import { AsyncLocalStorage } from "node:async_hooks";

import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError
} from "../errors.js";
import {
  createTransactionalProfileBackendAtomicOperations
} from "../atomic-operations.js";
import { PROFILE_BACKEND_STORE_SCHEMA_VERSION } from "../store-values.js";
import { loadMigrations } from "./migrate.js";
import { createPostgresPool } from "./pool.js";
import {
  normalizeCardLocale,
  normalizeCardStyle,
  serializeCardStyle
} from "../../profile-card/presentation.js";

export const DEFAULT_POSTGRES_STATEMENT_TIMEOUT_MS = 15_000;
export const DEFAULT_POSTGRES_IDLE_IN_TRANSACTION_TIMEOUT_MS = 30_000;

// Unique-constraint violations map to the same CONFLICT errors the memory
// store throws, keyed by the constraint names fixed in 0001_init.up.sql.
const CONFLICT_MESSAGES_BY_CONSTRAINT = Object.freeze({
  owners_provider_identity_key: "Provider identity already belongs to another owner",
  owners_handle_key: "Handle already belongs to another owner",
  cli_login_challenges_device_code_digest_key:
    "Device code digest already belongs to another CLI login challenge",
  cli_login_challenges_user_code_key:
    "User code already belongs to another CLI login challenge",
  cli_tokens_token_digest_key: "Token digest already belongs to another CLI token",
  latest_snapshots_handle_key: "Snapshot handle already belongs to another owner",
  latest_usages_handle_key: "Usage handle already belongs to another owner",
  submitted_devices_owner_device_key:
    "Submitted device key already belongs to another device"
});

// Column specs: [jsKey, sqlColumn, {json}] — json columns are stringified on
// write because node-postgres would otherwise encode JS arrays as Postgres
// array literals instead of jsonb.
const OWNER = {
  label: "owner",
  table: "owners",
  conflict: ["id"],
  required: ["id", "authProvider", "providerUserId", "handle"],
  columns: [
    ["id", "id"],
    ["authProvider", "auth_provider"],
    ["providerUserId", "provider_user_id"],
    ["githubLogin", "github_login"],
    ["displayName", "display_name"],
    ["avatarUrl", "avatar_url"],
    ["profileUrl", "profile_url"],
    ["handle", "handle"],
    ["visibility", "visibility"],
    ["cardLocale", "card_locale"],
    ["cardStyle", "card_style", { json: true, serialize: serializeCardStyle }],
    ["createdAt", "created_at"],
    ["updatedAt", "updated_at"]
  ]
};

const OAUTH_STATE = {
  label: "OAuth state",
  table: "oauth_states",
  conflict: ["id"],
  required: ["id", "status", "expiresAt"],
  columns: [
    ["id", "id"],
    ["provider", "provider"],
    ["status", "status"],
    ["cliLoginChallengeId", "cli_login_challenge_id"],
    ["redirectTo", "redirect_to"],
    ["createdAt", "created_at"],
    ["expiresAt", "expires_at"],
    ["consumedAt", "consumed_at"],
    ["ownerId", "owner_id"],
    ["sessionId", "session_id"]
  ]
};

const SESSION = {
  label: "session",
  table: "sessions",
  conflict: ["id"],
  required: ["id", "ownerId", "expiresAt"],
  columns: [
    ["id", "id"],
    ["ownerId", "owner_id"],
    ["createdAt", "created_at"],
    ["expiresAt", "expires_at"],
    ["revokedAt", "revoked_at"]
  ]
};

const CLI_LOGIN_CHALLENGE = {
  label: "CLI login challenge",
  table: "cli_login_challenges",
  conflict: ["id"],
  required: ["id"],
  columns: [
    ["id", "id"],
    ["status", "status"],
    ["label", "label"],
    ["intent", "intent"],
    ["redirectUri", "redirect_uri"],
    ["deviceCodeDigest", "device_code_digest"],
    ["userCode", "user_code"],
    ["verificationUri", "verification_uri"],
    ["verificationUriComplete", "verification_uri_complete"],
    ["intervalSeconds", "interval_seconds"],
    ["createdAt", "created_at"],
    ["expiresAt", "expires_at"],
    ["approvedAt", "approved_at"],
    ["exchangedAt", "exchanged_at"],
    ["ownerId", "owner_id"],
    ["cliTokenId", "cli_token_id"]
  ]
};

const CLI_TOKEN = {
  label: "CLI token",
  table: "cli_tokens",
  conflict: ["id"],
  required: ["id", "ownerId", "tokenDigest"],
  columns: [
    ["id", "id"],
    ["ownerId", "owner_id"],
    ["tokenDigest", "token_digest"],
    ["label", "label"],
    ["scopes", "scopes", { json: true }],
    ["sourceChallengeId", "source_challenge_id"],
    ["createdAt", "created_at"],
    ["expiresAt", "expires_at"],
    ["revokedAt", "revoked_at"],
    ["lastUsedAt", "last_used_at"]
  ]
};

