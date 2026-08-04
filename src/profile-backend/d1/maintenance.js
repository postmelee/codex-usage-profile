import {
  createProfileMaintenanceDigest,
  createProfileMaintenanceSummary,
  safeEqualText,
  stableStringify
} from "../maintenance-contract.js";
import { createD1ProfileBackendStore } from "./store.js";
import {
  createPresentationDigest,
  normalizeCardStyle,
  serializeCardStyle
} from "../../profile-card/presentation.js";

export const DEFAULT_PROFILE_RETENTION_DAYS = 30;
export const MAX_PROFILE_RETENTION_ROWS_PER_TABLE = 100;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;
const OWNER_COUNT_KEYS = Object.freeze([
  "cliLoginChallenges",
  "cliTokens",
  "latestSnapshots",
  "latestUsages",
  "oauthStates",
  "owners",
  "rateLimits",
  "sessions",
  "submittedDevices"
]);

export function createD1ProfileMaintenance(options = {}) {
  const database = requireD1Database(options.database ?? options.db);
  const store = options.store ?? createD1ProfileBackendStore({ database });
  const now = options.now ?? (() => new Date());
  const createNonce = options.createNonce ??
    (() => globalThis.crypto.randomUUID());
  const beforeDeleteOwner = options.beforeDeleteOwner;
  const beforeRetentionApply = options.beforeRetentionApply;
  const prepare = (sql, params = []) => database.prepare(sql).bind(...params);

  return Object.freeze({
    applyRetention,
    deleteOwner,
    exportOwner,
    planOwnerDeletion,
    planRetention,
    quiesceOwner,
    restoreOwner
  });

  async function exportOwner(exportOptions = {}) {
    const ownerId = requireKeySegment(exportOptions.ownerId, "ownerId");
    const handle = requireHandle(exportOptions.handle);
    const owner = await store.getOwnerById(ownerId);
    if (!owner || owner.handle !== handle) {
      throw maintenanceError("not_found", "owner scope was not found");
    }

    const [latestSnapshot, latestUsage, submittedDevices] = await Promise.all([
      store.getLatestSnapshotByOwnerId(owner.id),
      store.getLatestUsageByOwnerId(owner.id),
      store.listSubmittedDevicesByOwnerId(owner.id)
    ]);
    return deepFreeze({
      latestSnapshot,
      latestUsage,
      owner,
      presentationDigest: await createPresentationDigest(owner.cardStyle),
      publication: null,
      submittedDevices
    });
  }

  async function planOwnerDeletion(planOptions = {}) {
    const profile = await exportOwner(planOptions);
    const counts = await readOwnerCounts(profile.owner.id);
    const createdAt = normalizeIsoDate(planOptions.createdAt ?? now());
    const contentDigest = await createProfileMaintenanceDigest({
      counts,
      ownerRevision: {
        handle: profile.owner.handle,
        ownerId: profile.owner.id,
        updatedAt: profile.owner.updatedAt ?? null
      },
      profile
    });
    const objectCount = sumCounts(counts);
    return deepFreeze({
      counts,
      profile,
      summary: createProfileMaintenanceSummary({
        contentDigest,
        createdAt,
        objectCount,
        operation: "delete-account",
        ownerCount: counts.owners
      })
    });
  }

  async function quiesceOwner(quiesceOptions = {}) {
    const plan = await planOwnerDeletion(quiesceOptions);
    const currentUpdatedAt = plan.profile.owner.updatedAt ?? null;
    const updatedAt = nextIsoTimestamp(currentUpdatedAt, now());
    const nonce = createNonce();
    try {
      await database.batch([
        prepare(
          "INSERT INTO atomic_operation_claims " +
            "(operation, claim_key, nonce, outcome, created_at) " +
          "SELECT 'maintenanceQuiesceOwner', id, ?, 'ok', ? FROM owners " +
          "WHERE id = ? AND handle = ? AND updated_at IS ?",
          [
            nonce,
            updatedAt,
            plan.profile.owner.id,
            plan.profile.owner.handle,
            currentUpdatedAt
          ]
        ),
        claimAssertion(
          prepare,
          "maintenanceQuiesceOwner",
          plan.profile.owner.id,
          nonce
        ),
        prepare(
          "UPDATE owners SET visibility = 'private', updated_at = ? " +
          "WHERE id = ? AND handle = ? AND updated_at IS ?",
          [
            updatedAt,
            plan.profile.owner.id,
            plan.profile.owner.handle,
            currentUpdatedAt
          ]
        ),
        prepare(
          "UPDATE latest_usages SET visibility = 'private' WHERE owner_id = ?",
          [plan.profile.owner.id]
        ),
        prepare(
          "UPDATE latest_snapshots SET visibility = 'private' WHERE owner_id = ?",
          [plan.profile.owner.id]
        ),
        ...claimCleanup(
          prepare,
          "maintenanceQuiesceOwner",
          plan.profile.owner.id,
          nonce
        )
      ]);
    } catch (error) {
      throw maintenanceError(
        "conflict",
        "owner changed before it could be made private",
        error
      );
    }
    return exportOwner({
      ownerId: plan.profile.owner.id,
      handle: plan.profile.owner.handle
    });
  }

  async function deleteOwner(deleteOptions = {}) {
    const expectedContentDigest = requireDigest(
      deleteOptions.expectedContentDigest
    );
    const expectedObjectCount = requireNonNegativeInteger(
      deleteOptions.expectedObjectCount,
      "expectedObjectCount"
    );
    let plan = await planOwnerDeletion(deleteOptions);
    assertExpectedPlan(plan.summary, {
      expectedContentDigest,
      expectedObjectCount
    });
    await beforeDeleteOwner?.({ plan });
    plan = await planOwnerDeletion(deleteOptions);
    assertExpectedPlan(plan.summary, {
      expectedContentDigest,
      expectedObjectCount
    });

    const nonce = createNonce();
    const guard = buildOwnerDeleteGuard(plan, nonce);
    try {
      const results = await database.batch([
        prepare(guard.sql, guard.params),
        claimAssertion(
          prepare,
          "maintenanceDeleteOwner",
          plan.profile.owner.id,
          nonce
        ),
        prepare(
          "DELETE FROM account_usage_rate_limits WHERE rate_key IN " +
          "(SELECT id FROM cli_tokens WHERE owner_id = ?)",
          [plan.profile.owner.id]
        ),
        prepare("DELETE FROM oauth_states WHERE owner_id = ?", [
          plan.profile.owner.id
        ]),
        prepare("DELETE FROM cli_login_challenges WHERE owner_id = ?", [
          plan.profile.owner.id
        ]),
        prepare("DELETE FROM sessions WHERE owner_id = ?", [
          plan.profile.owner.id
        ]),
        prepare("DELETE FROM cli_tokens WHERE owner_id = ?", [
          plan.profile.owner.id
        ]),
        prepare("DELETE FROM submitted_devices WHERE owner_id = ?", [
          plan.profile.owner.id
        ]),
        prepare("DELETE FROM latest_snapshots WHERE owner_id = ?", [
          plan.profile.owner.id
        ]),
        prepare("DELETE FROM latest_usages WHERE owner_id = ?", [
          plan.profile.owner.id
        ]),
        prepare("DELETE FROM owners WHERE id = ? AND handle = ?", [
          plan.profile.owner.id,
          plan.profile.owner.handle
        ]),
        ...claimCleanup(
          prepare,
          "maintenanceDeleteOwner",
          plan.profile.owner.id,
          nonce
        )
      ]);
      const ownerDelete = results.at(-3);
      if (Number(ownerDelete?.meta?.changes ?? 0) !== 1) {
        throw new Error("owner delete did not affect exactly one row");
      }
    } catch (error) {
      throw maintenanceError(
        "conflict",
        "owner changed before account deletion committed",
        error
      );
    }
    return plan;
  }

  async function restoreOwner(restoreOptions = {}) {
    const profile = await normalizeDurableProfile(restoreOptions.profile);
    const desiredVisibility = profile.owner.visibility;
    const stagedProfile = withProfileVisibility(profile, "private");
    const currentById = await store.getOwnerById(profile.owner.id);
    const currentByHandle = await store.getOwnerByHandle(profile.owner.handle);
    const currentByProvider = await store.getOwnerByProviderIdentity(
      profile.owner.authProvider,
      profile.owner.providerUserId
    );
    const existing = currentById ?? currentByHandle ?? currentByProvider;

    if (existing) {
      if (
        [currentById, currentByHandle, currentByProvider]
          .filter(Boolean)
          .some((owner) => owner.id !== existing.id)
      ) {
        throw maintenanceError(
          "conflict",
          "restore identity conflicts with an existing owner"
        );
      }
      const current = await exportOwner({
        ownerId: existing.id,
        handle: existing.handle
      });
      const original = withProfileVisibility(profile, desiredVisibility);
      if (
        stableStringify(current) !== stableStringify(stagedProfile) &&
        stableStringify(current) !== stableStringify(original) &&
        !isSafeQuiescedRestoreState(current, stagedProfile)
      ) {
        throw maintenanceError(
          "conflict",
          "restore target already contains different durable data"
        );
      }
      return deepFreeze({
        desiredVisibility,
        idempotent: true,
        profile: current
      });
    }

    const statements = [
      prepare(insertOwnerSql(), ownerParams(stagedProfile.owner))
    ];
    if (stagedProfile.latestSnapshot) {
      statements.push(prepare(
        insertLatestSnapshotSql(),
        latestSnapshotParams(stagedProfile.latestSnapshot)
      ));
    }
    if (stagedProfile.latestUsage) {
      statements.push(prepare(
        insertLatestUsageSql(),
        latestUsageParams(stagedProfile.latestUsage)
      ));
    }
    for (const device of stagedProfile.submittedDevices) {
      statements.push(prepare(insertSubmittedDeviceSql(), deviceParams(device)));
    }

    try {
      await database.batch(statements);
    } catch (error) {
      throw maintenanceError(
        "conflict",
        "restore target conflicts with existing durable data",
        error
      );
    }
    return deepFreeze({
      desiredVisibility,
      idempotent: false,
      profile: await exportOwner({
        ownerId: stagedProfile.owner.id,
        handle: stagedProfile.owner.handle
      })
    });
  }

  async function planRetention(planOptions = {}) {
    const retentionDays = requirePositiveInteger(
      planOptions.retentionDays ?? DEFAULT_PROFILE_RETENTION_DAYS,
      "retentionDays"
    );
    const before = new Date(
      normalizeDate(planOptions.now ?? now()).getTime() -
      retentionDays * MILLISECONDS_PER_DAY
    );
    const beforeIso = before.toISOString();
    const beforeMs = before.getTime();
    const limit = requirePositiveInteger(
      planOptions.limit ?? MAX_PROFILE_RETENTION_ROWS_PER_TABLE,
      "limit"
    );

    const [
      oauthStates,
      cliLoginChallenges,
      sessions,
      cliTokens,
      rateLimits
    ] = await Promise.all([
      listIds(
        "SELECT id FROM oauth_states WHERE expires_at <= ? ORDER BY id LIMIT ?",
        [beforeIso, limit]
      ),
      listIds(
        "SELECT id FROM cli_login_challenges " +
        "WHERE expires_at <= ? ORDER BY id LIMIT ?",
        [beforeIso, limit]
      ),
      listIds(
        "SELECT id FROM sessions WHERE expires_at <= ? OR " +
        "(revoked_at IS NOT NULL AND revoked_at <= ?) ORDER BY id LIMIT ?",
        [beforeIso, beforeIso, limit]
      ),
      listIds(
        "SELECT id FROM cli_tokens WHERE expires_at <= ? OR " +
        "(revoked_at IS NOT NULL AND revoked_at <= ?) ORDER BY id LIMIT ?",
        [beforeIso, beforeIso, limit]
      ),
      listRateLimitKeys(
        "SELECT rate_key, window_kind, window_start_ms FROM " +
        "account_usage_rate_limits WHERE window_end_ms <= ? " +
        "ORDER BY rate_key, window_kind, window_start_ms LIMIT ?",
        [beforeMs, limit]
      )
    ]);
    const candidates = {
      cliLoginChallenges,
      cliTokens,
      oauthStates,
      rateLimits,
      sessions
    };
    const objectCount = Object.values(candidates)
      .reduce((total, records) => total + records.length, 0);
    const createdAt = normalizeIsoDate(planOptions.createdAt ?? now());
    const contentDigest = await createProfileMaintenanceDigest({
      before: beforeIso,
      candidates,
      retentionDays
    });
    return deepFreeze({
      before: beforeIso,
      candidates,
      retentionDays,
      summary: createProfileMaintenanceSummary({
        contentDigest,
        createdAt,
        objectCount,
        operation: "retention",
        ownerCount: 0
      })
    });
  }

  async function applyRetention(applyOptions = {}) {
    const expected = {
      expectedContentDigest: requireDigest(applyOptions.expectedContentDigest),
      expectedObjectCount: requireNonNegativeInteger(
        applyOptions.expectedObjectCount,
        "expectedObjectCount"
      )
    };
    let plan = await planRetention(applyOptions);
    assertExpectedPlan(plan.summary, expected);
    await beforeRetentionApply?.({ plan });
    plan = await planRetention(applyOptions);
    assertExpectedPlan(plan.summary, expected);

    const statements = [];
    statements.push(...deleteByIds(
      prepare,
      "oauth_states",
      plan.candidates.oauthStates
    ));
    statements.push(...deleteByIds(
      prepare,
      "cli_login_challenges",
      plan.candidates.cliLoginChallenges
    ));
    statements.push(...deleteByIds(
      prepare,
      "sessions",
      plan.candidates.sessions
    ));
    for (const key of plan.candidates.rateLimits) {
      statements.push(prepare(
        "DELETE FROM account_usage_rate_limits " +
        "WHERE rate_key = ? AND window_kind = ? AND window_start_ms = ?",
        [key.rateKey, key.windowKind, key.windowStartMs]
      ));
    }
    statements.push(...deleteByIds(
      prepare,
      "cli_tokens",
      plan.candidates.cliTokens
    ));
    if (statements.length > 0) await database.batch(statements);
    return plan;
  }

  async function readOwnerCounts(ownerId) {
    const row = await prepare(
      "SELECT " +
      "(SELECT COUNT(*) FROM owners WHERE id = ?) AS owners, " +
      "(SELECT COUNT(*) FROM oauth_states WHERE owner_id = ?) AS oauth_states, " +
      "(SELECT COUNT(*) FROM sessions WHERE owner_id = ?) AS sessions, " +
      "(SELECT COUNT(*) FROM cli_login_challenges WHERE owner_id = ?) " +
        "AS cli_login_challenges, " +
      "(SELECT COUNT(*) FROM cli_tokens WHERE owner_id = ?) AS cli_tokens, " +
      "(SELECT COUNT(*) FROM latest_snapshots WHERE owner_id = ?) " +
        "AS latest_snapshots, " +
      "(SELECT COUNT(*) FROM latest_usages WHERE owner_id = ?) AS latest_usages, " +
      "(SELECT COUNT(*) FROM submitted_devices WHERE owner_id = ?) " +
        "AS submitted_devices, " +
      "(SELECT COUNT(*) FROM account_usage_rate_limits WHERE rate_key IN " +
        "(SELECT id FROM cli_tokens WHERE owner_id = ?)) AS rate_limits",
      Array(9).fill(ownerId)
    ).first();
    return Object.freeze(Object.fromEntries(
      OWNER_COUNT_KEYS.map((key) => [key, Number(row?.[snakeCase(key)] ?? 0)])
    ));
  }

  async function listIds(sql, params) {
    const result = await prepare(sql, params).all();
    return (result.results ?? []).map((row) => String(row.id));
  }

  async function listRateLimitKeys(sql, params) {
    const result = await prepare(sql, params).all();
    return (result.results ?? []).map((row) => Object.freeze({
      rateKey: String(row.rate_key),
      windowKind: String(row.window_kind),
      windowStartMs: Number(row.window_start_ms)
    }));
  }
}

