import { createHash } from "node:crypto";

export const PROFILE_MEDIA_STORE_CONTRACT_VERSION = 3;
export const PROFILE_MEDIA_CONTENT_TYPE = "image/png";
export const PROFILE_MEDIA_CACHE_CONTROL = "public, no-cache, must-revalidate";
export const PROFILE_MEDIA_DEFAULT_LOCALE = "en";
export const PROFILE_MEDIA_SUPPORTED_LOCALES = Object.freeze(["en", "ko"]);
export const PROFILE_MEDIA_STORE_ERROR_CODES = Object.freeze({
  CONFLICT: "conflict",
  INVALID: "invalid",
  NOT_FOUND: "not_found",
  UNAVAILABLE: "unavailable"
});
export const PROFILE_MEDIA_STABLE_STATE_KINDS = Object.freeze({
  MISSING: "missing",
  PUBLICATION: "publication",
  UNPUBLISHED: "unpublished"
});

const PROFILE_MEDIA_REVISION_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const PROFILE_MEDIA_HANDLE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const PROFILE_MEDIA_STORE_METHODS = Object.freeze([
  "getPublishedCard",
  "getRevision",
  "inspectStableCard",
  "publishRevision",
  "putRevision",
  "unpublishCard"
]);

export function createProfileMediaRevisionKey(options = {}) {
  const ownerId = requireKeySegment(options.ownerId, "ownerId");
  const locale = normalizeProfileMediaLocale(options.locale, { fallback: false });
  const revision = requireRevision(options.revision);
  return `cards/v2/owners/${ownerId}/revisions/${locale}/${revision}.png`;
}

export function createProfileMediaStableKey(options = {}) {
  const handle = requireProfileMediaHandle(options.handle);
  return `cards/v2/public/${handle}/card.png`;
}

export function createProfileMediaObjectKeys(options = {}) {
  return {
    revisionKey: createProfileMediaRevisionKey(options),
    stableKey: createProfileMediaStableKey(options)
  };
}

export function normalizeProfileMediaLocale(value, options = {}) {
  const fallback = options.fallback !== false;
  if (typeof value !== "string" || value.trim() === "") {
    if (fallback) return PROFILE_MEDIA_DEFAULT_LOCALE;
    throw new TypeError("locale is required");
  }

  const locale = value.trim().toLowerCase();
  if (locale === "ko" || locale.startsWith("ko-")) return "ko";
  if (locale === "en" || locale.startsWith("en-")) return "en";
  if (fallback) return PROFILE_MEDIA_DEFAULT_LOCALE;
  throw new TypeError("locale must be en or ko");
}

export function normalizeProfileMediaRevisionRecord(options = {}) {
  const ownerId = requireKeySegment(options.ownerId, "ownerId");
  const locale = normalizeProfileMediaLocale(options.locale, { fallback: false });
  const revision = requireRevision(options.revision);
  const etag = requireApplicationEtag(options.etag, revision);

  return {
    body: normalizeBody(options.body),
    cacheControl: requireNonEmptyString(
      options.cacheControl ?? PROFILE_MEDIA_CACHE_CONTROL,
      "cacheControl"
    ),
    contentType: requireContentType(options.contentType),
    createdAt: normalizeIsoDate(options.createdAt),
    etag,
    locale,
    ownerId,
    revision,
    revisionKey: createProfileMediaRevisionKey({ ownerId, locale, revision })
  };
}

export function createProfileMediaRevisionDigest(body) {
  return createHash("sha256").update(normalizeBody(body)).digest("base64url");
}

export function normalizeProfileMediaPublicationInput(options = {}) {
  const ownerId = requireKeySegment(options.ownerId, "ownerId");
  const handle = requireProfileMediaHandle(options.handle);
  const publicationId = requireKeySegment(options.publicationId, "publicationId");
  const representations = Object.fromEntries(
    PROFILE_MEDIA_SUPPORTED_LOCALES.map((locale) => {
      const representation = options.representations?.[locale];
      if (!representation || typeof representation !== "object") {
        throw new TypeError(`representations.${locale} is required`);
      }

      const revision = requireRevision(representation.revision);
      const etag = requireApplicationEtag(representation.etag, revision);
      const revisionKey = createProfileMediaRevisionKey({ ownerId, locale, revision });
      if (
        representation.revisionKey !== undefined &&
        representation.revisionKey !== revisionKey
      ) {
        throw new TypeError(`representations.${locale}.revisionKey does not match revision`);
      }

      return [locale, { etag, locale, revision, revisionKey }];
    })
  );

  return {
    handle,
    ownerId,
    publicationId,
    publishedAt: normalizeIsoDate(options.publishedAt),
    representations,
    stableKey: createProfileMediaStableKey({ handle })
  };
}

