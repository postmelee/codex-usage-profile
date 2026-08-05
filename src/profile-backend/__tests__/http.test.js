import assert from "node:assert/strict";
import test from "node:test";

import {
  CLI_DEVICE_CODE_PREFIX,
  CLI_LOGIN_STATUS,
  CLI_TOKEN_PREFIX,
  ACCOUNT_USAGE_DEVICE_ID_HEADER,
  ACCOUNT_USAGE_DEVICE_NAME_HEADER,
  DEFAULT_MAX_ACTIVE_CLI_TOKENS,
  DEFAULT_SESSION_COOKIE_NAME,
  PROFILE_BACKEND_ERROR_CODES,
  PROFILE_VISIBILITY,
  createAccountUsageRateLimiter,
  createCliTokenService,
  createMemoryProfileBackendStore,
  createProfileBackendError,
  createProfileBackendHttpHandler
} from "../index.js";
import { ACCOUNT_USAGE_CONTRACT_VERSION } from "../../profile-card/index.js";
import { sampleProfileSnapshot } from "../../profile-snapshot/fixtures/sample-snapshot.js";
import { sampleAccountUsageReadResult } from "../../profile-card/fixtures/sample-account-usage.js";
import {
  PROFILE_MEDIA_STORE_ERROR_CODES,
  createMemoryProfileMediaStore,
  createProfileMediaRevisionDigest,
  createProfileMediaStoreError
} from "../../profile-media/index.js";

const BASE_URL = "http://localhost";

test("handles GitHub callback owner upsert and optional CLI challenge approval", async () => {
  const fixture = createFixture();
  const start = await requestJson(fixture.handler, "POST", "/api/cli/login/start", {
    label: "macbook"
  });

  const response = await requestJson(fixture.handler, "POST", "/api/auth/github/callback", {
    code: "oauth_code_1",
    challengeId: start.body.data.challenge.id,
    visibility: PROFILE_VISIBILITY.PUBLIC
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.data.owner.id, "owner_github_12345");
  assert.equal(response.body.data.owner.handle, "postmelee");
  assert.equal(response.body.data.owner.visibility, PROFILE_VISIBILITY.PUBLIC);
  assert.equal(response.body.data.challenge.status, CLI_LOGIN_STATUS.APPROVED);
  assert.equal(
    fixture.store.getCliLoginChallenge(start.body.data.challenge.id).ownerId,
    "owner_github_12345"
  );
  assert.deepEqual(fixture.githubCalls, [
    ["exchange", "oauth_code_1"],
    ["user", "gho_1234567890abcdefghijklmnopqrstuv"]
  ]);
});

test("handles GitHub browser login redirect, callback session, and me lookup", async () => {
  const fixture = createFixture();
  const started = await requestJson(fixture.handler, "POST", "/api/cli/login/start", {
    label: "macbook",
    intent: "login"
  });
  const loginResponse = await requestResponse(
    fixture.handler,
    "GET",
    `/api/auth/github/login?cli_login_challenge=${started.body.data.challenge.id}&redirect_to=/u/postmelee`
  );
  const location = loginResponse.headers.get("location");
  const authorizationUrl = new URL(location);

  assert.equal(loginResponse.status, 302);
  assert.equal(
    `${authorizationUrl.origin}${authorizationUrl.pathname}`,
    "https://github.com/login/oauth/authorize"
  );
  assert.equal(authorizationUrl.searchParams.get("client_id"), "github_client_1");
  assert.equal(
    authorizationUrl.searchParams.get("redirect_uri"),
    "http://localhost/api/auth/github/callback"
  );
  assert.equal(authorizationUrl.searchParams.get("scope"), "read:user");

  const state = authorizationUrl.searchParams.get("state");
  const callback = await requestJson(
    fixture.handler,
    "GET",
    `/api/auth/github/callback?code=oauth_code_1&state=${state}`
  );
  const cookie = callback.headers.get("set-cookie");
  const me = await requestJson(
    fixture.handler,
    "GET",
    "/api/auth/me",
    undefined,
    { cookie }
  );

  assert.equal(callback.status, 200);
  assert.match(cookie, new RegExp(`${DEFAULT_SESSION_COOKIE_NAME}=session_`));
  assert.equal(callback.body.data.owner.id, "owner_github_12345");
  assert.equal(callback.body.data.session.ownerId, "owner_github_12345");
  assert.equal(callback.body.data.challenge.status, CLI_LOGIN_STATUS.APPROVED);
  assert.equal(callback.body.data.challenge.ownerId, "owner_github_12345");
  assert.equal(callback.body.data.redirectTo, "/u/postmelee");
  assert.equal(me.status, 200);
  assert.equal(me.body.data.owner.handle, "postmelee");
  assert.equal(me.body.data.session.ownerId, "owner_github_12345");
});

test("redirects GitHub browser callback back to the app with a session cookie", async () => {
  const fixture = createFixture();
  const loginResponse = await requestResponse(
    fixture.handler,
    "GET",
    "/api/auth/github/login?redirect_to=/settings",
    "",
    { accept: "text/html" }
  );
  const state = new URL(loginResponse.headers.get("location")).searchParams.get("state");
  const callback = await requestResponse(
    fixture.handler,
    "GET",
    `/api/auth/github/callback?code=oauth_code_1&state=${state}`,
    "",
    { accept: "text/html" }
  );

  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get("location"), "/settings");
  assert.match(callback.headers.get("set-cookie"), new RegExp(`${DEFAULT_SESSION_COOKIE_NAME}=session_`));
});

test("redirects browser GitHub login configuration errors back to settings", async () => {
  const handler = createProfileBackendHttpHandler({
    store: createMemoryProfileBackendStore()
  });
  const browserResponse = await requestResponse(
    handler,
    "GET",
    "/api/auth/github/login?redirect_to=/settings",
    "",
    { accept: "text/html" }
  );
  const apiResponse = await requestJson(
    handler,
    "GET",
    "/api/auth/github/login?redirect_to=/settings"
  );

  assert.equal(browserResponse.status, 302);
  assert.equal(
    browserResponse.headers.get("location"),
    "/settings?auth_error=github_oauth_not_configured"
  );
  assert.equal(apiResponse.status, 400);
  assert.equal(apiResponse.body.error.code, PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED);
});

test("allows only local OAuth return paths and never reflects external redirects", async () => {
  const fixture = createFixture();
  const local = await requestResponse(
    fixture.handler,
    "GET",
    "/api/auth/github/login?redirect_to=/settings%3Ftab%3Ddevices%23tokens"
  );
  const localStateId = new URL(local.headers.get("location")).searchParams.get("state");
  const external = await requestJson(
    fixture.handler,
    "GET",
    "/api/auth/github/login?redirect_to=https%3A%2F%2Fevil.example"
  );
  const protocolRelative = await requestResponse(
    fixture.handler,
    "GET",
    "/api/auth/github/login?redirect_to=%2F%2Fevil.example",
    "",
    { accept: "text/html" }
  );

  assert.equal(
    fixture.store.getOAuthState(localStateId).redirectTo,
    "/settings?tab=devices#tokens"
  );
  assert.equal(external.status, 400);
  assert.equal(external.body.error.code, PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED);
  assert.equal(protocolRelative.status, 302);
  assert.equal(
    protocolRelative.headers.get("location"),
    "/settings?auth_error=github_login_failed"
  );
});

