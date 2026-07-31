import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import pg from "pg";

import {
  getAppliedMigrations,
  loadMigrations,
  migrateDown,
  migrateUp,
  migrationStatus
} from "../postgres/migrate.js";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "";
const skipWithoutDatabase = TEST_DATABASE_URL === ""
  ? "TEST_DATABASE_URL is not set"
  : false;

const EXPECTED_TABLES = [
  "cli_login_challenges",
  "cli_tokens",
  "latest_snapshots",
  "latest_usages",
  "oauth_states",
  "owners",
  "schema_migrations",
  "sessions",
  "submitted_devices"
];

const EXPECTED_UNIQUE_CONSTRAINTS = [
  "cli_login_challenges_device_code_digest_key",
  "cli_login_challenges_user_code_key",
  "cli_tokens_token_digest_key",
  "latest_snapshots_handle_key",
  "latest_usages_handle_key",
  "owners_handle_key",
  "owners_provider_identity_key",
  "submitted_devices_owner_device_key"
];
const EXPECTED_CHECK_CONSTRAINTS = [
  "cli_login_challenges_intent_check"
];

test("loads the packaged migrations with paired up/down files", async () => {
  const migrations = await loadMigrations();

  assert.equal(migrations.length, 2);
  assert.equal(migrations[0].version, 1);
  assert.equal(migrations[0].name, "init");
  assert.match(migrations[0].upSql, /CREATE TABLE owners/);
  assert.match(migrations[0].downSql, /DROP TABLE IF EXISTS owners/);
  assert.equal(migrations[1].version, 2);
  assert.equal(migrations[1].name, "cli_login_intent");
  assert.match(migrations[1].upSql, /ADD COLUMN intent/);
  assert.match(migrations[1].downSql, /DROP COLUMN IF EXISTS intent/);
});

test("rejects unpaired and misnamed migration files", async () => {
  const unpairedDirectory = mkdtempSync(join(tmpdir(), "cup-migrate-"));
  writeFileSync(join(unpairedDirectory, "0001_solo.up.sql"), "SELECT 1;\n");
  await assert.rejects(
    () => loadMigrations(unpairedDirectory),
    /missing its down file/
  );

  const misnamedDirectory = mkdtempSync(join(tmpdir(), "cup-migrate-"));
  writeFileSync(join(misnamedDirectory, "init.sql"), "SELECT 1;\n");
  await assert.rejects(
    () => loadMigrations(misnamedDirectory),
    /file name is invalid/
  );
});

test(
  "migration up/down/up bootstraps a clean database with contract constraints",
  { skip: skipWithoutDatabase },
  async () => {
    const schema = `cup_migrate_${randomBytes(4).toString("hex")}`;
    const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
    await client.connect();

    try {
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET search_path TO ${schema}`);
      const migrations = await loadMigrations();

      // Clean database bootstrap.
      const firstUp = await migrateUp({ client, migrations });
      assert.deepEqual(firstUp.applied, [1, 2]);
      assert.deepEqual(await listTables(client, schema), EXPECTED_TABLES);
      assert.deepEqual(
        await listUniqueConstraints(client, schema),
        EXPECTED_UNIQUE_CONSTRAINTS
      );
      assert.deepEqual(
        await listCheckConstraints(client, schema),
        EXPECTED_CHECK_CONSTRAINTS
      );
      assert.deepEqual(
        (await getAppliedMigrations(client)).map((migration) => migration.version),
        [1, 2]
      );

      // Re-running up with nothing pending applies nothing.
      const secondUp = await migrateUp({ client, migrations });
      assert.deepEqual(secondUp.applied, []);

      // Down reverts the schema but keeps the runner-owned bookkeeping table.
      const down = await migrateDown({ client, migrations, steps: 2 });
      assert.deepEqual(down.reverted, [2, 1]);
      assert.deepEqual(await listTables(client, schema), ["schema_migrations"]);
      const status = await migrationStatus({ client, migrations });
      assert.deepEqual(status.applied, []);
      assert.deepEqual(status.pending, [
        { version: 1, name: "init" },
        { version: 2, name: "cli_login_intent" }
      ]);

      // Up again reproduces the same schema.
      const thirdUp = await migrateUp({ client, migrations });
      assert.deepEqual(thirdUp.applied, [1, 2]);
      assert.deepEqual(await listTables(client, schema), EXPECTED_TABLES);
      assert.deepEqual(
        await listUniqueConstraints(client, schema),
        EXPECTED_UNIQUE_CONSTRAINTS
      );
      assert.deepEqual(
        await listCheckConstraints(client, schema),
        EXPECTED_CHECK_CONSTRAINTS
      );
    } finally {
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {});
      await client.end();
    }
  }
);

async function listTables(client, schema) {
  const result = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = $1 ORDER BY table_name`,
    [schema]
  );
  return result.rows.map((row) => row.table_name);
}

async function listUniqueConstraints(client, schema) {
  const result = await client.query(
    `SELECT c.conname FROM pg_constraint c
     JOIN pg_namespace n ON n.oid = c.connamespace
     WHERE n.nspname = $1 AND c.contype = 'u'
     ORDER BY c.conname`,
    [schema]
  );
  return result.rows.map((row) => row.conname);
}

async function listCheckConstraints(client, schema) {
  const result = await client.query(
    `SELECT c.conname FROM pg_constraint c
     JOIN pg_namespace n ON n.oid = c.connamespace
     WHERE n.nspname = $1 AND c.contype = 'c'
     ORDER BY c.conname`,
    [schema]
  );
  return result.rows.map((row) => row.conname);
}
