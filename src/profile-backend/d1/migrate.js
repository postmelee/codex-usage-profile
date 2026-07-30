import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  migrateD1Database as runD1Migrations,
  splitSqlStatements
} from "./migration-runner.js";

export { splitSqlStatements };

const REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../.."
);

export const DEFAULT_D1_MIGRATIONS = Object.freeze([
  Object.freeze({
    version: 1,
    name: "profile_backend",
    file: "db/migrations/0001_profile_backend.sql"
  }),
  Object.freeze({
    version: 2,
    name: "account_usage_rate_limits",
    file: "db/migrations/0002_account_usage_rate_limits.sql"
  }),
  Object.freeze({
    version: 3,
    name: "cli_login_intent",
    file: "db/migrations/0003_cli_login_intent.sql"
  })
]);

export async function loadD1Migrations(options = {}) {
  const repositoryRoot = options.repositoryRoot ?? REPOSITORY_ROOT;
  return Promise.all(DEFAULT_D1_MIGRATIONS.map(async (migration) => ({
    ...migration,
    sql: await readFile(resolve(repositoryRoot, migration.file), "utf8")
  })));
}

export async function migrateD1Database(database, options = {}) {
  const migrations = options.migrations ?? await loadD1Migrations(options);
  return runD1Migrations(database, {
    ...options,
    migrations
  });
}
