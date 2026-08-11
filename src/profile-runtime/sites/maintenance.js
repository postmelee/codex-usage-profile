import {
  assertProfileMaintenanceBackup,
  createProfileMaintenanceBackup,
  createProfileMaintenanceDigest,
  createProfileMaintenanceSummary,
  safeEqualText
} from "../../profile-backend/maintenance-contract.js";
import {
  createD1ProfileMaintenance
} from "../../profile-backend/d1/maintenance.js";
import {
  D1_MIGRATION_MANIFEST
} from "../../profile-backend/d1/migration-manifest.js";
import {
  migrateD1Database,
  splitSqlStatements
} from "../../profile-backend/d1/migration-runner.js";
import {
  inspectD1MigrationReadiness
} from "../../profile-backend/d1/store.js";
import { createProfileCardServiceCore } from "../../profile-card/service-core.js";
import {
  createPresentationDigest,
  normalizeCardStyle
} from "../../profile-card/presentation.js";
import {
  PROFILE_MEDIA_FORMAT,
  PROFILE_MEDIA_LEGACY_CONTRACT_VERSION,
  PROFILE_MEDIA_STORE_CONTRACT_VERSION,
  PROFILE_MEDIA_STABLE_STATE_KINDS,
  PROFILE_MEDIA_SUPPORTED_LOCALES,
  PROFILE_MEDIA_SUPPORTED_THEMES
} from "../../profile-media/media-store-contract.js";
import {
  createProfilePublicationService
} from "../../profile-media/publication-service.js";
import {
  createR2BindingProfileMediaMaintenance
} from "../../profile-media/r2-binding/maintenance.js";
import { createProfileSitesBackendDependencies } from "./backend.js";

export const PROFILE_SITES_MAINTENANCE_PATH =
  "/__ops/profile-maintenance";
export const DEFAULT_PROFILE_SITES_MAINTENANCE_BODY_MAX_BYTES =
  512 * 1024;
export const PROFILE_SITES_MIGRATION_NOT_READY_CODE =
  "migration_not_ready";

const PROFILE_SITES_MIGRATION_STAGE_CODES = Object.freeze([
  "migration_inspection_unavailable",
  "migration_reconciliation_unavailable",
  "migration_apply_unavailable",
  "migration_apply_initialize_unavailable",
  "migration_apply_read_unavailable",
  "migration_verification_unavailable"
]);

const JSON_HEADERS = Object.freeze({
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8"
});
const HOSTED_D1_MIGRATION_COLUMNS = Object.freeze({
  3: Object.freeze({
    column: "intent",
    table: "cli_login_challenges",
    tableSqlFragment:
      "intent TEXT CHECK (intent IS NULL OR intent IN ('login', 'submit'))"
  }),
  4: Object.freeze({
    column: "card_style",
    table: "owners",
    tableSqlFragment:
      "card_style TEXT NOT NULL " +
      "DEFAULT '{\"effect\":{\"preset\":\"none\",\"version\":1}," +
      "\"schemaVersion\":1,\"theme\":\"dark\"}' " +
      "CHECK (json_valid(card_style))"
  }),
  5: Object.freeze({
    column: "card_locale",
    table: "owners",
    tableSqlFragment:
      "card_locale TEXT NOT NULL DEFAULT 'en' " +
      "CHECK (card_locale IN ('en', 'ko'))"
  })
});

