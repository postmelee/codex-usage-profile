// Concurrency and failure-injection matrix for the Postgres adapter:
// the five atomic operations x { duplicate consumption, partial commit },
// plus secret-persistence and owner-scope checks against the live schema.
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
  createAccountUsageSubmitService,
  createCliLoginService,
  createCliTokenDigest,
  createCliTokenService,
  createDeviceCodeDigest,
  createOAuthRuntimeService
} from "../index.js";
import { loadMigrations, migrateUp } from "../postgres/migrate.js";
import { createPostgresProfileBackendStore } from "../postgres/store.js";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "";
const skipWithoutDatabase = TEST_DATABASE_URL === ""
  ? "TEST_DATABASE_URL is not set"
  : false;

const RAW_ACCESS_TOKEN = "gho_secret_scan_access_token_1234567890";
const RAW_DEVICE_CODE = "cup_device_secret_scan_code";
const RAW_CLI_TOKEN = `${CLI_TOKEN_PREFIX}secret_scan_raw_token`;

test("postgres concurrency and failure injection", { skip: skipWithoutDatabase }, async (t) => {
  const schema = `cup_conc_${randomBytes(4).toString("hex")}`;
  const admin = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  await admin.query(`SET search_path TO ${schema}`);
  await migrateUp({ client: admin, migrations: await loadMigrations() });

  const pool = new pg.Pool({
    connectionString: TEST_DATABASE_URL,
    max: 4,
    options: `-csearch_path=${schema}`
  });
  const store = createPostgresProfileBackendStore({ pool });

  try {
    // --- completeOAuthCallback ------------------------------------------------

    await t.test("oauth callback consumes a pending state exactly once in parallel", async () => {
      await store.clear();
      const oauth = createOAuthFixture(store);
      const { oauthState } = await oauth.service.startGitHubLogin({});

      const results = await Promise.allSettled([
        oauth.service.completeGitHubCallback({ code: "code-a", state: oauthState.id }),
        oauth.service.completeGitHubCallback({ code: "code-b", state: oauthState.id })
      ]);

      const { fulfilled, rejected } = splitSettled(results);
      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 1);
      assert.equal(rejected[0].code, PROFILE_BACKEND_ERROR_CODES.GONE);

      const state = await store.getOAuthState(oauthState.id);
      assert.equal(state.status, "consumed");
      assert.equal(state.sessionId, fulfilled[0].session.id);
      assert.equal((await store.exportState()).sessions.length, 1);
    });

    await t.test("oauth callback rolls back owner and session when the consume fails", async () => {
      await store.clear();
      const oauth = createOAuthFixture(withFailingSave(store, "saveOAuthState"));
      const pending = await store.saveOAuthState({
        id: "oauth_state_inject",
        provider: "github",
        status: "pending",
        expiresAt: "2027-01-01T00:00:00.000Z"
      });

      await assert.rejects(
        () => oauth.service.completeGitHubCallback({ code: "code-a", state: pending.id }),
        /injected failure/
      );

      assert.equal(await store.getOwnerByProviderIdentity("github", "12345"), null);
      assert.equal((await store.exportState()).sessions.length, 0);
      assert.equal((await store.getOAuthState(pending.id)).status, "pending");
    });

    // --- approveCliLogin ------------------------------------------------------

    await t.test("cli approve grants a pending challenge exactly once in parallel", async () => {
      await store.clear();
      await saveOwnerFixture(store, "owner_a", "a");
      await saveOwnerFixture(store, "owner_b", "b");
      const cli = createCliFixture(store);
      const started = await cli.service.startCliLogin();

      const results = await Promise.allSettled([
        cli.service.approveCliLogin({ challengeId: started.challenge.id, ownerId: "owner_a" }),
        cli.service.approveCliLogin({ challengeId: started.challenge.id, ownerId: "owner_b" })
      ]);

      const { fulfilled, rejected } = splitSettled(results);
      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 1);
      assert.equal(rejected[0].code, PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST);

      const challenge = await store.getCliLoginChallenge(started.challenge.id);
      assert.equal(challenge.status, "approved");
      assert.equal(challenge.ownerId, fulfilled[0].ownerId);
    });

    await t.test("cli approve rolls back when the challenge write fails", async () => {
      await store.clear();
      await saveOwnerFixture(store, "owner_a", "a");
      const realCli = createCliFixture(store);
      const started = await realCli.service.startCliLogin();
      const failingCli = createCliFixture(withFailingSave(store, "saveCliLoginChallenge"));

      await assert.rejects(
        () => failingCli.service.approveCliLogin({
          challengeId: started.challenge.id,
          ownerId: "owner_a"
        }),
        /injected failure/
      );

      assert.equal(
        (await store.getCliLoginChallenge(started.challenge.id)).status,
        "pending"
      );
    });

    // --- exchangeCliLogin -----------------------------------------------------

    await t.test("cli exchange issues exactly one token in parallel", async () => {
      await store.clear();
      await saveOwnerFixture(store, "owner_a", "a");
      const cli = createCliFixture(store);
      const started = await cli.service.startCliLogin();
      await cli.service.approveCliLogin({
        challengeId: started.challenge.id,
        ownerId: "owner_a"
      });

      const results = await Promise.allSettled([
        cli.service.exchangeCliLogin({ challengeId: started.challenge.id }),
        cli.service.exchangeCliLogin({ challengeId: started.challenge.id })
      ]);

      const { fulfilled, rejected } = splitSettled(results);
      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 1);
      assert.equal(rejected[0].code, PROFILE_BACKEND_ERROR_CODES.GONE);
      assert.equal((await store.listCliTokensByOwnerId("owner_a")).length, 1);
      assert.equal(
        (await store.getCliLoginChallenge(started.challenge.id)).cliTokenId,
        fulfilled[0].tokenRecord.id
      );
    });

    await t.test("cli exchange rolls back the issued token when the exchanged mark fails", async () => {
      await store.clear();
      await saveOwnerFixture(store, "owner_a", "a");
      const realCli = createCliFixture(store);
      const started = await realCli.service.startCliLogin();
      await realCli.service.approveCliLogin({
        challengeId: started.challenge.id,
        ownerId: "owner_a"
      });
      const failingCli = createCliFixture(withFailingSave(store, "saveCliLoginChallenge"));

      await assert.rejects(
        () => failingCli.service.exchangeCliLogin({ challengeId: started.challenge.id }),
        /injected failure/
      );

      // The token issued earlier in the same transaction must be rolled back.
      assert.equal((await store.listCliTokensByOwnerId("owner_a")).length, 0);
      assert.equal(
        (await store.getCliLoginChallenge(started.challenge.id)).status,
        "approved"
      );
    });

    // --- submitAccountUsage ---------------------------------------------------

    await t.test("usage submit resolves a same-timestamp content race to one accepted and one conflict", async () => {
      await store.clear();
      const usage = await createUsageFixture(store);

      const results = await Promise.allSettled([
        usage.service.submitAccountUsage({
          token: usage.token,
          device: { id: "device_a", name: "A" },
          document: createDocument()
        }),
        usage.service.submitAccountUsage({
          token: usage.token,
          device: { id: "device_b", name: "B" },
          document: createDocument({
            summary: {
              ...sampleAccountUsageReadResult.summary,
              lifetimeTokens: sampleAccountUsageReadResult.summary.lifetimeTokens + 5
            }
          })
        })
      ]);

      const { fulfilled, rejected } = splitSettled(results);
      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 1);
      assert.equal(rejected[0].code, PROFILE_BACKEND_ERROR_CODES.CONFLICT);

      const stored = await store.getLatestUsageByOwnerId("owner_1");
      assert.equal(stored.contentDigest, fulfilled[0].usageRecord.contentDigest);
      // The losing submit committed nothing, including its device touch.
      assert.equal((await store.listSubmittedDevicesByOwnerId("owner_1")).length, 1);
    });

    await t.test("usage submit rolls back the device touch when the usage write fails", async () => {
      await store.clear();
      const usage = await createUsageFixture(store, withFailingSave(store, "saveLatestUsage"));

      await assert.rejects(
        () => usage.service.submitAccountUsage({
          token: usage.token,
          device: { id: "device_a", name: "A" },
          document: createDocument()
        }),
        /injected failure/
      );

      assert.equal(await store.getLatestUsageByOwnerId("owner_1"), null);
      assert.equal((await store.listSubmittedDevicesByOwnerId("owner_1")).length, 0);
    });

    // --- updateVisibility -----------------------------------------------------

    await t.test("parallel visibility toggles stay coherent across owner, usage and snapshot", async () => {
      await store.clear();
      const usage = await createUsageFixture(store);
      await usage.service.submitAccountUsage({
        token: usage.token,
        document: createDocument()
      });
      await store.saveLatestSnapshot({
        ownerId: "owner_1",
        handle: "postmelee",
        visibility: PROFILE_VISIBILITY.PRIVATE,
        capturedAt: "2026-07-11T00:00:00.000Z",
        uploadedAt: "2026-07-11T00:01:00.000Z",
        schemaVersion: 2,
        snapshot: { schemaVersion: 2 }
      });
      const cards = createProfileCardService({
        store,
        now: () => new Date("2026-07-11T00:03:00.000Z"),
        renderPng: () => Buffer.from("png")
      });

      const results = await Promise.allSettled([
        cards.updateVisibility({ ownerId: "owner_1", visibility: PROFILE_VISIBILITY.PUBLIC }),
        cards.updateVisibility({ ownerId: "owner_1", visibility: PROFILE_VISIBILITY.PRIVATE })
      ]);
      assert.equal(splitSettled(results).rejected.length, 0);

      // Whichever toggle committed last, all three records expose one revision.
      const owner = await store.getOwnerById("owner_1");
      const usageRecord = await store.getLatestUsageByOwnerId("owner_1");
      const snapshotRecord = await store.getLatestSnapshotByOwnerId("owner_1");
      assert.equal(usageRecord.visibility, owner.visibility);
      assert.equal(snapshotRecord.visibility, owner.visibility);
    });

    await t.test("visibility update rolls back owner and usage when the snapshot write fails", async () => {
      await store.clear();
      const usage = await createUsageFixture(store);
      await usage.service.submitAccountUsage({
        token: usage.token,
        document: createDocument()
      });
      await store.saveLatestSnapshot({
        ownerId: "owner_1",
        handle: "postmelee",
        visibility: PROFILE_VISIBILITY.PRIVATE,
        capturedAt: "2026-07-11T00:00:00.000Z",
        uploadedAt: "2026-07-11T00:01:00.000Z",
        schemaVersion: 2,
        snapshot: { schemaVersion: 2 }
      });
      const failingCards = createProfileCardService({
        store: withFailingSave(store, "saveLatestSnapshot"),
        now: () => new Date("2026-07-11T00:03:00.000Z"),
        renderPng: () => Buffer.from("png")
      });

      await assert.rejects(
        () => failingCards.updateVisibility({
          ownerId: "owner_1",
          visibility: PROFILE_VISIBILITY.PUBLIC
        }),
        /injected failure/
      );

      assert.equal((await store.getOwnerById("owner_1")).visibility, PROFILE_VISIBILITY.PRIVATE);
      assert.equal(
        (await store.getLatestUsageByOwnerId("owner_1")).visibility,
        PROFILE_VISIBILITY.PRIVATE
      );
      assert.equal(
        (await store.getLatestSnapshotByOwnerId("owner_1")).visibility,
        PROFILE_VISIBILITY.PRIVATE
      );
    });

    // --- secrets and owner scope ----------------------------------------------

    await t.test("no raw CLI token, device code, or OAuth access token is persisted", async () => {
      await store.clear();
      const oauth = createOAuthFixture(store);
      const { oauthState } = await oauth.service.startGitHubLogin({});
      const callback = await oauth.service.completeGitHubCallback({
        code: "code-a",
        state: oauthState.id
      });
      const cli = createCliFixture(store);
      const started = await cli.service.startCliLogin();
      await cli.service.approveCliLogin({
        challengeId: started.challenge.id,
        ownerId: callback.owner.id
      });
      const exchanged = await cli.service.exchangeCliLogin({
        challengeId: started.challenge.id
      });
      assert.equal(exchanged.token, RAW_CLI_TOKEN);

      const persisted = JSON.stringify(await store.exportState());
      assert.equal(persisted.includes(RAW_CLI_TOKEN), false);
      assert.equal(persisted.includes(RAW_DEVICE_CODE), false);
      assert.equal(persisted.includes(RAW_ACCESS_TOKEN), false);
      // The digests prove the flows really ran through the store.
      assert.equal(persisted.includes(createCliTokenDigest(RAW_CLI_TOKEN)), true);
      assert.equal(persisted.includes(createDeviceCodeDigest(RAW_DEVICE_CODE)), true);
    });

    await t.test("schema stores digests and codes only through allowlisted columns", async () => {
      const result = await admin.query(
        `SELECT table_name, column_name FROM information_schema.columns
         WHERE table_schema = $1
           AND (column_name LIKE '%token%' OR column_name LIKE '%secret%' OR column_name LIKE '%code%')
         ORDER BY table_name, column_name`,
        [schema]
      );

      assert.deepEqual(
        result.rows.map((row) => `${row.table_name}.${row.column_name}`),
        [
          "cli_login_challenges.cli_token_id",
          "cli_login_challenges.device_code_digest",
          "cli_login_challenges.user_code",
          "cli_tokens.token_digest"
        ]
      );
    });

    await t.test("owner scope cannot be bypassed for tokens, devices and usage", async () => {
      await store.clear();
      await saveOwnerFixture(store, "owner_a", "a");
      await saveOwnerFixture(store, "owner_b", "b");
      for (const [ownerId, suffix] of [["owner_a", "a"], ["owner_b", "b"]]) {
        await store.saveCliToken({
          id: `cli_token_${suffix}`,
          ownerId,
          tokenDigest: `digest-${suffix}`,
          createdAt: "2026-07-11T00:00:00.000Z"
        });
        await store.saveSubmittedDevice({
          id: `device_${suffix}`,
          ownerId,
          deviceKey: `key-${suffix}`,
          displayName: null,
          createdAt: "2026-07-11T00:00:00.000Z",
          updatedAt: "2026-07-11T00:00:00.000Z",
          lastSubmittedAt: "2026-07-11T00:00:00.000Z"
        });
        await store.saveLatestUsage({
          ownerId,
          handle: `handle-${suffix}`,
          visibility: PROFILE_VISIBILITY.PRIVATE,
          capturedAt: "2026-07-11T00:00:00.000Z",
          uploadedAt: "2026-07-11T00:01:00.000Z",
          contentDigest: `content-${suffix}`,
          usage: structuredClone(sampleAccountUsageReadResult)
        });
      }

      assert.deepEqual(
        (await store.listCliTokensByOwnerId("owner_b")).map((token) => token.id),
        ["cli_token_b"]
      );
      assert.deepEqual(
        (await store.listSubmittedDevicesByOwnerId("owner_b")).map((device) => device.id),
        ["device_b"]
      );
      assert.equal((await store.getLatestUsageByOwnerId("owner_b")).contentDigest, "content-b");
      assert.equal(await store.getSubmittedDeviceByOwnerAndKey("owner_b", "key-a"), null);
    });
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {});
    await admin.end();
  }
});