const LATEST_SNAPSHOT = {
  label: "latest snapshot",
  table: "latest_snapshots",
  conflict: ["owner_id"],
  required: [
    "ownerId",
    "handle",
    "visibility",
    "capturedAt",
    "uploadedAt",
    "schemaVersion",
    "snapshot"
  ],
  columns: [
    ["ownerId", "owner_id"],
    ["handle", "handle"],
    ["visibility", "visibility"],
    ["capturedAt", "captured_at"],
    ["uploadedAt", "uploaded_at"],
    ["schemaVersion", "schema_version"],
    ["snapshot", "snapshot", { json: true }]
  ]
};

const LATEST_USAGE = {
  label: "latest usage",
  table: "latest_usages",
  conflict: ["owner_id"],
  required: ["ownerId", "handle", "visibility", "capturedAt", "uploadedAt", "usage"],
  columns: [
    ["ownerId", "owner_id"],
    ["handle", "handle"],
    ["visibility", "visibility"],
    ["contractVersion", "contract_version"],
    ["capturedAt", "captured_at"],
    ["uploadedAt", "uploaded_at"],
    ["contentDigest", "content_digest"],
    ["usage", "usage", { json: true }]
  ]
};

const SUBMITTED_DEVICE = {
  label: "submitted device",
  table: "submitted_devices",
  conflict: ["id"],
  required: ["id", "ownerId", "deviceKey", "createdAt", "updatedAt", "lastSubmittedAt"],
  columns: [
    ["id", "id"],
    ["ownerId", "owner_id"],
    ["deviceKey", "device_key"],
    ["displayName", "display_name"],
    ["createdAt", "created_at"],
    ["updatedAt", "updated_at"],
    ["lastSubmittedAt", "last_submitted_at"]
  ]
};

const ALL_TABLES = [
  OWNER,
  OAUTH_STATE,
  SESSION,
  CLI_LOGIN_CHALLENGE,
  CLI_TOKEN,
  LATEST_SNAPSHOT,
  LATEST_USAGE,
  SUBMITTED_DEVICE
];

