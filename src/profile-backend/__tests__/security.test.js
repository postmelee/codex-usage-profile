import assert from "node:assert/strict";
import test from "node:test";

import {
  CLI_DEVICE_CODE_PREFIX,
  CLI_LOGIN_STATUS,
  CLI_TOKEN_PREFIX,
  DEFAULT_SESSION_COOKIE_NAME,
  PROFILE_BACKEND_ERROR_CODES,
  PROFILE_VISIBILITY,
  ProfileBackendError,
  assertNoForbiddenSecrets,
  createCliTokenService,
  createMemoryProfileBackendStore,
  createProfileBackendHttpHandler,
  detectForbiddenSecrets,
  hasForbiddenSecrets,
  isForbiddenSecretKey,
  isForbiddenSecretValue
} from "../index.js";
import { sampleProfileSnapshot } from "../../profile-snapshot/fixtures/sample-snapshot.js";
import { sampleAccountUsageReadResult } from "../../profile-card/fixtures/sample-account-usage.js";

test("does not flag normal profile snapshot token metrics", () => {
  const findings = detectForbiddenSecrets(sampleProfileSnapshot);

  assert.deepEqual(findings, []);
  assert.equal(hasForbiddenSecrets(sampleProfileSnapshot), false);
});

test("distinguishes usage token fields from credential token fields", () => {
  assert.equal(isForbiddenSecretKey("totalTextTokens"), false);
  assert.equal(isForbiddenSecretKey("peakTokens"), false);
  assert.equal(isForbiddenSecretKey("tokenDigest"), false);
  assert.equal(isForbiddenSecretKey("apiTokenDigest"), false);
  assert.equal(isForbiddenSecretKey("apiKeyDigest"), false);

  assert.equal(isForbiddenSecretKey("accessToken"), true);
  assert.equal(isForbiddenSecretKey("api_key"), true);
  assert.equal(isForbiddenSecretKey("githubToken"), true);
  assert.equal(isForbiddenSecretKey("openaiApiKey"), true);
  assert.equal(isForbiddenSecretKey("refresh_token"), true);
  assert.equal(isForbiddenSecretKey("CODEX_ACCESS_TOKEN"), true);
  assert.equal(isForbiddenSecretKey("auth.json"), true);
});

test("detects nested credential-like keys and values", () => {
  const findings = detectForbiddenSecrets({
    snapshot: sampleProfileSnapshot,
    credentials: {
      access_token: "redacted",
      env: "CODEX_ACCESS_TOKEN=codex-secret-value"
    }
  });

  assert.deepEqual(
    findings.map((finding) => finding.path),
    ["$.credentials.access_token", "$.credentials.env"]
  );
});

test("detects credential-like values in submit device metadata", () => {
  const findings = detectForbiddenSecrets({
    snapshot: sampleProfileSnapshot,
    device: {
      id: "machine-1",
      access_token: "gho_1234567890abcdefghijklmnopqrstuv"
    }
  });

  assert.deepEqual(
    findings.map((finding) => finding.path),
    ["$.device.access_token", "$.device.access_token"]
  );
});

test("detects OpenAI, GitHub, bearer, and private key values", () => {
  assert.equal(isForbiddenSecretValue("sk-proj-1234567890abcdef"), true);
  assert.equal(isForbiddenSecretValue("ghp_1234567890abcdefghijklmnopqrstuv"), true);
  assert.equal(isForbiddenSecretValue("Bearer eyJhbGciOiJIUzI1NiJ9.fake"), true);
  assert.equal(isForbiddenSecretValue("-----BEGIN PRIVATE KEY-----"), true);
});

test("assertNoForbiddenSecrets throws a backend error with details", () => {
  assert.throws(
    () => assertNoForbiddenSecrets({ githubToken: "gho_1234567890abcdefghijklmnopqrstuv" }),
    (error) => {
      assert.equal(error instanceof ProfileBackendError, true);
      assert.equal(error.code, PROFILE_BACKEND_ERROR_CODES.FORBIDDEN_SECRET);
      assert.equal(error.status, 400);
      assert.equal(error.details.length, 2);
      return true;
    }
  );
});