export function createProfileSitesMaintenanceHandler(options = {}) {
  const config = options.config ?? {};

  return async function handleProfileSitesMaintenance(request) {
    if (!isAuthorizedMaintenanceRequest(request, config)) {
      return maintenanceNotFoundResponse();
    }
    if (request.method.toUpperCase() !== "POST") {
      return maintenanceResponse(405, "method_not_allowed");
    }
    if (!isJsonContentType(request.headers.get("content-type"))) {
      return maintenanceResponse(415, "unsupported_media_type");
    }

    let payload;
    try {
      payload = await readBoundedJson(
        request,
        options.bodyMaxBytes ??
          DEFAULT_PROFILE_SITES_MAINTENANCE_BODY_MAX_BYTES
      );
    } catch {
      return maintenanceResponse(400, "invalid_request");
    }

    try {
      const service = options.service ??
        options.createService?.() ??
        createProfileSitesMaintenanceService(options);
      const result = await dispatchMaintenanceOperation(service, payload);
      return new Response(JSON.stringify({ ok: true, ...result }), {
        status: 200,
        headers: JSON_HEADERS
      });
    } catch (error) {
      if (error?.code === "not_found") {
        return maintenanceResponse(404, "not_found");
      }
      if (error?.code === "conflict") {
        return maintenanceResponse(409, "maintenance_conflict");
      }
      if (error?.code === PROFILE_SITES_MIGRATION_NOT_READY_CODE) {
        return maintenanceResponse(
          503,
          PROFILE_SITES_MIGRATION_NOT_READY_CODE
        );
      }
      if (isMigrationStageCode(error?.code)) {
        return maintenanceResponse(503, error.code);
      }
      if (error instanceof TypeError || error?.code === "invalid") {
        return maintenanceResponse(400, "invalid_request");
      }
      return maintenanceResponse(503, "maintenance_unavailable");
    }
  };
}

