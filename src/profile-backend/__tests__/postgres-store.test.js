import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import pg from "pg";

import {
  ACCOUNT_USAGE_CONTRACT_VERSION
} from "../../profile-card/account-usage.js";
import { sampleAccountUsageReadResult } from "../../profile-card/fixtures/sample-account-usage.js";
import { createProfileCardService } from "../../profile-card/service.js";
import {
  CLI_TOKEN_PREFIX,
  PROFILE_BACKEND_ERROR_CODES,
  PROFILE_VISIBILITY,
  assertProfileBackendStoreContract,
  createAccountUsageSubmitService,
  createCliLoginService,
  createCliTokenService,
  createOAuthRuntimeService
} from "../index.js";
import { loadMigrations, migrateUp } from "../postgres/migrate.js";
import { createPostgresProfileBackendStore } from "../postgres/store.js";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "";
const skipWithoutDatabase = TEST_DATABASE_URL === ""
  ? "TEST_DATABASE_URL is not set"
  : false;

const OWNER = Object.freeze({
  id: "owner_1",
  authProvider: "github",
  providerUserId: "1",
  githubLogin: "postmelee",
  displayName: "Post Melee",
  avatarUrl: null,
  profileUrl: null,
  handle: "postmelee",
  visibility: PROFILE_VISIBILITY.PRIVATE,
  cardStyle: {
    schemaVersion: 1,
    theme: "dark",
    effect: { preset: "none", version: 1 }
  },
  createdAt: "2026-07-11T00:00:00.000Z",
  updatedAt: "2026-07-11T00:00:00.000Z"
});