export function createPostgresProfileBackendStore(options = {}) {
  const pool = options.pool ?? createPostgresPool(options);
  const ownsPool = !options.pool;
  const statementTimeoutMs = requirePositiveInteger(
    options.statementTimeoutMs ?? DEFAULT_POSTGRES_STATEMENT_TIMEOUT_MS,
    "statementTimeoutMs"
  );
  const idleInTransactionTimeoutMs = requirePositiveInteger(
    options.idleInTransactionTimeoutMs ?? DEFAULT_POSTGRES_IDLE_IN_TRANSACTION_TIMEOUT_MS,
    "idleInTransactionTimeoutMs"
  );

  // Queries issued anywhere inside a transaction runner's async flow are
  // routed to the transaction's dedicated client through this context, so
  // tx-bound sub-services stay transactional without threading the client.
  const transactionContext = new AsyncLocalStorage();

  const run = async (text, params) => {
    const queryable = transactionContext.getStore()?.client ?? pool;
    try {
      return await queryable.query(text, params);
    } catch (error) {
      throw mapPostgresError(error);
    }
  };

  // Inside a transaction, single-row getters lock their target row so the
  // contract's serialization keys (oauthState.id, cliLoginChallenge.id,
  // owner.id) serialize concurrent operations across instances.
  const rowLockClause = () => (transactionContext.getStore() ? " FOR UPDATE" : "");

  const getOne = async (spec, where, params) => {
    const result = await run(
      `SELECT ${columnList(spec)} FROM ${spec.table} WHERE ${where}${rowLockClause()}`,
      params
    );
    return result.rows[0] ? fromRow(spec, result.rows[0]) : null;
  };

  const list = async (spec, where, params, orderBy) => {
    const whereSql = where ? ` WHERE ${where}` : "";
    const orderSql = orderBy ? ` ORDER BY ${orderBy}` : "";
    const result = await run(
      `SELECT ${columnList(spec)} FROM ${spec.table}${whereSql}${orderSql}`,
      params
    );
    return result.rows.map((row) => fromRow(spec, row));
  };

  const upsert = async (spec, record) => {
    requireFields(spec.label, record, spec.required);
    await run(buildUpsertSql(spec), toParams(spec, record));
    return normalizeSavedRecord(spec, record);
  };

  const store = {
    async clear() {
      await run(
        `TRUNCATE ${ALL_TABLES.map((spec) => spec.table).join(", ")}`
      );
    },

    async deleteCliToken(id) {
      const result = await run("DELETE FROM cli_tokens WHERE id = $1", [id]);
      return result.rowCount > 0;
    },

    getCliLoginChallenge(id) {
      return getOne(CLI_LOGIN_CHALLENGE, "id = $1", [id]);
    },

    getCliLoginChallengeByDeviceCodeDigest(deviceCodeDigest) {
      return getOne(CLI_LOGIN_CHALLENGE, "device_code_digest = $1", [deviceCodeDigest]);
    },

    getCliLoginChallengeByUserCode(userCode) {
      return getOne(CLI_LOGIN_CHALLENGE, "user_code = $1", [userCode]);
    },

    getCliTokenByDigest(tokenDigest) {
      return getOne(CLI_TOKEN, "token_digest = $1", [tokenDigest]);
    },

    getCliTokenById(id) {
      return getOne(CLI_TOKEN, "id = $1", [id]);
    },

    getLatestSnapshotByHandle(handle) {
      return getOne(LATEST_SNAPSHOT, "handle = $1", [handle]);
    },

    getLatestSnapshotByOwnerId(ownerId) {
      return getOne(LATEST_SNAPSHOT, "owner_id = $1", [ownerId]);
    },

    getLatestUsageByHandle(handle) {
      return getOne(LATEST_USAGE, "handle = $1", [handle]);
    },

    getLatestUsageByOwnerId(ownerId) {
      return getOne(LATEST_USAGE, "owner_id = $1", [ownerId]);
    },

    getOAuthState(id) {
      return getOne(OAUTH_STATE, "id = $1", [id]);
    },

    getOwnerByHandle(handle) {
      return getOne(OWNER, "handle = $1", [handle]);
    },

    getOwnerById(id) {
      return getOne(OWNER, "id = $1", [id]);
    },

    getOwnerByProviderIdentity(authProvider, providerUserId) {
      return getOne(
        OWNER,
        "auth_provider = $1 AND provider_user_id = $2",
        [authProvider, providerUserId]
      );
    },

    getSession(id) {
      return getOne(SESSION, "id = $1", [id]);
    },

    getSubmittedDeviceById(id) {
      return getOne(SUBMITTED_DEVICE, "id = $1", [id]);
    },

    getSubmittedDeviceByOwnerAndKey(ownerId, deviceKey) {
      return getOne(
        SUBMITTED_DEVICE,
        "owner_id = $1 AND device_key = $2",
        [ownerId, deviceKey]
      );
    },

    listCliTokensByOwnerId(ownerId) {
      return list(
        CLI_TOKEN,
        "owner_id = $1",
        [ownerId],
        "created_at DESC NULLS LAST, id"
      );
    },

    listOwners() {
      return list(OWNER, null, [], "id");
    },

    listSubmittedDevicesByOwnerId(ownerId) {
      return list(
        SUBMITTED_DEVICE,
        "owner_id = $1",
        [ownerId],
        "last_submitted_at DESC NULLS LAST, created_at DESC NULLS LAST, id"
      );
    },

    saveCliLoginChallenge(challenge) {
      return upsert(CLI_LOGIN_CHALLENGE, challenge);
    },

    saveCliToken(token) {
      return upsert(CLI_TOKEN, token);
    },

    saveLatestSnapshot(record) {
      return upsert(LATEST_SNAPSHOT, record);
    },

    saveLatestUsage(record) {
      return upsert(LATEST_USAGE, record);
    },

    saveOAuthState(state) {
      return upsert(OAUTH_STATE, state);
    },

    saveOwner(owner) {
      return upsert(OWNER, {
        ...owner,
        cardLocale: normalizeCardLocale(owner.cardLocale),
        cardStyle: normalizeCardStyle(owner.cardStyle)
      });
    },

    saveSession(session) {
      return upsert(SESSION, session);
    },

    saveSubmittedDevice(device) {
      return upsert(SUBMITTED_DEVICE, device);
    },

    async exportState() {
      const [
        owners,
        oauthStates,
        sessions,
        cliLoginChallenges,
        cliTokens,
        latestSnapshots,
        latestUsages,
        submittedDevices
      ] = await Promise.all([
        list(OWNER, null, [], "id"),
        list(OAUTH_STATE, null, [], "id"),
        list(SESSION, null, [], "id"),
        list(CLI_LOGIN_CHALLENGE, null, [], "id"),
        list(CLI_TOKEN, null, [], "id"),
        list(LATEST_SNAPSHOT, null, [], "owner_id"),
        list(LATEST_USAGE, null, [], "owner_id"),
        list(SUBMITTED_DEVICE, null, [], "id")
      ]);

      return {
        schemaVersion: PROFILE_BACKEND_STORE_SCHEMA_VERSION,
        owners,
        oauthStates,
        sessions,
        cliLoginChallenges,
        cliTokens,
        latestSnapshots,
        latestUsages,
        submittedDevices
      };
    },

    transaction(runner) {
      if (typeof runner !== "function") {
        throw new TypeError("transaction runner must be a function");
      }
      if (transactionContext.getStore()) {
        throw new Error(
          "Nested store transactions are not supported; reuse the active transaction handle"
        );
      }

      return (async () => {
        const client = await pool.connect();

        try {
          // SET LOCAL is transaction-scoped, so the timeouts hold under
          // Neon's transaction-mode pooling where session SET does not stick.
          await client.query(
            `BEGIN; SET LOCAL statement_timeout = ${statementTimeoutMs}; ` +
            `SET LOCAL idle_in_transaction_session_timeout = ${idleInTransactionTimeoutMs}`
          );
          const result = await transactionContext.run(
            { client },
            () => runner(store)
          );
          await client.query("COMMIT");
          return result;
        } catch (error) {
          try {
            await client.query("ROLLBACK");
          } catch {
            // The connection is unusable; release() below destroys it.
          }
          throw mapPostgresError(error);
        } finally {
          client.release();
        }
      })();
    },

    // Dependency readiness (distinct from /healthz liveness): confirms the
    // database is reachable and every packaged migration has been applied.
    // Migrations never run here — they are an explicit deploy step.
    async verifyReadiness() {
      const migrations = await loadMigrations();
      let appliedRows;

      try {
        appliedRows = (
          await pool.query("SELECT version FROM schema_migrations ORDER BY version")
        ).rows;
      } catch (error) {
        if (error?.code === "42P01") {
          throw new Error(
            "Postgres store schema is not migrated; run `npm run migrate:postgres -- up`"
          );
        }
        throw error;
      }

      const appliedVersions = appliedRows.map((row) => Number(row.version));
      const applied = new Set(appliedVersions);
      const missing = migrations
        .filter((migration) => !applied.has(migration.version))
        .map((migration) => migration.version);

      if (missing.length > 0) {
        throw new Error(
          `Postgres store is missing migrations: ${missing.join(", ")}; ` +
          "run `npm run migrate:postgres -- up`"
        );
      }

      return { appliedVersions };
    },

    async close() {
      if (ownsPool) {
        await pool.end();
      }
    }
  };

  store.atomic = createTransactionalProfileBackendAtomicOperations(store);
  return store;
}

