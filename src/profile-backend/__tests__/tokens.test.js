import assert from "node:assert/strict";
import test from "node:test";

import {
  CLI_TOKEN_PREFIX,
  DEFAULT_MAX_ACTIVE_CLI_TOKENS,
  PROFILE_BACKEND_ERROR_CODES,
  PROFILE_VISIBILITY,
  ProfileBackendError,
  createCliTokenDigest,
  createCliTokenService,
  createMemoryProfileBackendStore
} from "../index.js";

test("issues a raw CLI token once and stores only a digest", async () => {
  const store = createStoreWithOwner();
  const service = createCliTokenService({
    store,
    now: () => new Date("2026-06-08T00:00:00.000Z"),
    createId: createIdFactory(),
    createToken: createTokenFactory()
  });

  const { token, tokenRecord } = await service.issueCliToken({
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

test("verifies a valid CLI token and updates lastUsedAt", async () => {
  const store = createStoreWithOwner();
  let current = new Date("2026-06-08T00:00:00.000Z");
  const service = createCliTokenService({
    store,
    now: () => current,
    createId: createIdFactory(),
    createToken: createTokenFactory()
  });
  const { token } = await service.issueCliToken({ ownerId: "owner_1" });

  current = new Date("2026-06-08T00:03:00.000Z");
  const result = await service.verifyCliToken(token, { ownerId: "owner_1" });

  assert.equal(result.owner.id, "owner_1");
  assert.equal(result.tokenRecord.lastUsedAt, "2026-06-08T00:03:00.000Z");
});

test("lists owner CLI tokens without revoked records by default", async () => {
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
  const first = await service.issueCliToken({ ownerId: "owner_1", label: "first" });
  await service.issueCliToken({ ownerId: "owner_2", label: "other" });
  current = new Date("2026-06-08T00:01:00.000Z");
  const second = await service.issueCliToken({ ownerId: "owner_1", label: "second" });
  await service.revokeCliToken({
    tokenId: first.tokenRecord.id,
    ownerId: "owner_1"
  });

  const activeTokens = await service.listCliTokens({ ownerId: "owner_1" });
  const allTokens = await service.listCliTokens({
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

test("limits active CLI tokens per owner and ignores revoked records", async () => {
  const store = createStoreWithOwner();
  store.saveOwner({
    id: "owner_2",
    authProvider: "github",
    providerUserId: "2",
    githubLogin: "other",
    handle: "other",
    visibility: PROFILE_VISIBILITY.PRIVATE
  });
  const service = createCliTokenService({
    store,
    now: () => new Date("2026-06-08T00:00:00.000Z"),
    createId: createIdFactory(),
    createToken: createTokenFactory()
  });
  const issued = [
    await service.issueCliToken({ ownerId: "owner_1", label: "first" }),
    await service.issueCliToken({ ownerId: "owner_1", label: "second" }),
    await service.issueCliToken({ ownerId: "owner_1", label: "third" })
  ];

  const otherOwner = await service.issueCliToken({
    ownerId: "owner_2",
    label: "other"
  });

  assert.equal(
    (await service.listCliTokens({ ownerId: "owner_1" })).length,
    DEFAULT_MAX_ACTIVE_CLI_TOKENS
  );
  await assertBackendError(
    () => service.issueCliToken({ ownerId: "owner_1", label: "overflow" }),
    PROFILE_BACKEND_ERROR_CODES.CONFLICT
  );

  await service.revokeCliToken({
    ownerId: "owner_1",
    tokenId: issued[1].tokenRecord.id
  });
  const replacement = await service.issueCliToken({
    ownerId: "owner_1",
    label: "replacement"
  });

  assert.equal(replacement.tokenRecord.label, "replacement");
  assert.equal((await service.listCliTokens({ ownerId: "owner_1" })).length, 3);
  assert.deepEqual(
    (await service
      .listCliTokens({ ownerId: "owner_1" }))
      .map((tokenRecord) => tokenRecord.label)
      .sort(),
    ["first", "replacement", "third"]
  );
  assert.deepEqual(
    (await service
      .listCliTokens({ ownerId: "owner_2" }))
      .map((tokenRecord) => tokenRecord.id),
    [otherOwner.tokenRecord.id]
  );
});

test("rejects invalid, expired, revoked, and owner-mismatched CLI tokens", async () => {
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

  const expiring = await service.issueCliToken({
    ownerId: "owner_1",
    expiresInMs: 1000
  });
  const revoked = await service.issueCliToken({ ownerId: "owner_1" });

  await assertBackendError(
    () => service.verifyCliToken("cup_unknown"),
    PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED
  );
  await assertBackendError(
    () => service.verifyCliToken(expiring.token, { ownerId: "owner_2" }),
    PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED
  );

  current = new Date("2026-06-08T00:00:01.000Z");
  await assertBackendError(
    () => service.verifyCliToken(expiring.token),
    PROFILE_BACKEND_ERROR_CODES.EXPIRED
  );

  await service.revokeCliToken({
    tokenId: revoked.tokenRecord.id,
    ownerId: "owner_1"
  });
  await assertBackendError(
    () => service.verifyCliToken(revoked.token),
    PROFILE_BACKEND_ERROR_CODES.GONE
  );
});

test("revokes CLI tokens idempotently and validates ownership", async () => {
  const store = createStoreWithOwner();
  const service = createCliTokenService({
    store,
    now: () => new Date("2026-06-08T00:00:00.000Z"),
    createId: createIdFactory(),
    createToken: createTokenFactory()
  });
  const { tokenRecord } = await service.issueCliToken({ ownerId: "owner_1" });

  await assertBackendError(
    () => service.revokeCliToken({
      tokenId: tokenRecord.id,
      ownerId: "owner_2"
    }),
    PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED
  );

  const revoked = await service.revokeCliToken({
    tokenId: tokenRecord.id,
    ownerId: "owner_1"
  });
  const second = await service.revokeCliToken({
    tokenId: tokenRecord.id,
    ownerId: "owner_1"
  });

  assert.equal(revoked.revokedAt, "2026-06-08T00:00:00.000Z");
  assert.equal(second.revokedAt, revoked.revokedAt);
});

test("validates token issue inputs", async () => {
  const store = createStoreWithOwner();
  const service = createCliTokenService({
    store,
    now: () => new Date("2026-06-08T00:00:00.000Z"),
    createId: createIdFactory(),
    createToken: createTokenFactory()
  });

  await assertBackendError(
    () => service.issueCliToken({ ownerId: "missing_owner" }),
    PROFILE_BACKEND_ERROR_CODES.NOT_FOUND
  );
  await assertBackendError(
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

async function assertBackendError(callback, code) {
  await assert.rejects(async () => callback(), (error) => {
    assert.equal(error instanceof ProfileBackendError, true);
    assert.equal(error.code, code);
    return true;
  });
}
