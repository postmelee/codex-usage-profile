import assert from "node:assert/strict";
import test from "node:test";

import {
  CLI_LOGIN_INTENT,
  CLI_LOGIN_STATUS,
  CLI_DEVICE_CODE_PREFIX,
  CLI_TOKEN_PREFIX,
  PROFILE_BACKEND_ERROR_CODES,
  PROFILE_VISIBILITY,
  ProfileBackendError,
  createDeviceCodeDigest,
  createCliLoginService,
  createCliTokenService,
  createMemoryProfileBackendStore,
  normalizeCliLoginIntent
} from "../index.js";

test("starts a CLI login challenge with a browser URL", async () => {
  const { store, service } = createFixture();

  const result = await service.startCliLogin({
    label: "macbook",
    intent: CLI_LOGIN_INTENT.SUBMIT,
    redirectUri: "codex-usage-profile://callback"
  });
  const { challenge, browserUrl } = result;
  const storedChallenge = store.getCliLoginChallenge(challenge.id);

  assert.equal(challenge.id, "cli_login_1");
  assert.equal(challenge.status, CLI_LOGIN_STATUS.PENDING);
  assert.equal(challenge.intent, CLI_LOGIN_INTENT.SUBMIT);
  assert.equal(result.deviceCode, `${CLI_DEVICE_CODE_PREFIX}test_1`);
  assert.equal(result.userCode, "ABCD-1234");
  assert.equal(result.verificationUri, "/device");
  assert.equal(result.verificationUriComplete, "/device?user_code=ABCD-1234");
  assert.equal(result.intervalSeconds, 5);
  assert.equal(challenge.deviceCodeDigest, createDeviceCodeDigest(result.deviceCode));
  assert.equal(challenge.userCode, "ABCD-1234");
  assert.equal(challenge.expiresAt, "2026-06-08T00:10:00.000Z");
  assert.equal(browserUrl, "/api/auth/github/login?cli_login_challenge=cli_login_1");
  assert.deepEqual(storedChallenge, challenge);
  assert.equal(JSON.stringify(storedChallenge).includes(result.deviceCode), false);
});

test("normalizes optional CLI login intent and rejects unknown values", async () => {
  const { service } = createFixture();
  const legacy = await service.startCliLogin();
  const login = await service.startCliLogin({ intent: CLI_LOGIN_INTENT.LOGIN });

  assert.equal(legacy.challenge.intent, null);
  assert.equal(login.challenge.intent, CLI_LOGIN_INTENT.LOGIN);
  assert.equal(normalizeCliLoginIntent(undefined), null);
  assert.equal(normalizeCliLoginIntent(null), null);
  assert.equal(
    normalizeCliLoginIntent(CLI_LOGIN_INTENT.SUBMIT),
    CLI_LOGIN_INTENT.SUBMIT
  );
  await assertBackendError(
    () => service.startCliLogin({ intent: "publish" }),
    PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED
  );
});

test("approves and exchanges a CLI login challenge for a raw token", async () => {
  const { store, service } = createFixture();
  const { challenge } = await service.startCliLogin({ label: "macbook" });

  const approved = await service.approveCliLogin({
    challengeId: challenge.id,
    ownerId: "owner_1"
  });
  const exchanged = await service.exchangeCliLogin({ challengeId: challenge.id });
  const storedChallenge = store.getCliLoginChallenge(challenge.id);
  const storedToken = store.getCliTokenById(exchanged.tokenRecord.id);

  assert.equal(approved.status, CLI_LOGIN_STATUS.APPROVED);
  assert.equal(approved.ownerId, "owner_1");
  assert.equal(exchanged.token, `${CLI_TOKEN_PREFIX}test_1`);
  assert.equal(exchanged.tokenRecord.ownerId, "owner_1");
  assert.equal(exchanged.tokenRecord.sourceChallengeId, challenge.id);
  assert.equal(Object.hasOwn(storedToken, "token"), false);
  assert.equal(storedChallenge.status, CLI_LOGIN_STATUS.EXCHANGED);
  assert.equal(storedChallenge.cliTokenId, exchanged.tokenRecord.id);
});

