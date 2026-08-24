const MIGRATION_NAME_PATTERN = /^[a-z][a-z0-9_]*$/u;
const MIGRATION_ENTRY_KEYS = Object.freeze(["file", "name", "version"]);

export function createD1MigrationManifest(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new TypeError("D1 migration manifest must be a non-empty array");
  }

  const names = new Set();
  const files = new Set();
  const manifest = entries.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new TypeError("D1 migration manifest entries must be objects");
    }
    if (!sameKeys(Object.keys(entry).sort(), MIGRATION_ENTRY_KEYS)) {
      throw new TypeError(
        "D1 migration manifest entries must contain only file, name, and version"
      );
    }

    const expectedVersion = index + 1;
    if (entry.version !== expectedVersion) {
      throw new TypeError(
        `D1 migration versions must be contiguous from 1; expected ${expectedVersion}`
      );
    }
    if (
      typeof entry.name !== "string" ||
      !MIGRATION_NAME_PATTERN.test(entry.name)
    ) {
      throw new TypeError("D1 migration names must use lowercase snake_case");
    }

    const expectedFile =
      `db/migrations/${String(entry.version).padStart(4, "0")}_${entry.name}.sql`;
    if (entry.file !== expectedFile) {
      throw new TypeError(
        `D1 migration file must match version and name: ${expectedFile}`
      );
    }
    if (names.has(entry.name) || files.has(entry.file)) {
      throw new TypeError("D1 migration names and files must be unique");
    }
    names.add(entry.name);
    files.add(entry.file);

    return Object.freeze({
      version: entry.version,
      name: entry.name,
      file: entry.file
    });
  });

  return Object.freeze(manifest);
}

export const D1_MIGRATION_MANIFEST = createD1MigrationManifest([
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
  },
  {
    version: 4,
    name: "card_style",
    file: "db/migrations/0004_card_style.sql"
  },
  {
    version: 5,
    name: "card_locale",
    file: "db/migrations/0005_card_locale.sql"
  },
  {
    version: 6,
    name: "account_deletion_operations",
    file: "db/migrations/0006_account_deletion_operations.sql"
  }
]);

export const D1_MIGRATION_VERSIONS = Object.freeze(
  D1_MIGRATION_MANIFEST.map((migration) => migration.version)
);

function sameKeys(actual, expected) {
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}
