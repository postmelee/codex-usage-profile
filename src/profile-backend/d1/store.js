import {
  assertChallengeApprovable,
  assertChallengeExchangeable,
  assertOAuthStateConsumable,
  assertProfileBackendAtomicCommand,
  assertProfileBackendAtomicOperations,
  assertProfileBackendAtomicResult,
  classifyUsageSubmission
} from "../atomic-operations.js";
import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError
} from "../errors.js";

import {
  PROFILE_BACKEND_STORE_SCHEMA_VERSION,
  PROFILE_VISIBILITY
} from "../store-values.js";
import {
  D1_MIGRATION_VERSIONS
} from "./migration-manifest.js";
import {
  normalizeCardLocale,
  normalizeCardStyle,
  serializeCardStyle
} from "../../profile-card/presentation.js";

const D1_MIGRATION_TABLE_QUERY =
  "SELECT name FROM sqlite_master " +
  "WHERE type = 'table' AND name = 'schema_migrations' LIMIT 1";
const D1_MIGRATION_VERSION_QUERY =
  "SELECT version FROM schema_migrations ORDER BY version";

const OWNER = spec("owner", "owners", ["id"], [
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
], ["id", "authProvider", "providerUserId", "handle"]);

const OAUTH_STATE = spec("OAuth state", "oauth_states", ["id"], [
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
], ["id", "status", "expiresAt"]);

const SESSION = spec("session", "sessions", ["id"], [
  ["id", "id"],
  ["ownerId", "owner_id"],
  ["createdAt", "created_at"],
  ["expiresAt", "expires_at"],
  ["revokedAt", "revoked_at"]
], ["id", "ownerId", "expiresAt"]);

const CLI_LOGIN_CHALLENGE = spec("CLI login challenge", "cli_login_challenges", ["id"], [
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
], ["id"]);

const CLI_TOKEN = spec("CLI token", "cli_tokens", ["id"], [
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
], ["id", "ownerId", "tokenDigest"]);

const LATEST_SNAPSHOT = spec("latest snapshot", "latest_snapshots", ["owner_id"], [
  ["ownerId", "owner_id"],
  ["handle", "handle"],
  ["visibility", "visibility"],
  ["capturedAt", "captured_at"],
  ["uploadedAt", "uploaded_at"],
  ["schemaVersion", "schema_version"],
  ["snapshot", "snapshot", { json: true }]
], [
  "ownerId",
  "handle",
  "visibility",
  "capturedAt",
  "uploadedAt",
  "schemaVersion",
  "snapshot"
]);

const LATEST_USAGE = spec("latest usage", "latest_usages", ["owner_id"], [
  ["ownerId", "owner_id"],
  ["handle", "handle"],
  ["visibility", "visibility"],
  ["contractVersion", "contract_version"],
  ["capturedAt", "captured_at"],
  ["uploadedAt", "uploaded_at"],
  ["contentDigest", "content_digest"],
  ["usage", "usage", { json: true }]
], ["ownerId", "handle", "visibility", "capturedAt", "uploadedAt", "usage"]);

const SUBMITTED_DEVICE = spec("submitted device", "submitted_devices", ["id"], [
  ["id", "id"],
  ["ownerId", "owner_id"],
  ["deviceKey", "device_key"],
  ["displayName", "display_name"],
  ["createdAt", "created_at"],
  ["updatedAt", "updated_at"],
  ["lastSubmittedAt", "last_submitted_at"]
], ["id", "ownerId", "deviceKey", "createdAt", "updatedAt", "lastSubmittedAt"]);

const ALL_SPECS = [
  OWNER,
  OAUTH_STATE,
  SESSION,
  CLI_LOGIN_CHALLENGE,
  CLI_TOKEN,
  LATEST_SNAPSHOT,
  LATEST_USAGE,
  SUBMITTED_DEVICE
];

