export const PROFILE_MEDIA_STORE_CONTRACT_VERSION = 1;
export const PROFILE_MEDIA_CONTENT_TYPE = "image/png";
export const PROFILE_MEDIA_CACHE_CONTROL = "public, no-cache, must-revalidate";

export const PROFILE_MEDIA_STORE_METHODS = Object.freeze([
  "getPublishedCard",
  "getRevision",
  "publishRevision",
  "putRevision",
  "unpublishCard"
]);

export function createProfileMediaObjectKeys(options = {}) {
  const ownerId = requireKeySegment(options.ownerId, "ownerId");
  const revision = requireKeySegment(options.revision, "revision");
  const ownerPrefix = `cards/v1/owners/${ownerId}`;

  return {
    revisionKey: `${ownerPrefix}/revisions/${revision}.png`,
    stableKey: `${ownerPrefix}/card.png`
  };
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
  const publishedByOwnerId = new Map();

  return {
    async getPublishedCard(options = {}) {
      return cloneMediaRecord(publishedByOwnerId.get(
        requireKeySegment(options.ownerId, "ownerId")
      )) ?? null;
    },

    async getRevision(options = {}) {
      const keys = createProfileMediaObjectKeys(options);
      return cloneMediaRecord(revisions.get(keys.revisionKey)) ?? null;
    },

    async putRevision(options = {}) {
      const record = normalizeRevisionRecord(options);
      const previous = revisions.get(record.revisionKey);

      if (previous) {
        if (!sameImmutableRevision(previous, record)) {
          throw mediaStoreError(
            "conflict",
            "immutable media revision already exists with different content"
          );
        }
        return { idempotent: true, record: cloneMediaRecord(previous) };
      }

      revisions.set(record.revisionKey, cloneMediaRecord(record));
      return { idempotent: false, record: cloneMediaRecord(record) };
    },

    async publishRevision(options = {}) {
      const keys = createProfileMediaObjectKeys(options);
      const revision = revisions.get(keys.revisionKey);
      if (!revision) {
        throw mediaStoreError("not_found", "media revision not found");
      }

      const published = {
        ...cloneMediaRecord(revision),
        stableKey: keys.stableKey,
        publishedAt: normalizeIsoDate(options.publishedAt)
      };
      publishedByOwnerId.set(revision.ownerId, cloneMediaRecord(published));
      return cloneMediaRecord(published);
    },

    async unpublishCard(options = {}) {
      const ownerId = requireKeySegment(options.ownerId, "ownerId");
      const previous = publishedByOwnerId.get(ownerId) ?? null;
      publishedByOwnerId.delete(ownerId);
      return cloneMediaRecord(previous);
    }
  };
}

function normalizeRevisionRecord(options) {
  const keys = createProfileMediaObjectKeys(options);
  const body = normalizeBody(options.body);

  return {
    body,
    cacheControl: requireNonEmptyString(
      options.cacheControl ?? PROFILE_MEDIA_CACHE_CONTROL,
      "cacheControl"
    ),
    contentType: requireContentType(options.contentType),
    createdAt: normalizeIsoDate(options.createdAt),
    etag: requireNonEmptyString(options.etag, "etag"),
    ownerId: requireKeySegment(options.ownerId, "ownerId"),
    revision: requireKeySegment(options.revision, "revision"),
    revisionKey: keys.revisionKey
  };
}

function sameImmutableRevision(left, right) {
  return left.etag === right.etag &&
    left.contentType === right.contentType &&
    left.cacheControl === right.cacheControl &&
    Buffer.from(left.body).equals(Buffer.from(right.body));
}

function cloneMediaRecord(value) {
  if (!value) return value;
  return {
    ...value,
    body: value.body ? Buffer.from(value.body) : value.body
  };
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

function requireKeySegment(value, label) {
  const segment = requireNonEmptyString(value, label);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(segment)) {
    throw new TypeError(`${label} must be a safe object-key segment`);
  }
  return segment;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} is required`);
  }
  return value.trim();
}

function mediaStoreError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