test("postgres adapter", { skip: skipWithoutDatabase }, async (t) => {
  const schema = `cup_store_${randomBytes(4).toString("hex")}`;
  const admin = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  await admin.query(`SET search_path TO ${schema}`);

  const pool = new pg.Pool({
    connectionString: TEST_DATABASE_URL,
    max: 4,
    options: `-csearch_path=${schema}`
  });
  const store = createPostgresProfileBackendStore({ pool });

  try {
    await t.test("readiness fails closed before migrations run", async () => {
      await assert.rejects(
        () => store.verifyReadiness(),
        /schema is not migrated/
      );
    });

    await migrateUp({ client: admin, migrations: await loadMigrations() });

    await t.test("satisfies the store contract surface and readiness", async () => {
      assert.equal(assertProfileBackendStoreContract(store), store);
      assert.deepEqual(await store.verifyReadiness(), { appliedVersions: [1, 2, 3] });
    });

    await t.test("round-trips owners with validation and unique conflicts", async () => {
      await store.clear();

      const saved = await store.saveOwner(OWNER);
      assert.deepEqual(saved, OWNER);
      assert.deepEqual(await store.getOwnerById(OWNER.id), OWNER);
      assert.deepEqual(await store.getOwnerByHandle(OWNER.handle), OWNER);
      assert.deepEqual(
        await store.getOwnerByProviderIdentity("github", "1"),
        OWNER
      );
      assert.deepEqual((await store.listOwners()).length, 1);

      await expectCode(
        () => store.saveOwner({ ...OWNER, handle: null }),
        PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
        /owner is missing handle/
      );
      await expectCode(
        () => store.saveOwner({ ...OWNER, id: "owner_2", providerUserId: "2" }),
        PROFILE_BACKEND_ERROR_CODES.CONFLICT,
        /Handle already belongs to another owner/
      );
      await expectCode(
        () => store.saveOwner({ ...OWNER, id: "owner_2", handle: "other" }),
        PROFILE_BACKEND_ERROR_CODES.CONFLICT,
        /Provider identity already belongs to another owner/
      );
    });

    await t.test("round-trips credentials with digest uniqueness and ordering", async () => {
      await store.clear();
      await store.saveOwner(OWNER);

      await store.saveCliToken({
        id: "cli_token_1",
        ownerId: OWNER.id,
        tokenDigest: "digest-1",
        label: "first",
        scopes: ["snapshot:write"],
        sourceChallengeId: null,
        createdAt: "2026-07-11T00:01:00.000Z",
        expiresAt: "2027-07-11T00:01:00.000Z",
        revokedAt: null,
        lastUsedAt: null
      });
      await store.saveCliToken({
        id: "cli_token_2",
        ownerId: OWNER.id,
        tokenDigest: "digest-2",
        label: "second",
        scopes: ["snapshot:write"],
        sourceChallengeId: null,
        createdAt: "2026-07-11T00:02:00.000Z",
        expiresAt: "2027-07-11T00:02:00.000Z",
        revokedAt: null,
        lastUsedAt: null
      });

      const tokens = await store.listCliTokensByOwnerId(OWNER.id);
      assert.deepEqual(tokens.map((token) => token.id), ["cli_token_2", "cli_token_1"]);
      assert.deepEqual(tokens[0].scopes, ["snapshot:write"]);
      assert.equal((await store.getCliTokenByDigest("digest-1")).id, "cli_token_1");

      await expectCode(
        () => store.saveCliToken({
          id: "cli_token_3",
          ownerId: OWNER.id,
          tokenDigest: "digest-1"
        }),
        PROFILE_BACKEND_ERROR_CODES.CONFLICT,
        /Token digest already belongs to another CLI token/
      );

      assert.equal(await store.deleteCliToken("cli_token_2"), true);
      assert.equal(await store.deleteCliToken("cli_token_2"), false);
      assert.equal(await store.getCliTokenById("cli_token_2"), null);

      await store.saveCliLoginChallenge({
        id: "cli_login_1",
        status: "pending",
        deviceCodeDigest: "device-digest-1",
        userCode: "ABCD-2345",
        expiresAt: "2026-07-11T00:10:00.000Z"
      });
      assert.equal(
        (await store.getCliLoginChallengeByDeviceCodeDigest("device-digest-1")).id,
        "cli_login_1"
      );
      assert.equal(
        (await store.getCliLoginChallengeByUserCode("ABCD-2345")).id,
        "cli_login_1"
      );
      await expectCode(
        () => store.saveCliLoginChallenge({
          id: "cli_login_2",
          userCode: "ABCD-2345"
        }),
        PROFILE_BACKEND_ERROR_CODES.CONFLICT,
        /User code already belongs to another CLI login challenge/
      );
    });

    await t.test("keeps one latest record per owner with cross-owner handle protection", async () => {
      await store.clear();
      await store.saveOwner(OWNER);

      const usage = {
        ownerId: OWNER.id,
        handle: OWNER.handle,
        visibility: PROFILE_VISIBILITY.PRIVATE,
        contractVersion: ACCOUNT_USAGE_CONTRACT_VERSION,
        capturedAt: "2026-07-11T00:00:00.000Z",
        uploadedAt: "2026-07-11T00:01:00.000Z",
        contentDigest: "content-1",
        usage: structuredClone(sampleAccountUsageReadResult)
      };
      await store.saveLatestUsage(usage);
      assert.equal(
        (await store.getLatestUsageByOwnerId(OWNER.id)).contentDigest,
        "content-1"
      );

      // Re-saving for the same owner replaces the row and can move the handle.
      await store.saveLatestUsage({ ...usage, handle: "moved", contentDigest: "content-2" });
      assert.equal(await store.getLatestUsageByHandle(OWNER.handle), null);
      assert.equal((await store.getLatestUsageByHandle("moved")).contentDigest, "content-2");

      await expectCode(
        () => store.saveLatestUsage({ ...usage, ownerId: "owner_2", handle: "moved" }),
        PROFILE_BACKEND_ERROR_CODES.CONFLICT,
        /Usage handle already belongs to another owner/
      );

      await store.saveLatestSnapshot({
        ownerId: OWNER.id,
        handle: OWNER.handle,
        visibility: PROFILE_VISIBILITY.PRIVATE,
        capturedAt: "2026-07-11T00:00:00.000Z",
        uploadedAt: "2026-07-11T00:01:00.000Z",
        schemaVersion: 2,
        snapshot: { schemaVersion: 2 }
      });
      assert.deepEqual(
        (await store.getLatestSnapshotByOwnerId(OWNER.id)).snapshot,
        { schemaVersion: 2 }
      );

      await store.saveSubmittedDevice({
        id: "device_1",
        ownerId: OWNER.id,
        deviceKey: "macbook",
        displayName: "MacBook",
        createdAt: "2026-07-11T00:00:00.000Z",
        updatedAt: "2026-07-11T00:00:00.000Z",
        lastSubmittedAt: "2026-07-11T00:00:00.000Z"
      });
      await expectCode(
        () => store.saveSubmittedDevice({
          id: "device_2",
          ownerId: OWNER.id,
          deviceKey: "macbook",
          displayName: null,
          createdAt: "2026-07-11T00:01:00.000Z",
          updatedAt: "2026-07-11T00:01:00.000Z",
          lastSubmittedAt: "2026-07-11T00:01:00.000Z"
        }),
        PROFILE_BACKEND_ERROR_CODES.CONFLICT,
        /Submitted device key already belongs to another device/
      );
    });

    await t.test("commits transactions atomically and rolls back on failure", async () => {
      await store.clear();

      await store.transaction(async (tx) => {
        await tx.saveOwner(OWNER);
        await tx.saveSession({
          id: "session_1",
          ownerId: OWNER.id,
          createdAt: "2026-07-11T00:00:00.000Z",
          expiresAt: "2026-08-11T00:00:00.000Z",
          revokedAt: null
        });
      });
      assert.equal((await store.getSession("session_1")).ownerId, OWNER.id);

      await assert.rejects(
        () => store.transaction(async (tx) => {
          await tx.saveSession({
            id: "session_2",
            ownerId: OWNER.id,
            expiresAt: "2026-08-11T00:00:00.000Z"
          });
          throw new Error("boom");
        }),
        /boom/
      );
      assert.equal(await store.getSession("session_2"), null);

      assert.throws(
        () => store.transaction("not a function"),
        /transaction runner must be a function/
      );
      await assert.rejects(
        () => store.transaction(async () => {
          await store.transaction(() => {});
        }),
        /Nested store transactions are not supported/
      );
    });

    await t.test("locks serialization rows inside transactions", async () => {
      await store.clear();
      await store.saveOAuthState({
        id: "lock_state",
        status: "pending",
        expiresAt: "2027-01-01T00:00:00.000Z"
      });

      const order = [];
      const first = store.transaction(async (tx) => {
        await tx.getOAuthState("lock_state");
        order.push("first-read");
        await sleep(200);
        order.push("first-done");
      });
      await sleep(60);
      const second = store.transaction(async (tx) => {
        await tx.getOAuthState("lock_state");
        order.push("second-read");
      });

      await Promise.all([first, second]);
      assert.deepEqual(order, ["first-read", "first-done", "second-read"]);
    });

    await t.test("runs the five atomic operations end to end", async () => {
      await store.clear();
      let id = 0;
      const createId = (prefix) => `${prefix}_${(id += 1)}`;
      const now = () => new Date("2026-07-11T00:02:00.000Z");

      // completeOAuthCallback: exactly one consumer.
      const oauthService = createOAuthRuntimeService({
        store,
        now,
        createId,
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
      const { oauthState } = await oauthService.startGitHubLogin({});
      const callback = await oauthService.completeGitHubCallback({
        code: "code-1",
        state: oauthState.id
      });
      assert.equal(callback.oauthState.status, "consumed");
      await expectCode(
        () => oauthService.completeGitHubCallback({ code: "code-1", state: oauthState.id }),
        PROFILE_BACKEND_ERROR_CODES.GONE
      );

      // approveCliLogin + exchangeCliLogin: one approval, one token.
      const cliService = createCliLoginService({
        store,
        now,
        createId,
        createDeviceCode: () => "cup_device_fixed_code",
        createUserCode: () => "ABCD-2345",
        tokenService: createCliTokenService({
          store,
          now,
          createId,
          createToken: () => `${CLI_TOKEN_PREFIX}postgres_cli_token`
        })
      });
      const started = await cliService.startCliLogin({ intent: "submit" });
      assert.equal(started.challenge.intent, "submit");
      await cliService.approveCliLogin({
        challengeId: started.challenge.id,
        ownerId: callback.owner.id
      });
      const exchanged = await cliService.exchangeCliLogin({
        challengeId: started.challenge.id
      });
      assert.equal(exchanged.challenge.status, "exchanged");
      await expectCode(
        () => cliService.exchangeCliLogin({ challengeId: started.challenge.id }),
        PROFILE_BACKEND_ERROR_CODES.GONE
      );
      assert.equal((await store.listCliTokensByOwnerId(callback.owner.id)).length, 1);

      // submitAccountUsage: new / idempotent / conflict / stale.
      const usageService = createAccountUsageSubmitService({
        store,
        now,
        createId
      });
      const first = await usageService.submitAccountUsage({
        token: exchanged.token,
        device: { id: "device_1", name: "MacBook" },
        document: createDocument()
      });
      assert.equal(first.idempotent, false);
      const repeated = await usageService.submitAccountUsage({
        token: exchanged.token,
        device: { id: "device_1", name: "MacBook" },
        document: createDocument()
      });
      assert.equal(repeated.idempotent, true);
      await expectCode(
        () => usageService.submitAccountUsage({
          token: exchanged.token,
          document: createDocument({
            summary: {
              ...sampleAccountUsageReadResult.summary,
              lifetimeTokens: sampleAccountUsageReadResult.summary.lifetimeTokens + 5
            }
          })
        }),
        PROFILE_BACKEND_ERROR_CODES.CONFLICT
      );
      await expectCode(
        () => usageService.submitAccountUsage({
          token: exchanged.token,
          document: createDocument({ capturedAt: "2026-07-10T00:00:00.000Z" })
        }),
        PROFILE_BACKEND_ERROR_CODES.CONFLICT
      );

      // updateVisibility: owner, latest usage and legacy snapshot together.
      await store.saveLatestSnapshot({
        ownerId: callback.owner.id,
        handle: callback.owner.handle,
        visibility: PROFILE_VISIBILITY.PRIVATE,
        capturedAt: "2026-07-11T00:00:00.000Z",
        uploadedAt: "2026-07-11T00:01:00.000Z",
        schemaVersion: 2,
        snapshot: { schemaVersion: 2 }
      });
      const cardService = createProfileCardService({
        store,
        now,
        renderPng: () => Buffer.from("png")
      });
      const published = await cardService.updateVisibility({
        ownerId: callback.owner.id,
        visibility: PROFILE_VISIBILITY.PUBLIC
      });
      assert.equal(published.owner.visibility, PROFILE_VISIBILITY.PUBLIC);
      assert.equal(
        (await store.getLatestUsageByOwnerId(callback.owner.id)).visibility,
        PROFILE_VISIBILITY.PUBLIC
      );
      assert.equal(
        (await store.getLatestSnapshotByOwnerId(callback.owner.id)).visibility,
        PROFILE_VISIBILITY.PUBLIC
      );
    });

    await t.test("exports and clears the full state", async () => {
      const exported = await store.exportState();
      assert.equal(exported.owners.length >= 1, true);
      assert.equal(exported.latestUsages.length >= 1, true);

      await store.clear();
      const cleared = await store.exportState();
      for (const key of [
        "owners",
        "oauthStates",
        "sessions",
        "cliLoginChallenges",
        "cliTokens",
        "latestSnapshots",
        "latestUsages",
        "submittedDevices"
      ]) {
        assert.deepEqual(cleared[key], []);
      }
    });
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {});
    await admin.end();
  }
});

function createDocument(overrides = {}) {
  return {
    contractVersion: ACCOUNT_USAGE_CONTRACT_VERSION,
    capturedAt: "2026-07-11T00:00:00.000Z",
    summary: structuredClone(sampleAccountUsageReadResult.summary),
    dailyUsageBuckets: structuredClone(sampleAccountUsageReadResult.dailyUsageBuckets),
    ...overrides
  };
}

async function expectCode(callback, code, messagePattern) {
  await assert.rejects(async () => callback(), (error) => {
    assert.equal(error?.code, code, `expected ${code}, got ${error?.code}: ${error?.message}`);
    if (messagePattern) {
      assert.match(error.message, messagePattern);
    }
    return true;
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