function buildOwnerDeleteGuard(plan, nonce) {
  const profile = plan.profile;
  const counts = plan.counts;
  const usage = profile.latestUsage;
  const snapshot = profile.latestSnapshot;
  const deviceFingerprint = profile.submittedDevices
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((device) =>
      `${device.id}:${device.updatedAt ?? ""}:${device.lastSubmittedAt ?? ""}`
    )
    .join("|");
  const sql =
    "INSERT INTO atomic_operation_claims " +
      "(operation, claim_key, nonce, outcome, created_at) " +
    "SELECT 'maintenanceDeleteOwner', owner.id, ?, 'ok', ? FROM owners owner " +
    "WHERE owner.id = ? AND owner.handle = ? AND owner.updated_at IS ? " +
    "AND (SELECT COUNT(*) FROM oauth_states WHERE owner_id = owner.id) = ? " +
    "AND (SELECT COUNT(*) FROM sessions WHERE owner_id = owner.id) = ? " +
    "AND (SELECT COUNT(*) FROM cli_login_challenges WHERE owner_id = owner.id) = ? " +
    "AND (SELECT COUNT(*) FROM cli_tokens WHERE owner_id = owner.id) = ? " +
    "AND (SELECT COUNT(*) FROM latest_snapshots WHERE owner_id = owner.id) = ? " +
    "AND (SELECT COUNT(*) FROM latest_usages WHERE owner_id = owner.id) = ? " +
    "AND (SELECT COUNT(*) FROM submitted_devices WHERE owner_id = owner.id) = ? " +
    "AND (SELECT COUNT(*) FROM account_usage_rate_limits WHERE rate_key IN " +
      "(SELECT id FROM cli_tokens WHERE owner_id = owner.id)) = ? " +
    "AND COALESCE((SELECT content_digest FROM latest_usages " +
      "WHERE owner_id = owner.id), '') = ? " +
    "AND COALESCE((SELECT captured_at FROM latest_usages " +
      "WHERE owner_id = owner.id), '') = ? " +
    "AND COALESCE((SELECT captured_at FROM latest_snapshots " +
      "WHERE owner_id = owner.id), '') = ? " +
    "AND COALESCE((SELECT GROUP_CONCAT(fingerprint, '|') FROM (" +
      "SELECT id || ':' || COALESCE(updated_at, '') || ':' || " +
      "COALESCE(last_submitted_at, '') AS fingerprint " +
      "FROM submitted_devices WHERE owner_id = owner.id ORDER BY id" +
    ")), '') = ?";
  return {
    params: [
      nonce,
      normalizeIsoDate(new Date()),
      profile.owner.id,
      profile.owner.handle,
      profile.owner.updatedAt ?? null,
      counts.oauthStates,
      counts.sessions,
      counts.cliLoginChallenges,
      counts.cliTokens,
      counts.latestSnapshots,
      counts.latestUsages,
      counts.submittedDevices,
      counts.rateLimits,
      usage?.contentDigest ?? "",
      usage?.capturedAt ?? "",
      snapshot?.capturedAt ?? "",
      deviceFingerprint
    ],
    sql
  };
}

