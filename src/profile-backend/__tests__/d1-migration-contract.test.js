import assert from "node:assert/strict";
import test from "node:test";

import {
  D1_MIGRATION_MANIFEST,
  D1_MIGRATION_VERSIONS,
  createD1MigrationManifest
} from "../d1/migration-manifest.js";
import {
  inspectD1MigrationReadiness
} from "../d1/store.js";

test("D1 migration manifest is exact, contiguous, and deeply frozen", () => {
  assert.deepEqual(D1_MIGRATION_MANIFEST, [
    {
      version: 1,
      name: "profile_backend",
      file: "db/migrations/0001_profile_backend.sql"
    },
    {
      version: 2,
      name: "account_usage_rate_limits",
      file: "db/migrations/0002_account_usage_rate_limits.sql"
    },
    {
      version: 3,
      name: "cli_login_intent",
      file: "db/migrations/0003_cli_login_intent.sql"
    }
  ]);
  assert.deepEqual(D1_MIGRATION_VERSIONS, [1, 2, 3]);
  assert.equal(Object.isFrozen(D1_MIGRATION_MANIFEST), true);
  assert.equal(D1_MIGRATION_MANIFEST.every(Object.isFrozen), true);
  assert.equal(Object.isFrozen(D1_MIGRATION_VERSIONS), true);
});

test("D1 migration manifest rejects gaps and filename drift", () => {
  assert.throws(
    () => createD1MigrationManifest([]),
    /non-empty array/
  );
  assert.throws(
    () => createD1MigrationManifest([{
      version: 2,
      name: "second",
      file: "db/migrations/0002_second.sql"
    }]),
    /contiguous from 1/
  );
  assert.throws(
    () => createD1MigrationManifest([{
      version: 1,
      name: "first",
      file: "db/migrations/0001_other.sql"
    }]),
    /must match version and name/
  );
  assert.throws(
    () => createD1MigrationManifest([{
      version: 1,
      name: "first",
      file: "db/migrations/0001_first.sql",
      sql: "SELECT 1"
    }]),
    /contain only file, name, and version/
  );
});

test("D1 readiness inspector reports exact, missing, and unexpected versions", async () => {
  const exactDatabase = readinessDatabase([1, 2, 3]);
  assert.deepEqual(await inspectD1MigrationReadiness(exactDatabase), {
    appliedVersions: [1, 2, 3],
    expectedVersions: [1, 2, 3],
    missingVersions: [],
    readyExact: true,
    unexpectedVersions: []
  });
  assert.equal(exactDatabase.batchCalls, 0);

  const driftedDatabase = readinessDatabase([1, 3, 4]);
  const drifted = await inspectD1MigrationReadiness(driftedDatabase);
  assert.deepEqual(drifted, {
    appliedVersions: [1, 3, 4],
    expectedVersions: [1, 2, 3],
    missingVersions: [2],
    readyExact: false,
    unexpectedVersions: [4]
  });
  assert.equal(Object.isFrozen(drifted), true);
  assert.equal(Object.isFrozen(drifted.appliedVersions), true);
  assert.equal(driftedDatabase.batchCalls, 0);
});

test("D1 readiness reports every migration missing when metadata is absent", async () => {
  const database = readinessDatabase([], { hasMigrationTable: false });

  assert.deepEqual(await inspectD1MigrationReadiness(database), {
    appliedVersions: [],
    expectedVersions: [1, 2, 3],
    missingVersions: [1, 2, 3],
    readyExact: false,
    unexpectedVersions: []
  });
  assert.equal(database.versionReadCalls, 0);
  assert.equal(database.batchCalls, 0);
});

test("D1 readiness inspector rejects invalid stored versions", async () => {
  await assert.rejects(
    () => inspectD1MigrationReadiness(readinessDatabase([1, "invalid"])),
    /contains an invalid version/
  );
});

function readinessDatabase(versions, options = {}) {
  const database = {
    batchCalls: 0,
    versionReadCalls: 0,
    batch() {
      database.batchCalls += 1;
      throw new Error("readiness must not mutate D1");
    },
    prepare(sql) {
      if (
        sql ===
        "SELECT name FROM sqlite_master " +
          "WHERE type = 'table' AND name = 'schema_migrations' LIMIT 1"
      ) {
        return {
          async all() {
            return {
              results: options.hasMigrationTable === false
                ? []
                : [{ name: "schema_migrations" }]
            };
          }
        };
      }
      assert.equal(
        sql,
        "SELECT version FROM schema_migrations ORDER BY version"
      );
      return {
        async all() {
          database.versionReadCalls += 1;
          return {
            results: versions.map((version) => ({ version }))
          };
        }
      };
    }
  };
  return database;
}
