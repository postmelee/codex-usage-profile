import assert from "node:assert/strict";
import test from "node:test";

import {
  PROFILE_BACKEND_ERROR_CODES,
  PROFILE_VISIBILITY,
  ProfileBackendError,
  createMemoryProfileBackendStore
} from "../index.js";
import { sampleProfileSnapshot } from "../../profile-snapshot/fixtures/sample-snapshot.js";
import { sampleAccountUsageReadResult } from "../../profile-card/fixtures/sample-account-usage.js";

const owner = Object.freeze({
  id: "owner_1",
  authProvider: "github",
  providerUserId: "12345",
  githubLogin: "postmelee",
  handle: "postmelee",
  visibility: PROFILE_VISIBILITY.PUBLIC,
  cardLocale: "en",
  cardStyle: {
    schemaVersion: 1,
    theme: "dark",
    effect: { preset: "none", version: 1 }
  }
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
    intent: "submit",
    deviceCodeDigest: "device_digest_1",
    userCode: "ABCD-1234",
    expiresAt: "2026-06-08T00:10:00.000Z"
  };

  const saved = store.saveCliLoginChallenge(challenge);
  challenge.status = "changed-input";
  saved.status = "changed-output";

  assert.deepEqual(store.getCliLoginChallenge("challenge_1"), {
    id: "challenge_1",
    status: "pending",
    intent: "submit",
    deviceCodeDigest: "device_digest_1",
    userCode: "ABCD-1234",
    expiresAt: "2026-06-08T00:10:00.000Z"
  });
  assert.equal(
    store.getCliLoginChallengeByDeviceCodeDigest("device_digest_1").id,
    "challenge_1"
  );
  assert.equal(
    store.getCliLoginChallengeByUserCode("ABCD-1234").id,
    "challenge_1"
  );
});

test("updates CLI login challenge device and user code indexes", () => {
  const store = createMemoryProfileBackendStore();

  store.saveCliLoginChallenge({
    id: "challenge_1",
    status: "pending",
    deviceCodeDigest: "device_digest_1",
    userCode: "ABCD-1234"
  });
  store.saveCliLoginChallenge({
    id: "challenge_1",
    status: "approved",
    deviceCodeDigest: "device_digest_2",
    userCode: "WXYZ-9876"
  });

  assert.equal(store.getCliLoginChallengeByDeviceCodeDigest("device_digest_1"), null);
  assert.equal(store.getCliLoginChallengeByUserCode("ABCD-1234"), null);
  assert.equal(
    store.getCliLoginChallengeByDeviceCodeDigest("device_digest_2").status,
    "approved"
  );
  assert.equal(
    store.getCliLoginChallengeByUserCode("WXYZ-9876").status,
    "approved"
  );
});