function claimAssertion(prepare, operation, claimKey, nonce) {
  return prepare(
    "INSERT INTO atomic_operation_assertions (nonce) VALUES (" +
      "(SELECT nonce FROM atomic_operation_claims " +
      "WHERE operation = ? AND claim_key = ? AND nonce = ?)" +
    ")",
    [operation, claimKey, nonce]
  );
}

function claimCleanup(prepare, operation, claimKey, nonce) {
  return [
    prepare("DELETE FROM atomic_operation_assertions WHERE nonce = ?", [nonce]),
    prepare(
      "DELETE FROM atomic_operation_claims " +
      "WHERE operation = ? AND claim_key = ? AND nonce = ?",
      [operation, claimKey, nonce]
    )
  ];
}

function deleteByIds(prepare, table, ids) {
  return ids.map((id) =>
    prepare(`DELETE FROM ${table} WHERE id = ?`, [id])
  );
}

async function normalizeDurableProfile(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("restore profile must be an object");
  }
  const profile = structuredClone(value);
  requireKeySegment(profile.owner?.id, "ownerId");
  requireHandle(profile.owner?.handle);
  if (
    typeof profile.owner.authProvider !== "string" ||
    typeof profile.owner.providerUserId !== "string"
  ) {
    throw new TypeError("restore owner identity is incomplete");
  }
  if (!Array.isArray(profile.submittedDevices)) {
    throw new TypeError("restore submittedDevices must be an array");
  }
  profile.owner.cardStyle = normalizeCardStyle(profile.owner.cardStyle);
  const presentationDigest = await createPresentationDigest(
    profile.owner.cardStyle
  );
  if (
    profile.presentationDigest !== undefined &&
    !safeEqualText(profile.presentationDigest, presentationDigest)
  ) {
    throw new TypeError("restore presentationDigest does not match cardStyle");
  }
  profile.presentationDigest = presentationDigest;
  profile.publication = profile.publication ?? null;
  return profile;
}

