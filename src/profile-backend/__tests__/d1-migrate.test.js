import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_D1_MIGRATIONS,
  loadD1Migrations,
  migrateD1Database,
  splitSqlStatements
} from "../d1/migrate.js";
import {
  D1_MIGRATION_MANIFEST,
  D1_MIGRATION_VERSIONS
} from "../d1/migration-manifest.js";
import { createD1TestFixture } from "./_d1-test-fixture.js";

test("D1 migrations execute in order and are idempotent on real workerd D1", async (t) => {
  const fixture = await createD1TestFixture();
  t.after(() => fixture.dispose());

  const first = await fixture.migrate();
  const second = await fixture.migrate();
  const tables = (await fixture.inspect("tables")).map((row) => row.name);

  assert.deepEqual(first, {
    appliedVersions: D1_MIGRATION_VERSIONS,
    newlyApplied: D1_MIGRATION_VERSIONS
  });
  assert.deepEqual(second, {
    appliedVersions: D1_MIGRATION_VERSIONS,
    newlyApplied: []
  });
  assert.deepEqual(await fixture.rpc("verifyReadiness"), {
    appliedVersions: D1_MIGRATION_VERSIONS
  });
  for (const table of [
    "account_usage_rate_limits",
    "atomic_operation_assertions",
    "atomic_operation_claims",
    "cli_login_challenges",
    "cli_tokens",
    "latest_snapshots",
    "latest_usages",
    "oauth_states",
    "owners",
    "schema_migrations",
    "sessions",
    "submitted_devices"
  ]) {
    assert.equal(tables.includes(table), true, `missing ${table}`);
  }
});

test("Node D1 migration loader preserves pure manifest metadata", async () => {
  assert.equal(DEFAULT_D1_MIGRATIONS, D1_MIGRATION_MANIFEST);
  const loaded = await loadD1Migrations();
  assert.deepEqual(
    loaded.map(({ file, name, version }) => ({ file, name, version })),
    D1_MIGRATION_MANIFEST
  );
  assert.equal(
    loaded.every(({ sql }) => typeof sql === "string" && sql.length > 0),
    true
  );
});

test("migration splitter gives prepare exactly one statement at a time", () => {
  assert.deepEqual(
    splitSqlStatements("-- comment\nCREATE TABLE a (id TEXT);\nINSERT INTO a VALUES ('1');"),
    ["CREATE TABLE a (id TEXT)", "INSERT INTO a VALUES ('1')"]
  );
});

test("D1 migration runner reports only bounded execution progress", async () => {
  const progress = [];
  const database = {
    prepare(sql) {
      const statement = {
        bind() {
          return statement;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          return { success: true };
        }
      };
      assert.equal(typeof sql, "string");
      return statement;
    },
    async batch(statements) {
      assert.equal(statements.length, 2);
      return statements.map(() => ({ success: true }));
    }
  };

  await migrateD1Database(database, {
    migrations: [{
      name: "one",
      sql: "SELECT 1",
      version: 1
    }],
    now: () => new Date("2026-08-09T00:00:00.000Z"),
    onProgress(value) {
      progress.push(value);
    }
  });

  assert.deepEqual(progress, [
    { phase: "initialize" },
    { phase: "read" },
    { phase: "prepare", version: 1 },
    { phase: "batch", version: 1 }
  ]);
  assert.equal(progress.every(Object.isFrozen), true);
});
