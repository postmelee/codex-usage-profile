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
import { createProfileCardServiceCore } from "../../profile-card/service-core.js";
import {
  PROFILE_MEDIA_STABLE_STATE_KINDS,
  PROFILE_MEDIA_SUPPORTED_LOCALES
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

const JSON_HEADERS = Object.freeze({
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8"
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
    planOwner,
    repairPublication,
    restoreOwner,
    retention
  });

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
    const representations = {};
    for (const locale of PROFILE_MEDIA_SUPPORTED_LOCALES) {
      const card = await cardService.renderOwnerCard({
        ownerId: scope.ownerId,
        locale
      });
      if (!safeEqualText(card.etag, expectedApplicationEtags[locale])) {
        throw maintenanceError(
          "conflict",
          "rendered card ETag no longer matches the repair request"
        );
      }
      await mediaStore.putRevision({
        body: card.body,
        createdAt: now(),
        etag: card.etag,
        locale,
        ownerId: scope.ownerId,
        revision: card.revision
      });
      representations[locale] = {
        etag: card.etag,
        revision: card.revision
      };
    }

    const repaired = await r2.repairPublication({
      ...scope,
      apply: true,
      expectedStorageEtag,
      publication: {
        handle: scope.handle,
        ownerId: scope.ownerId,
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
        objectCount: PROFILE_MEDIA_SUPPORTED_LOCALES.length + 1,
        operation: "repair-publication",
        ownerCount: 1
      })
    };
  }
}

export async function dispatchMaintenanceOperation(service, payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("maintenance payload must be an object");
  }
  switch (payload.operation) {
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
      count += Object.keys(
        profile.publication.publication?.representations ?? {}
      ).length;
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
    PROFILE_MEDIA_SUPPORTED_LOCALES.map((locale) => {
      const etag = value[locale];
      if (
        typeof etag !== "string" ||
        !/^"[A-Za-z0-9_-]{43}"$/.test(etag)
      ) {
        throw new TypeError(`expectedApplicationEtags.${locale} is invalid`);
      }
      return [locale, etag];
    })
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
  return {
    invalid_request: "Maintenance request is invalid",
    maintenance_conflict: "Maintenance plan is stale or conflicts",
    maintenance_unavailable: "Maintenance operation is unavailable",
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
