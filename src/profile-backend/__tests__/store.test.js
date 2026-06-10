import assert from "node:assert/strict";
import test from "node:test";

import {
  PROFILE_BACKEND_ERROR_CODES,
  PROFILE_VISIBILITY,
  ProfileBackendError,
  createMemoryProfileBackendStore
} from "../index.js";
import { sampleProfileSnapshot } from "../../profile-snapshot/fixtures/sample-snapshot.js";

const owner = Object.freeze({
  id: "owner_1",
  authProvider: "github",
  providerUserId: "12345",
  githubLogin: "postmelee",
  handle: "postmelee",
  visibility: PROFILE_VISIBILITY.PUBLIC
});

test("saves and reads owners by id, handle, and provider identity", () => {
  const store = createMemoryProfileBackendStore();

  const saved = store.saveOwner(owner);

  assert.deepEqual(saved, owner);
  assert.deepEqual(store.getOwnerById(owner.id), owner);
  assert.deepEqual(store.getOwnerByHandle(owner.handle), owner);
  assert.deepEqual(
    store.getOwnerByProviderIdentity(owner.authProvider, owner.providerUserId),
    owner
  );
  assert.deepEqual(store.listOwners(), [owner]);
});

test("returns cloned owner records", () => {
  const store = createMemoryProfileBackendStore();
  const mutableOwner = { ...owner };

  const saved = store.saveOwner(mutableOwner);
  mutableOwner.handle = "changed-input";
  saved.handle = "changed-output";

  assert.equal(store.getOwnerById(owner.id).handle, owner.handle);
});

test("enforces owner provider identity and handle conflicts", () => {
  const store = createMemoryProfileBackendStore();
  store.saveOwner(owner);

  assertBackendError(
    () => store.saveOwner({ ...owner, id: "owner_2", handle: "postmelee-2" }),
    PROFILE_BACKEND_ERROR_CODES.CONFLICT
  );
  assertBackendError(
    () => store.saveOwner({ ...owner, id: "owner_3", providerUserId: "67890" }),
    PROFILE_BACKEND_ERROR_CODES.CONFLICT
  );
});

test("updates owner indexes when an owner changes handle or provider identity", () => {
  const store = createMemoryProfileBackendStore();
  store.saveOwner(owner);

  const updated = {
    ...owner,
    providerUserId: "67890",
    handle: "meleeisdeveloping"
  };

  store.saveOwner(updated);

  assert.equal(store.getOwnerByHandle(owner.handle), null);
  assert.equal(store.getOwnerByProviderIdentity("github", "12345"), null);
  assert.deepEqual(store.getOwnerByHandle(updated.handle), updated);
  assert.deepEqual(store.getOwnerByProviderIdentity("github", "67890"), updated);
});

test("saves and reads CLI login challenges as cloned records", () => {
  const store = createMemoryProfileBackendStore();
  const challenge = {
    id: "challenge_1",
    status: "pending",
    expiresAt: "2026-06-08T00:10:00.000Z"
  };

  const saved = store.saveCliLoginChallenge(challenge);
  challenge.status = "changed-input";
  saved.status = "changed-output";

  assert.deepEqual(store.getCliLoginChallenge("challenge_1"), {
    id: "challenge_1",
    status: "pending",
    expiresAt: "2026-06-08T00:10:00.000Z"
  });
});

test("saves and reads OAuth states and sessions as cloned records", () => {
  const store = createMemoryProfileBackendStore();
  const oauthState = {
    id: "oauth_state_1",
    status: "pending",
    expiresAt: "2026-06-08T00:10:00.000Z"
  };
  const session = {
    id: "session_1",
    ownerId: owner.id,
    expiresAt: "2026-07-08T00:00:00.000Z",
    revokedAt: null
  };

  const savedState = store.saveOAuthState(oauthState);
  const savedSession = store.saveSession(session);
  oauthState.status = "changed-input";
  session.ownerId = "changed-input";
  savedState.status = "changed-output";
  savedSession.ownerId = "changed-output";

  assert.deepEqual(store.getOAuthState("oauth_state_1"), {
    id: "oauth_state_1",
    status: "pending",
    expiresAt: "2026-06-08T00:10:00.000Z"
  });
  assert.deepEqual(store.getSession("session_1"), {
    id: "session_1",
    ownerId: owner.id,
    expiresAt: "2026-07-08T00:00:00.000Z",
    revokedAt: null
  });
});

