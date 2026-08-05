import {
  createProfileMaintenanceDigest,
  createProfileMaintenanceSummary,
  safeEqualText
} from "../../profile-backend/maintenance-contract.js";
import {
  DEFAULT_PROFILE_MEDIA_RECENT_REVISIONS,
  DEFAULT_PROFILE_MEDIA_RETENTION_DAYS,
  PROFILE_MEDIA_REVISION_PREFIX,
  PROFILE_MEDIA_STABLE_PREFIX,
  isProfileMediaStableKey,
  parseProfileMediaRevisionObject,
  selectProfileMediaCleanupCandidates
} from "../maintenance-contract.js";
import {
  PROFILE_MEDIA_LEGACY_CONTRACT_VERSION,
  PROFILE_MEDIA_STORE_CONTRACT_VERSION,
  PROFILE_MEDIA_STABLE_STATE_KINDS,
  PROFILE_MEDIA_SUPPORTED_LOCALES,
  PROFILE_MEDIA_SUPPORTED_THEMES,
  createProfileMediaStableKey
} from "../media-store-contract.js";
import { createR2BindingProfileMediaStore } from "./store.js";

const MAX_LIST_PAGE_SIZE = 1_000;

export function createR2BindingProfileMediaMaintenance(options = {}) {
  const bucket = requireMaintenanceBucket(options.bucket);
  const mediaStore = options.mediaStore ??
    createR2BindingProfileMediaStore({ bucket });
  const now = options.now ?? (() => new Date());
  const createTombstoneId = options.createTombstoneId ??
    (() => `maintenance_${globalThis.crypto.randomUUID().replaceAll("-", "")}`);
  const beforeDeleteRevision = options.beforeDeleteRevision;

  return Object.freeze({
    applyRetention,
    deleteOwnerRevisions,
    listOwnerManifest,
    planOwnerDeletion,
    planRetention,
    repairPublication,
    tombstoneOwnerPublication
  });

  async function listOwnerManifest(listOptions = {}) {
    const ownerId = requireKeySegment(listOptions.ownerId, "ownerId");
    const handle = requireHandle(listOptions.handle);
    const stable = await readStableState(handle);
    if (
      stable.kind === PROFILE_MEDIA_STABLE_STATE_KINDS.PUBLICATION &&
      stable.publication.ownerId !== ownerId
    ) {
      throw maintenanceError(
        "conflict",
        "stable publication belongs to another owner"
      );
    }
    const revisions = await listRevisionManifest({
      ownerId,
      prefix: `${PROFILE_MEDIA_REVISION_PREFIX}${ownerId}/revisions/`
    });
    const stableObjectKeys = await listOwnerStableObjectKeys(handle);
    return deepFreeze({
      ownerId,
      handle,
      revisions,
      stable: serializeStableState(stable),
      stableObjectKeys
    });
  }

  async function planOwnerDeletion(planOptions = {}) {
    const manifest = await listOwnerManifest(planOptions);
    const createdAt = normalizeIsoDate(planOptions.createdAt ?? now());
    const contentDigest = await createProfileMaintenanceDigest(manifest);
    return deepFreeze({
      manifest,
      summary: createProfileMaintenanceSummary({
        contentDigest,
        createdAt,
        objectCount: manifest.revisions.length + manifest.stableObjectKeys.length,
        operation: "delete-account",
        ownerCount: 1
      })
    });
  }

  async function tombstoneOwnerPublication(tombstoneOptions = {}) {
    const ownerId = requireKeySegment(tombstoneOptions.ownerId, "ownerId");
    const handle = requireHandle(tombstoneOptions.handle);
    const expectedStorageEtag = requireOptionalStorageEtag(
      tombstoneOptions.expectedStorageEtag
    );
    const stable = await readStableState(handle);
    if (stable.storageEtag !== expectedStorageEtag) {
      throw maintenanceError(
        "conflict",
        "stable publication changed before tombstone"
      );
    }
    if (stable.kind === PROFILE_MEDIA_STABLE_STATE_KINDS.MISSING) {
      return deepFreeze({ idempotent: true, stable: serializeStableState(stable) });
    }
    if (stable.kind === PROFILE_MEDIA_STABLE_STATE_KINDS.UNPUBLISHED) {
      const tombstoneOwnerId = await readTombstoneOwnerId(stable.stableKey);
      if (tombstoneOwnerId && tombstoneOwnerId !== ownerId) {
        throw maintenanceError("conflict", "tombstone belongs to another owner");
      }
      return deepFreeze({ idempotent: true, stable: serializeStableState(stable) });
    }
    if (stable.publication.ownerId !== ownerId) {
      throw maintenanceError(
        "conflict",
        "stable publication belongs to another owner"
      );
    }
    if (tombstoneOptions.apply !== true) {
      return deepFreeze({ idempotent: false, stable: serializeStableState(stable) });
    }

    const unpublished = await mediaStore.unpublishCard({
      expectedStorageEtag,
      handle,
      tombstoneId: requireKeySegment(
        tombstoneOptions.tombstoneId ?? createTombstoneId(),
        "tombstoneId"
      ),
      unpublishedAt: normalizeIsoDate(tombstoneOptions.unpublishedAt ?? now())
    });
    return deepFreeze({
      idempotent: false,
      previousPublication: sanitizePublication(unpublished),
      stable: serializeStableState(await readStableState(handle))
    });
  }

  async function deleteOwnerRevisions(deleteOptions = {}) {
    let plan = await planOwnerDeletion(deleteOptions);
    assertExpectedPlan(plan.summary, deleteOptions);
    if (plan.manifest.stable.kind === PROFILE_MEDIA_STABLE_STATE_KINDS.PUBLICATION) {
      throw maintenanceError(
        "conflict",
        "owner revisions cannot be deleted while a publication is stable"
      );
    }
    if (deleteOptions.apply !== true) return plan;

    const stableStorageEtag = plan.manifest.stable.storageEtag;
    for (const revision of plan.manifest.revisions) {
      await beforeDeleteRevision?.({ plan, revision });
      const stable = await readStableState(plan.manifest.handle);
      if (
        stable.kind === PROFILE_MEDIA_STABLE_STATE_KINDS.PUBLICATION ||
        stable.storageEtag !== stableStorageEtag
      ) {
        throw maintenanceError(
          "conflict",
          "stable publication changed during revision deletion"
        );
      }
      const current = await bucket.head(revision.key);
      if (!current) continue;
      const currentStorageEtag = storageEtag(current);
      if (
        revision.storageEtag &&
        currentStorageEtag !== revision.storageEtag
      ) {
        throw maintenanceError(
          "conflict",
          "immutable revision changed before deletion"
        );
      }
      await bucket.delete(revision.key);
      if (await bucket.head(revision.key)) {
        throw maintenanceError(
          "unavailable",
          "immutable revision remained after deletion"
        );
      }
    }
    plan = await planOwnerDeletion(deleteOptions);
    return plan;
  }

  async function planRetention(planOptions = {}) {
    const revisions = await listRevisionManifest({
      prefix: PROFILE_MEDIA_REVISION_PREFIX
    });
    const stableSnapshot = await readStableReferences();
    const candidates = selectProfileMediaCleanupCandidates(revisions, {
      now: planOptions.now ?? now(),
      protectedKeys: new Set(stableSnapshot.revisionKeys),
      recentRevisions:
        planOptions.recentRevisions ??
        DEFAULT_PROFILE_MEDIA_RECENT_REVISIONS,
      retentionDays:
        planOptions.retentionDays ??
        DEFAULT_PROFILE_MEDIA_RETENTION_DAYS
    });
    const digestInput = {
      candidates: candidates.map((candidate) => ({
        key: candidate.key,
        storageEtag: candidate.storageEtag
      })),
      stableDigest: stableSnapshot.contentDigest
    };
    const contentDigest = await createProfileMaintenanceDigest(digestInput);
    return deepFreeze({
      candidates,
      stableDigest: stableSnapshot.contentDigest,
      summary: createProfileMaintenanceSummary({
        contentDigest,
        createdAt: normalizeIsoDate(planOptions.createdAt ?? now()),
        objectCount: candidates.length,
        operation: "retention",
        ownerCount: 0
      })
    });
  }

  async function applyRetention(applyOptions = {}) {
    let plan = await planRetention(applyOptions);
    assertExpectedPlan(plan.summary, applyOptions);
    if (applyOptions.apply !== true) return plan;

    for (const candidate of plan.candidates) {
      await beforeDeleteRevision?.({ plan, revision: candidate });
      const currentStable = await readStableReferences();
      if (!safeEqualText(currentStable.contentDigest, plan.stableDigest)) {
        throw maintenanceError(
          "conflict",
          "stable references changed during retention"
        );
      }
      const current = await bucket.head(candidate.key);
      if (!current) continue;
      if (
        candidate.storageEtag &&
        storageEtag(current) !== candidate.storageEtag
      ) {
        throw maintenanceError(
          "conflict",
          "retention candidate changed before deletion"
        );
      }
      await bucket.delete(candidate.key);
      if (await bucket.head(candidate.key)) {
        throw maintenanceError(
          "unavailable",
          "retention candidate remained after deletion"
        );
      }
    }
    plan = await planRetention(applyOptions);
    return plan;
  }

  async function repairPublication(repairOptions = {}) {
    const ownerId = requireKeySegment(repairOptions.ownerId, "ownerId");
    const handle = requireHandle(repairOptions.handle);
    const publication = repairOptions.publication;
    if (
      !publication ||
      publication.ownerId !== ownerId ||
      publication.handle !== handle
    ) {
      throw new TypeError("repair publication owner scope is invalid");
    }
    const expectedStorageEtag = requireOptionalStorageEtag(
      repairOptions.expectedStorageEtag
    );
    const stable = await readStableState(handle);
    if (stable.storageEtag !== expectedStorageEtag) {
      throw maintenanceError(
        "conflict",
        "stable publication changed before repair"
      );
    }
    if (repairOptions.apply !== true) {
      return deepFreeze({
        idempotent: false,
        stable: serializeStableState(stable)
      });
    }
    const repaired = await mediaStore.publishRevision({
      ...publication,
      expectedStorageEtag
    });
    return deepFreeze({
      idempotent: false,
      publication: sanitizePublication(repaired),
      stable: serializeStableState(await readStableState(handle))
    });
  }

  async function listRevisionManifest(listOptions = {}) {
    const objects = await listObjects(listOptions.prefix);
    const revisions = [];
    for (const object of objects) {
      const parsed = parseProfileMediaRevisionObject(object);
      if (!parsed) continue;
      if (listOptions.ownerId && parsed.ownerId !== listOptions.ownerId) continue;
      const head = await bucket.head(parsed.key);
      if (!head) continue;
      const metadata = normalizeMetadata(head.customMetadata);
      const contractVersion = Number(metadata["contract-version"] ?? 3);
      const theme = metadata.theme ?? "dark";
      if (
        ![
          PROFILE_MEDIA_LEGACY_CONTRACT_VERSION,
          PROFILE_MEDIA_STORE_CONTRACT_VERSION
        ].includes(contractVersion) ||
        metadata.kind !== "revision" ||
        metadata["owner-id"] !== parsed.ownerId ||
        metadata.locale !== parsed.locale ||
        metadata.revision !== parsed.revision ||
        theme !== parsed.theme ||
        (contractVersion === PROFILE_MEDIA_STORE_CONTRACT_VERSION &&
          !/^[A-Za-z0-9_-]{43}$/.test(metadata["presentation-digest"] ?? ""))
      ) {
        throw maintenanceError(
          "invalid",
          "revision metadata does not match its immutable key"
        );
      }
      revisions.push(Object.freeze({
        contractVersion,
        createdAt: normalizeIsoDate(metadata["created-at"]),
        etag: `"${metadata.etag}"`,
        key: parsed.key,
        lastModified: parsed.lastModified.toISOString(),
        locale: parsed.locale,
        ownerId: parsed.ownerId,
        presentationDigest: metadata["presentation-digest"] ?? null,
        revision: parsed.revision,
        size: Number(head.size ?? parsed.size ?? 0),
        storageEtag: storageEtag(head),
        theme: parsed.theme
      }));
    }
    return revisions.sort((left, right) => left.key.localeCompare(right.key));
  }

  async function readStableReferences() {
    const stableObjects = await listObjects(PROFILE_MEDIA_STABLE_PREFIX);
    const states = [];
    const revisionKeys = [];
    for (const object of stableObjects) {
      if (!isAuthorityStableKey(object.key)) continue;
      const handle = object.key.split("/").at(-2);
      const state = await readStableState(handle);
      const serialized = serializeStableState(state);
      states.push(serialized);
      if (serialized.kind === PROFILE_MEDIA_STABLE_STATE_KINDS.PUBLICATION) {
        const publication = serialized.publication;
        const themes = publication.contractVersion ===
          PROFILE_MEDIA_STORE_CONTRACT_VERSION
          ? PROFILE_MEDIA_SUPPORTED_THEMES
          : ["dark"];
        for (const theme of themes) {
          const representations = publication.contractVersion ===
            PROFILE_MEDIA_STORE_CONTRACT_VERSION
            ? publication.representations[theme]
            : publication.representations;
          for (const locale of PROFILE_MEDIA_SUPPORTED_LOCALES) {
            revisionKeys.push(representations[locale].revisionKey);
          }
        }
      }
    }
    states.sort((left, right) => left.stableKey.localeCompare(right.stableKey));
    revisionKeys.sort();
    return {
      contentDigest: await createProfileMaintenanceDigest({
        revisionKeys,
        states
      }),
      revisionKeys,
      states
    };
  }

  async function listObjects(prefix) {
    const objects = [];
    let cursor;
    do {
      const response = await bucket.list({
        cursor,
        limit: MAX_LIST_PAGE_SIZE,
        prefix
      });
      for (const object of response.objects ?? []) {
        if (typeof object?.key === "string") objects.push(object);
      }
      if (!response.truncated) break;
      cursor = response.cursor;
      if (typeof cursor !== "string" || cursor === "") {
        throw maintenanceError(
          "invalid",
          "paginated R2 listing omitted a cursor"
        );
      }
    } while (cursor);
    return objects;
  }

  async function listOwnerStableObjectKeys(handle) {
    const objects = await listObjects(`${PROFILE_MEDIA_STABLE_PREFIX}${handle}/`);
    const keys = [];
    for (const object of objects) {
      if (!isProfileMediaStableKey(object.key)) continue;
      if (await bucket.head(object.key)) keys.push(object.key);
    }
    return keys.sort();
  }

  function readStableState(handle) {
    return mediaStore.inspectStableCard({ handle });
  }

  async function readTombstoneOwnerId(stableKey) {
    const object = await bucket.head(stableKey);
    const metadata = normalizeMetadata(object?.customMetadata);
    return metadata["owner-id"] ?? null;
  }
}