test("denies explicit cross-origin API access without adding CORS headers", async () => {
  const fixture = createFixture();
  const response = await requestJson(
    fixture.handler,
    "GET",
    "/api/auth/me",
    undefined,
    { origin: "https://marketing.example" }
  );

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, PROFILE_BACKEND_ERROR_CODES.FORBIDDEN);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("rejects cross-site session mutation and accepts same-origin mutation", async () => {
  const fixture = createFixture();
  fixture.saveOwner();
  const cookie = fixture.saveSession();
  const crossSite = await requestJson(
    fixture.handler,
    "PATCH",
    "/api/profile",
    { visibility: PROFILE_VISIBILITY.PUBLIC },
    {
      cookie,
      origin: "https://attacker.example",
      "sec-fetch-site": "cross-site"
    }
  );
  const sameOrigin = await requestJson(
    fixture.handler,
    "PATCH",
    "/api/profile",
    { visibility: PROFILE_VISIBILITY.PUBLIC },
    {
      cookie,
      origin: BASE_URL,
      "sec-fetch-site": "same-origin"
    }
  );
  const crossSiteCardSettings = await requestJson(
    fixture.handler,
    "PATCH",
    "/api/profile/card-settings",
    {
      cardStyle: {
        schemaVersion: 1,
        theme: "light",
        effect: { preset: "none", version: 1 }
      },
      cardLocale: "en"
    },
    {
      cookie,
      origin: "https://attacker.example",
      "sec-fetch-site": "cross-site"
    }
  );

  assert.equal(crossSite.status, 403);
  assert.equal(crossSite.body.error.code, PROFILE_BACKEND_ERROR_CODES.FORBIDDEN);
  assert.equal(sameOrigin.status, 200);
  assert.equal(sameOrigin.body.data.visibility, PROFILE_VISIBILITY.PUBLIC);
  assert.equal(crossSiteCardSettings.status, 403);
  assert.equal(
    crossSiteCardSettings.body.error.code,
    PROFILE_BACKEND_ERROR_CODES.FORBIDDEN
  );
});

test("handles CLI login start, approve, and exchange without exposing token digest", async () => {
  const fixture = createFixture();
  fixture.saveOwner();
  const cookie = fixture.saveSession();

  const started = await requestJson(fixture.handler, "POST", "/api/cli/login/start", {
    label: "macbook",
    intent: "login"
  });
  const approved = await requestJson(
    fixture.handler,
    "POST",
    "/api/cli/login/approve",
    {
      challengeId: started.body.data.challenge.id,
      ownerId: "attacker_owner"
    },
    { cookie }
  );
  const exchanged = await requestJson(fixture.handler, "POST", "/api/cli/login/exchange", {
    challengeId: started.body.data.challenge.id
  });

  assert.equal(started.status, 201);
  assert.equal(started.body.data.browserUrl, "/api/auth/github/login?cli_login_challenge=cli_login_1");
  assert.equal(started.body.data.intent, "login");
  assert.equal(started.body.data.challenge.intent, "login");
  assert.equal(approved.body.data.challenge.status, CLI_LOGIN_STATUS.APPROVED);
  assert.equal(approved.body.data.challenge.ownerId, "owner_1");
  assert.equal(exchanged.status, 200);
  assert.equal(exchanged.body.data.token, `${CLI_TOKEN_PREFIX}test_1`);
  assert.equal(exchanged.body.data.challenge.status, CLI_LOGIN_STATUS.EXCHANGED);
  assert.equal(Object.hasOwn(exchanged.body.data.tokenRecord, "tokenDigest"), false);
  assert.equal(Object.hasOwn(exchanged.body.data.tokenRecord, "token"), false);
});

test("handles device login start, authorize, and poll token exchange", async () => {
  const fixture = createFixture();
  fixture.saveOwner();
  const cookie = fixture.saveSession();

  const started = await requestJson(fixture.handler, "POST", "/api/auth/device", {
    label: "macbook",
    intent: "submit"
  });
  const authorized = await requestJson(
    fixture.handler,
    "POST",
    "/api/auth/device/authorize",
    {
      userCode: "abcd1234"
    },
    { cookie }
  );
  const polled = await requestJson(
    fixture.handler,
    "POST",
    "/api/auth/device/poll",
    {
      deviceCode: started.body.data.deviceCode
    }
  );
  const reused = await requestJson(
    fixture.handler,
    "POST",
    "/api/auth/device/poll",
    {
      deviceCode: started.body.data.deviceCode
    }
  );
  const storedState = JSON.stringify(fixture.store.exportState());

  assert.equal(started.status, 201);
  assert.equal(started.body.data.deviceCode, `${CLI_DEVICE_CODE_PREFIX}test_1`);
  assert.equal(started.body.data.userCode, "ABCD-1234");
  assert.equal(started.body.data.intent, "submit");
  assert.equal(started.body.data.verificationUri, "/device");
  assert.equal(
    started.body.data.verificationUriComplete,
    "/device?user_code=ABCD-1234"
  );
  assert.equal(started.body.data.intervalSeconds, 5);
  assert.equal(started.body.data.challenge.userCode, "ABCD-1234");
  assert.equal(started.body.data.challenge.intent, "submit");
  assert.equal(JSON.stringify(started.body.data).includes("deviceCodeDigest"), false);

  assert.equal(authorized.status, 200);
  assert.deepEqual(authorized.body.data, {
    approvedAt: "2026-06-10T00:00:00.000Z",
    exchangedAt: null,
    intent: "submit",
    status: CLI_LOGIN_STATUS.APPROVED
  });

  assert.equal(polled.status, 200);
  assert.equal(polled.body.data.status, CLI_LOGIN_STATUS.APPROVED);
  assert.equal(polled.body.data.token, `${CLI_TOKEN_PREFIX}test_1`);
  assert.equal(polled.body.data.tokenRecord.ownerId, "owner_1");
  assert.equal(Object.hasOwn(polled.body.data.tokenRecord, "tokenDigest"), false);
  assert.equal(polled.body.data.challenge.status, CLI_LOGIN_STATUS.EXCHANGED);

  assert.equal(reused.status, 200);
  assert.equal(reused.body.data.status, CLI_LOGIN_STATUS.EXCHANGED);
  assert.equal(Object.hasOwn(reused.body.data, "token"), false);
  assert.equal(storedState.includes(polled.body.data.token), false);
  assert.equal(storedState.includes(started.body.data.deviceCode), false);
});

test("keeps missing device intent compatible and rejects unknown intent", async () => {
  const fixture = createFixture();
  const legacy = await requestJson(
    fixture.handler,
    "POST",
    "/api/auth/device",
    { label: "old-cli" }
  );
  const invalid = await requestJson(
    fixture.handler,
    "POST",
    "/api/auth/device",
    { intent: "publish" }
  );

  assert.equal(legacy.status, 201);
  assert.equal(legacy.body.data.intent, null);
  assert.equal(legacy.body.data.challenge.intent, null);
  assert.equal(invalid.status, 400);
  assert.equal(
    invalid.body.error.code,
    PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED
  );
});

test("handles settings token create, list, revoke, and revoked submit failure", async () => {
  const fixture = createFixture();
  fixture.saveOwner();
  const cookie = fixture.saveSession();

  const created = await requestJson(
    fixture.handler,
    "POST",
    "/api/settings/tokens",
    {
      label: "  CI token  "
    },
    { cookie }
  );
  const listed = await requestJson(
    fixture.handler,
    "GET",
    "/api/settings/tokens",
    undefined,
    { cookie }
  );
  const revoked = await requestJson(
    fixture.handler,
    "DELETE",
    `/api/settings/tokens/${created.body.data.tokenRecord.id}`,
    undefined,
    { cookie }
  );
  const listedAfterRevoke = await requestJson(
    fixture.handler,
    "GET",
    "/api/settings/tokens",
    undefined,
    { cookie }
  );
  const submitAfterRevoke = await requestJson(
    fixture.handler,
    "POST",
    "/api/snapshots/submit",
    {
      snapshot: sampleProfileSnapshot,
      capturedAt: sampleProfileSnapshot.capturedAt
    },
    { authorization: `Bearer ${created.body.data.token}` }
  );
  const storedState = JSON.stringify(fixture.store.exportState());

  assert.equal(created.status, 201);
  assert.equal(created.body.data.token, `${CLI_TOKEN_PREFIX}test_1`);
  assert.equal(created.body.data.tokenRecord.label, "CI token");
  assert.equal(Object.hasOwn(created.body.data.tokenRecord, "token"), false);
  assert.equal(Object.hasOwn(created.body.data.tokenRecord, "tokenDigest"), false);

  assert.equal(listed.status, 200);
  assert.equal(listed.body.data.tokens.length, 1);
  assert.equal(listed.body.data.tokens[0].id, created.body.data.tokenRecord.id);
  assert.equal(JSON.stringify(listed.body.data).includes(created.body.data.token), false);
  assert.equal(JSON.stringify(listed.body.data).includes("tokenDigest"), false);

  assert.equal(revoked.status, 200);
  assert.equal(revoked.body.data.tokenRecord.id, created.body.data.tokenRecord.id);
  assert.equal(revoked.body.data.tokenRecord.revokedAt, "2026-06-10T00:00:00.000Z");
  assert.equal(Object.hasOwn(revoked.body.data.tokenRecord, "tokenDigest"), false);
  assert.equal(listedAfterRevoke.body.data.tokens.length, 0);
  assert.equal(submitAfterRevoke.status, 410);
  assert.equal(submitAfterRevoke.body.error.code, PROFILE_BACKEND_ERROR_CODES.GONE);
  assert.equal(storedState.includes(created.body.data.token), false);
});

test("limits active settings and device-code tokens per owner", async () => {
  const fixture = createFixture();
  fixture.saveOwner();
  const cookie = fixture.saveSession();
  const createdTokens = [];

  for (let index = 0; index < DEFAULT_MAX_ACTIVE_CLI_TOKENS; index += 1) {
    const created = await requestJson(
      fixture.handler,
      "POST",
      "/api/settings/tokens",
      {
        label: `CI token ${index + 1}`
      },
      { cookie }
    );

    assert.equal(created.status, 201);
    createdTokens.push(created.body.data.tokenRecord);
  }

  const overflow = await requestJson(
    fixture.handler,
    "POST",
    "/api/settings/tokens",
    {
      label: "overflow"
    },
    { cookie }
  );
  const started = await requestJson(fixture.handler, "POST", "/api/auth/device", {
    label: "workstation"
  });
  await requestJson(
    fixture.handler,
    "POST",
    "/api/auth/device/authorize",
    {
      userCode: started.body.data.userCode
    },
    { cookie }
  );
  const pollAtLimit = await requestJson(
    fixture.handler,
    "POST",
    "/api/auth/device/poll",
    {
      deviceCode: started.body.data.deviceCode
    }
  );

  assert.equal(overflow.status, 409);
  assert.equal(overflow.body.error.code, PROFILE_BACKEND_ERROR_CODES.CONFLICT);
  assert.equal(pollAtLimit.status, 409);
  assert.equal(pollAtLimit.body.error.code, PROFILE_BACKEND_ERROR_CODES.CONFLICT);

  await requestJson(
    fixture.handler,
    "DELETE",
    `/api/settings/tokens/${createdTokens[0].id}`,
    undefined,
    { cookie }
  );
  const pollAfterRevoke = await requestJson(
    fixture.handler,
    "POST",
    "/api/auth/device/poll",
    {
      deviceCode: started.body.data.deviceCode
    }
  );
  const listed = await requestJson(
    fixture.handler,
    "GET",
    "/api/settings/tokens",
    undefined,
    { cookie }
  );

  assert.equal(pollAfterRevoke.status, 200);
  assert.equal(pollAfterRevoke.body.data.status, CLI_LOGIN_STATUS.APPROVED);
  assert.equal(
    pollAfterRevoke.body.data.tokenRecord.sourceChallengeId,
    started.body.data.challenge.id
  );
  assert.equal(listed.body.data.tokens.length, DEFAULT_MAX_ACTIVE_CLI_TOKENS);
});

test("lists device-code login tokens and rejects bearer-only settings management", async () => {
  const fixture = createFixture();
  fixture.saveOwner();
  const cookie = fixture.saveSession();

  const started = await requestJson(fixture.handler, "POST", "/api/auth/device", {
    label: "workstation"
  });
  await requestJson(
    fixture.handler,
    "POST",
    "/api/auth/device/authorize",
    {
      userCode: started.body.data.userCode
    },
    { cookie }
  );
  const polled = await requestJson(
    fixture.handler,
    "POST",
    "/api/auth/device/poll",
    {
      deviceCode: started.body.data.deviceCode
    }
  );
  const listed = await requestJson(
    fixture.handler,
    "GET",
    "/api/settings/tokens",
    undefined,
    { cookie }
  );
  const bearerOnly = await requestJson(
    fixture.handler,
    "GET",
    "/api/settings/tokens",
    undefined,
    { authorization: `Bearer ${polled.body.data.token}` }
  );

  assert.equal(polled.status, 200);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.data.tokens.length, 1);
  assert.equal(listed.body.data.tokens[0].id, polled.body.data.tokenRecord.id);
  assert.equal(listed.body.data.tokens[0].label, "workstation");
  assert.equal(listed.body.data.tokens[0].sourceChallengeId, started.body.data.challenge.id);
  assert.equal(bearerOnly.status, 401);
  assert.equal(bearerOnly.body.error.code, PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED);
});

