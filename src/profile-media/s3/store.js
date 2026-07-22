import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand
} from "@aws-sdk/client-s3";

import {
  PROFILE_MEDIA_CACHE_CONTROL,
  PROFILE_MEDIA_CONTENT_TYPE,
  PROFILE_MEDIA_DEFAULT_LOCALE,
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
import {
  DEFAULT_PROFILE_MEDIA_S3_OPERATION_TIMEOUT_MS,
  createProfileMediaS3Client
} from "./client.js";

const METADATA_KIND = "kind";
const METADATA_OWNER_ID = "owner-id";
const METADATA_HANDLE = "handle";
const METADATA_LOCALE = "locale";
const METADATA_REVISION = "revision";
const METADATA_ETAG = "etag";
const METADATA_CREATED_AT = "created-at";
const METADATA_PUBLICATION_ID = "publication-id";
const METADATA_PUBLISHED_AT = "published-at";

export function createS3ProfileMediaStore(options = {}) {
  const bucket = requireNonEmptyString(options.bucket, "S3 bucket");
  const client = options.client ?? createProfileMediaS3Client(options);
  const ownsClient = !options.client;
  const operationTimeoutMs = requirePositiveInteger(
    options.operationTimeoutMs ?? DEFAULT_PROFILE_MEDIA_S3_OPERATION_TIMEOUT_MS,
    "S3 operation timeout"
  );

  const store = {
    async getPublishedCard(getOptions = {}) {
      const handle = normalizeHandle(getOptions.handle);
      const locale = normalizeProfileMediaLocale(getOptions.locale);
      const publication = await headPublication(handle);
      if (!publication) return null;

      const representation = publication.representations[locale];
      const notModified = matchesProfileMediaIfNoneMatch(
        getOptions.ifNoneMatch,
        representation.etag
      );
      const includeBody = getOptions.includeBody !== false && !notModified;
      let body = null;

      if (includeBody) {
        const key = locale === PROFILE_MEDIA_DEFAULT_LOCALE
          ? publication.stableKey
          : representation.revisionKey;
        const response = await send(new GetObjectCommand({
          Bucket: bucket,
          IfMatch: locale === PROFILE_MEDIA_DEFAULT_LOCALE
            ? publication.storageEtag
            : undefined,
          Key: key
        }), "read published media");
        const responseBody = await readSdkBody(response.Body);
        if (locale === PROFILE_MEDIA_DEFAULT_LOCALE) {
          assertResponseMediaHeaders(response);
          body = responseBody;
        } else {
          body = revisionRecordFromResponse(response, {
            body: responseBody,
            locale,
            ownerId: publication.ownerId,
            revision: representation.revision,
            revisionKey: representation.revisionKey
          }).body;
        }
      }

      return createSelectedPublicationRecord(publication, {
        body,
        locale,
        notModified
      });
    },

    async getRevision(getOptions = {}) {
      const revisionKey = createProfileMediaRevisionKey(getOptions);
      try {
        const response = await send(new GetObjectCommand({
          Bucket: bucket,
          Key: revisionKey
        }), "read media revision");
        return revisionRecordFromResponse(response, {
          body: await readSdkBody(response.Body),
          locale: getOptions.locale,
          ownerId: getOptions.ownerId,
          revision: getOptions.revision,
          revisionKey
        });
      } catch (error) {
        if (error?.code === "not_found") return null;
        throw error;
      }
    },

    async putRevision(putOptions = {}) {
      const record = normalizeProfileMediaRevisionRecord(putOptions);
      if (createProfileMediaRevisionDigest(record.body) !== record.revision) {
        throw createProfileMediaStoreError(
          "conflict",
          "media revision does not match body digest"
        );
      }
      try {
        await send(new PutObjectCommand({
          Body: record.body,
          Bucket: bucket,
          CacheControl: record.cacheControl,
          ContentType: record.contentType,
          IfNoneMatch: "*",
          Key: record.revisionKey,
          Metadata: revisionMetadata(record)
        }), "write media revision");
        return { idempotent: false, record: cloneRevisionRecord(record) };
      } catch (error) {
        if (error?.code !== "conflict") throw error;
        const previous = await store.getRevision(record);
        if (previous && sameImmutableRevision(previous, record)) {
          return { idempotent: true, record: previous };
        }
        throw createProfileMediaStoreError(
          "conflict",
          "immutable media revision already exists with different content",
          { cause: error }
        );
      }
    },

    async publishRevision(publishOptions = {}) {
      const publicationInput = normalizeProfileMediaPublicationInput(publishOptions);
      const previous = await headPublication(publicationInput.handle);
      if (previous && previous.ownerId !== publicationInput.ownerId) {
        throw createProfileMediaStoreError(
          "conflict",
          "stable media handle is already published by another owner"
        );
      }

      const revisions = {};
      for (const locale of PROFILE_MEDIA_SUPPORTED_LOCALES) {
        const expected = publicationInput.representations[locale];
        const revision = await headRevision({
          locale,
          ownerId: publicationInput.ownerId,
          revision: expected.revision
        });
        if (!revision) {
          throw createProfileMediaStoreError("not_found", "media revision not found");
        }
        if (revision.etag !== expected.etag) {
          throw createProfileMediaStoreError(
            "conflict",
            "media revision ETag does not match publication metadata"
          );
        }
        revisions[locale] = revision;
      }

      const source = revisions[PROFILE_MEDIA_DEFAULT_LOCALE];
      await send(new CopyObjectCommand({
        Bucket: bucket,
        CacheControl: PROFILE_MEDIA_CACHE_CONTROL,
        ContentType: PROFILE_MEDIA_CONTENT_TYPE,
        CopySource: encodeCopySource(bucket, source.revisionKey),
        CopySourceIfMatch: source.storageEtag,
        Key: publicationInput.stableKey,
        Metadata: publicationMetadata(publicationInput),
        MetadataDirective: "REPLACE"
      }), "publish stable media");

      return store.getPublishedCard({
        handle: publicationInput.handle,
        locale: PROFILE_MEDIA_DEFAULT_LOCALE
      });
    },

    async unpublishCard(unpublishOptions = {}) {
      const handle = normalizeHandle(unpublishOptions.handle);
      const previous = await store.getPublishedCard({ handle });
      if (!previous) return null;
      await send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: createProfileMediaStableKey({ handle })
      }), "unpublish stable media");
      return previous;
    },

    async verifyReadiness() {
      await send(new HeadBucketCommand({ Bucket: bucket }), "verify media bucket");
      return { ready: true };
    },

    async close() {
      if (ownsClient && typeof client.destroy === "function") client.destroy();
    }
  };

  return store;

  async function headRevision(options) {
    const revisionKey = createProfileMediaRevisionKey(options);
    try {
      const response = await send(new HeadObjectCommand({
        Bucket: bucket,
        Key: revisionKey
      }), "inspect media revision");
      return revisionRecordFromResponse(response, { ...options, revisionKey });
    } catch (error) {
      if (error?.code === "not_found") return null;
      throw error;
    }
  }

  async function headPublication(handle) {
    const stableKey = createProfileMediaStableKey({ handle });
    try {
      const response = await send(new HeadObjectCommand({
        Bucket: bucket,
        Key: stableKey
      }), "inspect stable media");
      return publicationFromHead(response, { handle, stableKey });
    } catch (error) {
      if (error?.code === "not_found") return null;
      throw error;
    }
  }

  async function send(command, operation) {
    try {
      return await client.send(command, {
        abortSignal: AbortSignal.timeout(operationTimeoutMs)
      });
    } catch (error) {
      throw mapS3Error(error, operation);
    }
  }
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