test("enforces CLI login challenge device and user code conflicts", () => {
  const store = createMemoryProfileBackendStore();

  store.saveCliLoginChallenge({
    id: "challenge_1",
    status: "pending",
    deviceCodeDigest: "device_digest_1",
    userCode: "ABCD-1234"
  });

  assertBackendError(
    () => store.saveCliLoginChallenge({
      id: "challenge_2",
      status: "pending",
      deviceCodeDigest: "device_digest_1",
      userCode: "WXYZ-9876"
    }),
    PROFILE_BACKEND_ERROR_CODES.CONFLICT
  );
  assertBackendError(
    () => store.saveCliLoginChallenge({
      id: "challenge_3",
      status: "pending",
      deviceCodeDigest: "device_digest_3",
      userCode: "ABCD-1234"
    }),
    PROFILE_BACKEND_ERROR_CODES.CONFLICT
  );
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

test("saves and lists submitted devices by owner and device key", () => {
  const store = createMemoryProfileBackendStore();
  const first = createSubmittedDeviceRecord({
    id: "device_1",
    deviceKey: "machine-1",
    lastSubmittedAt: "2026-06-08T00:00:00.000Z"
  });
  const second = createSubmittedDeviceRecord({
    id: "device_2",
    deviceKey: "machine-2",
    lastSubmittedAt: "2026-06-08T00:01:00.000Z"
  });

  store.saveSubmittedDevice(first);
  store.saveSubmittedDevice(second);

  assert.deepEqual(store.getSubmittedDeviceById("device_1"), first);
  assert.equal(
    store.getSubmittedDeviceByOwnerAndKey(owner.id, "machine-1").id,
    "device_1"
  );
  assert.deepEqual(
    store.listSubmittedDevicesByOwnerId(owner.id).map((device) => device.id),
    ["device_2", "device_1"]
  );
});

test("enforces submitted device owner and key conflicts", () => {
  const store = createMemoryProfileBackendStore();
  store.saveSubmittedDevice(createSubmittedDeviceRecord({
    id: "device_1",
    deviceKey: "machine-1"
  }));

  assertBackendError(
    () => store.saveSubmittedDevice(createSubmittedDeviceRecord({
      id: "device_2",
      deviceKey: "machine-1"
    })),
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

test("saves, clones, and reindexes latest account usage by owner and handle", () => {
  const store = createMemoryProfileBackendStore();
  const record = createLatestUsageRecord({ handle: "old-handle" });
  const saved = store.saveLatestUsage(record);
  saved.usage.summary.lifetimeTokens = 1;
  store.saveLatestUsage(createLatestUsageRecord({ handle: "new-handle" }));

  assert.equal(
    store.getLatestUsageByOwnerId(owner.id).usage.summary.lifetimeTokens,
    sampleAccountUsageReadResult.summary.lifetimeTokens
  );
  assert.equal(store.getLatestUsageByHandle("old-handle"), null);
  assert.equal(store.getLatestUsageByHandle("new-handle").ownerId, owner.id);
  assertBackendError(
    () => store.saveLatestUsage(createLatestUsageRecord({
      ownerId: "owner_2", handle: "new-handle"
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
  assertBackendError(
    () => store.saveLatestUsage(null),
    PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED
  );
});

test("exports and hydrates memory store state", () => {
  const store = createMemoryProfileBackendStore();
  const snapshot = createLatestSnapshotRecord();
  const usage = createLatestUsageRecord();
  const device = createSubmittedDeviceRecord();

  store.saveOwner(owner);
  store.saveOAuthState({
    id: "oauth_state_1",
    status: "pending",
    expiresAt: "2026-06-08T00:10:00.000Z"
  });
  store.saveSession({
    id: "session_1",
    ownerId: owner.id,
    expiresAt: "2026-07-08T00:00:00.000Z"
  });
  store.saveCliLoginChallenge({
    id: "cli_login_1",
    status: "pending",
    expiresAt: "2026-06-08T00:10:00.000Z"
  });
  store.saveCliToken({
    id: "cli_token_1",
    ownerId: owner.id,
    tokenDigest: "digest_1"
  });
  store.saveSubmittedDevice(device);
  store.saveLatestSnapshot(snapshot);
  store.saveLatestUsage(usage);

  const hydrated = createMemoryProfileBackendStore(store.exportState());

  assert.deepEqual(hydrated.getOwnerById(owner.id), owner);
  assert.equal(hydrated.getOAuthState("oauth_state_1").status, "pending");
  assert.equal(hydrated.getSession("session_1").ownerId, owner.id);
  assert.equal(hydrated.getCliLoginChallenge("cli_login_1").status, "pending");
  assert.equal(hydrated.getCliTokenByDigest("digest_1").id, "cli_token_1");
  assert.deepEqual(hydrated.getSubmittedDeviceById(device.id), device);
  assert.deepEqual(hydrated.getLatestSnapshotByHandle(owner.handle), snapshot);
  assert.deepEqual(hydrated.getLatestUsageByHandle(owner.handle), usage);
});

test("validates memory store initial state shape", () => {
  assertBackendError(
    () => createMemoryProfileBackendStore({ schemaVersion: 999, owners: [] }),
    PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED
  );
  assertBackendError(
    () => createMemoryProfileBackendStore({ owners: ["not-object"] }),
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

function createLatestUsageRecord(overrides = {}) {
  return {
    ownerId: owner.id,
    handle: owner.handle,
    visibility: PROFILE_VISIBILITY.PUBLIC,
    capturedAt: "2026-06-11T00:00:00.000Z",
    uploadedAt: "2026-06-11T00:01:00.000Z",
    usage: sampleAccountUsageReadResult,
    ...overrides
  };
}

function createSubmittedDeviceRecord(overrides = {}) {
  return {
    id: "submitted_device_1",
    ownerId: owner.id,
    deviceKey: "machine-1",
    displayName: null,
    createdAt: "2026-06-08T00:00:00.000Z",
    updatedAt: "2026-06-08T00:00:00.000Z",
    lastSubmittedAt: "2026-06-08T00:00:00.000Z",
    ...overrides
  };
}
