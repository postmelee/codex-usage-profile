import { createHash } from "node:crypto";

export const PROFILE_MEDIA_STORE_CONTRACT_VERSION = 4;
export const PROFILE_MEDIA_LEGACY_CONTRACT_VERSION = 3;
export const PROFILE_MEDIA_CONTENT_TYPE = "image/png";
export const PROFILE_MEDIA_CACHE_CONTROL = "public, no-cache, must-revalidate";
export const PROFILE_MEDIA_DEFAULT_LOCALE = "en";
export const PROFILE_MEDIA_SUPPORTED_LOCALES = Object.freeze(["en", "ko"]);
export const PROFILE_MEDIA_DEFAULT_THEME = "dark";
export const PROFILE_MEDIA_SUPPORTED_THEMES = Object.freeze(["dark", "light"]);
export const PROFILE_MEDIA_FORMAT = "png";
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
  const theme = normalizeProfileMediaTheme(options.theme);
  const revision = requireRevision(options.revision);
  const themeSegment = theme === PROFILE_MEDIA_DEFAULT_THEME ? "" : `${theme}/`;
  return `cards/v2/owners/${ownerId}/revisions/${themeSegment}${locale}/${revision}.png`;
}

export function createProfileMediaStableKey(options = {}) {
  const handle = requireProfileMediaHandle(options.handle);
  const theme = normalizeProfileMediaTheme(options.theme);
  if (theme === PROFILE_MEDIA_DEFAULT_THEME) {
    return `cards/v2/public/${handle}/card.png`;
  }
  return `cards/v2/public/${handle}/themes/${theme}/card.png`;
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

export function normalizeProfileMediaTheme(value, options = {}) {
  const fallback = options.fallback !== false;
  if (typeof value !== "string" || value.trim() === "") {
    if (fallback) return PROFILE_MEDIA_DEFAULT_THEME;
    throw new TypeError("theme is required");
  }
  const theme = value.trim().toLowerCase();
  if (PROFILE_MEDIA_SUPPORTED_THEMES.includes(theme)) return theme;
  if (fallback) return PROFILE_MEDIA_DEFAULT_THEME;
  throw new TypeError("theme must be dark or light");
}

export function normalizeProfileMediaRevisionRecord(options = {}) {
  const ownerId = requireKeySegment(options.ownerId, "ownerId");
  const locale = normalizeProfileMediaLocale(options.locale, { fallback: false });
  const theme = normalizeProfileMediaTheme(options.theme);
  const revision = requireRevision(options.revision);
  const etag = requireApplicationEtag(options.etag, revision);
  const format = requireFormat(options.format);
  const presentationDigest = options.presentationDigest === undefined ||
    options.presentationDigest === null
    ? null
    : requireRevision(options.presentationDigest, "presentationDigest");
  const contractVersion = normalizeRevisionContractVersion({
    contractVersion: options.contractVersion,
    presentationDigest,
    theme
  });

  return {
    body: normalizeBody(options.body),
    cacheControl: requireNonEmptyString(
      options.cacheControl ?? PROFILE_MEDIA_CACHE_CONTROL,
      "cacheControl"
    ),
    contentType: requireContentType(options.contentType),
    contractVersion,
    createdAt: normalizeIsoDate(options.createdAt),
    etag,
    format,
    locale,
    ownerId,
    presentationDigest,
    revision,
    revisionKey: createProfileMediaRevisionKey({
      ownerId,
      locale,
      revision,
      theme
    }),
    theme
  };
}

export function createProfileMediaRevisionDigest(body) {
  return createHash("sha256").update(normalizeBody(body)).digest("base64url");
}

export function normalizeProfileMediaPublicationInput(options = {}) {
  const ownerId = requireKeySegment(options.ownerId, "ownerId");
  const handle = requireProfileMediaHandle(options.handle);
  const publicationId = requireKeySegment(options.publicationId, "publicationId");
  const isV4 = isThemeRepresentationMap(options.representations) ||
    options.contractVersion === PROFILE_MEDIA_STORE_CONTRACT_VERSION;

  if (!isV4) {
    return {
      contractVersion: PROFILE_MEDIA_LEGACY_CONTRACT_VERSION,
      format: PROFILE_MEDIA_FORMAT,
      handle,
      ownerId,
      presentationDigest: null,
      publicationId,
      publishedAt: normalizeIsoDate(options.publishedAt),
      representations: normalizeLocaleRepresentations(
        options.representations,
        { ownerId, theme: PROFILE_MEDIA_DEFAULT_THEME }
      ),
      stableKey: createProfileMediaStableKey({ handle }),
      stableKeys: {
        dark: createProfileMediaStableKey({ handle })
      }
    };
  }

  const presentationDigest = requireRevision(
    options.presentationDigest,
    "presentationDigest"
  );
  const format = requireFormat(options.format);
  const representations = Object.fromEntries(
    PROFILE_MEDIA_SUPPORTED_THEMES.map((theme) => [
      theme,
      normalizeLocaleRepresentations(options.representations?.[theme], {
        ownerId,
        presentationDigest,
        theme
      })
    ])
  );
  return {
    contractVersion: PROFILE_MEDIA_STORE_CONTRACT_VERSION,
    format,
    handle,
    ownerId,
    presentationDigest,
    publicationId,
    publishedAt: normalizeIsoDate(options.publishedAt),
    representations,
    stableKey: createProfileMediaStableKey({ handle }),
    stableKeys: Object.fromEntries(PROFILE_MEDIA_SUPPORTED_THEMES.map(
      (theme) => [theme, createProfileMediaStableKey({ handle, theme })]
    ))
  };
}

export function getProfileMediaThemeRepresentations(publication, theme) {
  const normalizedTheme = normalizeProfileMediaTheme(theme);
  if (publication.contractVersion === PROFILE_MEDIA_STORE_CONTRACT_VERSION) {
    return publication.representations[normalizedTheme];
  }
  return normalizedTheme === PROFILE_MEDIA_DEFAULT_THEME
    ? publication.representations
    : null;
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
  const lightStableByHandle = new Map();
  let nextStorageRevision = 1;

  return {
    async getPublishedCard(options = {}) {
      const handle = requireProfileMediaHandle(options.handle);
      const theme = normalizeProfileMediaTheme(options.theme);
      const stable = stableByHandle.get(handle);
      if (!stable || stable.kind !== PROFILE_MEDIA_STABLE_STATE_KINDS.PUBLICATION) {
        return null;
      }
      if (theme === "light") {
        if (stable.publication.contractVersion !== PROFILE_MEDIA_STORE_CONTRACT_VERSION) {
          return null;
        }
        const light = lightStableByHandle.get(handle);
        if (!isCoherentLightStable(stable.publication, light)) return null;
      }
      return selectPublishedRepresentation(stable.publication, {
        ...options,
        theme
      });
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
          locale: PROFILE_MEDIA_DEFAULT_LOCALE,
          theme: PROFILE_MEDIA_DEFAULT_THEME
        }),
        stableKey,
        storageEtag: stable.storageEtag
      };
    },

    async publishRevision(options = {}) {
      const input = normalizeProfileMediaPublicationInput(options);
      const previous = stableByHandle.get(input.handle);
      assertExpectedStorageEtag(previous, options);
      if (
        previous?.kind === PROFILE_MEDIA_STABLE_STATE_KINDS.PUBLICATION &&
        previous.publication.ownerId !== input.ownerId
      ) {
        throw createProfileMediaStoreError(
          "conflict",
          "stable media handle is already published by another owner"
        );
      }

      const records = collectRevisionRecords(input, revisions);
      const published = createPublishedRecord(input, records);
      if (input.contractVersion === PROFILE_MEDIA_STORE_CONTRACT_VERSION) {
        lightStableByHandle.set(input.handle, {
          presentationDigest: input.presentationDigest,
          publicationId: input.publicationId,
          stableKey: input.stableKeys.light
        });
      }
      const storageEtag = createMemoryStorageEtag(nextStorageRevision++);
      published.storageEtag = storageEtag;
      stableByHandle.set(input.handle, {
        kind: PROFILE_MEDIA_STABLE_STATE_KINDS.PUBLICATION,
        publication: clonePublishedRecord(published, {
          includeRepresentationBodies: true
        }),
        storageEtag
      });
      return selectPublishedRepresentation(published, {
        locale: PROFILE_MEDIA_DEFAULT_LOCALE,
        theme: PROFILE_MEDIA_DEFAULT_THEME
      });
    },

    async unpublishCard(options = {}) {
      const handle = requireProfileMediaHandle(options.handle);
      const previous = stableByHandle.get(handle) ?? null;
      assertExpectedStorageEtag(previous, options);
      if (!previous || previous.kind === PROFILE_MEDIA_STABLE_STATE_KINDS.UNPUBLISHED) {
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
          locale: PROFILE_MEDIA_DEFAULT_LOCALE,
          theme: PROFILE_MEDIA_DEFAULT_THEME
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

function normalizeLocaleRepresentations(value, identity) {
  return Object.fromEntries(PROFILE_MEDIA_SUPPORTED_LOCALES.map((locale) => {
    const representation = value?.[locale];
    if (!representation || typeof representation !== "object") {
      throw new TypeError(`representations.${identity.theme}.${locale} is required`);
    }
    const revision = requireRevision(representation.revision);
    const etag = requireApplicationEtag(representation.etag, revision);
    const revisionKey = createProfileMediaRevisionKey({
      ownerId: identity.ownerId,
      locale,
      revision,
      theme: identity.theme
    });
    if (representation.revisionKey !== undefined &&
      representation.revisionKey !== revisionKey) {
      throw new TypeError(
        `representations.${identity.theme}.${locale}.revisionKey does not match revision`
      );
    }
    return [locale, {
      etag,
      format: PROFILE_MEDIA_FORMAT,
      locale,
      presentationDigest: identity.presentationDigest ?? null,
      revision,
      revisionKey,
      theme: identity.theme
    }];
  }));
}

function isThemeRepresentationMap(value) {
  return Boolean(value && typeof value === "object" &&
    (Object.hasOwn(value, "dark") || Object.hasOwn(value, "light")));
}

function normalizeRevisionContractVersion(identity) {
  const isV4 = identity.contractVersion === PROFILE_MEDIA_STORE_CONTRACT_VERSION ||
    identity.presentationDigest !== null || identity.theme !== PROFILE_MEDIA_DEFAULT_THEME;
  if (isV4) {
    if (identity.presentationDigest === null) {
      throw new TypeError("presentationDigest is required for media contract v4");
    }
    return PROFILE_MEDIA_STORE_CONTRACT_VERSION;
  }
  if (identity.contractVersion !== undefined &&
    identity.contractVersion !== PROFILE_MEDIA_LEGACY_CONTRACT_VERSION) {
    throw new TypeError("unsupported media contract version");
  }
  return PROFILE_MEDIA_LEGACY_CONTRACT_VERSION;
}

function collectRevisionRecords(input, revisions) {
  const records = {};
  const themes = input.contractVersion === PROFILE_MEDIA_STORE_CONTRACT_VERSION
    ? PROFILE_MEDIA_SUPPORTED_THEMES
    : [PROFILE_MEDIA_DEFAULT_THEME];
  for (const theme of themes) {
    records[theme] = {};
    const representations = getProfileMediaThemeRepresentations(input, theme);
    for (const locale of PROFILE_MEDIA_SUPPORTED_LOCALES) {
      const expected = representations[locale];
      const revision = revisions.get(expected.revisionKey);
      if (!revision) {
        throw createProfileMediaStoreError("not_found", "media revision not found");
      }
      if (revision.etag !== expected.etag ||
        revision.theme !== theme ||
        revision.presentationDigest !== input.presentationDigest) {
        throw createProfileMediaStoreError(
          "conflict",
          "media revision metadata does not match publication metadata"
        );
      }
      records[theme][locale] = cloneRevisionRecord(revision);
    }
  }
  return records;
}

function createPublishedRecord(input, records) {
  const isV4 = input.contractVersion === PROFILE_MEDIA_STORE_CONTRACT_VERSION;
  const darkRecords = records.dark;
  const defaultRevision = darkRecords[PROFILE_MEDIA_DEFAULT_LOCALE];
  const representations = isV4
    ? Object.fromEntries(PROFILE_MEDIA_SUPPORTED_THEMES.map((theme) => [
      theme,
      cloneRepresentationMap(input.representations[theme])
    ]))
    : cloneRepresentationMap(input.representations);
  const representationBodies = isV4
    ? Object.fromEntries(PROFILE_MEDIA_SUPPORTED_THEMES.map((theme) => [
      theme,
      cloneBodyMap(records[theme])
    ]))
    : cloneBodyMap(darkRecords);
  return {
    body: Buffer.from(defaultRevision.body),
    cacheControl: PROFILE_MEDIA_CACHE_CONTROL,
    contentType: PROFILE_MEDIA_CONTENT_TYPE,
    contractVersion: input.contractVersion,
    etag: defaultRevision.etag,
    format: PROFILE_MEDIA_FORMAT,
    handle: input.handle,
    locale: PROFILE_MEDIA_DEFAULT_LOCALE,
    notModified: false,
    ownerId: input.ownerId,
    presentationDigest: input.presentationDigest,
    publicationId: input.publicationId,
    publishedAt: input.publishedAt,
    representationBodies,
    representations,
    revision: defaultRevision.revision,
    revisionKey: defaultRevision.revisionKey,
    stableKey: input.stableKey,
    stableKeys: { ...input.stableKeys },
    theme: PROFILE_MEDIA_DEFAULT_THEME
  };
}

function selectPublishedRepresentation(publication, options) {
  const locale = normalizeProfileMediaLocale(options.locale);
  const theme = normalizeProfileMediaTheme(options.theme);
  const representations = getProfileMediaThemeRepresentations(publication, theme);
  if (!representations) return null;
  const representation = representations[locale];
  const notModified = matchesProfileMediaIfNoneMatch(
    options.ifNoneMatch,
    representation.etag
  );
  const includeBody = options.includeBody !== false && !notModified;
  const bodyMap = publication.contractVersion === PROFILE_MEDIA_STORE_CONTRACT_VERSION
    ? publication.representationBodies[theme]
    : publication.representationBodies;
  return {
    ...clonePublishedRecord(publication),
    body: includeBody ? Buffer.from(bodyMap[locale]) : null,
    etag: representation.etag,
    locale,
    notModified,
    revision: representation.revision,
    revisionKey: representation.revisionKey,
    stableKey: createProfileMediaStableKey({
      handle: publication.handle,
      theme
    }),
    theme
  };
}

function isCoherentLightStable(publication, light) {
  return Boolean(light &&
    light.publicationId === publication.publicationId &&
    light.presentationDigest === publication.presentationDigest &&
    light.stableKey === publication.stableKeys.light);
}

function cloneRevisionRecord(value) {
  if (!value) return value;
  return { ...value, body: value.body ? Buffer.from(value.body) : value.body };
}

function clonePublishedRecord(value, options = {}) {
  if (!value) return value;
  const isV4 = value.contractVersion === PROFILE_MEDIA_STORE_CONTRACT_VERSION;
  const cloned = {
    ...value,
    body: value.body ? Buffer.from(value.body) : value.body,
    representations: isV4
      ? Object.fromEntries(PROFILE_MEDIA_SUPPORTED_THEMES.map((theme) => [
        theme,
        cloneRepresentationMap(value.representations[theme])
      ]))
      : cloneRepresentationMap(value.representations),
    stableKeys: value.stableKeys ? { ...value.stableKeys } : value.stableKeys
  };
  if (options.includeRepresentationBodies === true && value.representationBodies) {
    cloned.representationBodies = isV4
      ? Object.fromEntries(PROFILE_MEDIA_SUPPORTED_THEMES.map((theme) => [
        theme,
        cloneRawBodyMap(value.representationBodies[theme])
      ]))
      : cloneRawBodyMap(value.representationBodies);
  }
  return cloned;
}

function cloneRepresentationMap(value) {
  return Object.fromEntries(Object.entries(value).map(
    ([locale, representation]) => [locale, { ...representation }]
  ));
}

function cloneBodyMap(records) {
  return Object.fromEntries(PROFILE_MEDIA_SUPPORTED_LOCALES.map(
    (locale) => [locale, Buffer.from(records[locale].body)]
  ));
}

function cloneRawBodyMap(value) {
  return Object.fromEntries(Object.entries(value).map(
    ([locale, body]) => [locale, Buffer.from(body)]
  ));
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
    left.theme === right.theme &&
    left.presentationDigest === right.presentationDigest &&
    left.format === right.format &&
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
  if (value.byteLength === 0) throw new TypeError("body must not be empty");
  return Buffer.from(value);
}

function requireContentType(value = PROFILE_MEDIA_CONTENT_TYPE) {
  if (value !== PROFILE_MEDIA_CONTENT_TYPE) {
    throw new TypeError(`contentType must be ${PROFILE_MEDIA_CONTENT_TYPE}`);
  }
  return value;
}

function requireFormat(value = PROFILE_MEDIA_FORMAT) {
  if (value !== PROFILE_MEDIA_FORMAT) {
    throw new TypeError(`format must be ${PROFILE_MEDIA_FORMAT}`);
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

function requireRevision(value, label = "revision") {
  const revision = requireNonEmptyString(value, label);
  if (!PROFILE_MEDIA_REVISION_PATTERN.test(revision)) {
    throw new TypeError(`${label} must be a 43-character base64url digest`);
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
