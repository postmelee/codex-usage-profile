export async function migrateD1Database(database, options = {}) {
  assertD1Database(database);
  const reportProgress = requireProgressReporter(options.onProgress);
  reportProgress(Object.freeze({ phase: "initialize" }));
  await database.prepare(
    "CREATE TABLE IF NOT EXISTS schema_migrations (" +
      "version INTEGER PRIMARY KEY NOT NULL, " +
      "name TEXT NOT NULL, applied_at TEXT NOT NULL)"
  ).run();

  const migrations = options.migrations;
  if (!Array.isArray(migrations)) {
    throw new TypeError("D1 migrations must be an array");
  }
  reportProgress(Object.freeze({ phase: "read" }));
  const applied = await database.prepare(
    "SELECT version FROM schema_migrations ORDER BY version"
  ).all();
  const appliedVersions = new Set(
    (applied.results ?? []).map((row) => Number(row.version))
  );
  const newlyApplied = [];

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) continue;

    reportProgress(Object.freeze({
      phase: "prepare",
      version: migration.version
    }));
    const statements = splitSqlStatements(migration.sql).map((sql) =>
      database.prepare(sql)
    );
    statements.push(
      database.prepare(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)"
      ).bind(
        migration.version,
        migration.name,
        (options.now ?? (() => new Date()))().toISOString()
      )
    );
    reportProgress(Object.freeze({
      phase: "batch",
      version: migration.version
    }));
    await database.batch(statements);
    newlyApplied.push(migration.version);
  }

  return {
    appliedVersions: [...appliedVersions, ...newlyApplied].sort((a, b) => a - b),
    newlyApplied
  };
}

function requireProgressReporter(value) {
  if (value === undefined) return () => {};
  if (typeof value !== "function") {
    throw new TypeError("D1 migration progress reporter must be a function");
  }
  return value;
}

export function splitSqlStatements(sql) {
  if (typeof sql !== "string") {
    throw new TypeError("migration SQL must be a string");
  }

  const withoutComments = sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

  return withoutComments
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function assertD1Database(database) {
  if (
    !database ||
    typeof database.prepare !== "function" ||
    typeof database.batch !== "function"
  ) {
    throw new TypeError("D1 database binding is required");
  }
}