const CONFLICT_MESSAGE_FRAGMENTS = Object.freeze([
  ["owners.auth_provider, owners.provider_user_id",
    "Provider identity already belongs to another owner"],
  ["owners.handle", "Handle already belongs to another owner"],
  ["cli_login_challenges.device_code_digest",
    "Device code digest already belongs to another CLI login challenge"],
  ["cli_login_challenges.user_code",
    "User code already belongs to another CLI login challenge"],
  ["cli_tokens.token_digest", "Token digest already belongs to another CLI token"],
  ["latest_snapshots.handle", "Snapshot handle already belongs to another owner"],
  ["latest_usages.handle", "Usage handle already belongs to another owner"],
  ["submitted_devices.owner_id, submitted_devices.device_key",
    "Submitted device key already belongs to another device"]
]);

export function createD1ProfileBackendStore(options = {}) {
  const database = requireD1Database(options.database ?? options.db);
  const createNonce = options.createNonce ?? (() => globalThis.crypto.randomUUID());

  const prepare = (sql, params = []) => database.prepare(sql).bind(...params);
  const getOne = async (recordSpec, where, params) => {
    const row = await prepare(
      `SELECT ${columnList(recordSpec)} FROM ${recordSpec.table} WHERE ${where}`,
      params
    ).first();
    return row ? fromRow(recordSpec, row) : null;
  };
  const list = async (recordSpec, where = "", params = [], orderBy = "") => {
    const result = await prepare(
      `SELECT ${columnList(recordSpec)} FROM ${recordSpec.table}` +
      `${where ? ` WHERE ${where}` : ""}` +
      `${orderBy ? ` ORDER BY ${orderBy}` : ""}`,
      params
    ).all();
    return (result.results ?? []).map((row) => fromRow(recordSpec, row));
  };
  const upsertStatement = (recordSpec, record) => {
    requireFields(recordSpec, record);
    return prepare(buildUpsertSql(recordSpec), toParams(recordSpec, record));
  };
  const upsert = async (recordSpec, record) => {
    try {
      await upsertStatement(recordSpec, record).run();
      return normalizeSavedRecord(recordSpec, record);
    } catch (error) {
      throw mapD1Error(error);
    }
  };

  const store = {
    async clear() {
      await database.batch([
        prepare("DELETE FROM atomic_operation_assertions"),
        prepare("DELETE FROM atomic_operation_claims"),
        prepare("DELETE FROM account_usage_rate_limits"),
        ...[...ALL_SPECS].reverse().map((recordSpec) =>
          prepare(`DELETE FROM ${recordSpec.table}`)
        )
      ]);
    },

    async deleteCliToken(id) {
      const result = await prepare("DELETE FROM cli_tokens WHERE id = ?", [id]).run();
      return Number(result.meta?.changes ?? 0) > 0;
    },

    getCliLoginChallenge(id) {
      return getOne(CLI_LOGIN_CHALLENGE, "id = ?", [id]);
    },
    getCliLoginChallengeByDeviceCodeDigest(deviceCodeDigest) {
      return getOne(
        CLI_LOGIN_CHALLENGE,
        "device_code_digest = ?",
        [deviceCodeDigest]
      );
    },
    getCliLoginChallengeByUserCode(userCode) {
      return getOne(CLI_LOGIN_CHALLENGE, "user_code = ?", [userCode]);
    },
    getCliTokenByDigest(tokenDigest) {
      return getOne(CLI_TOKEN, "token_digest = ?", [tokenDigest]);
    },
    getCliTokenById(id) {
      return getOne(CLI_TOKEN, "id = ?", [id]);
    },
    getLatestSnapshotByHandle(handle) {
      return getOne(LATEST_SNAPSHOT, "handle = ?", [handle]);
    },
    getLatestSnapshotByOwnerId(ownerId) {
      return getOne(LATEST_SNAPSHOT, "owner_id = ?", [ownerId]);
    },
    getLatestUsageByHandle(handle) {
      return getOne(LATEST_USAGE, "handle = ?", [handle]);
    },
    getLatestUsageByOwnerId(ownerId) {
      return getOne(LATEST_USAGE, "owner_id = ?", [ownerId]);
    },
    getOAuthState(id) {
      return getOne(OAUTH_STATE, "id = ?", [id]);
    },
    getOwnerByHandle(handle) {
      return getOne(OWNER, "handle = ?", [handle]);
    },
    getOwnerById(id) {
      return getOne(OWNER, "id = ?", [id]);
    },
    getOwnerByProviderIdentity(authProvider, providerUserId) {
      return getOne(
        OWNER,
        "auth_provider = ? AND provider_user_id = ?",
        [authProvider, providerUserId]
      );
    },
    async getPublicProfileSummaryByHandle(handle) {
      const row = await prepare(
        "SELECT owner.card_locale AS card_locale, owner.handle AS handle, " +
        "owner.updated_at AS owner_updated_at, usage.uploaded_at AS uploaded_at " +
        "FROM owners owner JOIN latest_usages usage ON usage.owner_id = owner.id " +
        "WHERE owner.handle = ? AND owner.visibility = ? " +
        "AND usage.visibility = ? AND usage.handle = owner.handle LIMIT 1",
        [handle, PROFILE_VISIBILITY.PUBLIC, PROFILE_VISIBILITY.PUBLIC]
      ).first();
      return row ? {
        cardLocale: normalizeCardLocale(row.card_locale),
        handle: row.handle,
        ownerUpdatedAt: row.owner_updated_at ?? null,
        uploadedAt: row.uploaded_at
      } : null;
    },
    getSession(id) {
      return getOne(SESSION, "id = ?", [id]);
    },
    getSubmittedDeviceById(id) {
      return getOne(SUBMITTED_DEVICE, "id = ?", [id]);
    },
    getSubmittedDeviceByOwnerAndKey(ownerId, deviceKey) {
      return getOne(
        SUBMITTED_DEVICE,
        "owner_id = ? AND device_key = ?",
        [ownerId, deviceKey]
      );
    },
    listCliTokensByOwnerId(ownerId) {
      return list(CLI_TOKEN, "owner_id = ?", [ownerId], "created_at DESC, id");
    },
    listOwners() {
      return list(OWNER, "", [], "id");
    },
    listSubmittedDevicesByOwnerId(ownerId) {
      return list(
        SUBMITTED_DEVICE,
        "owner_id = ?",
        [ownerId],
        "last_submitted_at DESC, created_at DESC, id"
      );
    },
    saveCliLoginChallenge(record) {
      return upsert(CLI_LOGIN_CHALLENGE, record);
    },
    saveCliToken(record) {
      return upsert(CLI_TOKEN, record);
    },
    saveLatestSnapshot(record) {
      return upsert(LATEST_SNAPSHOT, record);
    },
    saveLatestUsage(record) {
      return upsert(LATEST_USAGE, record);
    },
    saveOAuthState(record) {
      return upsert(OAUTH_STATE, record);
    },
    saveOwner(record) {
      return upsert(OWNER, {
        ...record,
        cardLocale: normalizeCardLocale(record.cardLocale),
        cardStyle: normalizeCardStyle(record.cardStyle)
      });
    },
    saveSession(record) {
      return upsert(SESSION, record);
    },
    saveSubmittedDevice(record) {
      return upsert(SUBMITTED_DEVICE, record);
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
        list(OWNER, "", [], "id"),
        list(OAUTH_STATE, "", [], "id"),
        list(SESSION, "", [], "id"),
        list(CLI_LOGIN_CHALLENGE, "", [], "id"),
        list(CLI_TOKEN, "", [], "id"),
        list(LATEST_SNAPSHOT, "", [], "owner_id"),
        list(LATEST_USAGE, "", [], "owner_id"),
        list(SUBMITTED_DEVICE, "", [], "id")
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

    async verifyReadiness() {
      const readiness = await inspectD1MigrationReadiness(database);
      if (readiness.missingVersions.length > 0) {
        throw new Error(
          `D1 store is missing migrations: ${readiness.missingVersions.join(", ")}`
        );
      }
      return { appliedVersions: readiness.appliedVersions };
    }
  };

  store.atomic = createD1AtomicOperations({
    database,
    store,
    prepare,
    upsertStatement,
    createNonce
  });

  return store;
}

export async function inspectD1MigrationReadiness(database) {
  const d1 = requireD1Database(database);
  const table = await d1.prepare(D1_MIGRATION_TABLE_QUERY).all();
  const hasMigrationTable = (table.results ?? []).some(
    (row) => row.name === "schema_migrations"
  );
  const rows = hasMigrationTable
    ? await d1.prepare(D1_MIGRATION_VERSION_QUERY).all()
    : { results: [] };
  const appliedVersions = Object.freeze(
    (rows.results ?? []).map((row) =>
      normalizeAppliedMigrationVersion(row.version)
    )
  );
  const missingVersions = Object.freeze(
    D1_MIGRATION_VERSIONS.filter(
      (version) => !appliedVersions.includes(version)
    )
  );
  const unexpectedVersions = Object.freeze(
    appliedVersions.filter(
      (version) => !D1_MIGRATION_VERSIONS.includes(version)
    )
  );

  return Object.freeze({
    appliedVersions,
    expectedVersions: D1_MIGRATION_VERSIONS,
    missingVersions,
    readyExact:
      missingVersions.length === 0 && unexpectedVersions.length === 0,
    unexpectedVersions
  });
}

function createD1AtomicOperations(context) {
  const {
    database,
    store,
    prepare,
    upsertStatement,
    createNonce
  } = context;

  const claimAssertion = (operation, claimKey, nonce) => prepare(
    "INSERT INTO atomic_operation_assertions (nonce) VALUES (" +
      "(SELECT nonce FROM atomic_operation_claims " +
      "WHERE operation = ? AND claim_key = ? AND nonce = ?)" +
    ")",
    [operation, claimKey, nonce]
  );
  const cleanupStatements = (operation, claimKey, nonce) => [
    prepare("DELETE FROM atomic_operation_assertions WHERE nonce = ?", [nonce]),
    prepare(
      "DELETE FROM atomic_operation_claims " +
      "WHERE operation = ? AND claim_key = ? AND nonce = ?",
      [operation, claimKey, nonce]
    )
  ];

  const atomic = {
    async completeOAuthCallback(command) {
      assertProfileBackendAtomicCommand("completeOAuthCallback", command);
      const operation = "completeOAuthCallback";
      const nonce = createNonce();
      try {
        const results = await database.batch([
          prepare(
            "INSERT INTO atomic_operation_claims " +
              "(operation, claim_key, nonce, outcome, created_at) " +
            "SELECT ?, id, ?, 'ok', ? FROM oauth_states " +
            "WHERE id = ? AND status = 'pending' AND expires_at > ?",
            [operation, nonce, command.now, command.stateId, command.now]
          ),
          claimAssertion(operation, command.stateId, nonce),
          upsertStatement(OWNER, command.owner),
          upsertStatement(SESSION, command.session),
          prepare(
            "UPDATE oauth_states SET status = 'consumed', consumed_at = ?, " +
              "owner_id = ?, session_id = ? " +
            "WHERE id = ? AND status = 'pending'",
            [
              command.now,
              command.owner.id,
              command.session.id,
              command.stateId
            ]
          ),
          selectOneStatement(prepare, OWNER, "id = ?", [command.owner.id]),
          selectOneStatement(prepare, OAUTH_STATE, "id = ?", [command.stateId]),
          selectOneStatement(prepare, SESSION, "id = ?", [command.session.id]),
          ...cleanupStatements(operation, command.stateId, nonce)
        ]);

        return assertProfileBackendAtomicResult("completeOAuthCallback", {
          owner: rowFromBatch(OWNER, results[5]),
          oauthState: rowFromBatch(OAUTH_STATE, results[6]),
          session: rowFromBatch(SESSION, results[7])
        });
      } catch (error) {
        const state = await store.getOAuthState(command.stateId);
        if (!state) {
          throw new ProfileBackendError(
            PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED,
            "OAuth state is invalid"
          );
        }
        assertOAuthStateConsumable(state, command.now);
        throw mapD1Error(error);
      }
    },

    async approveCliLogin(command) {
      assertProfileBackendAtomicCommand("approveCliLogin", command);
      const operation = "approveCliLogin";
      const nonce = createNonce();
      try {
        const results = await database.batch([
          prepare(
            "INSERT INTO atomic_operation_claims " +
              "(operation, claim_key, nonce, outcome, created_at) " +
            "SELECT ?, challenge.id, ?, 'ok', ? " +
            "FROM cli_login_challenges challenge " +
            "WHERE challenge.id = ? AND challenge.status = 'pending' " +
              "AND challenge.expires_at > ? " +
              "AND EXISTS (SELECT 1 FROM owners WHERE id = ?)",
            [
              operation,
              nonce,
              command.now,
              command.challengeId,
              command.now,
              command.ownerId
            ]
          ),
          claimAssertion(operation, command.challengeId, nonce),
          prepare(
            "UPDATE cli_login_challenges " +
            "SET status = 'approved', approved_at = ?, owner_id = ? " +
            "WHERE id = ? AND status = 'pending'",
            [command.now, command.ownerId, command.challengeId]
          ),
          selectOneStatement(
            prepare,
            CLI_LOGIN_CHALLENGE,
            "id = ?",
            [command.challengeId]
          ),
          ...cleanupStatements(operation, command.challengeId, nonce)
        ]);
        return assertProfileBackendAtomicResult("approveCliLogin", {
          challenge: rowFromBatch(CLI_LOGIN_CHALLENGE, results[3])
        });
      } catch (error) {
        const challenge = await requireChallengeForD1(store, command.challengeId);
        assertChallengeApprovable(challenge, command.now);
        if (!await store.getOwnerById(command.ownerId)) {
          throw new ProfileBackendError(
            PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
            "Owner not found"
          );
        }
        throw mapD1Error(error);
      }
    },

    async exchangeCliLogin(command) {
      assertProfileBackendAtomicCommand("exchangeCliLogin", command);
      const operation = "exchangeCliLogin";
      const nonce = createNonce();
      try {
        const results = await database.batch([
          prepare(
            "INSERT INTO atomic_operation_claims " +
              "(operation, claim_key, nonce, outcome, created_at) " +
            "SELECT ?, challenge.id, ?, 'ok', ? " +
            "FROM cli_login_challenges challenge " +
            "WHERE challenge.id = ? AND challenge.status = 'approved' " +
              "AND challenge.expires_at > ? " +
              "AND EXISTS (SELECT 1 FROM owners WHERE id = challenge.owner_id) " +
              "AND (SELECT COUNT(*) FROM cli_tokens token " +
                "WHERE token.owner_id = challenge.owner_id " +
                "AND token.revoked_at IS NULL) < ?",
            [
              operation,
              nonce,
              command.now,
              command.challengeId,
              command.now,
              command.maxActiveTokens
            ]
          ),
          claimAssertion(operation, command.challengeId, nonce),
          upsertStatement(CLI_TOKEN, command.tokenRecord),
          prepare(
            "UPDATE cli_login_challenges SET status = 'exchanged', " +
              "exchanged_at = ?, cli_token_id = ? " +
            "WHERE id = ? AND status = 'approved'",
            [command.now, command.tokenRecord.id, command.challengeId]
          ),
          selectOneStatement(
            prepare,
            CLI_LOGIN_CHALLENGE,
            "id = ?",
            [command.challengeId]
          ),
          selectOneStatement(prepare, CLI_TOKEN, "id = ?", [command.tokenRecord.id]),
          ...cleanupStatements(operation, command.challengeId, nonce)
        ]);
        return assertProfileBackendAtomicResult("exchangeCliLogin", {
          token: command.token,
          challenge: rowFromBatch(CLI_LOGIN_CHALLENGE, results[4]),
          tokenRecord: rowFromBatch(CLI_TOKEN, results[5])
        });
      } catch (error) {
        const challenge = await requireChallengeForD1(store, command.challengeId);
        assertChallengeExchangeable(challenge, command.now);
        const activeCount = (await store.listCliTokensByOwnerId(challenge.ownerId))
          .filter((record) => !record.revokedAt)
          .length;
        if (activeCount >= command.maxActiveTokens) {
          throw new ProfileBackendError(
            PROFILE_BACKEND_ERROR_CODES.CONFLICT,
            "Active CLI token limit reached"
          );
        }
        throw mapD1Error(error);
      }
    },

    async submitAccountUsage(command) {
      assertProfileBackendAtomicCommand("submitAccountUsage", command);
      const operation = "submitAccountUsage";
      const nonce = createNonce();
      try {
        const results = await database.batch([
          prepare(
            "INSERT INTO atomic_operation_claims " +
              "(operation, claim_key, nonce, outcome, created_at) " +
            "SELECT ?, owner.id, ?, " +
              "CASE " +
                "WHEN usage.owner_id IS NULL THEN 'new' " +
                "WHEN usage.captured_at < ? THEN 'new' " +
                "WHEN usage.captured_at = ? " +
                  "AND COALESCE(usage.content_digest, ?) = ? THEN 'idempotent' " +
                "ELSE 'invalid' END, ? " +
            "FROM owners owner " +
            "LEFT JOIN latest_usages usage ON usage.owner_id = owner.id " +
            "WHERE owner.id = ?",
            [
              operation,
              nonce,
              command.document.capturedAt,
              command.document.capturedAt,
              command.expectedLegacyContentDigest,
              command.contentDigest,
              command.uploadedAt,
              command.ownerId
            ]
          ),
          claimAssertion(operation, command.ownerId, nonce),
          prepare(
            "INSERT INTO submitted_devices (" +
              "id, owner_id, device_key, display_name, created_at, " +
              "updated_at, last_submitted_at" +
            ") VALUES (?, ?, ?, ?, ?, ?, ?) " +
            "ON CONFLICT (owner_id, device_key) DO UPDATE SET " +
              "display_name = COALESCE(submitted_devices.display_name, excluded.display_name), " +
              "updated_at = excluded.updated_at, " +
              "last_submitted_at = excluded.last_submitted_at",
            [
              command.deviceId,
              command.ownerId,
              command.device.deviceKey,
              command.device.displayName,
              command.uploadedAt,
              command.uploadedAt,
              command.uploadedAt
            ]
          ),
          prepare(
            "INSERT INTO latest_usages (" +
              "owner_id, handle, visibility, contract_version, captured_at, " +
              "uploaded_at, content_digest, usage" +
            ") " +
            "SELECT owner.id, owner.handle, owner.visibility, ?, ?, ?, ?, ? " +
            "FROM owners owner JOIN atomic_operation_claims claim " +
              "ON claim.operation = ? AND claim.claim_key = owner.id " +
              "AND claim.nonce = ? AND claim.outcome = 'new' " +
            "WHERE owner.id = ? " +
            "ON CONFLICT (owner_id) DO UPDATE SET " +
              "handle = excluded.handle, visibility = excluded.visibility, " +
              "contract_version = excluded.contract_version, " +
              "captured_at = excluded.captured_at, uploaded_at = excluded.uploaded_at, " +
              "content_digest = excluded.content_digest, usage = excluded.usage",
            [
              command.document.contractVersion,
              command.document.capturedAt,
              command.uploadedAt,
              command.contentDigest,
              JSON.stringify(command.usage),
              operation,
              nonce,
              command.ownerId
            ]
          ),
          selectOneStatement(prepare, OWNER, "id = ?", [command.ownerId]),
          selectOneStatement(
            prepare,
            LATEST_USAGE,
            "owner_id = ?",
            [command.ownerId]
          ),
          selectOneStatement(
            prepare,
            SUBMITTED_DEVICE,
            "owner_id = ? AND device_key = ?",
            [command.ownerId, command.device.deviceKey]
          ),
          prepare(
            "SELECT outcome FROM atomic_operation_claims " +
            "WHERE operation = ? AND claim_key = ? AND nonce = ?",
            [operation, command.ownerId, nonce]
          ),
          ...cleanupStatements(operation, command.ownerId, nonce)
        ]);
        const outcome = rawRowFromBatch(results[7])?.outcome;
        return assertProfileBackendAtomicResult("submitAccountUsage", {
          owner: rowFromBatch(OWNER, results[4]),
          usageRecord: rowFromBatch(LATEST_USAGE, results[5]),
          device: rowFromBatch(SUBMITTED_DEVICE, results[6]),
          tokenRecord: command.tokenRecord ?? null,
          idempotent: outcome === "idempotent"
        });
      } catch (error) {
        const owner = await store.getOwnerById(command.ownerId);
        if (!owner) {
          throw new ProfileBackendError(
            PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
            "Owner not found"
          );
        }
        const previous = await store.getLatestUsageByOwnerId(command.ownerId);
        const outcome = classifyUsageSubmission(previous, command);
        if (outcome === "stale") {
          throw new ProfileBackendError(
            PROFILE_BACKEND_ERROR_CODES.CONFLICT,
            "Account usage document is older than the stored revision"
          );
        }
        if (outcome === "conflict") {
          throw new ProfileBackendError(
            PROFILE_BACKEND_ERROR_CODES.CONFLICT,
            "Account usage timestamp already has different content"
          );
        }
        throw mapD1Error(error);
      }
    },

    async updateCardSettings(command) {
      assertProfileBackendAtomicCommand("updateCardSettings", command);
      const operation = "updateCardSettings";
      const nonce = createNonce();
      try {
        const cardStyle = normalizeCardStyle(command.cardStyle, {
          defaultWhenMissing: false
        });
        const cardLocale = normalizeCardLocale(command.cardLocale, {
          defaultWhenMissing: false
        });
        const results = await database.batch([
          prepare(
            "INSERT INTO atomic_operation_claims " +
              "(operation, claim_key, nonce, outcome, created_at) " +
            "SELECT ?, id, ?, 'ok', ? FROM owners " +
            "WHERE id = ? AND updated_at IS ?",
            [
              operation,
              nonce,
              command.updatedAt,
              command.ownerId,
              command.expectedOwnerUpdatedAt
            ]
          ),
          claimAssertion(operation, command.ownerId, nonce),
          prepare(
            "UPDATE owners SET card_style = ?, card_locale = ?, updated_at = ? " +
            "WHERE id = ? AND updated_at IS ?",
            [
              serializeCardStyle(cardStyle),
              cardLocale,
              command.updatedAt,
              command.ownerId,
              command.expectedOwnerUpdatedAt
            ]
          ),
          selectOneStatement(prepare, OWNER, "id = ?", [command.ownerId]),
          ...cleanupStatements(operation, command.ownerId, nonce)
        ]);
        const owner = rowFromBatch(OWNER, results[3]);
        return assertProfileBackendAtomicResult("updateCardSettings", {
          owner,
          cardLocale: owner.cardLocale,
          cardStyle: owner.cardStyle
        });
      } catch (error) {
        const owner = await store.getOwnerById(command.ownerId);
        if (!owner) {
          throw new ProfileBackendError(
            PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
            "Owner not found"
          );
        }
        if ((owner.updatedAt ?? null) !== command.expectedOwnerUpdatedAt) {
          throw new ProfileBackendError(
            PROFILE_BACKEND_ERROR_CODES.CONFLICT,
            "Owner card settings revision changed; retry the update"
          );
        }
        throw mapD1Error(error);
      }
    },

    async updateVisibility(command) {
      assertProfileBackendAtomicCommand("updateVisibility", command);
      const operation = "updateVisibility";
      const nonce = createNonce();
      try {
        const results = await database.batch([
          prepare(
            "INSERT INTO atomic_operation_claims " +
              "(operation, claim_key, nonce, outcome, created_at) " +
            "SELECT ?, id, ?, 'ok', ? FROM owners " +
            "WHERE id = ? AND updated_at IS ?",
            [
              operation,
              nonce,
              command.updatedAt,
              command.ownerId,
              command.expectedOwnerUpdatedAt
            ]
          ),
          claimAssertion(operation, command.ownerId, nonce),
          prepare(
            "UPDATE owners SET visibility = ?, updated_at = ? " +
            "WHERE id = ? AND updated_at IS ?",
            [
              command.visibility,
              command.updatedAt,
              command.ownerId,
              command.expectedOwnerUpdatedAt
            ]
          ),
          prepare(
            "UPDATE latest_usages SET " +
              "handle = (SELECT handle FROM owners WHERE id = ?), visibility = ? " +
            "WHERE owner_id = ?",
            [command.ownerId, command.visibility, command.ownerId]
          ),
          prepare(
            "UPDATE latest_snapshots SET " +
              "handle = (SELECT handle FROM owners WHERE id = ?), visibility = ? " +
            "WHERE owner_id = ?",
            [command.ownerId, command.visibility, command.ownerId]
          ),
          selectOneStatement(prepare, OWNER, "id = ?", [command.ownerId]),
          selectOneStatement(
            prepare,
            LATEST_USAGE,
            "owner_id = ?",
            [command.ownerId]
          ),
          ...cleanupStatements(operation, command.ownerId, nonce)
        ]);
        const owner = rowFromBatch(OWNER, results[5]);
        return assertProfileBackendAtomicResult("updateVisibility", {
          owner,
          usageRecord: rowFromBatch(LATEST_USAGE, results[6], true),
          visibility: owner.visibility
        });
      } catch (error) {
        const owner = await store.getOwnerById(command.ownerId);
        if (!owner) {
          throw new ProfileBackendError(
            PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
            "Owner not found"
          );
        }
        if ((owner.updatedAt ?? null) !== command.expectedOwnerUpdatedAt) {
          throw new ProfileBackendError(
            PROFILE_BACKEND_ERROR_CODES.CONFLICT,
            "Owner visibility revision changed; retry the update"
          );
        }
        throw mapD1Error(error);
      }
    }
  };

  return assertProfileBackendAtomicOperations(atomic);
}

function spec(label, table, conflict, columns, required) {
  return { label, table, conflict, columns, required };
}

function columnList(recordSpec) {
  return recordSpec.columns.map(([, column]) => column).join(", ");
}

function buildUpsertSql(recordSpec) {
  const columns = recordSpec.columns.map(([, column]) => column);
  const placeholders = columns.map(() => "?");
  const updates = columns
    .filter((column) => !recordSpec.conflict.includes(column))
    .map((column) => `${column} = excluded.${column}`);
  return `INSERT INTO ${recordSpec.table} (${columns.join(", ")}) ` +
    `VALUES (${placeholders.join(", ")}) ` +
    `ON CONFLICT (${recordSpec.conflict.join(", ")}) DO UPDATE SET ${updates.join(", ")}`;
}

function selectOneStatement(prepare, recordSpec, where, params) {
  return prepare(
    `SELECT ${columnList(recordSpec)} FROM ${recordSpec.table} WHERE ${where}`,
    params
  );
}

function toParams(recordSpec, record) {
  return recordSpec.columns.map(([key, , options]) => {
    const value = record[key];
    if (value === undefined || value === null) return null;
    if (options?.serialize) return options.serialize(value);
    return options?.json ? JSON.stringify(value) : value;
  });
}

function fromRow(recordSpec, row) {
  const record = {};
  for (const [key, column, options] of recordSpec.columns) {
    const value = row[column];
    record[key] = options?.json && typeof value === "string"
      ? JSON.parse(value)
      : value;
  }
  return record;
}

function normalizeSavedRecord(recordSpec, record) {
  const saved = {};
  for (const [key] of recordSpec.columns) {
    saved[key] = record[key] === undefined ? null : structuredClone(record[key]);
  }
  return saved;
}

function rowFromBatch(recordSpec, result, nullable = false) {
  const row = rawRowFromBatch(result);
  if (!row) {
    if (nullable) return null;
    throw new Error(`D1 atomic operation did not return ${recordSpec.label}`);
  }
  return fromRow(recordSpec, row);
}

function rawRowFromBatch(result) {
  return result?.results?.[0] ?? null;
}

function requireFields(recordSpec, record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
      `${recordSpec.label} must be an object`
    );
  }
  for (const field of recordSpec.required) {
    if (
      !Object.hasOwn(record, field) ||
      record[field] === null ||
      record[field] === ""
    ) {
      throw new ProfileBackendError(
        PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
        `${recordSpec.label} is missing ${field}`
      );
    }
  }
}

async function requireChallengeForD1(store, id) {
  const challenge = await store.getCliLoginChallenge(id);
  if (!challenge) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
      "CLI login challenge not found"
    );
  }
  return challenge;
}

function mapD1Error(error) {
  if (error instanceof ProfileBackendError) return error;
  const message = String(error?.message ?? "");
  if (message.includes("UNIQUE constraint failed")) {
    const mapped = CONFLICT_MESSAGE_FRAGMENTS.find(([fragment]) =>
      message.includes(fragment)
    );
    return new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.CONFLICT,
      mapped?.[1] ?? "Stored record conflicts with an existing record"
    );
  }
  return error;
}

function requireD1Database(database) {
  if (
    !database ||
    typeof database.prepare !== "function" ||
    typeof database.batch !== "function"
  ) {
    throw new TypeError("D1 database binding is required");
  }
  return database;
}

function normalizeAppliedMigrationVersion(value) {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new TypeError("D1 schema_migrations contains an invalid version");
  }
  return version;
}