test("rejects settings mutations without session cookies and ignores bearer credentials", async () => {
  const fixture = createFixture();
  fixture.saveOwner();
  const cookie = fixture.saveSession();
  const { token } = await fixture.issueToken({ label: "bearer" });
  const created = await requestJson(
    fixture.handler,
    "POST",
    "/api/settings/tokens",
    {
      label: "CI token"
    },
    { cookie }
  );

  await requestJson(
    fixture.handler,
    "POST",
    "/api/snapshots/submit",
    {
      snapshot: sampleProfileSnapshot,
      capturedAt: sampleProfileSnapshot.capturedAt,
      device: {
        id: "machine-1"
      }
    },
    { authorization: `Bearer ${token}` }
  );
  const devices = await requestJson(
    fixture.handler,
    "GET",
    "/api/settings/devices",
    undefined,
    { cookie }
  );
  const deviceId = devices.body.data.devices[0].id;
  const responses = [
    await requestJson(
      fixture.handler,
      "POST",
      "/api/settings/tokens",
      { label: "missing session" }
    ),
    await requestJson(
      fixture.handler,
      "POST",
      "/api/settings/tokens",
      { label: "bearer only" },
      { authorization: `Bearer ${token}` }
    ),
    await requestJson(
      fixture.handler,
      "DELETE",
      `/api/settings/tokens/${created.body.data.tokenRecord.id}`
    ),
    await requestJson(
      fixture.handler,
      "DELETE",
      `/api/settings/tokens/${created.body.data.tokenRecord.id}`,
      undefined,
      { authorization: `Bearer ${token}` }
    ),
    await requestJson(
      fixture.handler,
      "PATCH",
      `/api/settings/devices/${deviceId}`,
      { name: "No session" }
    ),
    await requestJson(
      fixture.handler,
      "PATCH",
      `/api/settings/devices/${deviceId}`,
      { name: "Bearer only" },
      { authorization: `Bearer ${token}` }
    )
  ];
  const listedAfterRejectedMutations = await requestJson(
    fixture.handler,
    "GET",
    "/api/settings/tokens",
    undefined,
    { cookie }
  );

  for (const response of responses) {
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED);
  }
  assert.equal(listedAfterRejectedMutations.body.data.tokens.length, 2);
  assert.equal(
    listedAfterRejectedMutations.body.data.tokens.some((item) => (
      item.id === created.body.data.tokenRecord.id
    )),
    true
  );
});

test("rejects device authorization without a session cookie", async () => {
  const fixture = createFixture();
  fixture.saveOwner();
  const started = await requestJson(fixture.handler, "POST", "/api/auth/device", {
    label: "macbook"
  });

  const response = await requestJson(
    fixture.handler,
    "POST",
    "/api/auth/device/authorize",
    {
      userCode: started.body.data.userCode
    }
  );

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED);
});

test("returns expired status while polling an expired device login", async () => {
  const fixture = createFixture();
  const started = await requestJson(fixture.handler, "POST", "/api/auth/device", {
    label: "macbook"
  });

  fixture.setNow(new Date("2026-06-10T00:10:00.000Z"));
  const response = await requestJson(
    fixture.handler,
    "POST",
    "/api/auth/device/poll",
    {
      deviceCode: started.body.data.deviceCode
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, CLI_LOGIN_STATUS.EXPIRED);
  assert.equal(response.body.data.challenge.status, CLI_LOGIN_STATUS.EXPIRED);
});

test("rejects CLI login approval without a session cookie", async () => {
  const fixture = createFixture();
  fixture.saveOwner();
  const started = await requestJson(fixture.handler, "POST", "/api/cli/login/start", {
    label: "macbook"
  });

  const response = await requestJson(
    fixture.handler,
    "POST",
    "/api/cli/login/approve",
    {
      challengeId: started.body.data.challenge.id,
      ownerId: "owner_1"
    }
  );

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, {
    ok: false,
    error: {
      code: PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED,
      message: "Session cookie is required"
    }
  });
});

test("handles session logout and revokes subsequent me lookup", async () => {
  const fixture = createFixture();
  fixture.saveOwner();
  const cookie = fixture.saveSession();
  const me = await requestJson(
    fixture.handler,
    "GET",
    "/api/auth/me",
    undefined,
    { cookie }
  );
  const logout = await requestJson(
    fixture.handler,
    "POST",
    "/api/auth/logout",
    {},
    { cookie }
  );
  const afterLogout = await requestJson(
    fixture.handler,
    "GET",
    "/api/auth/me",
    undefined,
    { cookie }
  );

  assert.equal(me.status, 200);
  assert.equal(me.body.data.owner.id, "owner_1");
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal(logout.body.data.session.revokedAt, "2026-06-10T00:00:00.000Z");
  assert.equal(afterLogout.status, 401);
  assert.equal(afterLogout.body.error.code, PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED);
});

test("returns the session owner's card profile metadata", async () => {
  const fixture = createFixture();
  fixture.saveOwner();
  fixture.saveLatestUsage();
  const cookie = fixture.saveSession();
  const unauthorized = await requestJson(fixture.handler, "GET", "/api/profile");
  const profile = await requestJson(
    fixture.handler, "GET", "/api/profile", undefined, { cookie }
  );
  assert.equal(unauthorized.status, 401);
  assert.equal(profile.status, 200);
  assert.equal(profile.body.data.owner.id, "owner_1");
  assert.equal(profile.body.data.visibility, PROFILE_VISIBILITY.PRIVATE);
  assert.deepEqual(profile.body.data.usage.usage, sampleAccountUsageReadResult);
  assert.equal(profile.body.data.publicCardUrl, `${BASE_URL}/u/postmelee/card.png`);
  assert.equal(profile.body.data.cardStyle.theme, "dark");
  assert.equal(profile.body.data.cardLocale, "en");
  assert.equal(
    profile.body.data.selectedPublicCardUrl,
    `${BASE_URL}/u/postmelee/card.png?theme=dark`
  );
});