export function matchesProfileMediaIfNoneMatch(value, etag) {
  if (typeof value !== "string") return false;
  return value.split(",").some((candidate) => {
    const normalized = candidate.trim();
    return normalized === "*" || normalized === etag;
  });
}

export function assertProfileMediaStoreContract(store) {
  if (!store || (typeof store !== "object" && typeof store !== "function")) {
    throw new TypeError("profile media store must be an object");
  }

  const missingMethods = PROFILE_MEDIA_STORE_METHODS.filter(
    (method) => typeof store[method] !== "function"
  );
  if (missingMethods.length > 0) {
    throw new TypeError(
      `profile media store is missing methods: ${missingMethods.join(", ")}`
    );
  }

  return store;
}

export function createMemoryProfileMediaStore() {
  const revisions = new Map();
  const stableByHandle = new Map();
  let nextStorageRevision = 1;

  return {
    async getPublishedCard(options = {}) {
      const handle = requireProfileMediaHandle(options.handle);
      const stable = stableByHandle.get(handle);
      if (!stable || stable.kind !== PROFILE_MEDIA_STABLE_STATE_KINDS.PUBLICATION) {
        return null;
      }
      return selectPublishedRepresentation(stable.publication, options);
    },

    async getRevision(options = {}) {
      const revisionKey = createProfileMediaRevisionKey(options);
      return cloneRevisionRecord(revisions.get(revisionKey)) ?? null;
    },

    async putRevision(options = {}) {
      const record = normalizeProfileMediaRevisionRecord(options);
      assertRevisionMatchesBody(record);
      const previous = revisions.get(record.revisionKey);

      if (previous) {
        if (!sameImmutableRevision(previous, record)) {
          throw createProfileMediaStoreError(
            "conflict",
            "immutable media revision already exists with different content"
          );
        }
        return { idempotent: true, record: cloneRevisionRecord(previous) };
      }

      revisions.set(record.revisionKey, cloneRevisionRecord(record));
      return { idempotent: false, record: cloneRevisionRecord(record) };
    },

    async inspectStableCard(options = {}) {
      const handle = requireProfileMediaHandle(options.handle);
      const stableKey = createProfileMediaStableKey({ handle });
      const stable = stableByHandle.get(handle);
      if (!stable) {
        return {
          handle,
          kind: PROFILE_MEDIA_STABLE_STATE_KINDS.MISSING,
          stableKey,
          storageEtag: null
        };
      }
      if (stable.kind === PROFILE_MEDIA_STABLE_STATE_KINDS.UNPUBLISHED) {
        return { ...stable };
      }
      return {
        handle,
        kind: PROFILE_MEDIA_STABLE_STATE_KINDS.PUBLICATION,
        publication: selectPublishedRepresentation(stable.publication, {
          includeBody: options.includeBody === true,
          locale: PROFILE_MEDIA_DEFAULT_LOCALE
        }),
        stableKey,
        storageEtag: stable.storageEtag
      };
    },

    async publishRevision(options = {}) {
      const publicationInput = normalizeProfileMediaPublicationInput(options);
      const previous = stableByHandle.get(publicationInput.handle);
      assertExpectedStorageEtag(previous, options);
      if (
        previous?.kind === PROFILE_MEDIA_STABLE_STATE_KINDS.PUBLICATION &&
        previous.publication.ownerId !== publicationInput.ownerId
      ) {
        throw createProfileMediaStoreError(
          "conflict",
          "stable media handle is already published by another owner"
        );
      }

      const representationRecords = {};
      for (const locale of PROFILE_MEDIA_SUPPORTED_LOCALES) {
        const expected = publicationInput.representations[locale];
        const revision = revisions.get(expected.revisionKey);
        if (!revision) {
          throw createProfileMediaStoreError("not_found", "media revision not found");
        }
        if (revision.etag !== expected.etag) {
          throw createProfileMediaStoreError(
            "conflict",
            "media revision ETag does not match publication metadata"
          );
        }
        representationRecords[locale] = cloneRevisionRecord(revision);
      }

      const storageEtag = createMemoryStorageEtag(nextStorageRevision++);
      const published = {
        ...createPublishedRecord(publicationInput, representationRecords),
        storageEtag
      };
      stableByHandle.set(publicationInput.handle, {
        kind: PROFILE_MEDIA_STABLE_STATE_KINDS.PUBLICATION,
        publication: clonePublishedRecord(published, {
          includeRepresentationBodies: true
        }),
        storageEtag
      });
      return selectPublishedRepresentation(published, {
        locale: PROFILE_MEDIA_DEFAULT_LOCALE
      });
    },

    async unpublishCard(options = {}) {
      const handle = requireProfileMediaHandle(options.handle);
      const previous = stableByHandle.get(handle) ?? null;
      assertExpectedStorageEtag(previous, options);
      if (
        !previous ||
        previous.kind === PROFILE_MEDIA_STABLE_STATE_KINDS.UNPUBLISHED
      ) {
        return null;
      }

      const storageEtag = createMemoryStorageEtag(nextStorageRevision++);
      stableByHandle.set(handle, {
        handle,
        kind: PROFILE_MEDIA_STABLE_STATE_KINDS.UNPUBLISHED,
        stableKey: createProfileMediaStableKey({ handle }),
        storageEtag,
        tombstoneId: requireOptionalKeySegment(
          options.tombstoneId,
          `tombstone_memory_${nextStorageRevision - 1}`
        ),
        unpublishedAt: normalizeIsoDate(options.unpublishedAt)
      });
      return {
        ...selectPublishedRepresentation(previous.publication, {
          locale: PROFILE_MEDIA_DEFAULT_LOCALE
        }),
        unpublishedStorageEtag: storageEtag
      };
    }
  };
}

