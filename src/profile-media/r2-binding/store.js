import {
  PROFILE_MEDIA_CACHE_CONTROL,
  PROFILE_MEDIA_CONTENT_TYPE,
  PROFILE_MEDIA_DEFAULT_LOCALE,
  PROFILE_MEDIA_STABLE_STATE_KINDS,
  PROFILE_MEDIA_STORE_ERROR_CODES,
  PROFILE_MEDIA_SUPPORTED_LOCALES,
  createProfileMediaRevisionDigest,
  createProfileMediaRevisionKey,
  createProfileMediaStableKey,
  createProfileMediaStoreError,
  matchesProfileMediaIfNoneMatch,
  normalizeProfileMediaLocale,
  normalizeProfileMediaPublicationInput,
  normalizeProfileMediaRevisionRecord
} from "../media-store-contract.js";

const TOMBSTONE_CONTENT_TYPE = "application/octet-stream";
const TOMBSTONE_CACHE_CONTROL = "no-store";
const METADATA_KIND = "kind";
const METADATA_OWNER_ID = "owner-id";
const METADATA_HANDLE = "handle";
const METADATA_LOCALE = "locale";
const METADATA_REVISION = "revision";
const METADATA_ETAG = "etag";
const METADATA_CREATED_AT = "created-at";
const METADATA_PUBLICATION_ID = "publication-id";
const METADATA_PUBLISHED_AT = "published-at";
const METADATA_TOMBSTONE_ID = "tombstone-id";
const METADATA_UNPUBLISHED_AT = "unpublished-at";

