import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCOUNT_USAGE_CONTRACT_VERSION
} from "../../profile-card/account-usage.js";
import { sampleAccountUsageReadResult } from "../../profile-card/fixtures/sample-account-usage.js";
import {
  CLI_TOKEN_PREFIX,
  PROFILE_BACKEND_ERROR_CODES,
  PROFILE_VISIBILITY,
  ProfileBackendError,
  createAccountUsageSubmitService,
  createCliLoginService,
  createCliTokenService,
  createMemoryProfileBackendStore,
  createOAuthRuntimeService,
  createTransactionalProfileBackendAtomicOperations
} from "../index.js";
import { createProfileCardService } from "../../profile-card/service.js";

const OWNER = Object.freeze({
  id: "owner_1",
  authProvider: "github",
  providerUserId: "1",
  githubLogin: "postmelee",
  handle: "postmelee",
  visibility: PROFILE_VISIBILITY.PRIVATE,
  createdAt: "2026-07-11T00:00:00.000Z",
  updatedAt: "2026-07-11T00:00:00.000Z"
});

// --- transaction primitive: all-or-nothing -----------------------------------

test("transaction commits every write when the runner resolves", async () => {
  const store = createMemoryProfileBackendStore();

  const result = await store.transaction((tx) => {
    tx.saveOwner(OWNER);
    tx.saveSession({
      id: "session_1",
      ownerId: OWNER.id,
      expiresAt: "2026-08-01T00:00:00.000Z"
    });
    return "committed";
  });

  assert.equal(result, "committed");
  assert.equal(store.getOwnerById(OWNER.id).handle, "postmelee");
  assert.equal(store.getSession("session_1").ownerId, OWNER.id);
});

test("transaction rolls back all writes when the runner throws synchronously", async () => {
  const store = createMemoryProfileBackendStore();
  store.saveOwner(OWNER);

  await assert.rejects(
    async () => store.transaction((tx) => {
      tx.saveSession({
        id: "session_1",
        ownerId: OWNER.id,
        expiresAt: "2026-08-01T00:00:00.000Z"
      });
      tx.saveOAuthState({
        id: "oauth_1",
        status: "pending",
        expiresAt: "2026-08-01T00:00:00.000Z"
      });
      throw new Error("boom");
    }),
    /boom/
  );

  // No partial commit: neither the session nor the oauth state survives.
  assert.equal(store.getSession("session_1"), null);
  assert.equal(store.getOAuthState("oauth_1"), null);
  // Writes made before the transaction remain intact.
  assert.equal(store.getOwnerById(OWNER.id).handle, "postmelee");
});

test("transaction rolls back when an async runner rejects", async () => {
  const store = createMemoryProfileBackendStore();

  await assert.rejects(
    () => store.transaction(async (tx) => {
      tx.saveOwner(OWNER);
      await Promise.resolve();
      throw new ProfileBackendError(
        PROFILE_BACKEND_ERROR_CODES.CONFLICT,
        "late failure"
      );
    }),
    (error) => error.code === PROFILE_BACKEND_ERROR_CODES.CONFLICT
  );

  assert.equal(store.getOwnerById(OWNER.id), null);
});

test("serializes overlapping transactions so a rollback cannot erase a commit", async () => {
  const store = createMemoryProfileBackendStore();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });

  // The failing transaction parks mid-runner; the committing transaction is
  // requested while the first still holds the queue.
  const failing = store.transaction(async (tx) => {
    tx.saveOwner({ ...OWNER, id: "owner_a", providerUserId: "a", handle: "handle-a" });
    await gate;
    throw new Error("boom");
  });
  const committing = store.transaction((tx) => {
    tx.saveOwner({ ...OWNER, id: "owner_b", providerUserId: "b", handle: "handle-b" });
    return "committed";
  });

  // Let the first runner start and park on the gate: the second transaction
  // must not have run yet while the first holds the queue.
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(store.getOwnerById("owner_b"), null);

  release();
  await assert.rejects(failing, /boom/);
  assert.equal(await committing, "committed");

  // The rollback of the first transaction must not erase the second commit.
  assert.equal(store.getOwnerById("owner_a"), null);
  assert.equal(store.getOwnerById("owner_b").id, "owner_b");
});

