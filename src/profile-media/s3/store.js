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
  PROFILE_MEDIA_DEFAULT_THEME,
  PROFILE_MEDIA_FORMAT,
  PROFILE_MEDIA_LEGACY_CONTRACT_VERSION,
  PROFILE_MEDIA_STABLE_STATE_KINDS,
  PROFILE_MEDIA_STORE_CONTRACT_VERSION,
  PROFILE_MEDIA_STORE_ERROR_CODES,
  PROFILE_MEDIA_SUPPORTED_LOCALES,
  PROFILE_MEDIA_SUPPORTED_THEMES,
  createProfileMediaRevisionDigest,
  createProfileMediaRevisionKey,
  createProfileMediaSocialKey,
  createProfileMediaStableKey,
  createProfileMediaStoreError,
  getProfileMediaThemeRepresentations,
  matchesProfileMediaIfNoneMatch,
  normalizeProfileMediaLocale,
  normalizeProfileMediaPublicationInput,
  normalizeProfileMediaRevisionRecord,
  normalizeProfileMediaSocialRecord,
  normalizeProfileMediaTheme
} from "../media-store-contract.js";
import {
  DEFAULT_PROFILE_MEDIA_S3_OPERATION_TIMEOUT_MS,
  createProfileMediaS3Client
} from "./client.js";