function serializeStableState(state) {
  if (state.kind === PROFILE_MEDIA_STABLE_STATE_KINDS.PUBLICATION) {
    return {
      kind: state.kind,
      publication: sanitizePublication(state.publication),
      stableKey: state.stableKey,
      storageEtag: state.storageEtag
    };
  }
  if (state.kind === PROFILE_MEDIA_STABLE_STATE_KINDS.UNPUBLISHED) {
    return {
      kind: state.kind,
      stableKey: state.stableKey,
      storageEtag: state.storageEtag,
      tombstoneId: state.tombstoneId,
      unpublishedAt: state.unpublishedAt
    };
  }
  return {
    kind: PROFILE_MEDIA_STABLE_STATE_KINDS.MISSING,
    stableKey: state.stableKey,
    storageEtag: null
  };
}

function sanitizePublication(value) {
  if (!value) return null;
  const isV4 = value.contractVersion === PROFILE_MEDIA_STORE_CONTRACT_VERSION;
  const representations = isV4
    ? Object.fromEntries(PROFILE_MEDIA_SUPPORTED_THEMES.map((theme) => [
      theme,
      sanitizeRepresentations(value.representations[theme], theme)
    ]))
    : sanitizeRepresentations(value.representations, "dark");
  return {
    contractVersion: value.contractVersion,
    format: value.format,
    handle: value.handle,
    ownerId: value.ownerId,
    presentationDigest: value.presentationDigest,
    publicationId: value.publicationId,
    publishedAt: value.publishedAt,
    representations,
    stableKey: value.stableKey,
    stableKeys: value.stableKeys,
    storageEtag: value.storageEtag
  };
}