test("rejects a nested transaction and keeps the queue usable", async () => {
  const store = createMemoryProfileBackendStore();

  await assert.rejects(
    () => store.transaction(async (tx) => {
      tx.saveOwner({ ...OWNER, id: "owner_x", providerUserId: "x", handle: "handle-x" });
      await store.transaction(() => {});
    }),
    /Nested store transactions are not supported/
  );

  // The outer transaction rolled back and the queue is not poisoned.
  assert.equal(store.getOwnerById("owner_x"), null);
  const result = await store.transaction((tx) => {
    tx.saveOwner(OWNER);
    return "ok";
  });
  assert.equal(result, "ok");
  assert.equal(store.getOwnerById(OWNER.id).handle, "postmelee");
});

// --- completeOAuthCallback: one callback consumes a pending state ------------

test("completeOAuthCallback consumes a pending state exactly once", async () => {
  const { service, store } = createOAuthFixture();
  const { oauthState } = await service.startGitHubLogin({ githubClientId: "client-1" });

  const result = await service.completeGitHubCallback({
    code: "code-1",
    state: oauthState.id
  });

  assert.equal(result.oauthState.status, "consumed");
  assert.equal(store.getOwnerById(result.owner.id).githubLogin, "postmelee");
  assert.equal(store.getSession(result.session.id).ownerId, result.owner.id);

  // A replayed callback for the same state is rejected (already consumed).
  await assert.rejects(
    () => service.completeGitHubCallback({ code: "code-1", state: oauthState.id }),
    (error) => error.code === PROFILE_BACKEND_ERROR_CODES.GONE
  );

  // Exactly one owner and one session exist for the consumed state.
  assert.equal(store.listOwners().length, 1);
});

// --- approveCliLogin / exchangeCliLogin -------------------------------------

test("approveCliLogin approves a pending challenge once", async () => {
  const { cli, store } = createCliFixture();
  store.saveOwner(OWNER);
  const started = await cli.startCliLogin();

  const approved = await cli.approveCliLogin({
    challengeId: started.challenge.id,
    ownerId: OWNER.id
  });
  assert.equal(approved.status, "approved");
  assert.equal(approved.ownerId, OWNER.id);

  await cli.exchangeCliLogin({ challengeId: started.challenge.id });

  // Re-approving an exchanged challenge is rejected.
  await assert.rejects(
    () => cli.approveCliLogin({ challengeId: started.challenge.id, ownerId: OWNER.id }),
    (error) => error.code === PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST
  );
});

test("exchangeCliLogin issues exactly one token for an approved challenge", async () => {
  const { cli, store } = createCliFixture();
  store.saveOwner(OWNER);
  const started = await cli.startCliLogin();
  await cli.approveCliLogin({ challengeId: started.challenge.id, ownerId: OWNER.id });

  const exchanged = await cli.exchangeCliLogin({ challengeId: started.challenge.id });
  assert.equal(exchanged.challenge.status, "exchanged");
  assert.equal(store.listCliTokensByOwnerId(OWNER.id).length, 1);

  // A second exchange for the same challenge is rejected and issues no token.
  await assert.rejects(
    () => cli.exchangeCliLogin({ challengeId: started.challenge.id }),
    (error) => error.code === PROFILE_BACKEND_ERROR_CODES.GONE
  );
  assert.equal(store.listCliTokensByOwnerId(OWNER.id).length, 1);
});

// --- submitAccountUsage: stale / conflict / idempotent / new -----------------

