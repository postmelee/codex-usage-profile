import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  PROFILE_BACKEND_ERROR_CODES,
  PROFILE_BACKEND_STORE_ATOMIC_OPERATIONS,
  PROFILE_BACKEND_STORE_CONTRACT_VERSION,
  PROFILE_BACKEND_STORE_RECORDS,
  PROFILE_VISIBILITY,
  ProfileBackendError,
  assertProfileBackendStoreContract,
  createFileProfileBackendStore,
  createMemoryProfileBackendStore
} from "../index.js";

test("memory and file stores satisfy the executable structured-store surface", () => {
  const memoryStore = createMemoryProfileBackendStore();
  const filePath = join(mkdtempSync(join(tmpdir(), "cup-contract-")), "store.json");
  const fileStore = createFileProfileBackendStore({ filePath });

  assert.equal(PROFILE_BACKEND_STORE_CONTRACT_VERSION, 2);
  assert.equal(typeof memoryStore.atomic.completeOAuthCallback, "function");
  assert.equal(typeof fileStore.atomic.submitAccountUsage, "function");
  assert.equal(assertProfileBackendStoreContract(memoryStore), memoryStore);
  assert.equal(assertProfileBackendStoreContract(fileStore), fileStore);
  assert.throws(
    () => assertProfileBackendStoreContract({ getOwnerById() {} }),
    /profile backend store is missing methods/
  );
});

test("contract records owner scope and all multi-record atomic operations", () => {
  assert.deepEqual(Object.keys(PROFILE_BACKEND_STORE_RECORDS).sort(), [
    "cliLoginChallenge",
    "cliToken",
    "latestSnapshot",
    "latestUsage",
    "oauthState",
    "owner",
    "session",
    "submittedDevice"
  ]);
  assert.deepEqual(Object.keys(PROFILE_BACKEND_STORE_ATOMIC_OPERATIONS).sort(), [
    "approveCliLogin",
    "completeOAuthCallback",
    "exchangeCliLogin",
    "submitAccountUsage",
    "updateVisibility"
  ]);
  assert.deepEqual(PROFILE_BACKEND_STORE_RECORDS.oauthState.secretFields, ["id"]);
  assert.deepEqual(PROFILE_BACKEND_STORE_RECORDS.session.secretFields, ["id"]);

  for (const operation of Object.values(PROFILE_BACKEND_STORE_ATOMIC_OPERATIONS)) {
    assert.equal(operation.failurePolicy, "rollback");
    assert.equal(operation.records.length > 1, true);
    assert.equal(typeof operation.serializationKey, "string");
    assert.equal(typeof operation.invariant, "string");
  }
});

test("file-store fixture persists device ownership and rejects owner collisions", () => {
  const filePath = join(mkdtempSync(join(tmpdir(), "cup-contract-")), "store.json");
  const store = createFileProfileBackendStore({ filePath });
  const owner = createOwner();

  store.saveOwner(owner);
  store.saveSubmittedDevice({
    id: "device_1",
    ownerId: owner.id,
    deviceKey: "macbook",
    displayName: "MacBook",
    createdAt: "2026-07-21T00:00:00.000Z",
    updatedAt: "2026-07-21T00:00:00.000Z",
    lastSubmittedAt: "2026-07-21T00:00:00.000Z"
  });

  const reopened = createFileProfileBackendStore({ filePath });
  assert.equal(
    reopened.getSubmittedDeviceByOwnerAndKey(owner.id, "macbook").id,
    "device_1"
  );
  assert.throws(
    () => reopened.saveOwner(createOwner({
      id: "owner_2",
      providerUserId: "2",
      handle: owner.handle
    })),
    (error) => error instanceof ProfileBackendError &&
      error.code === PROFILE_BACKEND_ERROR_CODES.CONFLICT
  );
  assert.equal(reopened.getSubmittedDeviceByOwnerAndKey("owner_2", "macbook"), null);
});

function createOwner(overrides = {}) {
  return {
    id: "owner_1",
    authProvider: "github",
    providerUserId: "1",
    githubLogin: "postmelee",
    handle: "postmelee",
    visibility: PROFILE_VISIBILITY.PRIVATE,
    ...overrides
  };
}