test("serves a public Account Usage profile with an explicit response allowlist", async () => {
  const fixture = createFixture();
  fixture.saveOwner({
    displayName: "Post Melee",
    avatarUrl: "https://avatars.githubusercontent.com/u/12345",
    ownerSecret: "owner-internal"
  });
  fixture.saveLatestUsage({
    contentDigest: "digest-internal",
    revision: 42,
    localPath: "/Users/example/.codex"
  });
  const cookie = fixture.saveSession();
  await requestJson(
    fixture.handler, "PATCH", "/api/profile",
    { visibility: PROFILE_VISIBILITY.PUBLIC }, { cookie }
  );

  const response = await requestJson(
    fixture.handler,
    "GET",
    "/api/profiles/public/postmelee"
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(response.body.data, {
    owner: {
      displayName: "Post Melee",
      githubLogin: "postmelee",
      avatarUrl: "https://avatars.githubusercontent.com/u/12345",
      handle: "postmelee"
    },
    usage: {
      capturedAt: "2026-06-11T00:00:00.000Z",
      uploadedAt: "2026-06-11T00:01:00.000Z",
      usage: sampleAccountUsageReadResult
    },
    visibility: PROFILE_VISIBILITY.PUBLIC,
    cardLocale: "en",
    cardStyle: {
      schemaVersion: 1,
      theme: "dark",
      effect: { preset: "none", version: 1 }
    },
    presentationDigest: "4Pu_ghjqNSMCxM4CfBZvubJIeSIdlJmR_H71FnHYb5U",
    publicCardUrl: `${BASE_URL}/u/postmelee/card.png`,
    selectedPublicCardUrl: `${BASE_URL}/u/postmelee/card.png?theme=dark`,
    publicCardUrls: {
      light: `${BASE_URL}/u/postmelee/card.png?theme=light`,
      dark: `${BASE_URL}/u/postmelee/card.png?theme=dark`
    },
    publicCardVariantUrls: {
      en: {
        light: `${BASE_URL}/u/postmelee/card.png?theme=light`,
        dark: `${BASE_URL}/u/postmelee/card.png?theme=dark`
      },
      ko: {
        light: `${BASE_URL}/u/postmelee/card.png?theme=light&locale=ko`,
        dark: `${BASE_URL}/u/postmelee/card.png?theme=dark&locale=ko`
      }
    }
  });

  const serialized = JSON.stringify(response.body.data);
  for (const internalValue of [
    "owner_1",
    "owner-internal",
    "digest-internal",
    "/Users/example/.codex"
  ]) {
    assert.equal(serialized.includes(internalValue), false);
  }
  for (const internalKey of [
    "providerUserId",
    "ownerId",
    "contentDigest",
    "revision",
    "localPath"
  ]) {
    assert.equal(serialized.includes(`\"${internalKey}\"`), false);
  }
});

test("updates versioned owner card settings and validates the exact payload", async () => {
  const ensureCalls = [];
  const fixture = createFixture({
    ensureCardStyleMedia(options) {
      ensureCalls.push(options);
    }
  });
  fixture.saveOwner({ visibility: PROFILE_VISIBILITY.PUBLIC });
  fixture.saveLatestUsage({ visibility: PROFILE_VISIBILITY.PUBLIC });
  const cookie = fixture.saveSession();
  const light = {
    schemaVersion: 1,
    theme: "light",
    effect: { preset: "none", version: 1 }
  };

  const response = await requestJson(
    fixture.handler,
    "PATCH",
    "/api/profile/card-settings",
    { cardStyle: light, cardLocale: "ko" },
    { cookie }
  );
  const injected = await requestJson(
    fixture.handler,
    "PATCH",
    "/api/profile/card-settings",
    { ownerId: "owner_2", cardStyle: light, cardLocale: "ko" },
    { cookie }
  );
  const unknown = await requestJson(
    fixture.handler,
    "PATCH",
    "/api/profile/card-settings",
    {
      cardStyle: { ...light, effect: { preset: "beam.rotate", version: 1 } },
      cardLocale: "ko"
    },
    { cookie }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.cardStyle, light);
  assert.equal(response.body.data.cardLocale, "ko");
  assert.equal(
    response.body.data.selectedPublicCardUrl,
    `${BASE_URL}/u/postmelee/card.png?theme=light&locale=ko`
  );
  assert.deepEqual(fixture.store.getOwnerById("owner_1").cardStyle, light);
  assert.equal(fixture.store.getOwnerById("owner_1").cardLocale, "ko");
  assert.equal(ensureCalls.length, 1);
  assert.equal(ensureCalls[0].owner.id, "owner_1");
  assert.equal(ensureCalls[0].cardLocale, "ko");

  const localeOnly = await requestJson(
    fixture.handler,
    "PATCH",
    "/api/profile/card-settings",
    { cardStyle: light, cardLocale: "en" },
    { cookie }
  );
  assert.equal(localeOnly.status, 200);
  assert.equal(localeOnly.body.data.cardLocale, "en");
  assert.equal(
    localeOnly.body.data.selectedPublicCardUrl,
    `${BASE_URL}/u/postmelee/card.png?theme=light`
  );
  // A locale-only change still prepares media because the single social image
  // is rendered from the saved card locale.
  assert.equal(ensureCalls.length, 2);
  assert.equal(ensureCalls[1].cardLocale, "en");

  assert.equal(injected.status, 400);
  assert.equal(injected.body.error.code, PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED);
  assert.equal(unknown.status, 400);
  assert.equal(unknown.body.error.code, PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED);
});

test("hides non-public, missing, malformed, and mismatched public profiles", async () => {
  const privateFixture = createFixture();
  privateFixture.saveOwner();
  privateFixture.saveLatestUsage();

  const noUsageFixture = createFixture();
  noUsageFixture.saveOwner({ visibility: PROFILE_VISIBILITY.PUBLIC });

  const privateUsageFixture = createFixture();
  privateUsageFixture.saveOwner({ visibility: PROFILE_VISIBILITY.PUBLIC });
  privateUsageFixture.saveLatestUsage();

  const mismatchedFixture = createFixture();
  mismatchedFixture.saveOwner({ visibility: PROFILE_VISIBILITY.PUBLIC });
  mismatchedFixture.saveLatestUsage({
    handle: "other",
    visibility: PROFILE_VISIBILITY.PUBLIC
  });

  const responses = await Promise.all([
    requestJson(
      privateFixture.handler, "GET", "/api/profiles/public/postmelee"
    ),
    requestJson(
      privateFixture.handler, "GET", "/api/profiles/public/missing"
    ),
    requestJson(
      privateFixture.handler, "GET", "/api/profiles/public/%ZZ"
    ),
    requestJson(
      noUsageFixture.handler, "GET", "/api/profiles/public/postmelee"
    ),
    requestJson(
      privateUsageFixture.handler, "GET", "/api/profiles/public/postmelee"
    ),
    requestJson(
      mismatchedFixture.handler, "GET", "/api/profiles/public/postmelee"
    )
  ]);
  const expected = {
    ok: false,
    error: {
      code: PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
      message: "Card not found"
    }
  };

  for (const response of responses) {
    assert.equal(response.status, 404);
    assert.deepEqual(response.body, expected);
  }
});

test("updates only the session owner's card visibility", async () => {
  const fixture = createFixture();
  fixture.saveOwner();
  fixture.saveLatestUsage();
  const cookie = fixture.saveSession();
  fixture.store.saveOwner({
    id: "owner_2", authProvider: "github", providerUserId: "2",
    githubLogin: "other", handle: "other", visibility: PROFILE_VISIBILITY.PRIVATE
  });
  const injectedOwner = await requestJson(
    fixture.handler, "PATCH", "/api/profile",
    { ownerId: "owner_2", visibility: PROFILE_VISIBILITY.PUBLIC }, { cookie }
  );
  const response = await requestJson(
    fixture.handler, "PATCH", "/api/profile",
    { visibility: PROFILE_VISIBILITY.PUBLIC }, { cookie }
  );
  assert.equal(injectedOwner.status, 400);
  assert.equal(injectedOwner.body.error.code, PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED);
  assert.equal(response.status, 200);
  assert.equal(response.body.data.visibility, PROFILE_VISIBILITY.PUBLIC);
  assert.equal(
    fixture.store.getLatestUsageByOwnerId("owner_1").visibility,
    PROFILE_VISIBILITY.PUBLIC
  );
  assert.equal(fixture.store.getOwnerById("owner_2").visibility, PROFILE_VISIBILITY.PRIVATE);
});

test("delegates authenticated profile visibility to the publication service", async () => {
  const calls = [];
  const fixture = createFixture({
    createPublicationService(store) {
      return {
        async updateVisibility(options) {
          calls.push(options);
          const owner = store.saveOwner({
            ...store.getOwnerById(options.ownerId),
            visibility: options.visibility
          });
          const usageRecord = store.saveLatestUsage({
            ...store.getLatestUsageByOwnerId(options.ownerId),
            visibility: options.visibility
          });
          return { owner, usageRecord, visibility: options.visibility };
        }
      };
    }
  });
  fixture.saveOwner();
  fixture.saveLatestUsage();
  const cookie = fixture.saveSession();

  const response = await requestJson(
    fixture.handler,
    "PATCH",
    "/api/profile",
    { visibility: PROFILE_VISIBILITY.PUBLIC },
    { cookie }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{
    ownerId: "owner_1",
    visibility: PROFILE_VISIBILITY.PUBLIC
  }]);
  assert.equal(response.body.data.visibility, PROFILE_VISIBILITY.PUBLIC);
  assert.equal(response.body.data.publicCardUrl, `${BASE_URL}/u/postmelee/card.png`);
});

