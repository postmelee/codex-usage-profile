import assert from "node:assert/strict";
import test from "node:test";

import {
  PROFILE_BACKEND_ATOMIC_OPERATION_NAMES,
  assertProfileBackendAtomicCommand,
  assertProfileBackendAtomicOperations,
  assertProfileBackendAtomicResult,
  createMemoryProfileBackendStore
} from "../index.js";

test("contract v2 fixes the named atomic operations", () => {
  assert.deepEqual(PROFILE_BACKEND_ATOMIC_OPERATION_NAMES, [
    "approveCliLogin",
    "completeOAuthCallback",
    "exchangeCliLogin",
    "submitAccountUsage",
    "updateCardSettings",
    "updateVisibility"
  ]);
  const store = createMemoryProfileBackendStore();
  assert.equal(assertProfileBackendAtomicOperations(store.atomic), store.atomic);
});

test("atomic command and result assertions reject incomplete adapter payloads", () => {
  assert.throws(
    () => assertProfileBackendAtomicCommand("approveCliLogin", {
      challengeId: "challenge_1"
    }),
    /missing fields: ownerId, now/
  );
  assert.throws(
    () => assertProfileBackendAtomicCommand("unknown", {}),
    /Unknown profile backend atomic operation/
  );
  assert.throws(
    () => assertProfileBackendAtomicResult("exchangeCliLogin", {
      challenge: {}
    }),
    /missing fields: token, tokenRecord/
  );
  assert.throws(
    () => assertProfileBackendAtomicOperations({
      approveCliLogin() {}
    }),
    /missing operations/
  );
  assert.throws(
    () => assertProfileBackendAtomicCommand("updateVisibility", {
      ownerId: "owner_1",
      expectedOwnerUpdatedAt: "2026-07-23T00:00:00.000Z",
      visibility: "public",
      updatedAt: "2026-07-23T00:00:00.000Z"
    }),
    /must advance the owner revision/
  );
});