export function createR2BindingProfileMediaStore(options = {}) {
  const bucket = requireR2Bucket(options.bucket);
  const now = options.now ?? (() => new Date());
  const createTombstoneId = options.createTombstoneId ??
    defaultCreateTombstoneId;

  const store = {
    async getPublishedCard(getOptions = {}) {
      return readPublishedCard({
        handle: normalizeHandle(getOptions.handle),
        ifNoneMatch: getOptions.ifNoneMatch,
        includeBody: getOptions.includeBody,
        locale: normalizeProfileMediaLocale(getOptions.locale)
      });
    },

    async getRevision(getOptions = {}) {
      const revisionKey = createProfileMediaRevisionKey(getOptions);
      let object;
      try {
        object = await bucket.get(revisionKey);
      } catch (error) {
        throw unavailable("read media revision", error);
      }
      if (!object) return null;
      const body = await readR2Body(object, "media revision");
      return revisionRecordFromObject(object, {
        body,
        locale: getOptions.locale,
        ownerId: getOptions.ownerId,
        revision: getOptions.revision,
        revisionKey
      });
    },

    async inspectStableCard(inspectOptions = {}) {
      const handle = normalizeHandle(inspectOptions.handle);
      const stableKey = createProfileMediaStableKey({ handle });
      let object;
      try {
        object = await bucket.head(stableKey);
      } catch (error) {
        throw unavailable("inspect stable media", error);
      }
      if (!object) {
        return {
          handle,
          kind: PROFILE_MEDIA_STABLE_STATE_KINDS.MISSING,
          stableKey,
          storageEtag: null
        };
      }
      return stableStateFromObject(object, { handle, stableKey });
    },

    async putRevision(putOptions = {}) {
      const record = normalizeProfileMediaRevisionRecord(putOptions);
      if (createProfileMediaRevisionDigest(record.body) !== record.revision) {
        throw createProfileMediaStoreError(
          PROFILE_MEDIA_STORE_ERROR_CODES.CONFLICT,
          "media revision does not match body digest"
        );
      }

      let created;
      try {
        created = await bucket.put(record.revisionKey, record.body, {
          customMetadata: revisionMetadata(record),
          httpMetadata: mediaHttpMetadata(),
          onlyIf: { etagDoesNotMatch: "*" }
        });
      } catch (error) {
        throw unavailable("write media revision", error);
      }
      if (created) {
        return {
          idempotent: false,
          record: {
            ...cloneRevisionRecord(record),
            storageEtag: requireStorageEtag(created)
          }
        };
      }

      const previous = await store.getRevision(record);
      if (previous && sameImmutableRevision(previous, record)) {
        return { idempotent: true, record: previous };
      }
      throw createProfileMediaStoreError(
        PROFILE_MEDIA_STORE_ERROR_CODES.CONFLICT,
        "immutable media revision already exists with different content"
      );
    },

    async publishRevision(publishOptions = {}) {
      const publication = normalizeProfileMediaPublicationInput(publishOptions);
      const current = await store.inspectStableCard({
        handle: publication.handle
      });
      assertExpectedStorageEtag(current, publishOptions);
      if (
        current.kind === PROFILE_MEDIA_STABLE_STATE_KINDS.PUBLICATION &&
        current.publication.ownerId !== publication.ownerId
      ) {
        throw createProfileMediaStoreError(
          PROFILE_MEDIA_STORE_ERROR_CODES.CONFLICT,
          "stable media handle is already published by another owner"
        );
      }

      const revisions = {};
      for (const locale of PROFILE_MEDIA_SUPPORTED_LOCALES) {
        const expected = publication.representations[locale];
        const revision = await store.getRevision({
          locale,
          ownerId: publication.ownerId,
          revision: expected.revision
        });
        if (!revision) {
          throw createProfileMediaStoreError(
            PROFILE_MEDIA_STORE_ERROR_CODES.NOT_FOUND,
            "media revision not found"
          );
        }
        if (revision.etag !== expected.etag) {
          throw createProfileMediaStoreError(
            PROFILE_MEDIA_STORE_ERROR_CODES.CONFLICT,
            "media revision ETag does not match publication metadata"
          );
        }
        revisions[locale] = revision;
      }

      let created;
      try {
        created = await bucket.put(
          publication.stableKey,
          revisions[PROFILE_MEDIA_DEFAULT_LOCALE].body,
          {
            customMetadata: publicationMetadata(publication),
            httpMetadata: mediaHttpMetadata(),
            onlyIf: stableOnlyIf(current)
          }
        );
      } catch (error) {
        throw unavailable("publish stable media", error);
      }
      if (!created) throw stableConflict();

      return createSelectedPublicationRecord({
        ...publication,
        storageEtag: requireStorageEtag(created)
      }, {
        body: revisions[PROFILE_MEDIA_DEFAULT_LOCALE].body,
        locale: PROFILE_MEDIA_DEFAULT_LOCALE,
        notModified: false
      });
    },

    async unpublishCard(unpublishOptions = {}) {
      const handle = normalizeHandle(unpublishOptions.handle);
      const current = await store.inspectStableCard({ handle });
      assertExpectedStorageEtag(current, unpublishOptions);
      if (current.kind !== PROFILE_MEDIA_STABLE_STATE_KINDS.PUBLICATION) {
        return null;
      }

      const tombstoneId = requireKeySegment(
        unpublishOptions.tombstoneId ?? createTombstoneId(),
        "tombstoneId"
      );
      const unpublishedAt = normalizeIsoDate(
        unpublishOptions.unpublishedAt ?? now()
      );
      let tombstone;
      try {
        tombstone = await bucket.put(current.stableKey, new Uint8Array(), {
          customMetadata: {
            [METADATA_KIND]: PROFILE_MEDIA_STABLE_STATE_KINDS.UNPUBLISHED,
            [METADATA_HANDLE]: handle,
            [METADATA_OWNER_ID]: current.publication.ownerId,
            [METADATA_TOMBSTONE_ID]: tombstoneId,
            [METADATA_UNPUBLISHED_AT]: unpublishedAt
          },
          httpMetadata: {
            cacheControl: TOMBSTONE_CACHE_CONTROL,
            contentType: TOMBSTONE_CONTENT_TYPE
          },
          onlyIf: { etagMatches: current.storageEtag }
        });
      } catch (error) {
        throw unavailable("unpublish stable media", error);
      }
      if (!tombstone) throw stableConflict();

      return {
        ...current.publication,
        unpublishedStorageEtag: requireStorageEtag(tombstone)
      };
    },

    async verifyReadiness() {
      try {
        await bucket.head("cards/v2/.readiness");
      } catch (error) {
        throw unavailable("verify media bucket", error);
      }
      return { ready: true };
    },

    async close() {}
  };

  return store;

  async function readPublishedCard(getOptions, stableReadAttempt = 0) {
    const stable = await store.inspectStableCard({ handle: getOptions.handle });
    if (stable.kind !== PROFILE_MEDIA_STABLE_STATE_KINDS.PUBLICATION) return null;

    const publication = stable.publication;
    const representation = publication.representations[getOptions.locale];
    const notModified = matchesProfileMediaIfNoneMatch(
      getOptions.ifNoneMatch,
      representation.etag
    );
    const includeBody = getOptions.includeBody !== false && !notModified;
    let body = null;

    if (getOptions.locale !== PROFILE_MEDIA_DEFAULT_LOCALE) {
      const revision = await store.getRevision({
        locale: getOptions.locale,
        ownerId: publication.ownerId,
        revision: representation.revision
      });
      if (!revision) {
        throw createProfileMediaStoreError(
          PROFILE_MEDIA_STORE_ERROR_CODES.NOT_FOUND,
          "media revision not found"
        );
      }
      if (revision.etag !== representation.etag) {
        throw createProfileMediaStoreError(
          PROFILE_MEDIA_STORE_ERROR_CODES.CONFLICT,
          "media revision ETag does not match publication metadata"
        );
      }
      if (includeBody) body = revision.body;
    } else if (includeBody) {
      let object;
      try {
        object = await bucket.get(publication.stableKey, {
          onlyIf: { etagMatches: publication.storageEtag }
        });
      } catch (error) {
        throw unavailable("read published media", error);
      }
      if (!object) {
        throw createProfileMediaStoreError(
          PROFILE_MEDIA_STORE_ERROR_CODES.NOT_FOUND,
          "profile media object not found"
        );
      }
      if (!hasR2Body(object)) {
        if (stableReadAttempt === 0) {
          return readPublishedCard(getOptions, stableReadAttempt + 1);
        }
        throw createProfileMediaStoreError(
          PROFILE_MEDIA_STORE_ERROR_CODES.UNAVAILABLE,
          "stable media changed repeatedly during read"
        );
      }
      const coherent = publicationFromObject(object, {
        handle: publication.handle,
        stableKey: publication.stableKey
      });
      if (coherent.publicationId !== publication.publicationId) {
        throw createProfileMediaStoreError(
          PROFILE_MEDIA_STORE_ERROR_CODES.UNAVAILABLE,
          "stable media changed repeatedly during read"
        );
      }
      body = await readR2Body(object, "published media");
      if (createProfileMediaRevisionDigest(body) !== representation.revision) {
        throw createProfileMediaStoreError(
          PROFILE_MEDIA_STORE_ERROR_CODES.INVALID,
          "published media body does not match its application ETag"
        );
      }
    }

    return createSelectedPublicationRecord(publication, {
      body,
      locale: getOptions.locale,
      notModified
    });
  }
}