function withProfileVisibility(profile, visibility) {
  const cloned = structuredClone(profile);
  cloned.owner.visibility = visibility;
  if (cloned.latestSnapshot) cloned.latestSnapshot.visibility = visibility;
  if (cloned.latestUsage) cloned.latestUsage.visibility = visibility;
  cloned.publication = null;
  return cloned;
}

function isSafeQuiescedRestoreState(current, staged) {
  if (current.owner.visibility !== "private") return false;
  const currentUpdatedAt = new Date(current.owner.updatedAt);
  const stagedUpdatedAt = new Date(staged.owner.updatedAt);
  if (
    Number.isNaN(currentUpdatedAt.getTime()) ||
    Number.isNaN(stagedUpdatedAt.getTime()) ||
    currentUpdatedAt.getTime() < stagedUpdatedAt.getTime()
  ) {
    return false;
  }
  const normalized = structuredClone(current);
  normalized.owner.updatedAt = staged.owner.updatedAt;
  return stableStringify(normalized) === stableStringify(staged);
}

function insertOwnerSql() {
  return "INSERT INTO owners (" +
    "id, auth_provider, provider_user_id, github_login, display_name, " +
    "avatar_url, profile_url, handle, visibility, card_style, created_at, updated_at" +
  ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
}

function ownerParams(owner) {
  return [
    owner.id,
    owner.authProvider,
    owner.providerUserId,
    owner.githubLogin ?? null,
    owner.displayName ?? null,
    owner.avatarUrl ?? null,
    owner.profileUrl ?? null,
    owner.handle,
    owner.visibility,
    serializeCardStyle(owner.cardStyle),
    owner.createdAt ?? null,
    owner.updatedAt ?? null
  ];
}

