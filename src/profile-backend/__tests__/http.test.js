import assert from "node:assert/strict";
import test from "node:test";

import {
  CLI_DEVICE_CODE_PREFIX,
  CLI_LOGIN_STATUS,
  CLI_TOKEN_PREFIX,
  DEFAULT_MAX_ACTIVE_CLI_TOKENS,
  DEFAULT_SESSION_COOKIE_NAME,
  PROFILE_BACKEND_ERROR_CODES,
  PROFILE_VISIBILITY,
  createCliTokenService,
  createMemoryProfileBackendStore,
  createProfileBackendHttpHandler
} from "../index.js";
import { sampleProfileSnapshot } from "../../profile-snapshot/fixtures/sample-snapshot.js";

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
    label: "macbook"
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

test("handles CLI login start, approve, and exchange without exposing token digest", async () => {
  const fixture = createFixture();
  fixture.saveOwner();
  const cookie = fixture.saveSession();

  const started = await requestJson(fixture.handler, "POST", "/api/cli/login/start", {
    label: "macbook"
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
    label: "macbook"
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
  assert.equal(started.body.data.verificationUri, "/device");
  assert.equal(
    started.body.data.verificationUriComplete,
    "/device?user_code=ABCD-1234"
  );
  assert.equal(started.body.data.intervalSeconds, 5);
  assert.equal(started.body.data.challenge.userCode, "ABCD-1234");
  assert.equal(JSON.stringify(started.body.data).includes("deviceCodeDigest"), false);

  assert.equal(authorized.status, 200);
  assert.equal(authorized.body.data.status, CLI_LOGIN_STATUS.APPROVED);
  assert.equal(authorized.body.data.challenge.ownerId, "owner_1");

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
  const { token } = fixture.issueToken({ label: "bearer" });
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

test("handles bearer snapshot submit and public handle lookup", async () => {
  const fixture = createFixture();
  fixture.saveOwner();
  const { token } = fixture.issueToken();

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

test("handles settings device list and rename after submit", async () => {
  const fixture = createFixture();
  fixture.saveOwner();
  const cookie = fixture.saveSession();
  const { token } = fixture.issueToken();

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
  const { token } = fixture.issueToken();

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
  const { token } = fixture.issueToken();

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
  const { token } = fixture.issueToken();
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

function createFixture() {
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
    }
  });

  return {
    store,
    handler,
    githubCalls,
    issueToken(options = {}) {
      return tokenService.issueCliToken({
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