export function createProfileSitesMaintenanceService(options = {}) {
  const dependencies = createProfileSitesBackendDependencies({
    database: options.database,
    media: options.media,
    mediaStore: options.mediaStore,
    rateLimiter: options.rateLimiter ?? { consume() {} },
    store: options.store
  });
  const store = dependencies.store;
  const mediaStore = dependencies.mediaStore;
  if (!dependencies.media || !mediaStore) {
    throw new TypeError("Sites maintenance requires D1 and R2 bindings");
  }
  const now = options.now ?? (() => new Date());
  const inspectReadiness = options.inspectD1MigrationReadiness ??
    inspectD1MigrationReadiness;
  const applyMigrations = options.migrateD1Database ?? migrateD1Database;
  const reconcileMigrations = options.reconcileHostedD1Migrations ??
    reconcileHostedD1Migrations;
  const createId = options.createId ??
    ((prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`);
  const d1 = options.d1Maintenance ?? createD1ProfileMaintenance({
    database: dependencies.database,
    now,
    store
  });
  const r2 = options.r2Maintenance ??
    createR2BindingProfileMediaMaintenance({
      bucket: dependencies.media,
      mediaStore,
      now
    });
  const cardService = options.cardService ?? createProfileCardServiceCore({
    store,
    now,
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
    observeAvatarLoadFailure: options.profileCardAvatarFailureObserver,
    renderPng: options.profileCardRenderPng,
    rendererVersion: options.profileCardRendererVersion
  });
  const publicationService = options.publicationService ??
    createProfilePublicationService({
      store,
      mediaStore,
      cardService,
      now,
      createId
    });

  return Object.freeze({
    deleteAccount,
    exportOwner,
    migrate,
    planOwner,
    readiness,
    repairPublication,
    restoreOwner,
    retention
  });

  async function readiness() {
    const result = await inspectReadiness(dependencies.database);
    if (result.readyExact !== true) {
      throw maintenanceError(
        PROFILE_SITES_MIGRATION_NOT_READY_CODE,
        "D1 migration readiness did not match the candidate"
      );
    }
    return Object.freeze({
      summary: Object.freeze({
        appliedVersions: result.appliedVersions,
        expectedVersions: result.expectedVersions,
        operation: "readiness",
        ready: true
      })
    });
  }

  async function migrate() {
    let before;
    try {
      before = await inspectReadiness(dependencies.database);
    } catch (cause) {
      throw maintenanceError(
        "migration_inspection_unavailable",
        "D1 migration inspection is unavailable",
        cause
      );
    }
    if (before.unexpectedVersions.length > 0) {
      throw maintenanceError(
        "conflict",
        "D1 contains a migration version outside the candidate manifest"
      );
    }
    const migrations = requireExactD1Migrations(options.migrations);
    let runnableMigrations;
    try {
      runnableMigrations = await reconcileMigrations(
        dependencies.database,
        migrations,
        before.appliedVersions
      );
    } catch (error) {
      if (error?.code === "conflict") throw error;
      throw maintenanceError(
        "migration_reconciliation_unavailable",
        "D1 migration reconciliation is unavailable",
        error
      );
    }
    let applied;
    let applyProgress = Object.freeze({ phase: "unknown" });
    try {
      applied = await applyMigrations(dependencies.database, {
        migrations: runnableMigrations,
        now,
        onProgress(progress) {
          applyProgress = progress;
        }
      });
    } catch (cause) {
      throw maintenanceError(
        migrationApplyFailureCode(applyProgress, runnableMigrations),
        "D1 migration apply is unavailable",
        cause
      );
    }
    let after;
    let newlyAppliedVersions;
    try {
      after = await inspectReadiness(dependencies.database);
      newlyAppliedVersions = normalizeAppliedMigrationVersions(
        applied?.newlyApplied,
        after.appliedVersions
      );
    } catch (cause) {
      throw maintenanceError(
        "migration_verification_unavailable",
        "D1 migration verification is unavailable",
        cause
      );
    }
    if (after.readyExact !== true) {
      throw maintenanceError(
        PROFILE_SITES_MIGRATION_NOT_READY_CODE,
        "D1 migration readiness did not match after apply"
      );
    }
    return Object.freeze({
      summary: Object.freeze({
        appliedVersions: after.appliedVersions,
        newlyAppliedVersions,
        operation: "migrate"
      })
    });
  }

  async function planOwner(operationOptions = {}) {
    const scope = requireOwnerScope(operationOptions);
    const [structured, media] = await Promise.all([
      d1.planOwnerDeletion(scope),
      r2.planOwnerDeletion(scope)
    ]);
    return combinePlans("plan", structured, media, scope, now());
  }

  async function exportOwner(operationOptions = {}) {
    const scope = requireOwnerScope(operationOptions);
    const [profile, mediaManifest] = await Promise.all([
      d1.exportOwner(scope),
      r2.listOwnerManifest(scope)
    ]);
    const backup = await createProfileMaintenanceBackup({
      createdAt: now(),
      profiles: [{
        ...profile,
        publication: mediaManifest.stable
      }]
    });
    const objectCount = countBackupObjects(backup.profiles[0]);
    return {
      backup,
      summary: createProfileMaintenanceSummary({
        contentDigest: backup.contentDigest,
        createdAt: backup.createdAt,
        objectCount,
        operation: "export",
        ownerCount: 1
      })
    };
  }

  async function restoreOwner(operationOptions = {}) {
    const backup = await assertProfileMaintenanceBackup(
      operationOptions.backup
    );
    const profile = backup.profiles[0];
    const scope = requireOwnerScope(operationOptions);
    assertProfileScope(profile, scope);
    const objectCount = countBackupObjects(profile);
    assertApplyConfirmation(operationOptions, {
      contentDigest: backup.contentDigest,
      objectCount,
      scope
    });

    const restored = await d1.restoreOwner({ profile });
    if (restored.desiredVisibility === "public") {
      await publicationService.publishOwnerCard({ ownerId: scope.ownerId });
    } else {
      const mediaPlan = await r2.planOwnerDeletion(scope);
      if (
        mediaPlan.manifest.stable.kind ===
          PROFILE_MEDIA_STABLE_STATE_KINDS.PUBLICATION
      ) {
        await r2.tombstoneOwnerPublication({
          ...scope,
          apply: true,
          expectedStorageEtag:
            mediaPlan.manifest.stable.storageEtag,
          tombstoneId: createId("profile_media_tombstone"),
          unpublishedAt: now()
        });
      }
    }

    return {
      summary: createProfileMaintenanceSummary({
        contentDigest: backup.contentDigest,
        createdAt: now(),
        objectCount,
        operation: "restore",
        ownerCount: 1
      })
    };
  }

  async function retention(operationOptions = {}) {
    const [structured, media] = await Promise.all([
      d1.planRetention(operationOptions),
      r2.planRetention(operationOptions)
    ]);
    const combined = await combinePlans(
      "retention",
      structured,
      media,
      null,
      now()
    );
    if (operationOptions.apply !== true) return combined;
    assertApplyConfirmation(operationOptions, {
      contentDigest: combined.summary.contentDigest,
      objectCount: combined.summary.objectCount,
      scope: null
    });
    await d1.applyRetention({
      ...operationOptions,
      expectedContentDigest: structured.summary.contentDigest,
      expectedObjectCount: structured.summary.objectCount
    });
    await r2.applyRetention({
      ...operationOptions,
      expectedContentDigest: media.summary.contentDigest,
      expectedObjectCount: media.summary.objectCount
    });
    return combined;
  }

  async function deleteAccount(operationOptions = {}) {
    const scope = requireOwnerScope(operationOptions);
    const combined = await planOwner(scope);
    assertApplyConfirmation(operationOptions, {
      contentDigest: combined.summary.contentDigest,
      objectCount: combined.summary.objectCount,
      scope
    });

    const currentMedia = await r2.planOwnerDeletion(scope);
    await r2.tombstoneOwnerPublication({
      ...scope,
      apply: true,
      expectedStorageEtag: currentMedia.manifest.stable.storageEtag,
      tombstoneId: createId("profile_media_tombstone"),
      unpublishedAt: now()
    });
    await d1.quiesceOwner(scope);

    const privateMedia = await r2.planOwnerDeletion(scope);
    await r2.deleteOwnerRevisions({
      ...scope,
      apply: true,
      expectedContentDigest: privateMedia.summary.contentDigest,
      expectedObjectCount: privateMedia.summary.objectCount
    });
    const privateStructured = await d1.planOwnerDeletion(scope);
    await d1.deleteOwner({
      ...scope,
      expectedContentDigest: privateStructured.summary.contentDigest,
      expectedObjectCount: privateStructured.summary.objectCount
    });
    return {
      summary: createProfileMaintenanceSummary({
        contentDigest: combined.summary.contentDigest,
        createdAt: now(),
        objectCount: combined.summary.objectCount,
        operation: "delete-account",
        ownerCount: 1
      })
    };
  }

  async function repairPublication(operationOptions = {}) {
    const scope = requireOwnerScope(operationOptions);
    const combined = await planOwner(scope);
    assertApplyConfirmation(operationOptions, {
      contentDigest: combined.summary.contentDigest,
      objectCount: combined.summary.objectCount,
      scope
    });
    const owner = await store.getOwnerById(scope.ownerId);
    if (!owner || owner.handle !== scope.handle) {
      throw maintenanceError("not_found", "owner scope was not found");
    }
    const expectedStorageEtag = requireStorageEtag(
      operationOptions.expectedStorageEtag
    );
    const expectedApplicationEtags = normalizeApplicationEtags(
      operationOptions.expectedApplicationEtags
    );
    const cardStyle = normalizeCardStyle(owner.cardStyle);
    const presentationDigest = await createPresentationDigest({
      ...cardStyle,
      effect: { preset: "none", version: 1 },
      theme: "dark"
    });
    const representations = {};
    for (const theme of ["light", "dark"]) {
      representations[theme] = {};
      for (const locale of PROFILE_MEDIA_SUPPORTED_LOCALES) {
        const card = await cardService.renderOwnerCard({
          ownerId: scope.ownerId,
          locale,
          theme
        });
        if (!safeEqualText(card.etag, expectedApplicationEtags[theme][locale])) {
          throw maintenanceError(
            "conflict",
            "rendered card ETag no longer matches the repair request"
          );
        }
        await putRepairRevision(mediaStore, {
          body: card.body,
          contractVersion: PROFILE_MEDIA_STORE_CONTRACT_VERSION,
          createdAt: now(),
          etag: card.etag,
          format: PROFILE_MEDIA_FORMAT,
          locale,
          ownerId: scope.ownerId,
          presentationDigest,
          revision: card.revision,
          theme
        });
        representations[theme][locale] = {
          etag: card.etag,
          revision: card.revision
        };
      }
    }

    const repaired = await r2.repairPublication({
      ...scope,
      apply: true,
      expectedStorageEtag,
      publication: {
        contractVersion: PROFILE_MEDIA_STORE_CONTRACT_VERSION,
        format: PROFILE_MEDIA_FORMAT,
        handle: scope.handle,
        ownerId: scope.ownerId,
        presentationDigest,
        publicationId: createId("profile_media_repair"),
        publishedAt: normalizeIsoDate(now()),
        representations
      }
    });
    try {
      await store.atomic.updateVisibility({
        ownerId: owner.id,
        expectedOwnerUpdatedAt: owner.updatedAt ?? null,
        updatedAt: nextIsoTimestamp(owner.updatedAt, now()),
        visibility: "public"
      });
    } catch (error) {
      try {
        await mediaStore.unpublishCard({
          expectedStorageEtag: repaired.stable.storageEtag,
          handle: scope.handle,
          tombstoneId: createId("profile_media_tombstone"),
          unpublishedAt: now()
        });
      } catch {
        // The response remains unavailable; operators must re-plan before retry.
      }
      throw error;
    }

    const digest = await createProfileMaintenanceDigest({
      applicationEtags: expectedApplicationEtags,
      ownerId: scope.ownerId,
      stableStorageEtag: repaired.stable.storageEtag
    });
    return {
      summary: createProfileMaintenanceSummary({
        contentDigest: digest,
        createdAt: now(),
        objectCount:
          PROFILE_MEDIA_SUPPORTED_THEMES.length *
          PROFILE_MEDIA_SUPPORTED_LOCALES.length + 2,
        operation: "repair-publication",
        ownerCount: 1
      })
    };
  }
}

async function putRepairRevision(mediaStore, revision) {
  try {
    return await mediaStore.putRevision(revision);
  } catch (error) {
    if (
      error?.code !== "conflict" ||
      revision.theme !== "dark"
    ) {
      throw error;
    }
    const existing = await mediaStore.getRevision?.({
      contractVersion: PROFILE_MEDIA_LEGACY_CONTRACT_VERSION,
      locale: revision.locale,
      ownerId: revision.ownerId,
      revision: revision.revision,
      theme: "dark"
    });
    if (!existing || !safeEqualText(existing.etag, revision.etag)) {
      throw error;
    }
    return existing;
  }
}

export async function dispatchMaintenanceOperation(service, payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("maintenance payload must be an object");
  }
  switch (payload.operation) {
    case "migrate":
      assertIdentitylessPayload(payload, "migrate");
      return service.migrate();
    case "readiness":
      assertIdentitylessPayload(payload, "readiness");
      return service.readiness();
    case "plan":
      return service.planOwner(payload);
    case "export":
      return service.exportOwner(payload);
    case "restore":
      return service.restoreOwner(payload);
    case "retention":
      return service.retention(payload);
    case "delete-account":
      return service.deleteAccount(payload);
    case "repair-publication":
      return service.repairPublication(payload);
    default:
      throw new TypeError("maintenance operation is unsupported");
  }
}

function assertIdentitylessPayload(payload, operation) {
  if (
    Object.keys(payload).length !== 1 ||
    payload.operation !== operation
  ) {
    throw new TypeError(`${operation} accepts only the operation field`);
  }
}

function requireExactD1Migrations(value) {
  if (!Array.isArray(value) || value.length !== D1_MIGRATION_MANIFEST.length) {
    throw new TypeError("exact D1 migrations are required");
  }
  return Object.freeze(value.map((migration, index) => {
    const expected = D1_MIGRATION_MANIFEST[index];
    if (
      !migration ||
      typeof migration !== "object" ||
      Array.isArray(migration) ||
      Object.keys(migration).sort().join(",") !== "name,sql,version" ||
      migration.version !== expected.version ||
      migration.name !== expected.name ||
      typeof migration.sql !== "string" ||
      migration.sql.trim() === ""
    ) {
      throw new TypeError("D1 migrations do not match the candidate manifest");
    }
    return migration;
  }));
}

async function reconcileHostedD1Migrations(
  database,
  migrations,
  appliedVersions
) {
  const applied = new Set(appliedVersions);
  const runnable = [];
  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    if (migration.version <= 2) {
      runnable.push(await reconcileHostedD1BaseMigration(
        database,
        migration
      ));
      continue;
    }
    const specification = HOSTED_D1_MIGRATION_COLUMNS[migration.version];
    if (!specification) {
      runnable.push(migration);
      continue;
    }

    const tableResult = await database.prepare(
      "SELECT sql FROM sqlite_master " +
        "WHERE type = 'table' AND name = ? LIMIT 1"
    ).bind(specification.table).all();
    const tableSql = tableResult.results?.[0]?.sql;
    if (typeof tableSql !== "string") {
      if (!applied.has(1)) {
        runnable.push(migration);
        continue;
      }
      throw maintenanceError(
        "conflict",
        "Hosted D1 table is missing for the candidate migration"
      );
    }
    const normalizedTableSql = normalizeSql(tableSql);
    const columnPattern = new RegExp(
      `\\b${specification.column.toLowerCase()}\\b`,
      "u"
    );
    if (!columnPattern.test(normalizedTableSql)) {
      runnable.push(migration);
      continue;
    }
    if (
      !normalizedTableSql.includes(
        normalizeSql(specification.tableSqlFragment)
      )
    ) {
      throw maintenanceError(
        "conflict",
        "Hosted D1 schema does not match the candidate migration"
      );
    }
    runnable.push(Object.freeze({
      name: migration.name,
      sql: "",
      version: migration.version
    }));
  }
  return Object.freeze(runnable);
}

async function reconcileHostedD1BaseMigration(database, migration) {
  const objects = splitSqlStatements(migration.sql).map((sql) => {
    const match = /^CREATE (TABLE|INDEX) ([a-z][a-z0-9_]*)\b/iu.exec(sql);
    if (!match) {
      throw new TypeError("Hosted D1 base migration must contain only schema objects");
    }
    return Object.freeze({
      name: match[2],
      sql,
      type: match[1].toLowerCase()
    });
  });
  const stored = [];
  for (const object of objects) {
    const result = await database.prepare(
      "SELECT type, name, sql FROM sqlite_master " +
        "WHERE type = ? AND name = ? LIMIT 1"
    ).bind(object.type, object.name).all();
    stored.push(result.results?.[0] ?? null);
  }
  const presentCount = stored.filter(Boolean).length;
  if (presentCount === 0) return migration;
  if (presentCount !== objects.length) {
    throw maintenanceError(
      "conflict",
      "Hosted D1 base schema is only partially applied"
    );
  }
  for (let index = 0; index < objects.length; index += 1) {
    const object = objects[index];
    const actual = stored[index];
    if (
      actual.type !== object.type ||
      actual.name !== object.name ||
      typeof actual.sql !== "string"
    ) {
      throw maintenanceError(
        "conflict",
        "Hosted D1 base schema does not match the candidate migration"
      );
    }
    const actualSql = object.type === "table"
      ? stripHostedD1ColumnFragments(object.name, actual.sql)
      : normalizeSql(actual.sql);
    if (
      actualSql !== normalizeSql(object.sql)
    ) {
      throw maintenanceError(
        "conflict",
        "Hosted D1 base schema does not match the candidate migration"
      );
    }
  }
  return Object.freeze({
    name: migration.name,
    sql: "",
    version: migration.version
  });
}

function stripHostedD1ColumnFragments(table, value) {
  let normalized = normalizeSql(value);
  for (const specification of Object.values(HOSTED_D1_MIGRATION_COLUMNS)) {
    if (specification.table !== table) continue;
    normalized = normalized.replace(
      normalizeSql(specification.tableSqlFragment),
      ""
    );
  }
  let collapsed = normalized;
  do {
    normalized = collapsed;
    collapsed = normalized.replace(/,\s*,/gu, ",");
  } while (collapsed !== normalized);
  return normalizeSql(
    collapsed.replace(/\(\s*,/gu, "(").replace(/,\s*\)/gu, ")")
  );
}

function normalizeSql(value) {
  return value.replace(/\s+/gu, " ").trim().toLowerCase();
}

function normalizeAppliedMigrationVersions(value, appliedVersions) {
  if (!Array.isArray(value)) {
    throw new TypeError("D1 migration result is invalid");
  }
  const allowed = new Set(appliedVersions);
  const normalized = [...value];
  if (
    normalized.some((version, index) =>
      !Number.isSafeInteger(version) ||
      !allowed.has(version) ||
      (index > 0 && version <= normalized[index - 1])
    )
  ) {
    throw new TypeError("D1 migration result is invalid");
  }
  return Object.freeze(normalized);
}

function isMigrationStageCode(value) {
  return PROFILE_SITES_MIGRATION_STAGE_CODES.includes(value) ||
    /^migration_apply_(?:metadata|sql)_v[1-5]_unavailable$/u.test(
      value ?? ""
    );
}

function migrationApplyFailureCode(progress, migrations) {
  if (progress?.phase === "initialize") {
    return "migration_apply_initialize_unavailable";
  }
  if (progress?.phase === "read") {
    return "migration_apply_read_unavailable";
  }
  if (
    ["prepare", "batch"].includes(progress?.phase) &&
    Number.isSafeInteger(progress?.version)
  ) {
    const migration = migrations.find(
      (candidate) => candidate.version === progress.version
    );
    if (migration) {
      const kind = migration.sql.trim() === "" ? "metadata" : "sql";
      return `migration_apply_${kind}_v${migration.version}_unavailable`;
    }
  }
  return "migration_apply_unavailable";
}

function isAuthorizedMaintenanceRequest(request, config) {
  if (
    config.maintenanceEnabled !== true ||
    typeof config.maintenanceToken !== "string" ||
    config.maintenanceToken === ""
  ) {
    return false;
  }
  const url = new URL(request.url);
  const isSecure = url.protocol === "https:" ||
    (url.protocol === "http:" && isLoopbackHostname(url.hostname));
  if (!isSecure || request.headers.get("origin") !== url.origin) {
    return false;
  }
  const authorization = request.headers.get("authorization") ?? "";
  const candidate = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  return safeEqualText(candidate, config.maintenanceToken);
}

async function readBoundedJson(request, maximumBytes) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
    throw new TypeError("maintenance body limit is invalid");
  }
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maximumBytes) {
    throw new TypeError("maintenance body is too large");
  }
  const reader = request.body?.getReader();
  if (!reader) return {};
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maximumBytes) {
      await reader.cancel();
      throw new TypeError("maintenance body is too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function combinePlans(operation, structured, media, scope, createdAt) {
  const contentDigest = await createProfileMaintenanceDigest({
    handle: scope?.handle ?? null,
    media: media.summary.contentDigest,
    ownerId: scope?.ownerId ?? null,
    structured: structured.summary.contentDigest
  });
  return {
    summary: createProfileMaintenanceSummary({
      contentDigest,
      createdAt,
      objectCount:
        structured.summary.objectCount + media.summary.objectCount,
      operation,
      ownerCount: scope ? 1 : 0
    })
  };
}

function countBackupObjects(profile) {
  let count = 1 + profile.submittedDevices.length;
  if (profile.latestSnapshot) count += 1;
  if (profile.latestUsage) count += 1;
  if (
    profile.publication &&
    profile.publication.kind !== PROFILE_MEDIA_STABLE_STATE_KINDS.MISSING
  ) {
    count += 1;
    if (
      profile.publication.kind ===
        PROFILE_MEDIA_STABLE_STATE_KINDS.PUBLICATION
    ) {
      const publication = profile.publication.publication;
      const representations = publication?.representations ?? {};
      count += publication?.contractVersion === PROFILE_MEDIA_STORE_CONTRACT_VERSION
        ? PROFILE_MEDIA_SUPPORTED_THEMES.reduce(
          (total, theme) => total + Object.keys(representations[theme] ?? {}).length,
          0
        ) + Math.max(Object.keys(publication.stableKeys ?? {}).length - 1, 0)
        : Object.keys(representations).length;
    }
  }
  return count;
}

function assertApplyConfirmation(options, expected) {
  if (options.apply !== true) {
    throw new TypeError("maintenance mutation requires apply");
  }
  const digest = requireDigest(options.expectedContentDigest);
  const count = requireNonNegativeInteger(
    options.expectedObjectCount,
    "expectedObjectCount"
  );
  if (
    !safeEqualText(digest, expected.contentDigest) ||
    count !== expected.objectCount
  ) {
    throw maintenanceError(
      "conflict",
      "maintenance confirmation no longer matches the current plan"
    );
  }
  if (expected.scope) assertOwnerConfirmation(options, expected.scope);
}

function assertOwnerConfirmation(options, scope) {
  const confirmation = options.confirmOwner;
  if (
    !confirmation ||
    confirmation.ownerId !== scope.ownerId ||
    confirmation.handle !== scope.handle
  ) {
    throw new TypeError("exact owner confirmation is required");
  }
}

function assertProfileScope(profile, scope) {
  if (
    profile.owner.id !== scope.ownerId ||
    profile.owner.handle !== scope.handle
  ) {
    throw new TypeError("maintenance backup owner scope does not match");
  }
}

function requireOwnerScope(options) {
  return Object.freeze({
    handle: requireHandle(options.handle),
    ownerId: requireKeySegment(options.ownerId, "ownerId")
  });
}

function normalizeApplicationEtags(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("expectedApplicationEtags is required");
  }
  return Object.freeze(Object.fromEntries(
    PROFILE_MEDIA_SUPPORTED_THEMES.map((theme) => [
      theme,
      Object.freeze(Object.fromEntries(
        PROFILE_MEDIA_SUPPORTED_LOCALES.map((locale) => {
          const etag = value[theme]?.[locale];
          if (
            typeof etag !== "string" ||
            !/^"[A-Za-z0-9_-]{43}"$/.test(etag)
          ) {
            throw new TypeError(
              `expectedApplicationEtags.${theme}.${locale} is invalid`
            );
          }
          return [locale, etag];
        })
      ))
    ])
  ));
}

function requireStorageEtag(value) {
  if (value === null) return null;
  if (typeof value !== "string" || value === "") {
    throw new TypeError("expectedStorageEtag must be a string or null");
  }
  return value.replace(/^"|"$/gu, "");
}

function requireDigest(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new TypeError("expectedContentDigest must be a SHA-256 digest");
  }
  return value;
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

function requireNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative integer`);
  }
  return value;
}

