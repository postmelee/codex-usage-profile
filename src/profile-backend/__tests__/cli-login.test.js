import assert from "node:assert/strict";
import test from "node:test";

import {
  CLI_LOGIN_STATUS,
  CLI_TOKEN_PREFIX,
  PROFILE_BACKEND_ERROR_CODES,
  PROFILE_VISIBILITY,
  ProfileBackendError,
  createCliLoginService,
  createCliTokenService,
  createMemoryProfileBackendStore
} from "../index.js";

test("starts a CLI login challenge with a browser URL", () => {
  const { store, service } = createFixture();

  const { challenge, browserUrl } = service.startCliLogin({
    label: "macbook",
    redirectUri: "codex-usage-profile://callback"
  });
  const storedChallenge = store.getCliLoginChallenge(challenge.id);

  assert.equal(challenge.id, "cli_login_1");
  assert.equal(challenge.status, CLI_LOGIN_STATUS.PENDING);
  assert.equal(challenge.expiresAt, "2026-06-08T00:10:00.000Z");
  assert.equal(browserUrl, "/api/auth/github/login?cli_login_challenge=cli_login_1");
  assert.deepEqual(storedChallenge, challenge);
});

test("approves and exchanges a CLI login challenge for a raw token", () => {
  const { store, service } = createFixture();
  const { challenge } = service.startCliLogin({ label: "macbook" });

  const approved = service.approveCliLogin({
    challengeId: challenge.id,
    ownerId: "owner_1"
  });
  const exchanged = service.exchangeCliLogin({ challengeId: challenge.id });
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

test("rejects exchange before approval and rejects exchange reuse", () => {
  const { service } = createFixture();
  const { challenge } = service.startCliLogin();

  assertBackendError(
    () => service.exchangeCliLogin({ challengeId: challenge.id }),
    PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST
  );

  service.approveCliLogin({ challengeId: challenge.id, ownerId: "owner_1" });
  service.exchangeCliLogin({ challengeId: challenge.id });

  assertBackendError(
    () => service.exchangeCliLogin({ challengeId: challenge.id }),
    PROFILE_BACKEND_ERROR_CODES.GONE
  );
});

test("expires pending challenges and persists expired status", () => {
  const fixture = createFixture();
  const { store, service } = fixture;
  const { challenge } = service.startCliLogin();

  fixture.setNow(new Date("2026-06-08T00:10:00.000Z"));

  assertBackendError(
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

test("validates owner and challenge ids during approval", () => {
  const { service } = createFixture();
  const { challenge } = service.startCliLogin();

  assertBackendError(
    () => service.approveCliLogin({
      challengeId: "missing",
      ownerId: "owner_1"
    }),
    PROFILE_BACKEND_ERROR_CODES.NOT_FOUND
  );
  assertBackendError(
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
    tokenService
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

function createTokenFactory() {
  let nextToken = 1;
  return () => {
    const token = `${CLI_TOKEN_PREFIX}test_${nextToken}`;
    nextToken += 1;
    return token;
  };
}

function assertBackendError(callback, code) {
  assert.throws(callback, (error) => {
    assert.equal(error instanceof ProfileBackendError, true);
    assert.equal(error.code, code);
    return true;
  });
}