// --- fixtures -----------------------------------------------------------------

function createOAuthFixture(store) {
  let id = 0;
  const service = createOAuthRuntimeService({
    store,
    now: () => new Date("2026-07-11T00:02:00.000Z"),
    createId: (prefix) => `${prefix}_${(id += 1)}`,
    githubClientId: "client-1",
    githubClient: {
      async exchangeCodeForToken() {
        return { accessToken: RAW_ACCESS_TOKEN };
      },
      async getAuthenticatedUser() {
        return { id: "12345", login: "postmelee", name: "Post Melee" };
      }
    }
  });
  return { service };
}

function createCliFixture(store) {
  let id = 0;
  const service = createCliLoginService({
    store,
    now: () => new Date("2026-07-11T00:02:00.000Z"),
    createId: (prefix) => `${prefix}_${(id += 1)}`,
    createDeviceCode: () => RAW_DEVICE_CODE,
    createUserCode: () => "ABCD-2345",
    tokenService: createCliTokenService({
      store,
      now: () => new Date("2026-07-11T00:02:00.000Z"),
      createId: (prefix) => `${prefix}_${(id += 1)}`,
      createToken: () => RAW_CLI_TOKEN
    })
  });
  return { service };
}

async function createUsageFixture(store, serviceStore = store) {
  await saveOwnerFixture(store, "owner_1", "1", "postmelee");
  const tokenService = createCliTokenService({
    store,
    now: () => new Date("2026-07-11T00:02:00.000Z"),
    createId: () => "cli_token_usage",
    createToken: () => `${CLI_TOKEN_PREFIX}usage_fixture_token`
  });
  const { token } = await tokenService.issueCliToken({ ownerId: "owner_1" });
  let deviceId = 0;
  const service = createAccountUsageSubmitService({
    store: serviceStore,
    now: () => new Date("2026-07-11T00:02:00.000Z"),
    createId: (prefix) => `${prefix}_${(deviceId += 1)}`
  });
  return { service, token };
}

function saveOwnerFixture(store, id, suffix, handle = `handle-${suffix}`) {
  return store.saveOwner({
    id,
    authProvider: "github",
    providerUserId: suffix,
    githubLogin: handle,
    displayName: null,
    avatarUrl: null,
    profileUrl: null,
    handle,
    visibility: PROFILE_VISIBILITY.PRIVATE,
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z"
  });
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

// Wraps a store so a chosen save method throws inside the transaction,
// proving every earlier write in the same transaction rolls back.
function withFailingSave(store, methodName) {
  const failing = Object.create(store);
  failing.transaction = (runner) => store.transaction(
    (tx) => runner(new Proxy(tx, {
      get(target, property, receiver) {
        if (property === methodName) {
          return () => {
            throw new Error(`injected failure in ${methodName}`);
          };
        }
        return Reflect.get(target, property, receiver);
      }
    }))
  );
  return failing;
}

function splitSettled(results) {
  return {
    fulfilled: results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value),
    rejected: results
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason)
  };
}
