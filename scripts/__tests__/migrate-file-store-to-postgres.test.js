import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import pg from "pg";

import { sampleAccountUsageReadResult } from "../../src/profile-card/fixtures/sample-account-usage.js";
import {
  PROFILE_VISIBILITY,
  createFileProfileBackendStore
} from "../../src/profile-backend/index.js";
import { loadMigrations, migrateUp } from "../../src/profile-backend/postgres/migrate.js";
import { createPostgresProfileBackendStore } from "../../src/profile-backend/postgres/store.js";
import {
  loadFileStoreSnapshot,
  rollbackSeededSnapshot,
  seedPostgresFromSnapshot
} from "../migrate-file-store-to-postgres.mjs";

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
  createdAt: "2026-07-11T00:00:00.000Z",
  updatedAt: "2026-07-11T00:00:00.000Z"
});

test("loads and re-validates a file store snapshot", () => {
  const filePath = join(mkdtempSync(join(tmpdir(), "cup-seed-")), "store.json");
  writeFixtureFileStore(filePath);

  const snapshot = loadFileStoreSnapshot(filePath);
  assert.equal(snapshot.owners.length, 1);
  assert.equal(snapshot.cliTokens.length, 1);
  assert.equal(snapshot.latestUsages.length, 1);

  // A missing file is an empty snapshot, so seeding it is a no-op.
  const missing = loadFileStoreSnapshot(join(tmpdir(), "cup-seed-missing.json"));
  assert.equal(missing.owners.length, 0);
});

test("file store seeding against Postgres", { skip: skipWithoutDatabase }, async (t) => {
  const schema = `cup_seed_${randomBytes(4).toString("hex")}`;
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

  const filePath = join(mkdtempSync(join(tmpdir(), "cup-seed-")), "store.json");
  writeFixtureFileStore(filePath);
  const snapshot = loadFileStoreSnapshot(filePath);

  try {
    await t.test("dry-run validates the load and rolls back", async () => {
      const result = await seedPostgresFromSnapshot(store, snapshot, { dryRun: true });

      assert.equal(result.dryRun, true);
      assert.equal(result.counts.owners, 1);
      assert.equal((await store.exportState()).owners.length, 0);
    });

    await t.test("seed commits every record", async () => {
      const result = await seedPostgresFromSnapshot(store, snapshot);

      assert.equal(result.dryRun, false);
      assert.deepEqual(await store.getOwnerById(OWNER.id), OWNER);
      assert.equal((await store.getCliTokenByDigest("digest-1")).id, "cli_token_1");
      assert.equal(
        (await store.getLatestUsageByOwnerId(OWNER.id)).contentDigest,
        "content-1"
      );
      assert.equal(
        (await store.getSubmittedDeviceByOwnerAndKey(OWNER.id, "macbook")).id,
        "device_1"
      );
    });

    await t.test("rerunning the seed is idempotent", async () => {
      const before = await store.exportState();
      await seedPostgresFromSnapshot(store, snapshot);
      const after = await store.exportState();

      assert.deepEqual(after, before);
    });

    await t.test("rollback removes exactly the seeded ids", async () => {
      const { removed } = await rollbackSeededSnapshot(pool, snapshot);

      assert.deepEqual(removed, {
        submittedDevices: 1,
        latestUsages: 1,
        latestSnapshots: 1,
        cliTokens: 1,
        cliLoginChallenges: 1,
        sessions: 1,
        oauthStates: 1,
        owners: 1
      });
      const state = await store.exportState();
      for (const records of Object.values(state)) {
        if (Array.isArray(records)) {
          assert.deepEqual(records, []);
        }
      }
    });

    await t.test("a unique conflict aborts the whole load", async () => {
      // A different owner already holds the fixture handle.
      await store.saveOwner({
        ...OWNER,
        id: "owner_foreign",
        providerUserId: "999"
      });

      await assert.rejects(
        () => seedPostgresFromSnapshot(store, snapshot),
        (error) => error?.code === "conflict"
      );

      const state = await store.exportState();
      assert.deepEqual(state.owners.map((owner) => owner.id), ["owner_foreign"]);
      assert.deepEqual(state.sessions, []);
      assert.deepEqual(state.cliTokens, []);
    });
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {});
    await admin.end();
  }
});

function writeFixtureFileStore(filePath) {
  const fileStore = createFileProfileBackendStore({ filePath, createIfMissing: true });

  fileStore.saveOwner({ ...OWNER });
  fileStore.saveOAuthState({
    id: "oauth_state_1",
    provider: "github",
    status: "consumed",
    cliLoginChallengeId: null,
    redirectTo: null,
    createdAt: "2026-07-11T00:00:00.000Z",
    expiresAt: "2026-07-11T00:10:00.000Z",
    consumedAt: "2026-07-11T00:01:00.000Z",
    ownerId: OWNER.id,
    sessionId: "session_1"
  });
  fileStore.saveSession({
    id: "session_1",
    ownerId: OWNER.id,
    createdAt: "2026-07-11T00:01:00.000Z",
    expiresAt: "2026-08-10T00:01:00.000Z",
    revokedAt: null
  });
  fileStore.saveCliLoginChallenge({
    id: "cli_login_1",
    status: "exchanged",
    label: null,
    redirectUri: null,
    deviceCodeDigest: "device-digest-1",
    userCode: "ABCD-2345",
    verificationUri: "/device",
    verificationUriComplete: "/device?user_code=ABCD-2345",
    intervalSeconds: 5,
    createdAt: "2026-07-11T00:01:00.000Z",
    expiresAt: "2026-07-11T00:11:00.000Z",
    approvedAt: "2026-07-11T00:02:00.000Z",
    exchangedAt: "2026-07-11T00:03:00.000Z",
    ownerId: OWNER.id,
    cliTokenId: "cli_token_1"
  });
  fileStore.saveCliToken({
    id: "cli_token_1",
    ownerId: OWNER.id,
    tokenDigest: "digest-1",
    label: "fixture",
    scopes: ["snapshot:write"],
    sourceChallengeId: "cli_login_1",
    createdAt: "2026-07-11T00:03:00.000Z",
    expiresAt: "2027-07-11T00:03:00.000Z",
    revokedAt: null,
    lastUsedAt: null
  });
  fileStore.saveLatestSnapshot({
    ownerId: OWNER.id,
    handle: OWNER.handle,
    visibility: PROFILE_VISIBILITY.PRIVATE,
    capturedAt: "2026-07-11T00:00:00.000Z",
    uploadedAt: "2026-07-11T00:04:00.000Z",
    schemaVersion: 2,
    snapshot: { schemaVersion: 2 }
  });
  fileStore.saveLatestUsage({
    ownerId: OWNER.id,
    handle: OWNER.handle,
    visibility: PROFILE_VISIBILITY.PRIVATE,
    contractVersion: 1,
    capturedAt: "2026-07-11T00:00:00.000Z",
    uploadedAt: "2026-07-11T00:04:00.000Z",
    contentDigest: "content-1",
    usage: structuredClone(sampleAccountUsageReadResult)
  });
  fileStore.saveSubmittedDevice({
    id: "device_1",
    ownerId: OWNER.id,
    deviceKey: "macbook",
    displayName: "MacBook",
    createdAt: "2026-07-11T00:04:00.000Z",
    updatedAt: "2026-07-11T00:04:00.000Z",
    lastSubmittedAt: "2026-07-11T00:04:00.000Z"
  });
}