test("creates the publication service when a media store is configured", async () => {
  const mediaStore = createMemoryProfileMediaStore();
  const fixture = createFixture({
    mediaStore,
    profileCardRenderPng: async (viewModel) => Buffer.from(`card:${viewModel.locale}`)
  });
  fixture.saveOwner();
  fixture.saveLatestUsage();
  const cookie = fixture.saveSession();

  const response = await requestJson(
    fixture.handler,
    "PATCH",
    "/api/profile",
    { visibility: PROFILE_VISIBILITY.PUBLIC },
    { cookie }
  );
  const english = await mediaStore.getPublishedCard({ handle: "postmelee" });
  const korean = await mediaStore.getPublishedCard({
    handle: "postmelee",
    locale: "ko"
  });

  assert.equal(response.status, 200);
  assert.deepEqual(english.body, Buffer.from("card:en"));
  assert.deepEqual(korean.body, Buffer.from("card:ko"));
  assert.equal(response.body.data.visibility, PROFILE_VISIBILITY.PUBLIC);
});

test("saves a public card preference only after v4 theme variants converge", async () => {
  const mediaStore = createMemoryProfileMediaStore();
  const fixture = createFixture({
    mediaStore,
    profileCardRenderPng: async (viewModel) => Buffer.from(
      `card:${viewModel.theme}:${viewModel.locale}`
    )
  });
  fixture.saveOwner();
  fixture.saveLatestUsage();
  const cookie = fixture.saveSession();
  await requestJson(
    fixture.handler,
    "PATCH",
    "/api/profile",
    { visibility: PROFILE_VISIBILITY.PUBLIC },
    { cookie }
  );

  const light = {
    schemaVersion: 1,
    theme: "light",
    effect: { preset: "none", version: 1 }
  };
  const response = await requestJson(
    fixture.handler,
    "PATCH",
    "/api/profile/card-settings",
    { cardStyle: light, cardLocale: "ko" },
    { cookie }
  );
  const published = await mediaStore.getPublishedCard({
    handle: "postmelee",
    locale: "ko",
    theme: "light"
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.cardStyle, light);
  assert.equal(published.contractVersion, 4);
  assert.deepEqual(published.body, Buffer.from("card:light:ko"));
});

test("returns a generic 503 when profile publication is unavailable", async () => {
  const fixture = createFixture({
    createPublicationService() {
      return {
        async updateVisibility() {
          throw createProfileBackendError(
            PROFILE_BACKEND_ERROR_CODES.MEDIA_UNAVAILABLE,
            "Profile media is temporarily unavailable",
            {
              details: {
                compensation: "failed",
                internalEndpoint: "must-not-leak"
              }
            }
          );
        }
      };
    }
  });
  fixture.saveOwner();
  const cookie = fixture.saveSession();

  const response = await requestJson(
    fixture.handler,
    "PATCH",
    "/api/profile",
    { visibility: PROFILE_VISIBILITY.PUBLIC },
    { cookie }
  );

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("retry-after"), "5");
  assert.deepEqual(response.body, {
    ok: false,
    error: {
      code: PROFILE_BACKEND_ERROR_CODES.MEDIA_UNAVAILABLE,
      message: "Profile media is temporarily unavailable"
    }
  });
  assert.equal(JSON.stringify(response.body).includes("must-not-leak"), false);
});

test("serves a private owner preview without public caching", async () => {
  const mediaCalls = [];
  const mediaStore = wrapMediaStore(createMemoryProfileMediaStore(), {}, mediaCalls);
  const fixture = createFixture({ mediaStore });
  fixture.saveOwner();
  fixture.saveLatestUsage();
  const cookie = fixture.saveSession();
  const unauthorized = await requestResponse(
    fixture.handler, "GET", "/api/profile/card.png"
  );
  const response = await requestResponse(
    fixture.handler, "GET", "/api/profile/card.png?locale=ko", "", { cookie }
  );
  const lightResponse = await requestResponse(
    fixture.handler,
    "GET",
    "/api/profile/card.png?locale=ko&theme=light",
    "",
    { cookie }
  );
  const fallbackResponse = await requestResponse(
    fixture.handler,
    "GET",
    "/api/profile/card.png?locale=ko&theme=unsupported",
    "",
    { cookie }
  );
  const body = Buffer.from(await response.arrayBuffer());
  const lightBody = Buffer.from(await lightResponse.arrayBuffer());
  const fallbackBody = Buffer.from(await fallbackResponse.arrayBuffer());
  assert.equal(unauthorized.status, 401);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(body.subarray(1, 4).toString(), "PNG");
  assert.equal(lightResponse.headers.get("cache-control"), "private, no-store");
  assert.notDeepEqual(lightBody, body);
  assert.deepEqual(fallbackBody, body);
  assert.deepEqual(mediaCalls, []);
});

test("serves public GET and HEAD cards with ETag revalidation", async () => {
  const mediaStore = createMemoryProfileMediaStore();
  const fixture = createFixture({ mediaStore });
  fixture.saveOwner();
  fixture.saveLatestUsage();
  const cookie = fixture.saveSession();
  const privateResponse = await requestJson(
    fixture.handler, "GET", "/u/postmelee/card.png"
  );
  await requestJson(
    fixture.handler, "PATCH", "/api/profile",
    { visibility: PROFILE_VISIBILITY.PUBLIC }, { cookie }
  );
  const getResponse = await requestResponse(
    fixture.handler, "GET", "/u/postmelee/card.png?locale=ko"
  );
  const englishResponse = await requestResponse(
    fixture.handler, "GET", "/u/postmelee/card.png"
  );
  const fallbackResponse = await requestResponse(
    fixture.handler, "GET", "/u/postmelee/card.png?locale=unsupported"
  );
  const themeResponse = await requestResponse(
    fixture.handler, "GET", "/u/postmelee/card.png?theme=light"
  );
  const localizedThemeResponse = await requestResponse(
    fixture.handler, "GET", "/u/postmelee/card.png?theme=light&locale=ko"
  );
  const invalidThemeResponse = await requestResponse(
    fixture.handler, "GET", "/u/postmelee/card.png?theme=unsupported"
  );
  const etag = getResponse.headers.get("etag");
  const headResponse = await requestResponse(
    fixture.handler, "HEAD", "/u/postmelee/card.png?locale=ko"
  );
  const notModified = await requestResponse(
    fixture.handler, "GET", "/u/postmelee/card.png?locale=ko", "",
    { "if-none-match": etag }
  );
  assert.equal(privateResponse.status, 404);
  assert.deepEqual(privateResponse.body, {
    ok: false,
    error: { code: PROFILE_BACKEND_ERROR_CODES.NOT_FOUND, message: "Card not found" }
  });
  assert.equal(getResponse.status, 200);
  assert.equal(getResponse.headers.get("content-type"), "image/png");
  assert.equal(
    getResponse.headers.get("cache-control"),
    "public, no-cache, must-revalidate"
  );
  assert.match(etag, /^"[A-Za-z0-9_-]{43}"$/);
  assert.equal(fallbackResponse.headers.get("etag"), englishResponse.headers.get("etag"));
  assert.equal(themeResponse.status, 200);
  assert.notEqual(
    themeResponse.headers.get("etag"),
    englishResponse.headers.get("etag")
  );
  assert.equal(localizedThemeResponse.status, 200);
  assert.notEqual(localizedThemeResponse.headers.get("etag"), etag);
  assert.notEqual(
    localizedThemeResponse.headers.get("etag"),
    themeResponse.headers.get("etag")
  );
  assert.equal(invalidThemeResponse.status, 404);
  assert.notEqual(englishResponse.headers.get("etag"), etag);
  assert.equal(headResponse.status, 200);
  assert.equal(headResponse.headers.get("etag"), etag);
  assert.equal((await headResponse.arrayBuffer()).byteLength, 0);
  assert.equal(notModified.status, 304);
  assert.equal(notModified.headers.get("etag"), etag);
  assert.equal((await notModified.arrayBuffer()).byteLength, 0);

  await requestJson(
    fixture.handler, "PATCH", "/api/profile",
    { visibility: PROFILE_VISIBILITY.PRIVATE }, { cookie }
  );
  const hiddenAgain = await requestJson(
    fixture.handler, "GET", "/u/postmelee/card.png"
  );
  const missing = await requestJson(fixture.handler, "GET", "/u/missing/card.png");
  assert.equal(hiddenAgain.status, 404);
  assert.deepEqual(hiddenAgain.body, missing.body);
});

test("serves public cards without reading the structured store or renderer", async () => {
  const baseMediaStore = createMemoryProfileMediaStore();
  await publishThemeMediaFixture(baseMediaStore, { handle: "media-only" });
  const mediaCalls = [];
  const mediaStore = wrapMediaStore(baseMediaStore, {}, mediaCalls);
  const forbiddenStore = new Proxy(createMemoryProfileBackendStore(), {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;
      return () => { throw new Error(`structured store access: ${String(property)}`); };
    }
  });
  const cardService = {
    getOwnerProfile() { throw new Error("card service access"); },
    renderOwnerCard() { throw new Error("renderer access"); },
    renderPublicCard() { throw new Error("public renderer access"); },
    updateVisibility() { throw new Error("card visibility access"); }
  };
  const handler = createProfileBackendHttpHandler({
    store: forbiddenStore,
    cardService,
    mediaStore,
    publicationService: {
      updateVisibility() { throw new Error("publication mutation access"); }
    }
  });

  const response = await requestResponse(
    handler,
    "GET",
    "/u/media-only/card.png?locale=ko&theme=light"
  );

  assert.equal(response.status, 200);
  assert.deepEqual(
    Buffer.from(await response.arrayBuffer()),
    Buffer.from("media:light:ko")
  );
  assert.deepEqual(mediaCalls, [["getPublishedCard", {
    handle: "media-only",
    locale: "ko",
    theme: "light",
    ifNoneMatch: null,
    includeBody: true
  }]]);
});

