import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  migrateD1Database as runD1Migrations,
  splitSqlStatements
} from "./migration-runner.js";
import { D1_MIGRATION_MANIFEST } from "./migration-manifest.js";

export { splitSqlStatements };

const REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../.."
);

export const DEFAULT_D1_MIGRATIONS = D1_MIGRATION_MANIFEST;

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