function sanitizeRepresentations(value, theme) {
  return Object.fromEntries(PROFILE_MEDIA_SUPPORTED_LOCALES.map((locale) => {
    const representation = value[locale];
    return [locale, {
      etag: representation.etag,
      format: representation.format,
      locale,
      presentationDigest: representation.presentationDigest,
      revision: representation.revision,
      revisionKey: representation.revisionKey,
      theme
    }];
  }));
}

function isAuthorityStableKey(key) {
  return /^cards\/v2\/public\/[a-z0-9]+(?:-[a-z0-9]+)*\/card\.png$/.test(key);
}

function assertExpectedPlan(summary, options) {
  const expectedDigest = requireDigest(options.expectedContentDigest);
  const expectedCount = requireNonNegativeInteger(
    options.expectedObjectCount,
    "expectedObjectCount"
  );
  if (
    !safeEqualText(summary.contentDigest, expectedDigest) ||
    summary.objectCount !== expectedCount
  ) {
    throw maintenanceError(
      "conflict",
      "media plan no longer matches expected digest and count"
    );
  }
}

function normalizeMetadata(value) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key.toLowerCase(),
      String(item)
    ])
  );
}

function storageEtag(object) {
  const value = object?.etag ?? object?.httpEtag;
  if (typeof value !== "string" || value === "") {
    throw maintenanceError("invalid", "R2 object is missing a storage ETag");
  }
  return value.replace(/^"|"$/gu, "");
}

function requireMaintenanceBucket(bucket) {
  for (const method of ["delete", "head", "list"]) {
    if (typeof bucket?.[method] !== "function") {
      throw new TypeError(`R2 maintenance bucket with ${method} is required`);
    }
  }
  return bucket;
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
  const stableKey = createProfileMediaStableKey({ handle: value });
  const handle = stableKey.split("/").at(-2);
  if (value !== handle) {
    throw new TypeError("handle must be canonical");
  }
  return handle;
}

function requireDigest(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new TypeError("expectedContentDigest must be a SHA-256 digest");
  }
  return value;
}

function requireOptionalStorageEtag(value) {
  if (value === null) return null;
  if (typeof value !== "string" || value === "") {
    throw new TypeError("expectedStorageEtag must be a string or null");
  }
  return value.replace(/^"|"$/gu, "");
}

function requireNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative integer`);
  }
  return value;
}

function normalizeIsoDate(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("media maintenance timestamp is invalid");
  }
  return date.toISOString();
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