export function createProfileMediaStoreError(code, message, options = {}) {
  const error = new Error(message);
  error.name = "ProfileMediaStoreError";
  error.code = code;
  if (options.cause !== undefined) error.cause = options.cause;
  return error;
}

function createPublishedRecord(publicationInput, representationRecords) {
  const defaultRevision = representationRecords[PROFILE_MEDIA_DEFAULT_LOCALE];
  return {
    body: Buffer.from(defaultRevision.body),
    cacheControl: PROFILE_MEDIA_CACHE_CONTROL,
    contentType: PROFILE_MEDIA_CONTENT_TYPE,
    etag: defaultRevision.etag,
    handle: publicationInput.handle,
    locale: PROFILE_MEDIA_DEFAULT_LOCALE,
    notModified: false,
    ownerId: publicationInput.ownerId,
    publicationId: publicationInput.publicationId,
    publishedAt: publicationInput.publishedAt,
    representationBodies: Object.fromEntries(
      PROFILE_MEDIA_SUPPORTED_LOCALES.map((locale) => [
        locale,
        Buffer.from(representationRecords[locale].body)
      ])
    ),
    representations: Object.fromEntries(
      PROFILE_MEDIA_SUPPORTED_LOCALES.map((locale) => {
        const revision = representationRecords[locale];
        return [locale, {
          etag: revision.etag,
          locale,
          revision: revision.revision,
          revisionKey: revision.revisionKey
        }];
      })
    ),
    revision: defaultRevision.revision,
    revisionKey: defaultRevision.revisionKey,
    stableKey: publicationInput.stableKey
  };
}