function stableStateFromObject(object, expected) {
  const metadata = normalizeMetadata(object.customMetadata);
  if (metadata[METADATA_KIND] === PROFILE_MEDIA_STABLE_STATE_KINDS.UNPUBLISHED) {
    try {
      assertHttpMetadata(object, {
        cacheControl: TOMBSTONE_CACHE_CONTROL,
        contentType: TOMBSTONE_CONTENT_TYPE
      });
      const handle = requireMetadata(metadata, METADATA_HANDLE);
      if (handle !== expected.handle) throw malformedMetadataError();
      return {
        handle,
        kind: PROFILE_MEDIA_STABLE_STATE_KINDS.UNPUBLISHED,
        stableKey: expected.stableKey,
        storageEtag: requireStorageEtag(object),
        tombstoneId: requireMetadata(metadata, METADATA_TOMBSTONE_ID),
        unpublishedAt: normalizeIsoDate(
          requireMetadata(metadata, METADATA_UNPUBLISHED_AT)
        )
      };
    } catch (error) {
      if (error?.name === "ProfileMediaStoreError") throw error;
      throw malformedMetadataError(error);
    }
  }

  const publication = publicationFromObject(object, expected);
  return {
    handle: publication.handle,
    kind: PROFILE_MEDIA_STABLE_STATE_KINDS.PUBLICATION,
    publication: createSelectedPublicationRecord(publication, {
      body: null,
      locale: PROFILE_MEDIA_DEFAULT_LOCALE,
      notModified: false
    }),
    stableKey: publication.stableKey,
    storageEtag: publication.storageEtag
  };
}