test("submitAccountUsage decides stale, conflict, idempotent and new atomically", async () => {
  const { service, store, token } = await createUsageFixture();

  const first = await service.submitAccountUsage({
    token,
    device: { id: "device_1", name: "MacBook" },
    document: createDocument()
  });
  assert.equal(first.idempotent, false);

  // Exact retry is idempotent and does not change the stored revision.
  const repeated = await service.submitAccountUsage({
    token,
    device: { id: "device_1", name: "MacBook" },
    document: createDocument()
  });
  assert.equal(repeated.idempotent, true);
  assert.equal(
    store.getLatestUsageByOwnerId(OWNER.id).contentDigest,
    first.usageRecord.contentDigest
  );

  // Same capturedAt with different content is a conflict.
  await assert.rejects(
    () => service.submitAccountUsage({
      token,
      document: createDocument({
        summary: {
          ...sampleAccountUsageReadResult.summary,
          lifetimeTokens: sampleAccountUsageReadResult.summary.lifetimeTokens + 5
        }
      })
    }),
    (error) => error.code === PROFILE_BACKEND_ERROR_CODES.CONFLICT
  );

  // Older capturedAt is stale.
  await assert.rejects(
    () => service.submitAccountUsage({
      token,
      document: createDocument({ capturedAt: "2026-07-10T00:00:00.000Z" })
    }),
    (error) => error.code === PROFILE_BACKEND_ERROR_CODES.CONFLICT
  );

  // A newer capturedAt is accepted as a new revision.
  const newer = await service.submitAccountUsage({
    token,
    document: createDocument({ capturedAt: "2026-07-11T00:01:00.000Z" })
  });
  assert.equal(newer.idempotent, false);
  assert.notEqual(newer.usageRecord.contentDigest, first.usageRecord.contentDigest);
});

test("submitAccountUsage rolls back the device touch when the usage save fails", async () => {
  const base = await createUsageFixture();
  // Wrap the store so the usage save throws inside the transaction, proving the
  // device touch committed earlier in the same transaction is rolled back.
  const failingStore = Object.create(base.store);
  failingStore.transaction = (runner) => base.store.transaction((tx) => {
    const txProxy = new Proxy(tx, {
      get(target, property, receiver) {
        if (property === "saveLatestUsage") {
          return () => {
            throw new ProfileBackendError(
              PROFILE_BACKEND_ERROR_CODES.CONFLICT,
              "injected failure"
            );
          };
        }
        return Reflect.get(target, property, receiver);
      }
    });
    return runner(txProxy);
  });
  failingStore.atomic = createTransactionalProfileBackendAtomicOperations(failingStore);

  const service = createAccountUsageSubmitService({
    store: failingStore,
    now: base.now,
    createId: () => "submitted_device_1"
  });

  await assert.rejects(
    () => service.submitAccountUsage({
      token: base.token,
      device: { id: "device_1", name: "MacBook" },
      document: createDocument()
    }),
    /injected failure/
  );

  assert.equal(base.store.getLatestUsageByOwnerId(OWNER.id), null);
  assert.equal(base.store.getSubmittedDeviceByOwnerAndKey(OWNER.id, "device_1"), null);
});

// --- updateVisibility: owner and latest usage stay in sync ------------------

test("updateVisibility exposes one visibility revision for owner and latest usage", async () => {
  const { usageService, cardService, store, token } = await createVisibilityFixture();
  await usageService.submitAccountUsage({
    token,
    document: createDocument()
  });

  const published = await cardService.updateVisibility({
    ownerId: OWNER.id,
    visibility: PROFILE_VISIBILITY.PUBLIC
  });

  assert.equal(published.owner.visibility, PROFILE_VISIBILITY.PUBLIC);
  assert.equal(published.usageRecord.visibility, PROFILE_VISIBILITY.PUBLIC);
  assert.equal(store.getOwnerById(OWNER.id).visibility, PROFILE_VISIBILITY.PUBLIC);
  assert.equal(store.getLatestUsageByOwnerId(OWNER.id).visibility, PROFILE_VISIBILITY.PUBLIC);
});