function isJsonContentType(value) {
  return typeof value === "string" &&
    value.toLowerCase().split(";", 1)[0].trim() === "application/json";
}

function isLoopbackHostname(hostname) {
  return ["127.0.0.1", "::1", "localhost"].includes(hostname);
}

function normalizeIsoDate(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("maintenance timestamp is invalid");
  }
  return date.toISOString();
}

function nextIsoTimestamp(previous, current) {
  const candidate = new Date(current);
  if (Number.isNaN(candidate.getTime())) {
    throw new TypeError("maintenance timestamp is invalid");
  }
  if (!previous) return candidate.toISOString();
  const previousDate = new Date(previous);
  if (candidate.getTime() <= previousDate.getTime()) {
    return new Date(previousDate.getTime() + 1).toISOString();
  }
  return candidate.toISOString();
}

function maintenanceNotFoundResponse() {
  return maintenanceResponse(404, "not_found");
}

function maintenanceResponse(status, code) {
  return new Response(JSON.stringify({
    ok: false,
    error: { code, message: maintenanceMessage(code) }
  }), {
    status,
    headers: JSON_HEADERS
  });
}

function maintenanceMessage(code) {
  if (code.startsWith("migration_apply_")) {
    return "Maintenance migration apply failed";
  }
  return {
    invalid_request: "Maintenance request is invalid",
    maintenance_conflict: "Maintenance plan is stale or conflicts",
    maintenance_unavailable: "Maintenance operation is unavailable",
    migration_apply_unavailable: "Maintenance migration apply failed",
    migration_inspection_unavailable:
      "Maintenance migration inspection failed",
    migration_not_ready: "Maintenance readiness check failed",
    migration_reconciliation_unavailable:
      "Maintenance migration reconciliation failed",
    migration_verification_unavailable:
      "Maintenance migration verification failed",
    method_not_allowed: "Maintenance method is not allowed",
    not_found: "Not found",
    unsupported_media_type: "Maintenance request must use JSON"
  }[code] ?? "Maintenance operation failed";
}

function maintenanceError(code, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.name = "ProfileMaintenanceError";
  error.code = code;
  return error;
}