function columnList(spec) {
  return spec.columns.map(([, column]) => column).join(", ");
}

function buildUpsertSql(spec) {
  const columns = spec.columns.map(([, column]) => column);
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const updates = columns
    .filter((column) => !spec.conflict.includes(column))
    .map((column) => `${column} = EXCLUDED.${column}`);

  return `INSERT INTO ${spec.table} (${columns.join(", ")}) ` +
    `VALUES (${placeholders.join(", ")}) ` +
    `ON CONFLICT (${spec.conflict.join(", ")}) DO UPDATE SET ${updates.join(", ")}`;
}

function toParams(spec, record) {
  return spec.columns.map(([key, , options]) => {
    const value = record[key];
    if (value === undefined || value === null) {
      return null;
    }
    if (options?.serialize) return options.serialize(value);
    return options?.json ? JSON.stringify(value) : value;
  });
}

function fromRow(spec, row) {
  const record = {};
  for (const [key, column] of spec.columns) {
    record[key] = row[column];
  }
  return record;
}

// The adapter persists exactly the contract columns, so the saved record is
// the column projection of the input with absent optional fields as null —
// the same shape every read returns.
function normalizeSavedRecord(spec, record) {
  const saved = {};
  for (const [key] of spec.columns) {
    saved[key] = record[key] === undefined ? null : structuredClone(record[key]);
  }
  return saved;
}

function mapPostgresError(error) {
  if (error instanceof ProfileBackendError) {
    return error;
  }

  if (error?.code === "23505") {
    return new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.CONFLICT,
      CONFLICT_MESSAGES_BY_CONSTRAINT[error.constraint] ??
        "Unique constraint violated"
    );
  }

  return error;
}

function requireFields(label, record, fields) {
  if (!isRecord(record)) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
      `${label} must be an object`
    );
  }

  for (const field of fields) {
    if (!Object.hasOwn(record, field) || record[field] === null || record[field] === "") {
      throw new ProfileBackendError(
        PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
        `${label} is missing ${field}`
      );
    }
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requirePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer`);
  }

  return value;
}