function revisionRecordFromObject(object, expected) {
  try {
    assertHttpMetadata(object, mediaHttpMetadata());
    const metadata = normalizeMetadata(object.customMetadata);
    if (metadata[METADATA_KIND] !== "revision") throw malformedMetadataError();
    const record = normalizeProfileMediaRevisionRecord({
      body: expected.body,
      cacheControl: object.httpMetadata?.cacheControl,
      contentType: object.httpMetadata?.contentType,
      createdAt: requireMetadata(metadata, METADATA_CREATED_AT),
      etag: quoteDigest(requireMetadata(metadata, METADATA_ETAG)),
      locale: requireMetadata(metadata, METADATA_LOCALE),
      ownerId: requireMetadata(metadata, METADATA_OWNER_ID),
      revision: requireMetadata(metadata, METADATA_REVISION)
    });
    if (
      record.ownerId !== expected.ownerId ||
      record.locale !== normalizeProfileMediaLocale(expected.locale, { fallback: false }) ||
      record.revision !== expected.revision ||
      record.revisionKey !== expected.revisionKey ||
      createProfileMediaRevisionDigest(record.body) !== record.revision
    ) {
      throw malformedMetadataError();
    }
    return {
      ...record,
      body: Buffer.from(expected.body),
      storageEtag: requireStorageEtag(object)
    };
  } catch (error) {
    if (error?.name === "ProfileMediaStoreError") throw error;
    throw malformedMetadataError(error);
  }
}

function publicationFromObject(object, expected) {
  try {
    assertHttpMetadata(object, mediaHttpMetadata());
    const metadata = normalizeMetadata(object.customMetadata);
    if (metadata[METADATA_KIND] !== "publication") throw malformedMetadataError();
    const representations = Object.fromEntries(
      PROFILE_MEDIA_SUPPORTED_LOCALES.map((locale) => [locale, {
        etag: quoteDigest(requireMetadata(metadata, `${locale}-etag`)),
        revision: requireMetadata(metadata, `${locale}-revision`),
        revisionKey: requireMetadata(metadata, `${locale}-key`)
      }])
    );
    const normalized = normalizeProfileMediaPublicationInput({
      handle: requireMetadata(metadata, METADATA_HANDLE),
      ownerId: requireMetadata(metadata, METADATA_OWNER_ID),
      publicationId: requireMetadata(metadata, METADATA_PUBLICATION_ID),
      publishedAt: requireMetadata(metadata, METADATA_PUBLISHED_AT),
      representations
    });
    if (
      normalized.handle !== expected.handle ||
      normalized.stableKey !== expected.stableKey
    ) {
      throw malformedMetadataError();
    }
    return {
      ...normalized,
      storageEtag: requireStorageEtag(object)
    };
  } catch (error) {
    if (error?.name === "ProfileMediaStoreError") throw error;
    throw malformedMetadataError(error);
  }
}

function createSelectedPublicationRecord(publication, options) {
  const representation = publication.representations[options.locale];
  return {
    body: options.body ? Buffer.from(options.body) : null,
    cacheControl: PROFILE_MEDIA_CACHE_CONTROL,
    contentType: PROFILE_MEDIA_CONTENT_TYPE,
    etag: representation.etag,
    handle: publication.handle,
    locale: options.locale,
    notModified: options.notModified,
    ownerId: publication.ownerId,
    publicationId: publication.publicationId,
    publishedAt: publication.publishedAt,
    representations: Object.fromEntries(
      Object.entries(publication.representations).map(
        ([locale, value]) => [locale, { ...value, locale }]
      )
    ),
    revision: representation.revision,
    revisionKey: representation.revisionKey,
    stableKey: publication.stableKey,
    storageEtag: publication.storageEtag
  };
}

function revisionMetadata(record) {
  return {
    [METADATA_KIND]: "revision",
    [METADATA_OWNER_ID]: record.ownerId,
    [METADATA_LOCALE]: record.locale,
    [METADATA_REVISION]: record.revision,
    [METADATA_ETAG]: record.revision,
    [METADATA_CREATED_AT]: record.createdAt
  };
}

function publicationMetadata(publication) {
  const metadata = {
    [METADATA_KIND]: "publication",
    [METADATA_OWNER_ID]: publication.ownerId,
    [METADATA_HANDLE]: publication.handle,
    [METADATA_PUBLICATION_ID]: publication.publicationId,
    [METADATA_PUBLISHED_AT]: publication.publishedAt
  };
  for (const locale of PROFILE_MEDIA_SUPPORTED_LOCALES) {
    const representation = publication.representations[locale];
    metadata[`${locale}-key`] = representation.revisionKey;
    metadata[`${locale}-revision`] = representation.revision;
    metadata[`${locale}-etag`] = representation.revision;
  }
  return metadata;
}

function mediaHttpMetadata() {
  return {
    cacheControl: PROFILE_MEDIA_CACHE_CONTROL,
    contentType: PROFILE_MEDIA_CONTENT_TYPE
  };
}