function insertLatestSnapshotSql() {
  return "INSERT INTO latest_snapshots (" +
    "owner_id, handle, visibility, captured_at, uploaded_at, schema_version, snapshot" +
  ") VALUES (?, ?, ?, ?, ?, ?, ?)";
}

function latestSnapshotParams(record) {
  return [
    record.ownerId,
    record.handle,
    record.visibility,
    record.capturedAt,
    record.uploadedAt,
    record.schemaVersion,
    JSON.stringify(record.snapshot)
  ];
}

function insertLatestUsageSql() {
  return "INSERT INTO latest_usages (" +
    "owner_id, handle, visibility, contract_version, captured_at, " +
    "uploaded_at, content_digest, usage" +
  ") VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
}

function latestUsageParams(record) {
  return [
    record.ownerId,
    record.handle,
    record.visibility,
    record.contractVersion ?? null,
    record.capturedAt,
    record.uploadedAt,
    record.contentDigest ?? null,
    JSON.stringify(record.usage)
  ];
}

function insertSubmittedDeviceSql() {
  return "INSERT INTO submitted_devices (" +
    "id, owner_id, device_key, display_name, created_at, updated_at, last_submitted_at" +
  ") VALUES (?, ?, ?, ?, ?, ?, ?)";
}

function deviceParams(record) {
  return [
    record.id,
    record.ownerId,
    record.deviceKey,
    record.displayName ?? null,
    record.createdAt,
    record.updatedAt,
    record.lastSubmittedAt
  ];
}