function revisionRecordFromResponse(response, expected) {
  assertResponseMediaHeaders(response);
  const metadata = normalizeMetadata(response.Metadata);
  if (metadata[METADATA_KIND] !== "revision") {
    throw malformedMetadataError();
  }

  const record = normalizeProfileMediaRevisionRecord({
    body: expected.body ?? Buffer.from([1]),
    cacheControl: response.CacheControl,
    contentType: response.ContentType,
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
    record.revisionKey !== expected.revisionKey
  ) {
    throw malformedMetadataError();
  }
  return {
    ...record,
    body: expected.body ? Buffer.from(expected.body) : null,
    storageEtag: requireStorageEtag(response.ETag)
  };
}

function publicationFromHead(response, expected) {
  assertResponseMediaHeaders(response);
  const metadata = normalizeMetadata(response.Metadata);
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
  if (normalized.handle !== expected.handle || normalized.stableKey !== expected.stableKey) {
    throw malformedMetadataError();
  }
  return {
    ...normalized,
    storageEtag: requireStorageEtag(response.ETag)
  };
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
    stableKey: publication.stableKey
  };
}

function assertResponseMediaHeaders(response) {
  if (
    response.ContentType !== PROFILE_MEDIA_CONTENT_TYPE ||
    response.CacheControl !== PROFILE_MEDIA_CACHE_CONTROL
  ) {
    throw createProfileMediaStoreError(
      "unavailable",
      "profile media object has invalid response metadata"
    );
  }
}

async function readSdkBody(body) {
  if (!body) {
    throw createProfileMediaStoreError("unavailable", "profile media object body is missing");
  }
  if (typeof body.transformToByteArray === "function") {
    const bytes = await body.transformToByteArray();
    if (bytes.byteLength === 0) throw emptyBodyError();
    return Buffer.from(bytes);
  }
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
    if (body.byteLength === 0) throw emptyBodyError();
    return Buffer.from(body);
  }
  if (typeof body[Symbol.asyncIterator] === "function") {
    const chunks = [];
    for await (const chunk of body) chunks.push(Buffer.from(chunk));
    const result = Buffer.concat(chunks);
    if (result.byteLength === 0) throw emptyBodyError();
    return result;
  }
  throw createProfileMediaStoreError("unavailable", "profile media object body is unreadable");
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

function mapS3Error(error, operation) {
  if (error?.name === "ProfileMediaStoreError") return error;
  const status = error?.$metadata?.httpStatusCode;
  const code = error?.Code ?? error?.code ?? error?.name;
  if (
    status === 404 ||
    ["NotFound", "NoSuchKey", "NoSuchBucket"].includes(code)
  ) {
    return createProfileMediaStoreError("not_found", "profile media object not found");
  }
  if (
    status === 409 ||
    status === 412 ||
    ["ConditionalRequestConflict", "PreconditionFailed"].includes(code)
  ) {
    return createProfileMediaStoreError("conflict", "profile media write conflict");
  }
  return createProfileMediaStoreError(
    "unavailable",
    `${operation} failed`,
    { cause: error }
  );
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

function requireStorageEtag(value) {
  return requireNonEmptyString(value, "S3 storage ETag");
}

function quoteDigest(value) {
  return `"${value}"`;
}

function encodeCopySource(bucket, key) {
  return `${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function normalizeHandle(value) {
  return createProfileMediaStableKey({ handle: value })
    .split("/")
    .at(-2);
}

function malformedMetadataError() {
  return createProfileMediaStoreError(
    "unavailable",
    "profile media object metadata is invalid"
  );
}

function emptyBodyError() {
  return createProfileMediaStoreError("unavailable", "profile media object body is empty");
}

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer`);
  }
  return value;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} is required`);
  }
  return value.trim();
}