function stableOnlyIf(state) {
  return state.kind === PROFILE_MEDIA_STABLE_STATE_KINDS.MISSING
    ? { etagDoesNotMatch: "*" }
    : { etagMatches: state.storageEtag };
}

function assertExpectedStorageEtag(state, options) {
  if (!Object.hasOwn(options, "expectedStorageEtag")) return;
  const expected = options.expectedStorageEtag;
  if (expected !== null && (typeof expected !== "string" || expected === "")) {
    throw new TypeError("expectedStorageEtag must be a non-empty string or null");
  }
  if (state.storageEtag !== expected) throw stableConflict();
}

function assertHttpMetadata(object, expected) {
  if (
    object.httpMetadata?.contentType !== expected.contentType ||
    object.httpMetadata?.cacheControl !== expected.cacheControl
  ) {
    throw createProfileMediaStoreError(
      PROFILE_MEDIA_STORE_ERROR_CODES.INVALID,
      "profile media object has invalid response metadata"
    );
  }
}

async function readR2Body(object, label) {
  let bytes;
  if (typeof object.arrayBuffer === "function") {
    bytes = new Uint8Array(await object.arrayBuffer());
  } else if (object.body && typeof object.body.getReader === "function") {
    const reader = object.body.getReader();
    const chunks = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      length += value.byteLength;
    }
    bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
  } else {
    throw createProfileMediaStoreError(
      PROFILE_MEDIA_STORE_ERROR_CODES.INVALID,
      `${label} body is unreadable`
    );
  }
  if (bytes.byteLength === 0) {
    throw createProfileMediaStoreError(
      PROFILE_MEDIA_STORE_ERROR_CODES.INVALID,
      `${label} body is empty`
    );
  }
  return Buffer.from(bytes);
}

function hasR2Body(object) {
  return typeof object.arrayBuffer === "function" ||
    Boolean(object.body && typeof object.body.getReader === "function");
}

function sameImmutableRevision(left, right) {
  return left.etag === right.etag &&
    left.locale === right.locale &&
    left.contentType === right.contentType &&
    left.cacheControl === right.cacheControl &&
    Buffer.from(left.body).equals(Buffer.from(right.body));
}

function cloneRevisionRecord(record) {
  return { ...record, body: Buffer.from(record.body) };
}

function normalizeMetadata(value) {
  if (!value || typeof value !== "object") throw malformedMetadataError();
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key.toLowerCase(), String(item)])
  );
}

function requireMetadata(metadata, key) {
  const value = metadata[key];
  if (typeof value !== "string" || value === "") throw malformedMetadataError();
  return value;
}

function requireStorageEtag(object) {
  if (typeof object?.etag === "string" && object.etag !== "") {
    return object.etag.replace(/^"|"$/g, "");
  }
  if (typeof object?.httpEtag === "string" && object.httpEtag !== "") {
    return object.httpEtag.replace(/^"|"$/g, "");
  }
  throw malformedMetadataError();
}

function normalizeHandle(value) {
  return createProfileMediaStableKey({ handle: value }).split("/").at(-2);
}

function quoteDigest(value) {
  return `"${value}"`;
}

function normalizeIsoDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("expected a valid media timestamp");
  }
  return date.toISOString();
}

function requireKeySegment(value, label) {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(value)
  ) {
    throw new TypeError(`${label} must be a safe object-key segment`);
  }
  return value;
}

function requireR2Bucket(bucket) {
  for (const method of ["get", "head", "put"]) {
    if (typeof bucket?.[method] !== "function") {
      throw new TypeError(`R2 bucket with ${method} is required`);
    }
  }
  return bucket;
}

function defaultCreateTombstoneId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `tombstone_${uuid.replaceAll("-", "")}`;
  return `tombstone_${Date.now()}`;
}

function stableConflict() {
  return createProfileMediaStoreError(
    PROFILE_MEDIA_STORE_ERROR_CODES.CONFLICT,
    "stable media storage revision changed"
  );
}

function unavailable(operation, cause) {
  if (cause?.name === "ProfileMediaStoreError") return cause;
  return createProfileMediaStoreError(
    PROFILE_MEDIA_STORE_ERROR_CODES.UNAVAILABLE,
    `${operation} failed`,
    { cause }
  );
}

function malformedMetadataError(cause) {
  return createProfileMediaStoreError(
    PROFILE_MEDIA_STORE_ERROR_CODES.INVALID,
    "profile media object metadata is invalid",
    { cause }
  );
}
