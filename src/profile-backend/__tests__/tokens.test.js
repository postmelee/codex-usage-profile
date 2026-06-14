import assert from "node:assert/strict";
import test from "node:test";

import {
  CLI_TOKEN_PREFIX,
  PROFILE_BACKEND_ERROR_CODES,
  PROFILE_VISIBILITY,
  ProfileBackendError,
  createCliTokenDigest,
  createCliTokenService,
  createMemoryProfileBackendStore
} from "../index.js";

test("issues a raw CLI token once and stores only a digest", () => {
  const store = createStoreWithOwner();
  const service = createCliTokenService({
    store,
    now: () => new Date("2026-06-08T00:00:00.000Z"),
    createId: createIdFactory(),
    createToken: createTokenFactory()
  });

  const { token, tokenRecord } = service.issueCliToken({
    ownerId: "owner_1",
    label: "macbook"
  });
  const storedToken = store.getCliTokenById(tokenRecord.id);

  assert.equal(token.startsWith(CLI_TOKEN_PREFIX), true);
  assert.equal(tokenRecord.id, "cli_token_1");
  assert.equal(tokenRecord.label, "macbook");
  assert.equal(tokenRecord.tokenDigest, createCliTokenDigest(token));
  assert.equal(Object.hasOwn(tokenRecord, "token"), false);
  assert.equal(Object.hasOwn(storedToken, "token"), false);
});

test("verifies a valid CLI token and updates lastUsedAt", () => {
  const store = createStoreWithOwner();
  let current = new Date("2026-06-08T00:00:00.000Z");
  const service = createCliTokenService({
    store,
    now: () => current,
    createId: createIdFactory(),
    createToken: createTokenFactory()
  });
  const { token } = service.issueCliToken({ ownerId: "owner_1" });

  current = new Date("2026-06-08T00:03:00.000Z");
  const result = service.verifyCliToken(token, { ownerId: "owner_1" });

  assert.equal(result.owner.id, "owner_1");
  assert.equal(result.tokenRecord.lastUsedAt, "2026-06-08T00:03:00.000Z");
});

test("lists owner CLI tokens without revoked records by default", () => {
  const store = createStoreWithOwner();
  store.saveOwner({
    id: "owner_2",
    authProvider: "github",
    providerUserId: "2",
    githubLogin: "other",
    handle: "other",
    visibility: PROFILE_VISIBILITY.PRIVATE
  });
  let current = new Date("2026-06-08T00:00:00.000Z");
  const service = createCliTokenService({
    store,
    now: () => current,
    createId: createIdFactory(),
    createToken: createTokenFactory()
  });
  const first = service.issueCliToken({ ownerId: "owner_1", label: "first" });
  service.issueCliToken({ ownerId: "owner_2", label: "other" });
  current = new Date("2026-06-08T00:01:00.000Z");
  const second = service.issueCliToken({ ownerId: "owner_1", label: "second" });
  service.revokeCliToken({
    tokenId: first.tokenRecord.id,
    ownerId: "owner_1"
  });

  const activeTokens = service.listCliTokens({ ownerId: "owner_1" });
  const allTokens = service.listCliTokens({
    ownerId: "owner_1",
    includeRevoked: true
  });

  assert.deepEqual(activeTokens.map((token) => token.id), [second.tokenRecord.id]);
  assert.deepEqual(
    allTokens.map((token) => token.id),
    [second.tokenRecord.id, first.tokenRecord.id]
  );
  assert.equal(Object.hasOwn(activeTokens[0], "token"), false);
});

test("rejects invalid, expired, revoked, and owner-mismatched CLI tokens", () => {
  const store = createStoreWithOwner();
  store.saveOwner({
    id: "owner_2",
    authProvider: "github",
    providerUserId: "2",
    githubLogin: "other",
    handle: "other",
    visibility: PROFILE_VISIBILITY.PRIVATE
  });
  let current = new Date("2026-06-08T00:00:00.000Z");
  const service = createCliTokenService({
    store,
    now: () => current,
    createId: createIdFactory(),
    createToken: createTokenFactory()
  });

  const expiring = service.issueCliToken({
    ownerId: "owner_1",
    expiresInMs: 1000
  });
  const revoked = service.issueCliToken({ ownerId: "owner_1" });

  assertBackendError(
    () => service.verifyCliToken("cup_unknown"),
    PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED
  );
  assertBackendError(
    () => service.verifyCliToken(expiring.token, { ownerId: "owner_2" }),
    PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED
  );

  current = new Date("2026-06-08T00:00:01.000Z");
  assertBackendError(
    () => service.verifyCliToken(expiring.token),
    PROFILE_BACKEND_ERROR_CODES.EXPIRED
  );

  service.revokeCliToken({
    tokenId: revoked.tokenRecord.id,
    ownerId: "owner_1"
  });
  assertBackendError(
    () => service.verifyCliToken(revoked.token),
    PROFILE_BACKEND_ERROR_CODES.GONE
  );
});

test("revokes CLI tokens idempotently and validates ownership", () => {
  const store = createStoreWithOwner();
  const service = createCliTokenService({
    store,
    now: () => new Date("2026-06-08T00:00:00.000Z"),
    createId: createIdFactory(),
    createToken: createTokenFactory()
  });
  const { tokenRecord } = service.issueCliToken({ ownerId: "owner_1" });

  assertBackendError(
    () => service.revokeCliToken({
      tokenId: tokenRecord.id,
      ownerId: "owner_2"
    }),
    PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED
  );

  const revoked = service.revokeCliToken({
    tokenId: tokenRecord.id,
    ownerId: "owner_1"
  });
  const second = service.revokeCliToken({
    tokenId: tokenRecord.id,
    ownerId: "owner_1"
  });

  assert.equal(revoked.revokedAt, "2026-06-08T00:00:00.000Z");
  assert.equal(second.revokedAt, revoked.revokedAt);
});

test("validates token issue inputs", () => {
  const store = createStoreWithOwner();
  const service = createCliTokenService({
    store,
    now: () => new Date("2026-06-08T00:00:00.000Z"),
    createId: createIdFactory(),
    createToken: createTokenFactory()
  });

  assertBackendError(
    () => service.issueCliToken({ ownerId: "missing_owner" }),
    PROFILE_BACKEND_ERROR_CODES.NOT_FOUND
  );
  assertBackendError(
    () => service.issueCliToken({ ownerId: "owner_1", scopes: [42] }),
    PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED
  );
});

function createStoreWithOwner() {
  const store = createMemoryProfileBackendStore();
  store.saveOwner({
    id: "owner_1",
    authProvider: "github",
    providerUserId: "1",
    githubLogin: "postmelee",
    handle: "postmelee",
    visibility: PROFILE_VISIBILITY.PRIVATE
  });
  return store;
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