function assertExpectedPlan(summary, expected) {
  if (
    !safeEqualText(summary.contentDigest, expected.expectedContentDigest) ||
    summary.objectCount !== expected.expectedObjectCount
  ) {
    throw maintenanceError(
      "conflict",
      "maintenance plan no longer matches expected digest and count"
    );
  }
}

function sumCounts(counts) {
  return OWNER_COUNT_KEYS.reduce((total, key) => total + counts[key], 0);
}

function snakeCase(value) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function requireD1Database(database) {
  if (
    !database ||
    typeof database.prepare !== "function" ||
    typeof database.batch !== "function"
  ) {
    throw new TypeError("D1 database binding is required for maintenance");
  }
  return database;
}

function requireKeySegment(value, label) {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(value)
  ) {
    throw new TypeError(`${label} must be a safe key segment`);
  }
  return value;
}

function requireHandle(value) {
  if (
    typeof value !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  ) {
    throw new TypeError("handle must be canonical");
  }
  return value;
}

function requireDigest(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new TypeError("expectedContentDigest must be a SHA-256 digest");
  }
  return value;
}

function requireNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative integer`);
  }
  return value;
}

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer`);
  }
  return value;
}

function normalizeDate(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("maintenance date is invalid");
  }
  return date;
}

function normalizeIsoDate(value) {
  return normalizeDate(value).toISOString();
}

function nextIsoTimestamp(previous, current) {
  const candidate = normalizeDate(current);
  if (!previous) return candidate.toISOString();
  const previousDate = normalizeDate(previous);
  if (candidate.getTime() <= previousDate.getTime()) {
    return new Date(previousDate.getTime() + 1).toISOString();
  }
  return candidate.toISOString();
}

function maintenanceError(code, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.name = "ProfileMaintenanceError";
  error.code = code;
  return error;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