test("saves, reads, updates, and deletes CLI tokens by id and digest", () => {
  const store = createMemoryProfileBackendStore();
  const token = {
    id: "cli_token_1",
    ownerId: owner.id,
    tokenDigest: "digest_1",
    createdAt: "2026-06-08T00:00:00.000Z"
  };

  const saved = store.saveCliToken(token);
  token.tokenDigest = "changed-input";
  saved.ownerId = "changed-output";

  assert.deepEqual(store.getCliTokenById("cli_token_1"), {
    id: "cli_token_1",
    ownerId: owner.id,
    tokenDigest: "digest_1",
    createdAt: "2026-06-08T00:00:00.000Z"
  });
  assert.equal(store.getCliTokenByDigest("digest_1").id, "cli_token_1");

  store.saveCliToken({
    id: "cli_token_1",
    ownerId: owner.id,
    tokenDigest: "digest_2"
  });

  assert.equal(store.getCliTokenByDigest("digest_1"), null);
  assert.equal(store.getCliTokenByDigest("digest_2").id, "cli_token_1");
  assert.equal(store.deleteCliToken("cli_token_1"), true);
  assert.equal(store.deleteCliToken("cli_token_1"), false);
  assert.equal(store.getCliTokenByDigest("digest_2"), null);
});

test("enforces CLI token digest conflicts", () => {
  const store = createMemoryProfileBackendStore();

  store.saveCliToken({
    id: "cli_token_1",
    ownerId: owner.id,
    tokenDigest: "digest_1"
  });

  assertBackendError(
    () => store.saveCliToken({
      id: "cli_token_2",
      ownerId: owner.id,
      tokenDigest: "digest_1"
    }),
    PROFILE_BACKEND_ERROR_CODES.CONFLICT
  );
});

test("saves and reads latest snapshots by owner id and handle", () => {
  const store = createMemoryProfileBackendStore();
  const record = createLatestSnapshotRecord();

  const saved = store.saveLatestSnapshot(record);
  saved.snapshot.profile.displayName = "changed-output";

  assert.equal(
    store.getLatestSnapshotByOwnerId(owner.id).snapshot.profile.displayName,
    sampleProfileSnapshot.profile.displayName
  );
  assert.deepEqual(store.getLatestSnapshotByHandle(owner.handle), record);
});

test("updates latest snapshot handle index", () => {
  const store = createMemoryProfileBackendStore();

  store.saveLatestSnapshot(createLatestSnapshotRecord({ handle: "old-handle" }));
  store.saveLatestSnapshot(createLatestSnapshotRecord({ handle: "new-handle" }));

  assert.equal(store.getLatestSnapshotByHandle("old-handle"), null);
  assert.equal(store.getLatestSnapshotByHandle("new-handle").ownerId, owner.id);
});

test("enforces latest snapshot handle conflicts", () => {
  const store = createMemoryProfileBackendStore();

  store.saveLatestSnapshot(createLatestSnapshotRecord());

  assertBackendError(
    () => store.saveLatestSnapshot(createLatestSnapshotRecord({
      ownerId: "owner_2",
      handle: owner.handle
    })),
    PROFILE_BACKEND_ERROR_CODES.CONFLICT
  );
});

test("validates required record fields", () => {
  const store = createMemoryProfileBackendStore();

  assertBackendError(
    () => store.saveOwner({ ...owner, id: "" }),
    PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED
  );
  assertBackendError(
    () => store.saveCliToken({ id: "cli_token_1" }),
    PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED
  );
  assertBackendError(
    () => store.saveOAuthState({ id: "oauth_state_1" }),
    PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED
  );
  assertBackendError(
    () => store.saveSession({ id: "session_1" }),
    PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED
  );
  assertBackendError(
    () => store.saveLatestSnapshot(null),
    PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED
  );
});

function assertBackendError(callback, code) {
  assert.throws(callback, (error) => {
    assert.equal(error instanceof ProfileBackendError, true);
    assert.equal(error.code, code);
    return true;
  });
}

function createLatestSnapshotRecord(overrides = {}) {
  return {
    ownerId: owner.id,
    handle: owner.handle,
    visibility: PROFILE_VISIBILITY.PUBLIC,
    capturedAt: sampleProfileSnapshot.capturedAt,
    uploadedAt: "2026-06-08T00:00:00.000Z",
    schemaVersion: sampleProfileSnapshot.schemaVersion,
    snapshot: sampleProfileSnapshot,
    ...overrides
  };
}
