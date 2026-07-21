#!/usr/bin/env node
// One-shot seeding of a local file-store snapshot into the Postgres store.
//
// There is no production file-store data: this tool exists to seed a local
// development snapshot into a fresh database and to verify the migration
// path required by the store contract. It stays deliberately thin:
// * the snapshot is re-validated by hydrating a memory store (same
//   requireFields and unique-key checks as the runtime),
// * the load runs inside one adapter transaction (dry-run rolls back,
//   a unique conflict aborts the whole load),
// * a rerun is idempotent because every save is a primary-key upsert,
// * rollback deletes exactly the ids present in the snapshot.
//
// Usage:
//   node scripts/migrate-file-store-to-postgres.mjs seed [--file <path>] [--dry-run]
//   node scripts/migrate-file-store-to-postgres.mjs rollback [--file <path>]
//
// The connection string comes from NEON_DATABASE_URL (or DATABASE_URL) and
// is never printed. Output is limited to record counts.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_DURABLE_STORE_FILE,
  createMemoryProfileBackendStore,
  createPostgresPool,
  createPostgresProfileBackendStore,
  readStoreState
} from "../src/profile-backend/index.js";

const RECORD_ORDER = [
  ["owners", "saveOwner"],
  ["oauthStates", "saveOAuthState"],
  ["sessions", "saveSession"],
  ["cliLoginChallenges", "saveCliLoginChallenge"],
  ["cliTokens", "saveCliToken"],
  ["latestSnapshots", "saveLatestSnapshot"],
  ["latestUsages", "saveLatestUsage"],
  ["submittedDevices", "saveSubmittedDevice"]
];

// Inverse of RECORD_ORDER: [record key, table, id column, record id key].
const ROLLBACK_ORDER = [
  ["submittedDevices", "submitted_devices", "id", "id"],
  ["latestUsages", "latest_usages", "owner_id", "ownerId"],
  ["latestSnapshots", "latest_snapshots", "owner_id", "ownerId"],
  ["cliTokens", "cli_tokens", "id", "id"],
  ["cliLoginChallenges", "cli_login_challenges", "id", "id"],
  ["sessions", "sessions", "id", "id"],
  ["oauthStates", "oauth_states", "id", "id"],
  ["owners", "owners", "id", "id"]
];

class DryRunRollback extends Error {
  constructor() {
    super("dry-run rollback sentinel");
  }
}

export function loadFileStoreSnapshot(filePath) {
  // Hydrating a memory store replays every record through the same
  // validation and unique-key checks the runtime uses.
  const memoryStore = createMemoryProfileBackendStore(readStoreState(filePath));
  return memoryStore.exportState();
}

export async function seedPostgresFromSnapshot(store, snapshot, options = {}) {
  const dryRun = options.dryRun === true;
  const counts = countRecords(snapshot);

  try {
    await store.transaction(async (tx) => {
      for (const [recordKey, saveMethod] of RECORD_ORDER) {
        for (const record of snapshot[recordKey]) {
          await tx[saveMethod](record);
        }
      }

      if (dryRun) {
        throw new DryRunRollback();
      }
    });
  } catch (error) {
    if (!(error instanceof DryRunRollback)) {
      throw error;
    }
  }

  return { counts, dryRun };
}

export async function rollbackSeededSnapshot(pool, snapshot) {
  const client = await pool.connect();
  const removed = {};

  try {
    await client.query("BEGIN");
    for (const [recordKey, table, idColumn, idKey] of ROLLBACK_ORDER) {
      const ids = snapshot[recordKey].map((record) => record[idKey]);
      const result = await client.query(
        `DELETE FROM ${table} WHERE ${idColumn} = ANY($1)`,
        [ids]
      );
      removed[recordKey] = result.rowCount;
    }
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The connection is unusable; release() below destroys it.
    }
    throw error;
  } finally {
    client.release();
  }

  return { removed };
}

function countRecords(snapshot) {
  return Object.fromEntries(
    RECORD_ORDER.map(([recordKey]) => [recordKey, snapshot[recordKey].length])
  );
}

function formatCounts(counts) {
  return Object.entries(counts)
    .map(([key, count]) => `${key} ${count}`)
    .join(", ");
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!["seed", "rollback"].includes(command)) {
    console.error(
      "Usage: node scripts/migrate-file-store-to-postgres.mjs <seed|rollback> [--file <path>] [--dry-run]"
    );
    process.exitCode = 1;
    return;
  }

  const fileIndex = args.indexOf("--file");
  const filePath = fileIndex !== -1
    ? args[fileIndex + 1]
    : (process.env.PROFILE_STORE_FILE ?? DEFAULT_DURABLE_STORE_FILE);
  const dryRun = args.includes("--dry-run");

  const snapshot = loadFileStoreSnapshot(filePath);
  console.log(`snapshot ${resolve(filePath)}: ${formatCounts(countRecords(snapshot))}`);

  const pool = createPostgresPool({ env: process.env });
  const store = createPostgresProfileBackendStore({ pool });

  try {
    // The schema must be migrated before any load; this also fails fast on
    // an unreachable database.
    await store.verifyReadiness();

    if (command === "seed") {
      const result = await seedPostgresFromSnapshot(store, snapshot, { dryRun });
      console.log(
        result.dryRun
          ? "seed dry-run: validated inside a transaction and rolled back"
          : "seed committed"
      );
      return;
    }

    const { removed } = await rollbackSeededSnapshot(pool, snapshot);
    console.log(`rollback committed: removed ${formatCounts(removed)}`);
  } finally {
    await pool.end();
  }
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return fileURLToPath(import.meta.url) === resolve(process.argv[1]);
}

if (isMainModule()) {
  main().catch((error) => {
    console.error(`Migration failed: ${error.message}`);
    process.exitCode = 1;
  });
}