test("updateVisibility keeps the legacy latest snapshot on the same visibility revision", async () => {
  const { usageService, cardService, store, token } = await createVisibilityFixture();
  await usageService.submitAccountUsage({
    token,
    document: createDocument()
  });
  store.saveLatestSnapshot({
    ownerId: OWNER.id,
    handle: OWNER.handle,
    visibility: PROFILE_VISIBILITY.PRIVATE,
    capturedAt: "2026-07-11T00:00:00.000Z",
    uploadedAt: "2026-07-11T00:01:00.000Z",
    schemaVersion: 2,
    snapshot: { schemaVersion: 2 }
  });

  await cardService.updateVisibility({
    ownerId: OWNER.id,
    visibility: PROFILE_VISIBILITY.PUBLIC
  });
  assert.equal(
    store.getLatestSnapshotByOwnerId(OWNER.id).visibility,
    PROFILE_VISIBILITY.PUBLIC
  );

  // Turning private must also hide the legacy snapshot record.
  await cardService.updateVisibility({
    ownerId: OWNER.id,
    visibility: PROFILE_VISIBILITY.PRIVATE
  });
  assert.equal(
    store.getLatestSnapshotByOwnerId(OWNER.id).visibility,
    PROFILE_VISIBILITY.PRIVATE
  );
  assert.equal(
    store.getLatestUsageByOwnerId(OWNER.id).visibility,
    PROFILE_VISIBILITY.PRIVATE
  );
});

// --- fixtures ----------------------------------------------------------------

function createOAuthFixture() {
  const store = createMemoryProfileBackendStore();
  let id = 0;
  const service = createOAuthRuntimeService({
    store,
    now: () => new Date("2026-07-11T00:00:00.000Z"),
    createId: (prefix) => `${prefix}_${(id += 1)}`,
    githubClientId: "client-1",
    githubClient: {
      async exchangeCodeForToken() {
        return { accessToken: "gho_test_access_token_value_1234567890" };
      },
      async getAuthenticatedUser() {
        return { id: "12345", login: "postmelee", name: "Post Melee" };
      }
    }
  });
  return { service, store };
}

function createCliFixture() {
  const store = createMemoryProfileBackendStore();
  let id = 0;
  const cli = createCliLoginService({
    store,
    now: () => new Date("2026-07-11T00:00:00.000Z"),
    createId: (prefix) => `${prefix}_${(id += 1)}`,
    createDeviceCode: () => "cup_device_fixed_code",
    createUserCode: () => "ABCD-2345",
    tokenService: createCliTokenService({
      store,
      now: () => new Date("2026-07-11T00:00:00.000Z"),
      createId: (prefix) => `${prefix}_${(id += 1)}`,
      createToken: () => `${CLI_TOKEN_PREFIX}fixed_cli_token`
    })
  });
  return { cli, store };
}

async function createUsageFixture() {
  const store = createMemoryProfileBackendStore();
  const now = () => new Date("2026-07-11T00:02:00.000Z");
  store.saveOwner(OWNER);
  const tokenService = createCliTokenService({
    store,
    now,
    createId: () => "cli_token_1",
    createToken: () => `${CLI_TOKEN_PREFIX}fixed_usage_token`
  });
  const { token } = await tokenService.issueCliToken({ ownerId: OWNER.id });
  const service = createAccountUsageSubmitService({
    store,
    now,
    tokenService,
    createId: () => "submitted_device_1"
  });
  return { store, now, token, service };
}

async function createVisibilityFixture() {
  const store = createMemoryProfileBackendStore();
  const now = () => new Date("2026-07-11T00:02:00.000Z");
  store.saveOwner(OWNER);
  const tokenService = createCliTokenService({
    store,
    now,
    createId: () => "cli_token_1",
    createToken: () => `${CLI_TOKEN_PREFIX}fixed_visibility_token`
  });
  const { token } = await tokenService.issueCliToken({ ownerId: OWNER.id });
  const usageService = createAccountUsageSubmitService({
    store,
    now,
    tokenService,
    createId: () => "submitted_device_1"
  });
  const cardService = createProfileCardService({
    store,
    now,
    renderPng: () => Buffer.from("png")
  });
  return { store, now, token, tokenService, usageService, cardService };
}

function createDocument(overrides = {}) {
  return {
    contractVersion: ACCOUNT_USAGE_CONTRACT_VERSION,
    capturedAt: "2026-07-11T00:00:00.000Z",
    summary: structuredClone(sampleAccountUsageReadResult.summary),
    dailyUsageBuckets: structuredClone(sampleAccountUsageReadResult.dailyUsageBuckets),
    ...overrides
  };
}