const METADATA_KIND = "kind";
const METADATA_CONTRACT_VERSION = "contract-version";
const METADATA_OWNER_ID = "owner-id";
const METADATA_HANDLE = "handle";
const METADATA_LOCALE = "locale";
const METADATA_THEME = "theme";
const METADATA_FORMAT = "format";
const METADATA_REVISION = "revision";
const METADATA_ETAG = "etag";
const METADATA_PRESENTATION_DIGEST = "presentation-digest";
const METADATA_CREATED_AT = "created-at";
const METADATA_PUBLICATION_ID = "publication-id";
const METADATA_PUBLISHED_AT = "published-at";
const METADATA_AUTHORITY_KEY = "authority-key";

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
      return readPublishedCard({
        handle: normalizeHandle(getOptions.handle),
        ifNoneMatch: getOptions.ifNoneMatch,
        includeBody: getOptions.includeBody,
        locale: normalizeProfileMediaLocale(getOptions.locale),
        theme: normalizeProfileMediaTheme(getOptions.theme)
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
          revisionKey,
          theme: normalizeProfileMediaTheme(getOptions.theme)
        });
      } catch (error) {
        if (error?.code === PROFILE_MEDIA_STORE_ERROR_CODES.NOT_FOUND) return null;
        throw error;
      }
    },

    async getSocialCard(getOptions = {}) {
      const handle = normalizeHandle(getOptions.handle);
      const socialKey = createProfileMediaSocialKey({ handle });
      const includeBody = getOptions.includeBody !== false;

      try {
        const response = includeBody
          ? await send(new GetObjectCommand({
            Bucket: bucket,
            Key: socialKey
          }), "read social media")
          : await send(new HeadObjectCommand({
            Bucket: bucket,
            Key: socialKey
          }), "read social media");
        return socialRecordFromResponse(response, {
          body: includeBody ? await readSdkBody(response.Body) : null,
          handle,
          socialKey
        });
      } catch (error) {
        if (error?.code === PROFILE_MEDIA_STORE_ERROR_CODES.NOT_FOUND) return null;
        throw error;
      }
    },

    async putSocialCard(putOptions = {}) {
      const record = normalizeProfileMediaSocialRecord(putOptions);
      if (createProfileMediaRevisionDigest(record.body) !== record.revision) {
        throw createProfileMediaStoreError(
          PROFILE_MEDIA_STORE_ERROR_CODES.CONFLICT,
          "social media does not match body digest"
        );
      }

      await send(new PutObjectCommand({
        Body: record.body,
        Bucket: bucket,
        CacheControl: record.cacheControl,
        ContentType: record.contentType,
        Key: record.socialKey,
        Metadata: socialMetadata(record)
      }), "write social media");

      const { body, ...metadata } = record;
      return metadata;
    },

    async deleteSocialCard(deleteOptions = {}) {
      const handle = normalizeHandle(deleteOptions.handle);
      const socialKey = createProfileMediaSocialKey({ handle });
      let existed = true;

      try {
        await send(new HeadObjectCommand({
          Bucket: bucket,
          Key: socialKey
        }), "inspect social media");
      } catch (error) {
        if (error?.code !== PROFILE_MEDIA_STORE_ERROR_CODES.NOT_FOUND) throw error;
        existed = false;
      }
      if (!existed) return { deleted: false, handle };

      await send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: socialKey
      }), "delete social media");
      return { deleted: true, handle };
    },

    async inspectStableCard(inspectOptions = {}) {
      const handle = normalizeHandle(inspectOptions.handle);
      const stableKey = createProfileMediaStableKey({ handle });
      const publication = await headPublication(handle);
      if (!publication) {
        return {
          handle,
          kind: PROFILE_MEDIA_STABLE_STATE_KINDS.MISSING,
          stableKey,
          storageEtag: null
        };
      }
      return {
        handle,
        kind: PROFILE_MEDIA_STABLE_STATE_KINDS.PUBLICATION,
        publication: createSelectedPublicationRecord(publication, {
          body: null,
          locale: PROFILE_MEDIA_DEFAULT_LOCALE,
          notModified: false,
          theme: PROFILE_MEDIA_DEFAULT_THEME
        }),
        stableKey,
        storageEtag: publication.storageEtag
      };
    },

    async putRevision(putOptions = {}) {
      const record = normalizeProfileMediaRevisionRecord(putOptions);
      if (createProfileMediaRevisionDigest(record.body) !== record.revision) {
        throw createProfileMediaStoreError(
          PROFILE_MEDIA_STORE_ERROR_CODES.CONFLICT,
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
        if (error?.code !== PROFILE_MEDIA_STORE_ERROR_CODES.CONFLICT) throw error;
        const previous = await store.getRevision(record);
        if (previous && sameImmutableRevision(previous, record)) {
          return { idempotent: true, record: previous };
        }
        throw createProfileMediaStoreError(
          PROFILE_MEDIA_STORE_ERROR_CODES.CONFLICT,
          "immutable media revision already exists with different content",
          { cause: error }
        );
      }
    },

    async publishRevision(publishOptions = {}) {
      const publication = normalizeProfileMediaPublicationInput(publishOptions);
      const previous = await headPublication(publication.handle);
      assertExpectedStorageEtag(previous, publishOptions);
      if (previous && previous.ownerId !== publication.ownerId) {
        throw createProfileMediaStoreError(
          PROFILE_MEDIA_STORE_ERROR_CODES.CONFLICT,
          "stable media handle is already published by another owner"
        );
      }

      const revisions = await loadPublicationRevisions(publication);
      if (publication.contractVersion === PROFILE_MEDIA_STORE_CONTRACT_VERSION) {
        await copyStableRepresentation({
          metadata: lightStableMetadata(publication),
          revision: revisions.light[PROFILE_MEDIA_DEFAULT_LOCALE],
          stableKey: publication.stableKeys.light
        }, "stage light stable media");
      }
      await copyStableRepresentation({
        metadata: publicationMetadata(publication),
        revision: revisions.dark[PROFILE_MEDIA_DEFAULT_LOCALE],
        stableKey: publication.stableKey
      }, "publish stable media");

      return store.getPublishedCard({
        handle: publication.handle,
        locale: PROFILE_MEDIA_DEFAULT_LOCALE,
        theme: PROFILE_MEDIA_DEFAULT_THEME
      });
    },

    async unpublishCard(unpublishOptions = {}) {
      const handle = normalizeHandle(unpublishOptions.handle);
      const previous = await store.getPublishedCard({ handle });
      assertExpectedStorageEtag(previous, unpublishOptions);
      if (!previous) return null;
      await send(new DeleteObjectCommand({
        Bucket: bucket,
        IfMatch: previous.storageEtag,
        Key: createProfileMediaStableKey({ handle })
      }), "unpublish stable media");
      return { ...previous, unpublishedStorageEtag: null };
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

  async function readPublishedCard(getOptions, stableReadAttempt = 0) {
    const publication = await headPublication(getOptions.handle);
    if (!publication) return null;
    const representations = getProfileMediaThemeRepresentations(
      publication,
      getOptions.theme
    );
    if (!representations) return null;
    const representation = representations[getOptions.locale];
    const variant = getOptions.theme === PROFILE_MEDIA_DEFAULT_THEME
      ? {
          stableKey: publication.stableKey,
          storageEtag: publication.storageEtag
        }
      : await headLightStable(publication);
    const notModified = matchesProfileMediaIfNoneMatch(
      getOptions.ifNoneMatch,
      representation.etag
    );
    const includeBody = getOptions.includeBody !== false && !notModified;
    let body = null;

    if (getOptions.locale !== PROFILE_MEDIA_DEFAULT_LOCALE && !includeBody) {
      const revision = await headRevision({
        locale: getOptions.locale,
        ownerId: publication.ownerId,
        revision: representation.revision,
        theme: getOptions.theme
      });
      assertCoherentRevision(revision, publication, representation, getOptions.theme);
    }

    if (includeBody) {
      const stableLocale = getOptions.locale === PROFILE_MEDIA_DEFAULT_LOCALE;
      const key = stableLocale ? variant.stableKey : representation.revisionKey;
      let response;
      try {
        response = await send(new GetObjectCommand({
          Bucket: bucket,
          IfMatch: stableLocale ? variant.storageEtag : undefined,
          Key: key
        }), "read published media");
      } catch (error) {
        if (
          stableLocale &&
          error?.code === PROFILE_MEDIA_STORE_ERROR_CODES.CONFLICT
        ) {
          if (stableReadAttempt === 0) {
            return readPublishedCard(getOptions, stableReadAttempt + 1);
          }
          throw repeatedStableReadError(error);
        }
        throw error;
      }

      const responseBody = await readSdkBody(response.Body);
      if (stableLocale) {
        assertResponseMediaHeaders(response);
        if (getOptions.theme === PROFILE_MEDIA_DEFAULT_THEME) {
          const coherent = publicationFromHead(response, {
            handle: publication.handle,
            stableKey: publication.stableKey
          });
          if (!samePublicationAuthority(coherent, publication)) {
            throw repeatedStableReadError();
          }
        } else {
          const coherent = lightStableFromResponse(response, publication);
          if (coherent.storageEtag !== variant.storageEtag) {
            throw repeatedStableReadError();
          }
        }
        if (createProfileMediaRevisionDigest(responseBody) !== representation.revision) {
          throw createProfileMediaStoreError(
            PROFILE_MEDIA_STORE_ERROR_CODES.INVALID,
            "published media body does not match its application ETag"
          );
        }
        body = responseBody;
      } else {
        body = revisionRecordFromResponse(response, {
          body: responseBody,
          locale: getOptions.locale,
          ownerId: publication.ownerId,
          revision: representation.revision,
          revisionKey: representation.revisionKey,
          theme: getOptions.theme
        }).body;
      }
    }

    return createSelectedPublicationRecord(publication, {
      body,
      locale: getOptions.locale,
      notModified,
      stableKey: variant.stableKey,
      theme: getOptions.theme
    });
  }

  async function loadPublicationRevisions(publication) {
    const themes = publication.contractVersion === PROFILE_MEDIA_STORE_CONTRACT_VERSION
      ? PROFILE_MEDIA_SUPPORTED_THEMES
      : [PROFILE_MEDIA_DEFAULT_THEME];
    const revisions = {};
    for (const theme of themes) {
      revisions[theme] = {};
      const expectedByLocale = getProfileMediaThemeRepresentations(publication, theme);
      for (const locale of PROFILE_MEDIA_SUPPORTED_LOCALES) {
        const expected = expectedByLocale[locale];
        const revision = await headRevision({
          locale,
          ownerId: publication.ownerId,
          revision: expected.revision,
          theme
        });
        assertCoherentRevision(revision, publication, expected, theme);
        revisions[theme][locale] = revision;
      }
    }
    return revisions;
  }

  async function copyStableRepresentation(input, operation) {
    await send(new CopyObjectCommand({
      Bucket: bucket,
      CacheControl: PROFILE_MEDIA_CACHE_CONTROL,
      ContentType: PROFILE_MEDIA_CONTENT_TYPE,
      CopySource: encodeCopySource(bucket, input.revision.revisionKey),
      CopySourceIfMatch: input.revision.storageEtag,
      Key: input.stableKey,
      Metadata: input.metadata,
      MetadataDirective: "REPLACE"
    }), operation);
  }

  async function headRevision(options) {
    const revisionKey = createProfileMediaRevisionKey(options);
    try {
      const response = await send(new HeadObjectCommand({
        Bucket: bucket,
        Key: revisionKey
      }), "inspect media revision");
      return revisionRecordFromResponse(response, { ...options, revisionKey });
    } catch (error) {
      if (error?.code === PROFILE_MEDIA_STORE_ERROR_CODES.NOT_FOUND) return null;
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
      if (error?.code === PROFILE_MEDIA_STORE_ERROR_CODES.NOT_FOUND) return null;
      throw error;
    }
  }

  async function headLightStable(publication) {
    if (publication.contractVersion !== PROFILE_MEDIA_STORE_CONTRACT_VERSION) {
      throw createProfileMediaStoreError(
        PROFILE_MEDIA_STORE_ERROR_CODES.NOT_FOUND,
        "light media variant is not available"
      );
    }
    try {
      const response = await send(new HeadObjectCommand({
        Bucket: bucket,
        Key: publication.stableKeys.light
      }), "inspect light stable media");
      return lightStableFromResponse(response, publication);
    } catch (error) {
      if (error?.code === PROFILE_MEDIA_STORE_ERROR_CODES.NOT_FOUND) {
        throw createProfileMediaStoreError(
          PROFILE_MEDIA_STORE_ERROR_CODES.NOT_FOUND,
          "light media variant is not available"
        );
      }
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

function socialMetadata(record) {
  return {
    [METADATA_KIND]: "social",
    [METADATA_CONTRACT_VERSION]: String(PROFILE_MEDIA_STORE_CONTRACT_VERSION),
    [METADATA_OWNER_ID]: record.ownerId,
    [METADATA_HANDLE]: record.handle,
    [METADATA_FORMAT]: PROFILE_MEDIA_FORMAT,
    [METADATA_REVISION]: record.revision,
    [METADATA_ETAG]: record.revision,
    [METADATA_PRESENTATION_DIGEST]: record.presentationDigest,
    [METADATA_PUBLICATION_ID]: record.publicationId,
    [METADATA_CREATED_AT]: record.createdAt
  };
}

function socialRecordFromResponse(response, expected) {
  const metadata = response.Metadata ?? {};
  if (metadata[METADATA_KIND] !== "social") {
    throw createProfileMediaStoreError(
      PROFILE_MEDIA_STORE_ERROR_CODES.INVALID,
      "social media object has an unexpected kind"
    );
  }

  const revision = metadata[METADATA_REVISION];
  if (typeof revision !== "string" || revision === "") {
    throw createProfileMediaStoreError(
      PROFILE_MEDIA_STORE_ERROR_CODES.INVALID,
      "social media object is missing its revision"
    );
  }
  if (expected.body && createProfileMediaRevisionDigest(expected.body) !== revision) {
    throw createProfileMediaStoreError(
      PROFILE_MEDIA_STORE_ERROR_CODES.INVALID,
      "social media object does not match its revision"
    );
  }

  const record = {
    cacheControl: PROFILE_MEDIA_CACHE_CONTROL,
    contentType: PROFILE_MEDIA_CONTENT_TYPE,
    createdAt: metadata[METADATA_CREATED_AT],
    etag: `"${revision}"`,
    handle: expected.handle,
    ownerId: metadata[METADATA_OWNER_ID],
    presentationDigest: metadata[METADATA_PRESENTATION_DIGEST],
    publicationId: metadata[METADATA_PUBLICATION_ID],
    revision,
    socialKey: expected.socialKey
  };
  if (expected.body) record.body = expected.body;
  return record;
}

function revisionMetadata(record) {
  const metadata = {
    [METADATA_KIND]: "revision",
    [METADATA_OWNER_ID]: record.ownerId,
    [METADATA_LOCALE]: record.locale,
    [METADATA_REVISION]: record.revision,
    [METADATA_ETAG]: record.revision,
    [METADATA_CREATED_AT]: record.createdAt
  };
  if (record.contractVersion === PROFILE_MEDIA_STORE_CONTRACT_VERSION) {
    metadata[METADATA_CONTRACT_VERSION] = String(record.contractVersion);
    metadata[METADATA_THEME] = record.theme;
    metadata[METADATA_FORMAT] = record.format;
    metadata[METADATA_PRESENTATION_DIGEST] = record.presentationDigest;
  }
  return metadata;
}

function publicationMetadata(publication) {
  const metadata = {
    [METADATA_KIND]: "publication",
    [METADATA_OWNER_ID]: publication.ownerId,
    [METADATA_HANDLE]: publication.handle,
    [METADATA_PUBLICATION_ID]: publication.publicationId,
    [METADATA_PUBLISHED_AT]: publication.publishedAt
  };
  const isV4 = publication.contractVersion === PROFILE_MEDIA_STORE_CONTRACT_VERSION;
  if (isV4) {
    metadata[METADATA_CONTRACT_VERSION] = String(publication.contractVersion);
    metadata[METADATA_FORMAT] = publication.format;
    metadata[METADATA_PRESENTATION_DIGEST] = publication.presentationDigest;
  }
  const themes = isV4
    ? PROFILE_MEDIA_SUPPORTED_THEMES
    : [PROFILE_MEDIA_DEFAULT_THEME];
  for (const theme of themes) {
    const representations = getProfileMediaThemeRepresentations(publication, theme);
    const prefix = isV4 ? `${theme}-` : "";
    for (const locale of PROFILE_MEDIA_SUPPORTED_LOCALES) {
      const representation = representations[locale];
      metadata[`${prefix}${locale}-key`] = representation.revisionKey;
      metadata[`${prefix}${locale}-revision`] = representation.revision;
      metadata[`${prefix}${locale}-etag`] = representation.revision;
    }
  }
  return metadata;
}

function lightStableMetadata(publication) {
  const representation = publication.representations.light.en;
  return {
    [METADATA_KIND]: "representation",
    [METADATA_CONTRACT_VERSION]: String(publication.contractVersion),
    [METADATA_OWNER_ID]: publication.ownerId,
    [METADATA_HANDLE]: publication.handle,
    [METADATA_THEME]: "light",
    [METADATA_FORMAT]: publication.format,
    [METADATA_REVISION]: representation.revision,
    [METADATA_ETAG]: representation.revision,
    [METADATA_PRESENTATION_DIGEST]: publication.presentationDigest,
    [METADATA_PUBLICATION_ID]: publication.publicationId,
    [METADATA_AUTHORITY_KEY]: publication.stableKey
  };
}

function revisionRecordFromResponse(response, expected) {
  try {
    assertResponseMediaHeaders(response);
    const metadata = normalizeMetadata(response.Metadata);
    if (metadata[METADATA_KIND] !== "revision") throw malformedMetadataError();
    const contractVersion = Number(
      metadata[METADATA_CONTRACT_VERSION] ?? PROFILE_MEDIA_LEGACY_CONTRACT_VERSION
    );
    const record = normalizeProfileMediaRevisionRecord({
      body: expected.body ?? Buffer.from([1]),
      cacheControl: response.CacheControl,
      contentType: response.ContentType,
      contractVersion,
      createdAt: requireMetadata(metadata, METADATA_CREATED_AT),
      etag: quoteDigest(requireMetadata(metadata, METADATA_ETAG)),
      format: metadata[METADATA_FORMAT] ?? PROFILE_MEDIA_FORMAT,
      locale: requireMetadata(metadata, METADATA_LOCALE),
      ownerId: requireMetadata(metadata, METADATA_OWNER_ID),
      presentationDigest: metadata[METADATA_PRESENTATION_DIGEST] ?? null,
      revision: requireMetadata(metadata, METADATA_REVISION),
      theme: metadata[METADATA_THEME] ?? PROFILE_MEDIA_DEFAULT_THEME
    });
    if (
      record.ownerId !== expected.ownerId ||
      record.locale !== normalizeProfileMediaLocale(expected.locale, { fallback: false }) ||
      record.theme !== expected.theme ||
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
  } catch (error) {
    if (error?.name === "ProfileMediaStoreError") throw error;
    throw malformedMetadataError(error);
  }
}

function publicationFromHead(response, expected) {
  try {
    assertResponseMediaHeaders(response);
    const metadata = normalizeMetadata(response.Metadata);
    if (metadata[METADATA_KIND] !== "publication") throw malformedMetadataError();
    const contractVersion = Number(
      metadata[METADATA_CONTRACT_VERSION] ?? PROFILE_MEDIA_LEGACY_CONTRACT_VERSION
    );
    const isV4 = contractVersion === PROFILE_MEDIA_STORE_CONTRACT_VERSION;
    const representations = isV4
      ? Object.fromEntries(PROFILE_MEDIA_SUPPORTED_THEMES.map((theme) => [
          theme,
          readRepresentationMetadata(metadata, theme)
        ]))
      : readRepresentationMetadata(metadata);
    const normalized = normalizeProfileMediaPublicationInput({
      contractVersion,
      format: metadata[METADATA_FORMAT] ?? PROFILE_MEDIA_FORMAT,
      handle: requireMetadata(metadata, METADATA_HANDLE),
      ownerId: requireMetadata(metadata, METADATA_OWNER_ID),
      presentationDigest: isV4
        ? requireMetadata(metadata, METADATA_PRESENTATION_DIGEST)
        : undefined,
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
      storageEtag: requireStorageEtag(response.ETag)
    };
  } catch (error) {
    if (error?.name === "ProfileMediaStoreError") throw error;
    throw malformedMetadataError(error);
  }
}

function lightStableFromResponse(response, authority) {
  try {
    assertResponseMediaHeaders(response);
    const metadata = normalizeMetadata(response.Metadata);
    if (
      metadata[METADATA_KIND] !== "representation" ||
      Number(requireMetadata(metadata, METADATA_CONTRACT_VERSION)) !==
        PROFILE_MEDIA_STORE_CONTRACT_VERSION ||
      requireMetadata(metadata, METADATA_THEME) !== "light" ||
      requireMetadata(metadata, METADATA_FORMAT) !== authority.format ||
      requireMetadata(metadata, METADATA_HANDLE) !== authority.handle ||
      requireMetadata(metadata, METADATA_OWNER_ID) !== authority.ownerId ||
      requireMetadata(metadata, METADATA_PUBLICATION_ID) !== authority.publicationId ||
      requireMetadata(metadata, METADATA_PRESENTATION_DIGEST) !==
        authority.presentationDigest ||
      requireMetadata(metadata, METADATA_AUTHORITY_KEY) !== authority.stableKey
    ) {
      throw malformedMetadataError();
    }
    const expected = authority.representations.light.en;
    if (
      requireMetadata(metadata, METADATA_REVISION) !== expected.revision ||
      quoteDigest(requireMetadata(metadata, METADATA_ETAG)) !== expected.etag
    ) {
      throw malformedMetadataError();
    }
    return {
      stableKey: authority.stableKeys.light,
      storageEtag: requireStorageEtag(response.ETag)
    };
  } catch (error) {
    if (error?.name === "ProfileMediaStoreError") throw error;
    throw malformedMetadataError(error);
  }
}

function readRepresentationMetadata(metadata, theme) {
  const prefix = theme ? `${theme}-` : "";
  return Object.fromEntries(PROFILE_MEDIA_SUPPORTED_LOCALES.map((locale) => [
    locale,
    {
      etag: quoteDigest(requireMetadata(metadata, `${prefix}${locale}-etag`)),
      revision: requireMetadata(metadata, `${prefix}${locale}-revision`),
      revisionKey: requireMetadata(metadata, `${prefix}${locale}-key`)
    }
  ]));
}

function createSelectedPublicationRecord(publication, options) {
  const representations = getProfileMediaThemeRepresentations(
    publication,
    options.theme
  );
  const representation = representations[options.locale];
  return {
    body: options.body ? Buffer.from(options.body) : null,
    cacheControl: PROFILE_MEDIA_CACHE_CONTROL,
    contentType: PROFILE_MEDIA_CONTENT_TYPE,
    contractVersion: publication.contractVersion,
    etag: representation.etag,
    format: publication.format,
    handle: publication.handle,
    locale: options.locale,
    notModified: options.notModified,
    ownerId: publication.ownerId,
    presentationDigest: publication.presentationDigest,
    publicationId: publication.publicationId,
    publishedAt: publication.publishedAt,
    representations: cloneRepresentations(publication),
    revision: representation.revision,
    revisionKey: representation.revisionKey,
    stableKey: options.stableKey ?? createProfileMediaStableKey({
      handle: publication.handle,
      theme: options.theme
    }),
    stableKeys: { ...publication.stableKeys },
    storageEtag: publication.storageEtag,
    theme: options.theme
  };
}

function cloneRepresentations(publication) {
  if (publication.contractVersion !== PROFILE_MEDIA_STORE_CONTRACT_VERSION) {
    return Object.fromEntries(Object.entries(publication.representations).map(
      ([locale, value]) => [locale, { ...value, locale, theme: "dark" }]
    ));
  }
  return Object.fromEntries(PROFILE_MEDIA_SUPPORTED_THEMES.map((theme) => [
    theme,
    Object.fromEntries(Object.entries(publication.representations[theme]).map(
      ([locale, value]) => [locale, { ...value, locale, theme }]
    ))
  ]));
}

function assertCoherentRevision(revision, publication, expected, theme) {
  if (!revision) {
    throw createProfileMediaStoreError(
      PROFILE_MEDIA_STORE_ERROR_CODES.NOT_FOUND,
      "media revision not found"
    );
  }
  if (
    revision.etag !== expected.etag ||
    revision.theme !== theme ||
    !isPublicationRevisionPresentationCompatible(revision, publication, theme)
  ) {
    throw createProfileMediaStoreError(
      PROFILE_MEDIA_STORE_ERROR_CODES.CONFLICT,
      "media revision metadata does not match publication metadata"
    );
  }
}

function isPublicationRevisionPresentationCompatible(revision, publication, theme) {
  if (revision.presentationDigest === publication.presentationDigest) return true;
  return publication.contractVersion === PROFILE_MEDIA_STORE_CONTRACT_VERSION &&
    theme === PROFILE_MEDIA_DEFAULT_THEME &&
    revision.contractVersion === PROFILE_MEDIA_LEGACY_CONTRACT_VERSION &&
    revision.presentationDigest === null;
}

function samePublicationAuthority(left, right) {
  return left.publicationId === right.publicationId &&
    left.presentationDigest === right.presentationDigest &&
    left.contractVersion === right.contractVersion;
}

function assertExpectedStorageEtag(stable, options) {
  if (!Object.hasOwn(options, "expectedStorageEtag")) return;
  const expected = options.expectedStorageEtag;
  if (expected !== null && (typeof expected !== "string" || expected === "")) {
    throw new TypeError("expectedStorageEtag must be a non-empty string or null");
  }
  if ((stable?.storageEtag ?? null) !== expected) {
    throw createProfileMediaStoreError(
      PROFILE_MEDIA_STORE_ERROR_CODES.CONFLICT,
      "stable media storage revision changed"
    );
  }
}

function assertResponseMediaHeaders(response) {
  if (
    response.ContentType !== PROFILE_MEDIA_CONTENT_TYPE ||
    response.CacheControl !== PROFILE_MEDIA_CACHE_CONTROL
  ) {
    throw createProfileMediaStoreError(
      PROFILE_MEDIA_STORE_ERROR_CODES.INVALID,
      "profile media object has invalid response metadata"
    );
  }
}

async function readSdkBody(body) {
  if (!body) {
    throw createProfileMediaStoreError(
      PROFILE_MEDIA_STORE_ERROR_CODES.INVALID,
      "profile media object body is missing"
    );
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
  throw createProfileMediaStoreError(
    PROFILE_MEDIA_STORE_ERROR_CODES.INVALID,
    "profile media object body is unreadable"
  );
}

function sameImmutableRevision(left, right) {
  return left.etag === right.etag &&
    left.locale === right.locale &&
    left.theme === right.theme &&
    left.presentationDigest === right.presentationDigest &&
    left.format === right.format &&
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
  if (code === "NoSuchBucket") {
    return createProfileMediaStoreError(
      PROFILE_MEDIA_STORE_ERROR_CODES.UNAVAILABLE,
      `${operation} failed`,
      { cause: error }
    );
  }
  if (status === 404 || ["NotFound", "NoSuchKey"].includes(code)) {
    return createProfileMediaStoreError(
      PROFILE_MEDIA_STORE_ERROR_CODES.NOT_FOUND,
      "profile media object not found"
    );
  }
  if (
    status === 409 ||
    status === 412 ||
    ["ConditionalRequestConflict", "PreconditionFailed"].includes(code)
  ) {
    return createProfileMediaStoreError(
      PROFILE_MEDIA_STORE_ERROR_CODES.CONFLICT,
      `${operation} conflict`
    );
  }
  return createProfileMediaStoreError(
    PROFILE_MEDIA_STORE_ERROR_CODES.UNAVAILABLE,
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
  return createProfileMediaStableKey({ handle: value }).split("/").at(-2);
}

function repeatedStableReadError(cause) {
  return createProfileMediaStoreError(
    PROFILE_MEDIA_STORE_ERROR_CODES.UNAVAILABLE,
    "stable media changed repeatedly during read",
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

function emptyBodyError() {
  return createProfileMediaStoreError(
    PROFILE_MEDIA_STORE_ERROR_CODES.INVALID,
    "profile media object body is empty"
  );
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