test("maps missing, malformed, invalid, and conflicting public media to the same 404", async () => {
  const missingFixture = createFixture({
    mediaStore: createMemoryProfileMediaStore()
  });
  const baseMediaStore = createMemoryProfileMediaStore();
  await publishMediaFixture(baseMediaStore, { handle: "postmelee" });
  const invalidFixture = createFixture({
    mediaStore: wrapMediaStore(baseMediaStore, {
      async getPublishedCard() {
        throw createProfileMediaStoreError(
          PROFILE_MEDIA_STORE_ERROR_CODES.INVALID,
          "secret invalid metadata"
        );
      }
    })
  });
  const conflictFixture = createFixture({
    mediaStore: wrapMediaStore(baseMediaStore, {
      async getPublishedCard() {
        throw createProfileMediaStoreError(
          PROFILE_MEDIA_STORE_ERROR_CODES.CONFLICT,
          "secret publication conflict"
        );
      }
    })
  });
  const malformedFixture = createFixture({
    mediaStore: wrapMediaStore(baseMediaStore, {
      async getPublishedCard() {
        return {
          body: Buffer.from("media"),
          cacheControl: "private",
          contentType: "application/octet-stream",
          etag: "storage-secret",
          notModified: false
        };
      }
    })
  });
  const missingLocaleFixture = createFixture({
    mediaStore: wrapMediaStore(baseMediaStore, {
      async getPublishedCard(options) {
        if (options.locale === "ko") {
          const error = new Error("referenced revision missing");
          error.code = "not_found";
          throw error;
        }
        return baseMediaStore.getPublishedCard(options);
      }
    })
  });

  const responses = await Promise.all([
    requestJson(missingFixture.handler, "GET", "/u/postmelee/card.png"),
    requestJson(invalidFixture.handler, "GET", "/u/postmelee/card.png"),
    requestJson(conflictFixture.handler, "GET", "/u/postmelee/card.png"),
    requestJson(malformedFixture.handler, "GET", "/u/postmelee/card.png"),
    requestJson(missingLocaleFixture.handler, "HEAD", "/u/postmelee/card.png?locale=ko"),
    requestJson(missingLocaleFixture.handler, "GET", "/u/%2F/card.png")
  ]);
  const expected = {
    ok: false,
    error: {
      code: PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
      message: "Card not found"
    }
  };

  for (const [index, response] of responses.entries()) {
    assert.equal(response.status, 404, `response ${index}`);
    assert.deepEqual(response.body, expected);
    assert.equal(JSON.stringify(response.body).includes("secret"), false);
  }
});

test("maps transient and unexpected public media failures to a generic 503", async () => {
  const baseMediaStore = createMemoryProfileMediaStore();
  const fixtures = [
    createFixture({
      mediaStore: wrapMediaStore(baseMediaStore, {
        async getPublishedCard() {
          throw createProfileMediaStoreError(
            PROFILE_MEDIA_STORE_ERROR_CODES.UNAVAILABLE,
            "secret storage endpoint"
          );
        }
      })
    }),
    createFixture({
      mediaStore: wrapMediaStore(baseMediaStore, {
        async getPublishedCard() {
          throw new Error("secret unexpected adapter failure");
        }
      })
    })
  ];

  for (const fixture of fixtures) {
    const response = await requestJson(
      fixture.handler,
      "GET",
      "/u/postmelee/card.png"
    );

    assert.equal(response.status, 503);
    assert.equal(response.headers.get("retry-after"), "5");
    assert.deepEqual(response.body, {
      ok: false,
      error: {
        code: PROFILE_BACKEND_ERROR_CODES.MEDIA_UNAVAILABLE,
        message: "Profile media is temporarily unavailable"
      }
    });
    assert.equal(JSON.stringify(response.body).includes("secret"), false);
  }
});

test("handles bearer snapshot submit and public handle lookup", async () => {
  const fixture = createFixture();
  fixture.saveOwner();
  const { token } = await fixture.issueToken();

  const submitted = await requestJson(
    fixture.handler,
    "POST",
    "/api/snapshots/submit",
    {
      snapshot: sampleProfileSnapshot,
      capturedAt: sampleProfileSnapshot.capturedAt,
      visibility: PROFILE_VISIBILITY.PUBLIC
    },
    { authorization: `Bearer ${token}` }
  );
  const publicSnapshot = await requestJson(
    fixture.handler,
    "GET",
    "/api/snapshots/public/postmelee"
  );

  assert.equal(submitted.status, 201);
  assert.equal(submitted.body.data.snapshot.ownerId, "owner_1");
  assert.equal(submitted.body.data.snapshot.uploadedAt, "2026-06-10T00:00:00.000Z");
  assert.equal(publicSnapshot.status, 200);
  assert.equal(publicSnapshot.body.data.snapshot.handle, "postmelee");
  assert.deepEqual(publicSnapshot.body.data.snapshot.snapshot, sampleProfileSnapshot);
});

test("submits Account Usage Contract v1 and returns metadata-only status", async () => {
  const fixture = createFixture();
  fixture.saveOwner();
  const { token } = await fixture.issueToken({ label: "account usage" });
  const document = createAccountUsageDocument();
  const headers = {
    authorization: `Bearer ${token}`,
    [ACCOUNT_USAGE_DEVICE_ID_HEADER]: "macbook-pro",
    [ACCOUNT_USAGE_DEVICE_NAME_HEADER]: "Office Mac"
  };

  const submitted = await requestJson(
    fixture.handler,
    "POST",
    "/api/account-usage/submit",
    document,
    headers
  );
  const repeated = await requestJson(
    fixture.handler,
    "POST",
    "/api/account-usage/submit",
    document,
    headers
  );
  const status = await requestJson(
    fixture.handler,
    "GET",
    "/api/account-usage/status",
    undefined,
    { authorization: `Bearer ${token}` }
  );
  const stored = fixture.store.getLatestUsageByOwnerId("owner_1");
  const serializedResponses = JSON.stringify({
    submitted: submitted.body,
    repeated: repeated.body,
    status: status.body
  });

  assert.equal(submitted.status, 201);
  assert.equal(submitted.body.data.submission.status, "accepted");
  assert.equal(submitted.body.data.submission.contractVersion, 1);
  assert.match(submitted.body.data.submission.revision, /^usage_/);
  assert.equal(submitted.body.data.profile.handle, "postmelee");
  assert.equal(
    submitted.body.data.profile.imageUrl,
    `${BASE_URL}/u/postmelee/card.png`
  );
  assert.equal(
    submitted.body.data.profile.readmeMarkdown,
    `![Codex usage profile](${BASE_URL}/u/postmelee/card.png)`
  );
  assert.equal(submitted.body.data.device.deviceKey, "macbook-pro");
  assert.equal(submitted.body.data.device.displayName, "Office Mac");
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.data.submission.status, "unchanged");
  assert.equal(repeated.body.data.submission.idempotent, true);

  assert.equal(status.status, 200);
  assert.equal(status.body.data.account.handle, "postmelee");
  assert.equal(status.body.data.latestUsage.capturedAt, document.capturedAt);
  assert.equal(status.body.data.latestUsage.revision, submitted.body.data.submission.revision);
  assert.equal(stored.contractVersion, ACCOUNT_USAGE_CONTRACT_VERSION);
  assert.deepEqual(stored.usage, {
    summary: document.summary,
    dailyUsageBuckets: document.dailyUsageBuckets
  });
  assert.equal(serializedResponses.includes("lifetimeTokens"), false);
  assert.equal(serializedResponses.includes(token), false);
});

test("refreshes public media after accepted and exact idempotent Account Usage submits", async () => {
  const calls = [];
  const fixture = createFixture({
    publicationService: {
      async refreshPublishedCard(options) {
        calls.push(options);
        return { operation: "publish" };
      },
      async updateVisibility() {
        throw new Error("not used");
      }
    }
  });
  fixture.saveOwner({ visibility: PROFILE_VISIBILITY.PUBLIC });
  const { token } = await fixture.issueToken();
  const headers = { authorization: `Bearer ${token}` };
  const document = createAccountUsageDocument();

  const accepted = await requestJson(
    fixture.handler,
    "POST",
    "/api/account-usage/submit",
    document,
    headers
  );
  const repeated = await requestJson(
    fixture.handler,
    "POST",
    "/api/account-usage/submit",
    document,
    headers
  );

  assert.equal(accepted.status, 201);
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.data.submission.idempotent, true);
  assert.deepEqual(calls, [
    { ownerId: "owner_1" },
    { ownerId: "owner_1" }
  ]);
});