function selectPublishedRepresentation(publication, options) {
  const locale = normalizeProfileMediaLocale(options.locale);
  const representation = publication.representations[locale];
  const notModified = matchesProfileMediaIfNoneMatch(
    options.ifNoneMatch,
    representation.etag
  );
  const includeBody = options.includeBody !== false && !notModified;
  const body = includeBody
    ? locale === PROFILE_MEDIA_DEFAULT_LOCALE
      ? publication.body
      : publication.representationBodies[locale]
    : null;

  return {
    ...clonePublishedRecord(publication),
    body: body ? Buffer.from(body) : null,
    etag: representation.etag,
    locale,
    notModified,
    revision: representation.revision,
    revisionKey: representation.revisionKey
  };
}

function cloneRevisionRecord(value) {
  if (!value) return value;
  return {
    ...value,
    body: value.body ? Buffer.from(value.body) : value.body
  };
}

function clonePublishedRecord(value, options = {}) {
  if (!value) return value;
  const cloned = {
    ...value,
    body: value.body ? Buffer.from(value.body) : value.body,
    representations: value.representations
      ? Object.fromEntries(Object.entries(value.representations).map(
        ([locale, representation]) => [locale, { ...representation }]
      ))
      : value.representations
  };
  if (options.includeRepresentationBodies === true && value.representationBodies) {
    cloned.representationBodies = Object.fromEntries(
      Object.entries(value.representationBodies).map(
        ([locale, body]) => [locale, Buffer.from(body)]
      )
    );
  }
  return cloned;
}

function assertExpectedStorageEtag(stable, options) {
  if (!Object.hasOwn(options, "expectedStorageEtag")) return;
  const expected = options.expectedStorageEtag;
  if (expected !== null && (typeof expected !== "string" || expected === "")) {
    throw new TypeError("expectedStorageEtag must be a non-empty string or null");
  }
  const actual = stable?.storageEtag ?? null;
  if (actual !== expected) {
    throw createProfileMediaStoreError(
      PROFILE_MEDIA_STORE_ERROR_CODES.CONFLICT,
      "stable media storage revision changed"
    );
  }
}

function createMemoryStorageEtag(revision) {
  return `"memory-${revision}"`;
}

function sameImmutableRevision(left, right) {
  return left.etag === right.etag &&
    left.locale === right.locale &&
    left.contentType === right.contentType &&
    left.cacheControl === right.cacheControl &&
    Buffer.from(left.body).equals(Buffer.from(right.body));
}

function assertRevisionMatchesBody(record) {
  if (createProfileMediaRevisionDigest(record.body) !== record.revision) {
    throw createProfileMediaStoreError(
      "conflict",
      "media revision does not match body digest"
    );
  }
}

function normalizeBody(value) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
    throw new TypeError("body must be a Buffer or Uint8Array");
  }
  if (value.byteLength === 0) {
    throw new TypeError("body must not be empty");
  }
  return Buffer.from(value);
}

function requireContentType(value = PROFILE_MEDIA_CONTENT_TYPE) {
  if (value !== PROFILE_MEDIA_CONTENT_TYPE) {
    throw new TypeError(`contentType must be ${PROFILE_MEDIA_CONTENT_TYPE}`);
  }
  return value;
}

function normalizeIsoDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("expected a valid media timestamp");
  }
  return date.toISOString();
}

function requireApplicationEtag(value, revision) {
  const etag = requireNonEmptyString(value, "etag");
  if (etag !== `"${revision}"`) {
    throw new TypeError("etag must be the quoted revision digest");
  }
  return etag;
}

function requireRevision(value) {
  const revision = requireNonEmptyString(value, "revision");
  if (!PROFILE_MEDIA_REVISION_PATTERN.test(revision)) {
    throw new TypeError("revision must be a 43-character base64url digest");
  }
  return revision;
}

function requireProfileMediaHandle(value) {
  const handle = requireNonEmptyString(value, "handle").toLowerCase();
  if (handle.length > 200 || !PROFILE_MEDIA_HANDLE_PATTERN.test(handle)) {
    throw new TypeError("handle must be a canonical public handle");
  }
  return handle;
}

function requireKeySegment(value, label) {
  const segment = requireNonEmptyString(value, label);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(segment)) {
    throw new TypeError(`${label} must be a safe object-key segment`);
  }
  return segment;
}

function requireOptionalKeySegment(value, fallback) {
  return requireKeySegment(value ?? fallback, "tombstoneId");
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} is required`);
  }
  return value.trim();
}