test("approves a CLI login by user code and polls a raw token once", async () => {
  const { service } = createFixture();
  const started = await service.startCliLogin({ label: "macbook" });

  const approved = await service.approveCliLogin({
    userCode: "abcd1234",
    ownerId: "owner_1"
  });
  const polled = await service.pollCliLogin({ deviceCode: started.deviceCode });
  const reused = await service.pollCliLogin({ deviceCode: started.deviceCode });

  assert.equal(approved.status, CLI_LOGIN_STATUS.APPROVED);
  assert.equal(approved.ownerId, "owner_1");
  assert.equal(polled.status, CLI_LOGIN_STATUS.APPROVED);
  assert.equal(polled.token, `${CLI_TOKEN_PREFIX}test_1`);
  assert.equal(polled.tokenRecord.ownerId, "owner_1");
  assert.equal(polled.challenge.status, CLI_LOGIN_STATUS.EXCHANGED);
  assert.equal(reused.status, CLI_LOGIN_STATUS.EXCHANGED);
  assert.equal(Object.hasOwn(reused, "token"), false);
});

test("polls pending and expired CLI login challenges by device code", async () => {
  const fixture = createFixture();
  const { store, service } = fixture;
  const started = await service.startCliLogin();
  const pending = await service.pollCliLogin({ deviceCode: started.deviceCode });

  fixture.setNow(new Date("2026-06-08T00:10:00.000Z"));
  const expired = await service.pollCliLogin({ deviceCode: started.deviceCode });

  assert.equal(pending.status, CLI_LOGIN_STATUS.PENDING);
  assert.equal(pending.challenge.status, CLI_LOGIN_STATUS.PENDING);
  assert.equal(expired.status, CLI_LOGIN_STATUS.EXPIRED);
  assert.equal(expired.challenge.status, CLI_LOGIN_STATUS.EXPIRED);
  assert.equal(
    store.getCliLoginChallenge(started.challenge.id).status,
    CLI_LOGIN_STATUS.EXPIRED
  );
});

test("rejects exchange before approval and rejects exchange reuse", async () => {
  const { service } = createFixture();
  const { challenge } = await service.startCliLogin();

  await assertBackendError(
    () => service.exchangeCliLogin({ challengeId: challenge.id }),
    PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST
  );

  await service.approveCliLogin({ challengeId: challenge.id, ownerId: "owner_1" });
  await service.exchangeCliLogin({ challengeId: challenge.id });

  await assertBackendError(
    () => service.exchangeCliLogin({ challengeId: challenge.id }),
    PROFILE_BACKEND_ERROR_CODES.GONE
  );
});

test("expires pending challenges and persists expired status", async () => {
  const fixture = createFixture();
  const { store, service } = fixture;
  const { challenge } = await service.startCliLogin();

  fixture.setNow(new Date("2026-06-08T00:10:00.000Z"));

  await assertBackendError(
    () => service.approveCliLogin({
      challengeId: challenge.id,
      ownerId: "owner_1"
    }),
    PROFILE_BACKEND_ERROR_CODES.EXPIRED
  );
  assert.equal(
    store.getCliLoginChallenge(challenge.id).status,
    CLI_LOGIN_STATUS.EXPIRED
  );
});

test("validates owner and challenge ids during approval", async () => {
  const { service } = createFixture();
  const { challenge } = await service.startCliLogin();

  await assertBackendError(
    () => service.approveCliLogin({
      challengeId: "missing",
      ownerId: "owner_1"
    }),
    PROFILE_BACKEND_ERROR_CODES.NOT_FOUND
  );
  await assertBackendError(
    () => service.approveCliLogin({
      challengeId: challenge.id,
      ownerId: "missing_owner"
    }),
    PROFILE_BACKEND_ERROR_CODES.NOT_FOUND
  );
});

function createFixture() {
  const store = createMemoryProfileBackendStore();
  store.saveOwner({
    id: "owner_1",
    authProvider: "github",
    providerUserId: "1",
    githubLogin: "postmelee",
    handle: "postmelee",
    visibility: PROFILE_VISIBILITY.PRIVATE
  });

  let current = new Date("2026-06-08T00:00:00.000Z");
  const createId = createIdFactory();
  const tokenService = createCliTokenService({
    store,
    now: () => current,
    createId,
    createToken: createTokenFactory()
  });
  const service = createCliLoginService({
    store,
    now: () => current,
    createId,
    tokenService,
    createDeviceCode: createDeviceCodeFactory(),
    createUserCode: createUserCodeFactory()
  });

  return {
    store,
    service,
    setNow(value) {
      current = value;
    }
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

function createTokenFactory() {
  let nextToken = 1;
  return () => {
    const token = `${CLI_TOKEN_PREFIX}test_${nextToken}`;
    nextToken += 1;
    return token;
  };
}

async function assertBackendError(callback, code) {
  await assert.rejects(async () => callback(), (error) => {
    assert.equal(error instanceof ProfileBackendError, true);
    assert.equal(error.code, code);
    return true;
  });
}