test("preserves committed usage and recovers media on an exact retry", async () => {
  const baseMediaStore = createMemoryProfileMediaStore();
  let failNextWrite = true;
  const mediaStore = wrapMediaStore(baseMediaStore, {
    async putRevision(options) {
      if (failNextWrite) {
        failNextWrite = false;
        throw createProfileMediaStoreError(
          "unavailable",
          "injected media write failure"
        );
      }
      return baseMediaStore.putRevision(options);
    }
  });
  const fixture = createFixture({
    mediaStore,
    profileCardRenderPng: async (viewModel) => Buffer.from(
      `card:${viewModel.locale}:${viewModel.usage.summary.lifetimeTokens}`
    )
  });
  fixture.saveOwner({ visibility: PROFILE_VISIBILITY.PUBLIC });
  const { token } = await fixture.issueToken();
  const headers = { authorization: `Bearer ${token}` };
  const document = createAccountUsageDocument();

  const failedRefresh = await requestJson(
    fixture.handler,
    "POST",
    "/api/account-usage/submit",
    document,
    headers
  );
  const committed = fixture.store.getLatestUsageByOwnerId("owner_1");
  const recovered = await requestJson(
    fixture.handler,
    "POST",
    "/api/account-usage/submit",
    document,
    headers
  );
  const published = await baseMediaStore.getPublishedCard({
    handle: "postmelee"
  });

  assert.equal(failedRefresh.status, 503);
  assert.equal(failedRefresh.headers.get("retry-after"), "5");
  assert.deepEqual(failedRefresh.body, {
    ok: false,
    error: {
      code: PROFILE_BACKEND_ERROR_CODES.MEDIA_UNAVAILABLE,
      message: "Profile media is temporarily unavailable"
    }
  });
  assert.equal(committed.capturedAt, document.capturedAt);
  assert.equal(recovered.status, 200);
  assert.equal(recovered.body.data.submission.idempotent, true);
  assert.notEqual(published, null);
});

test("rejects Account Usage conflicts and invalid HTTP bodies", async () => {
  const fixture = createFixture();
  fixture.saveOwner();
  const { token } = await fixture.issueToken();
  const authorization = { authorization: `Bearer ${token}` };
  const document = createAccountUsageDocument();

  const submitted = await requestJson(
    fixture.handler,
    "POST",
    "/api/account-usage/submit",
    document,
    authorization
  );
  const conflict = await requestJson(
    fixture.handler,
    "POST",
    "/api/account-usage/submit",
    createAccountUsageDocument({
      summary: {
        ...document.summary,
        lifetimeTokens: document.summary.lifetimeTokens + 1
      }
    }),
    authorization
  );
  const wrongContentType = await requestRaw(
    fixture.handler,
    "POST",
    "/api/account-usage/submit",
    JSON.stringify(document),
    {
      ...authorization,
      "content-type": "text/plain"
    }
  );
  const oversized = await requestRaw(
    fixture.handler,
    "POST",
    "/api/account-usage/submit",
    JSON.stringify({ ...document, padding: "x".repeat(70 * 1024) }),
    {
      ...authorization,
      "content-type": "application/json"
    }
  );

  assert.equal(submitted.status, 201);
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error.code, PROFILE_BACKEND_ERROR_CODES.CONFLICT);
  assert.equal(wrongContentType.status, 415);
  assert.equal(wrongContentType.body.error.code, PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST);
  assert.equal(oversized.status, 413);
  assert.equal(oversized.body.error.code, PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST);
});

test("returns conflict and Retry-After responses for Account Usage submit", async () => {
  const rateLimitNow = () => new Date("2026-06-10T00:00:00.000Z");
  const fixture = createFixture({
    accountUsageRateLimiter: createAccountUsageRateLimiter({
      now: rateLimitNow,
      burstLimit: 2,
      burstWindowMs: 10_000,
      sustainedLimit: 4,
      sustainedWindowMs: 60_000
    })
  });
  fixture.saveOwner();
  const { token } = await fixture.issueToken();
  const headers = { authorization: `Bearer ${token}` };
  const document = createAccountUsageDocument();

  const accepted = await requestJson(
    fixture.handler,
    "POST",
    "/api/account-usage/submit",
    document,
    headers
  );
  const conflict = await requestJson(
    fixture.handler,
    "POST",
    "/api/account-usage/submit",
    createAccountUsageDocument({
      summary: {
        ...document.summary,
        peakDailyTokens: document.summary.peakDailyTokens + 1
      }
    }),
    headers
  );
  const rateLimited = await requestJson(
    fixture.handler,
    "POST",
    "/api/account-usage/submit",
    document,
    headers
  );

  assert.equal(accepted.status, 201);
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error.code, PROFILE_BACKEND_ERROR_CODES.CONFLICT);
  assert.equal(rateLimited.status, 429);
  assert.equal(rateLimited.body.error.code, PROFILE_BACKEND_ERROR_CODES.RATE_LIMITED);
  assert.equal(rateLimited.headers.get("retry-after"), "10");
});

test("handles settings device list and rename after submit", async () => {
  const fixture = createFixture();
  fixture.saveOwner();
  const cookie = fixture.saveSession();
  const { token } = await fixture.issueToken();

  await requestJson(
    fixture.handler,
    "POST",
    "/api/snapshots/submit",
    {
      snapshot: sampleProfileSnapshot,
      capturedAt: sampleProfileSnapshot.capturedAt,
      visibility: PROFILE_VISIBILITY.PUBLIC,
      device: {
        id: "machine-1",
        name: "Office Mac"
      }
    },
    { authorization: `Bearer ${token}` }
  );
  const listed = await requestJson(
    fixture.handler,
    "GET",
    "/api/settings/devices",
    undefined,
    { cookie }
  );
  const device = listed.body.data.devices[0];
  const renamed = await requestJson(
    fixture.handler,
    "PATCH",
    `/api/settings/devices/${device.id}`,
    {
      name: "  Desk Mac  "
    },
    { cookie }
  );
  const reset = await requestJson(
    fixture.handler,
    "PATCH",
    `/api/settings/devices/${device.id}`,
    {
      name: ""
    },
    { cookie }
  );

  assert.equal(listed.status, 200);
  assert.equal(device.deviceKey, "machine-1");
  assert.equal(device.displayName, "Office Mac");
  assert.equal(device.customName, "Office Mac");
  assert.equal(device.lastSubmittedAt, "2026-06-10T00:00:00.000Z");
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.data.device.displayName, "Desk Mac");
  assert.equal(renamed.body.data.device.customName, "Desk Mac");
  assert.equal(reset.status, 200);
  assert.equal(reset.body.data.device.displayName, "Unnamed device");
  assert.equal(reset.body.data.device.customName, null);
});

test("rejects settings device management without session ownership", async () => {
  const fixture = createFixture();
  fixture.saveOwner();
  const ownerCookie = fixture.saveSession();
  fixture.store.saveOwner({
    id: "owner_2",
    authProvider: "github",
    providerUserId: "2",
    githubLogin: "other",
    handle: "other",
    visibility: PROFILE_VISIBILITY.PRIVATE
  });
  const otherCookie = fixture.saveSession("owner_2", { id: "session_2" });
  const { token } = await fixture.issueToken();

  await requestJson(
    fixture.handler,
    "POST",
    "/api/snapshots/submit",
    {
      snapshot: sampleProfileSnapshot,
      capturedAt: sampleProfileSnapshot.capturedAt,
      device: {
        id: "machine-1"
      }
    },
    { authorization: `Bearer ${token}` }
  );
  const listed = await requestJson(
    fixture.handler,
    "GET",
    "/api/settings/devices",
    undefined,
    { cookie: ownerCookie }
  );
  const missingSession = await requestJson(
    fixture.handler,
    "GET",
    "/api/settings/devices"
  );
  const crossOwner = await requestJson(
    fixture.handler,
    "PATCH",
    `/api/settings/devices/${listed.body.data.devices[0].id}`,
    {
      name: "Other"
    },
    { cookie: otherCookie }
  );
  const invalidName = await requestJson(
    fixture.handler,
    "PATCH",
    `/api/settings/devices/${listed.body.data.devices[0].id}`,
    {
      name: "bad\nname"
    },
    { cookie: ownerCookie }
  );

  assert.equal(missingSession.status, 401);
  assert.equal(missingSession.body.error.code, PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED);
  assert.equal(crossOwner.status, 404);
  assert.equal(crossOwner.body.error.code, PROFILE_BACKEND_ERROR_CODES.NOT_FOUND);
  assert.equal(invalidName.status, 400);
  assert.equal(invalidName.body.error.code, PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED);
});

test("hides private snapshots behind the same not found response", async () => {
  const fixture = createFixture();
  fixture.saveOwner();
  const { token } = await fixture.issueToken();

  await requestJson(
    fixture.handler,
    "POST",
    "/api/snapshots/submit",
    {
      snapshot: sampleProfileSnapshot,
      capturedAt: sampleProfileSnapshot.capturedAt,
      visibility: PROFILE_VISIBILITY.PRIVATE
    },
    { authorization: `Bearer ${token}` }
  );
  const response = await requestJson(
    fixture.handler,
    "GET",
    "/api/snapshots/public/postmelee"
  );

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    ok: false,
    error: {
      code: PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
      message: "Snapshot not found"
    }
  });
});

