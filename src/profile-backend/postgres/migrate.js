import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

export const MIGRATIONS_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  "migrations"
);

// Session-level advisory lock key (two int32 halves). Serializes concurrent
// runners so a multi-instance deploy or parallel CI cannot apply the same
// migration twice. Migrations must never run automatically on instance boot;
// they run as an explicit deploy step (`npm run migrate:postgres -- up`).
export const MIGRATION_LOCK_KEY = Object.freeze([0x63757031, 0x6d696772]);

const MIGRATION_FILE_PATTERN = /^(\d{4})_([a-z0-9_]+)\.(up|down)\.sql$/;

export async function loadMigrations(directory = MIGRATIONS_DIRECTORY) {
  const entries = await readdir(directory);
  const byVersion = new Map();

  for (const entry of entries) {
    if (!entry.endsWith(".sql")) {
      continue;
    }

    const match = MIGRATION_FILE_PATTERN.exec(entry);
    if (!match) {
      throw new Error(
        `Migration file name is invalid: ${entry} (expected NNNN_name.up.sql / NNNN_name.down.sql)`
      );
    }

    const version = Number(match[1]);
    const name = match[2];
    const direction = match[3];
    const existing = byVersion.get(version) ?? { version, name };

    if (existing.name !== name) {
      throw new Error(
        `Migration ${String(version).padStart(4, "0")} has mismatched names: ${existing.name} vs ${name}`
      );
    }
    if (existing[`${direction}Sql`] !== undefined) {
      throw new Error(`Migration ${entry} is duplicated`);
    }

    existing[`${direction}Sql`] = await readFile(join(directory, entry), "utf8");
    byVersion.set(version, existing);
  }

  const migrations = Array.from(byVersion.values())
    .sort((left, right) => left.version - right.version);

  for (const migration of migrations) {
    if (migration.upSql === undefined || migration.downSql === undefined) {
      throw new Error(
        `Migration ${migration.name} is missing its ${migration.upSql === undefined ? "up" : "down"} file`
      );
    }
  }

  return migrations;
}

export async function getAppliedMigrations(client) {
  await ensureMigrationsTable(client);
  const result = await client.query(
    "SELECT version, name, applied_at FROM schema_migrations ORDER BY version"
  );
  return result.rows.map((row) => ({
    version: Number(row.version),
    name: row.name,
    appliedAt: row.applied_at
  }));
}

export async function migrateUp(options = {}) {
  const { client, migrations, log = () => {} } = requireRunnerOptions(options);

  return withMigrationLock(client, async () => {
    const appliedVersions = new Set(
      (await getAppliedMigrations(client)).map((migration) => migration.version)
    );
    const applied = [];

    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) {
        continue;
      }

      await runInTransaction(client, async () => {
        await client.query(migration.upSql);
        await client.query(
          "INSERT INTO schema_migrations (version, name) VALUES ($1, $2)",
          [migration.version, migration.name]
        );
      });
      applied.push(migration.version);
      log(`applied ${formatMigration(migration)}`);
    }

    return { applied };
  });
}

export async function migrateDown(options = {}) {
  const { client, migrations, log = () => {} } = requireRunnerOptions(options);
  const steps = normalizeSteps(options.steps ?? 1);

  return withMigrationLock(client, async () => {
    const appliedMigrations = await getAppliedMigrations(client);
    const targets = appliedMigrations.slice(-steps).reverse();
    const migrationsByVersion = new Map(
      migrations.map((migration) => [migration.version, migration])
    );
    const reverted = [];

    for (const target of targets) {
      const migration = migrationsByVersion.get(target.version);
      if (!migration) {
        throw new Error(
          `Applied migration ${target.version} has no local migration file to revert with`
        );
      }

      await runInTransaction(client, async () => {
        await client.query(migration.downSql);
        await client.query(
          "DELETE FROM schema_migrations WHERE version = $1",
          [migration.version]
        );
      });
      reverted.push(migration.version);
      log(`reverted ${formatMigration(migration)}`);
    }

    return { reverted };
  });
}

export async function migrationStatus(options = {}) {
  const { client, migrations } = requireRunnerOptions(options);
  const applied = await getAppliedMigrations(client);
  const appliedVersions = new Set(applied.map((migration) => migration.version));
  const pending = migrations
    .filter((migration) => !appliedVersions.has(migration.version))
    .map((migration) => ({ version: migration.version, name: migration.name }));

  return { applied, pending };
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version integer PRIMARY KEY,
      name text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function withMigrationLock(client, callback) {
  await client.query(
    "SELECT pg_advisory_lock($1, $2)",
    [...MIGRATION_LOCK_KEY]
  );

  try {
    return await callback();
  } finally {
    await client.query(
      "SELECT pg_advisory_unlock($1, $2)",
      [...MIGRATION_LOCK_KEY]
    );
  }
}

async function runInTransaction(client, callback) {
  await client.query("BEGIN");
  try {
    await callback();
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

function requireRunnerOptions(options) {
  if (!options.client || typeof options.client.query !== "function") {
    throw new TypeError("client is required");
  }
  if (!Array.isArray(options.migrations)) {
    throw new TypeError("migrations is required");
  }

  return options;
}

function normalizeSteps(value) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError("steps must be a positive integer");
  }

  return value;
}

function formatMigration(migration) {
  return `${String(migration.version).padStart(4, "0")}_${migration.name}`;
}

async function main() {
  const command = process.argv[2];
  if (!["up", "down", "status"].includes(command)) {
    console.error("Usage: node src/profile-backend/postgres/migrate.js <up|down|status> [steps]");
    process.exitCode = 1;
    return;
  }

  const databaseUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("NEON_DATABASE_URL (or DATABASE_URL) is required");
    process.exitCode = 1;
    return;
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const migrations = await loadMigrations();

    if (command === "up") {
      const { applied } = await migrateUp({ client, migrations, log: console.log });
      console.log(`up complete (${applied.length} applied)`);
      return;
    }

    if (command === "down") {
      const steps = process.argv[3] === undefined ? 1 : Number(process.argv[3]);
      const { reverted } = await migrateDown({ client, migrations, steps, log: console.log });
      console.log(`down complete (${reverted.length} reverted)`);
      return;
    }

    const status = await migrationStatus({ client, migrations });
    console.log(`applied: ${status.applied.map((m) => m.version).join(", ") || "(none)"}`);
    console.log(`pending: ${status.pending.map((m) => m.version).join(", ") || "(none)"}`);
  } finally {
    await client.end();
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