test("device login responses expose raw secrets only at intended exchange points", async () => {
  const fixture = createDeviceFixture();
  fixture.saveOwner();
  const cookie = fixture.saveSession();

  const started = await requestJson(fixture.handler, "POST", "/api/auth/device", {
    label: "workstation"
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
  const exportedState = JSON.stringify(fixture.store.exportState());

  assert.equal(started.status, 201);
  assert.equal(started.body.data.deviceCode, `${CLI_DEVICE_CODE_PREFIX}test_1`);
  assert.equal(started.body.data.challenge.deviceCode, undefined);
  assertNoSerializedKeys(started.body.data.challenge, [
    "deviceCodeDigest",
    "token",
    "tokenDigest"
  ]);

  assert.equal(authorized.status, 200);
  assert.equal(authorized.body.data.challenge.status, CLI_LOGIN_STATUS.APPROVED);
  assertNoSerializedKeys(authorized.body.data.challenge, [
    "deviceCode",
    "deviceCodeDigest",
    "token",
    "tokenDigest"
  ]);

  assert.equal(polled.status, 200);
  assert.equal(polled.body.data.token, `${CLI_TOKEN_PREFIX}test_1`);
  assert.equal(polled.body.data.challenge.status, CLI_LOGIN_STATUS.EXCHANGED);
  assertNoSerializedKeys(polled.body.data.challenge, [
    "deviceCode",
    "deviceCodeDigest",
    "token",
    "tokenDigest"
  ]);
  assertNoSerializedKeys(polled.body.data.tokenRecord, ["token", "tokenDigest"]);

  assert.equal(reused.status, 200);
  assert.equal(reused.body.data.status, CLI_LOGIN_STATUS.EXCHANGED);
  assert.equal(Object.hasOwn(reused.body.data, "token"), false);
  assert.equal(Object.hasOwn(reused.body.data, "tokenRecord"), false);

  assert.equal(exportedState.includes(started.body.data.deviceCode), false);
  assert.equal(exportedState.includes(polled.body.data.token), false);
});

test("settings token responses expose raw tokens only on create", async () => {
  const fixture = createDeviceFixture();
  fixture.saveOwner();
  const cookie = fixture.saveSession();

  const created = await requestJson(
    fixture.handler,
    "POST",
    "/api/settings/tokens",
    {
      label: "CI token"
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
  const exportedState = JSON.stringify(fixture.store.exportState());

  assert.equal(created.status, 201);
  assert.equal(created.body.data.token, `${CLI_TOKEN_PREFIX}test_1`);
  assertNoSerializedKeys(created.body.data.tokenRecord, ["token", "tokenDigest"]);
  assertNoSerializedKeys(listed.body.data.tokens[0], ["token", "tokenDigest"]);
  assertNoSerializedKeys(revoked.body.data.tokenRecord, ["token", "tokenDigest"]);
  assert.equal(JSON.stringify(listed.body.data).includes(created.body.data.token), false);
  assert.equal(JSON.stringify(revoked.body.data).includes(created.body.data.token), false);
  assert.equal(exportedState.includes(created.body.data.token), false);
});

test("public profile responses exclude owner and usage storage metadata", async () => {
  const fixture = createDeviceFixture();
  fixture.saveOwner({
    visibility: PROFILE_VISIBILITY.PUBLIC,
    displayName: "Post Melee",
    avatarUrl: "https://avatars.githubusercontent.com/u/12345",
    internalOwnerNote: "hidden-owner-note"
  });
  fixture.store.saveLatestUsage({
    ownerId: "owner_1",
    handle: "postmelee",
    visibility: PROFILE_VISIBILITY.PUBLIC,
    capturedAt: "2026-06-11T00:00:00.000Z",
    uploadedAt: "2026-06-11T00:01:00.000Z",
    usage: sampleAccountUsageReadResult,
    contentDigest: "hidden-content-digest",
    revision: 7,
    sourcePath: "/Users/example/.codex"
  });

  const response = await requestJson(
    fixture.handler,
    "GET",
    "/api/profiles/public/postmelee"
  );
  const serialized = JSON.stringify(response.body.data);

  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.body.data.owner).sort(), [
    "avatarUrl",
    "displayName",
    "githubLogin",
    "handle"
  ]);
  assert.deepEqual(Object.keys(response.body.data.usage).sort(), [
    "capturedAt",
    "uploadedAt",
    "usage"
  ]);
  for (const forbidden of [
    "owner_1",
    "hidden-owner-note",
    "hidden-content-digest",
    "/Users/example/.codex",
    "providerUserId",
    "contentDigest",
    "revision",
    "sourcePath"
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("device login rejects invalid, duplicate, expired, and unknown codes", async () => {
  const fixture = createDeviceFixture();
  fixture.saveOwner();
  const cookie = fixture.saveSession();

  const started = await requestJson(fixture.handler, "POST", "/api/auth/device", {
    label: "workstation"
  });
  const invalid = await requestJson(
    fixture.handler,
    "POST",
    "/api/auth/device/authorize",
    {
      userCode: "bad"
    },
    { cookie }
  );
  const authorized = await requestJson(
    fixture.handler,
    "POST",
    "/api/auth/device/authorize",
    {
      userCode: started.body.data.userCode
    },
    { cookie }
  );
  const duplicate = await requestJson(
    fixture.handler,
    "POST",
    "/api/auth/device/authorize",
    {
      userCode: started.body.data.userCode
    },
    { cookie }
  );
  const unknownPoll = await requestJson(
    fixture.handler,
    "POST",
    "/api/auth/device/poll",
    {
      deviceCode: `${CLI_DEVICE_CODE_PREFIX}missing`
    }
  );

  const expiring = await requestJson(fixture.handler, "POST", "/api/auth/device", {
    label: "workstation"
  });
  fixture.setNow(new Date("2026-06-10T00:10:00.000Z"));
  const expired = await requestJson(
    fixture.handler,
    "POST",
    "/api/auth/device/authorize",
    {
      userCode: expiring.body.data.userCode
    },
    { cookie }
  );

  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED);
  assert.equal(authorized.status, 200);
  assert.equal(authorized.body.data.status, CLI_LOGIN_STATUS.APPROVED);
  assert.equal(duplicate.status, 400);
  assert.equal(duplicate.body.error.code, PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST);
  assert.equal(unknownPoll.status, 404);
  assert.equal(unknownPoll.body.error.code, PROFILE_BACKEND_ERROR_CODES.NOT_FOUND);
  assert.equal(expired.status, 410);
  assert.equal(expired.body.error.code, PROFILE_BACKEND_ERROR_CODES.EXPIRED);
});

const DEVICE_BASE_URL = "http://localhost";

function createDeviceFixture() {
  const store = createMemoryProfileBackendStore();
  let current = new Date("2026-06-10T00:00:00.000Z");
  const createId = createIdFactory();
  const createToken = createTokenFactory();
  const tokenService = createCliTokenService({
    store,
    now: () => current,
    createId,
    createToken
  });
  const handler = createProfileBackendHttpHandler({
    store,
    tokenService,
    now: () => current,
    createId,
    createToken,
    createDeviceCode: createDeviceCodeFactory(),
    createUserCode: createUserCodeFactory()
  });

  return {
    store,
    handler,
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
  const response = await handler(new Request(`${DEVICE_BASE_URL}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...headers
    },
    body: method === "GET" || method === "HEAD"
      ? undefined
      : body === undefined
        ? ""
        : JSON.stringify(body)
  }));

  return {
    status: response.status,
    headers: response.headers,
    body: await response.json()
  };
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

function assertNoSerializedKeys(value, forbiddenKeys) {
  const serialized = JSON.stringify(value);

  for (const key of forbiddenKeys) {
    assert.equal(serialized.includes(`"${key}"`), false);
  }
}