test("returns stable errors for malformed JSON, missing auth, and unsupported routes", async () => {
  const fixture = createFixture();
  const malformed = await requestRaw(
    fixture.handler,
    "POST",
    "/api/cli/login/start",
    "{not-json"
  );
  const missingAuth = await requestJson(
    fixture.handler,
    "POST",
    "/api/snapshots/submit",
    {
      snapshot: sampleProfileSnapshot,
      capturedAt: sampleProfileSnapshot.capturedAt
    }
  );
  const missingRoute = await requestJson(
    fixture.handler,
    "GET",
    "/api/does-not-exist"
  );

  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.error.code, PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST);
  assert.equal(missingAuth.status, 401);
  assert.equal(missingAuth.body.error.code, PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED);
  assert.equal(missingRoute.status, 404);
  assert.equal(missingRoute.body.error.code, PROFILE_BACKEND_ERROR_CODES.NOT_FOUND);
});

test("returns validation errors from submit payloads", async () => {
  const fixture = createFixture();
  fixture.saveOwner();
  const { token } = await fixture.issueToken();
  const invalidSnapshot = structuredClone(sampleProfileSnapshot);
  delete invalidSnapshot.schemaVersion;

  const response = await requestJson(
    fixture.handler,
    "POST",
    "/api/snapshots/submit",
    {
      snapshot: invalidSnapshot,
      capturedAt: sampleProfileSnapshot.capturedAt
    },
    { authorization: `Bearer ${token}` }
  );

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    ok: false,
    error: {
      code: PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
      message: "Snapshot payload is invalid"
    }
  });
});

function createFixture(options = {}) {
  const store = createMemoryProfileBackendStore();
  let current = new Date("2026-06-10T00:00:00.000Z");
  const createId = createIdFactory();
  const createToken = createTokenFactory();
  const createDeviceCode = createDeviceCodeFactory();
  const createUserCode = createUserCodeFactory();
  const tokenService = createCliTokenService({
    store,
    now: () => current,
    createId,
    createToken
  });
  const githubCalls = [];
  const publicationService = typeof options.createPublicationService === "function"
    ? options.createPublicationService(store)
    : options.publicationService;
  const handler = createProfileBackendHttpHandler({
    store,
    tokenService,
    now: () => current,
    createId,
    createToken,
    createDeviceCode,
    createUserCode,
    githubClientId: "github_client_1",
    publicBaseUrl: BASE_URL,
    githubClient: {
      async exchangeCodeForToken(code) {
        githubCalls.push(["exchange", code]);
        return { accessToken: "gho_1234567890abcdefghijklmnopqrstuv" };
      },
      async getAuthenticatedUser(accessToken) {
        githubCalls.push(["user", accessToken]);
        return {
          id: 12345,
          login: "postmelee",
          name: "Post Melee",
          avatar_url: "https://avatars.githubusercontent.com/u/12345",
          html_url: "https://github.com/postmelee"
        };
      }
    },
    accountUsageBodyMaxBytes: options.accountUsageBodyMaxBytes,
    accountUsageRateLimiter: options.accountUsageRateLimiter,
    mediaStore: options.mediaStore,
    profileCardRenderPng: options.profileCardRenderPng ??
      (async (viewModel) => Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        Buffer.from(`:${viewModel.locale}:${viewModel.theme}`)
      ])),
    profileCardRendererVersion: "http-test-renderer-1",
    ensureCardStyleMedia: options.ensureCardStyleMedia,
    publicationService
  });

  return {
    store,
    handler,
    githubCalls,
    async issueToken(options = {}) {
      return await tokenService.issueCliToken({
        ownerId: "owner_1",
        ...options
      });
    },
    saveOwner(overrides = {}) {
      store.saveOwner({
        id: "owner_1",
        authProvider: "github",
        providerUserId: "1",
        githubLogin: "postmelee",
        handle: "postmelee",
        visibility: PROFILE_VISIBILITY.PRIVATE,
        ...overrides
      });
    },
    saveLatestUsage(overrides = {}) {
      return store.saveLatestUsage({
        ownerId: "owner_1",
        handle: "postmelee",
        visibility: PROFILE_VISIBILITY.PRIVATE,
        capturedAt: "2026-06-11T00:00:00.000Z",
        uploadedAt: "2026-06-11T00:01:00.000Z",
        usage: sampleAccountUsageReadResult,
        ...overrides
      });
    },
    saveSession(ownerId = "owner_1", overrides = {}) {
      const session = store.saveSession({
        id: overrides.id ?? "session_1",
        ownerId,
        createdAt: overrides.createdAt ?? "2026-06-10T00:00:00.000Z",
        expiresAt: overrides.expiresAt ?? "2026-07-10T00:00:00.000Z",
        revokedAt: overrides.revokedAt ?? null
      });

      return `${DEFAULT_SESSION_COOKIE_NAME}=${session.id}`;
    },
    setNow(value) {
      current = value;
    }
  };
}

async function publishMediaFixture(mediaStore, options = {}) {
  const ownerId = options.ownerId ?? "owner_media";
  const handle = options.handle ?? "postmelee";
  const representations = {};
  for (const locale of ["en", "ko"]) {
    const body = Buffer.from(`media:${locale}`);
    const revision = createProfileMediaRevisionDigest(body);
    const etag = `"${revision}"`;
    await mediaStore.putRevision({
      body,
      createdAt: "2026-07-22T00:00:00.000Z",
      etag,
      locale,
      ownerId,
      revision
    });
    representations[locale] = { etag, revision };
  }
  return mediaStore.publishRevision({
    handle,
    ownerId,
    publicationId: "profile_media_fixture",
    publishedAt: "2026-07-22T00:01:00.000Z",
    representations
  });
}

async function publishThemeMediaFixture(mediaStore, options = {}) {
  const ownerId = options.ownerId ?? "owner_media";
  const handle = options.handle ?? "postmelee";
  const presentationDigest = createProfileMediaRevisionDigest(
    Buffer.from("presentation-v1")
  );
  const representations = {};
  for (const theme of ["dark", "light"]) {
    representations[theme] = {};
    for (const locale of ["en", "ko"]) {
      const body = Buffer.from(`media:${theme}:${locale}`);
      const revision = createProfileMediaRevisionDigest(body);
      const etag = `"${revision}"`;
      await mediaStore.putRevision({
        body,
        contractVersion: 4,
        createdAt: "2026-07-22T00:00:00.000Z",
        etag,
        locale,
        ownerId,
        presentationDigest,
        revision,
        theme
      });
      representations[theme][locale] = { etag, revision };
    }
  }
  return mediaStore.publishRevision({
    contractVersion: 4,
    handle,
    ownerId,
    presentationDigest,
    publicationId: "profile_media_theme_fixture",
    publishedAt: "2026-07-22T00:01:00.000Z",
    representations
  });
}

function wrapMediaStore(base, overrides = {}, calls = null) {
  return Object.fromEntries([
    "getPublishedCard",
    "getRevision",
    "inspectStableCard",
    "publishRevision",
    "putRevision",
    "unpublishCard"
  ].map((method) => [method, async (...args) => {
    if (calls) calls.push([method, ...args]);
    if (typeof overrides[method] === "function") {
      return overrides[method](...args);
    }
    return base[method](...args);
  }]));
}

function createAccountUsageDocument(overrides = {}) {
  return {
    contractVersion: ACCOUNT_USAGE_CONTRACT_VERSION,
    capturedAt: "2026-06-10T00:00:00.000Z",
    summary: structuredClone(sampleAccountUsageReadResult.summary),
    dailyUsageBuckets: structuredClone(sampleAccountUsageReadResult.dailyUsageBuckets),
    ...overrides
  };
}

async function requestJson(handler, method, path, body, headers = {}) {
  return requestRaw(
    handler,
    method,
    path,
    body === undefined ? "" : JSON.stringify(body),
    {
      "content-type": "application/json",
      ...headers
    }
  );
}

async function requestRaw(handler, method, path, body = "", headers = {}) {
  const response = await requestResponse(handler, method, path, body, headers);

  return {
    status: response.status,
    headers: response.headers,
    body: await response.json()
  };
}

async function requestResponse(handler, method, path, body = "", headers = {}) {
  return handler(new Request(`${BASE_URL}${path}`, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : body
  }));
}

function createIdFactory() {
  let nextId = 1;
  return (prefix) => {
    const id = `${prefix}_${nextId}`;
    nextId += 1;
    return id;
  };
}

function createTokenFactory() {
  let nextToken = 1;
  return () => {
    const token = `${CLI_TOKEN_PREFIX}test_${nextToken}`;
    nextToken += 1;
    return token;
  };
}

function createDeviceCodeFactory() {
  let nextDeviceCode = 1;
  return () => {
    const deviceCode = `${CLI_DEVICE_CODE_PREFIX}test_${nextDeviceCode}`;
    nextDeviceCode += 1;
    return deviceCode;
  };
}

function createUserCodeFactory() {
  const codes = ["ABCD-1234", "WXYZ-9876", "JKLM-4567", "QRST-2345"];
  let nextCode = 0;
  return () => {
    const code = codes[nextCode] ?? `ZZZZ-${nextCode}`;
    nextCode += 1;
    return code;
  };
}
