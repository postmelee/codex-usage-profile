import { createProfileMediaRevisionDigest } from "../index.js";

export const PRESENTATION_DIGEST = createProfileMediaRevisionDigest(
  Buffer.from("presentation-v1")
);

export function createRepresentations(label, ownerId = OWNER_ID) {
  return {
    en: createRevision(ownerId, "en", `${label}:en`),
    ko: createRevision(ownerId, "ko", `${label}:ko`)
  };
}

export function publicationInput(representations, options = {}) {
  const input = {
    handle: options.handle ?? HANDLE,
    ownerId: options.ownerId ?? OWNER_ID,
    publicationId: options.publicationId ?? "publication_1",
    publishedAt: "2026-07-24T00:01:00.000Z",
    representations: {
      en: {
        etag: representations.en.etag,
        revision: representations.en.revision
      },
      ko: {
        etag: representations.ko.etag,
        revision: representations.ko.revision
      }
    }
  };
  if (Object.hasOwn(options, "expectedStorageEtag")) {
    input.expectedStorageEtag = options.expectedStorageEtag;
  }
  return input;
}

export function createThemeRepresentations(label, ownerId = OWNER_ID) {
  return Object.fromEntries(["dark", "light"].map((theme) => [
    theme,
    Object.fromEntries(["en", "ko"].map((locale) => [
      locale,
      createRevision(ownerId, locale, `${label}:${theme}:${locale}`, {
        contractVersion: 4,
        presentationDigest: PRESENTATION_DIGEST,
        theme
      })
    ]))
  ]));
}

export function themePublicationInput(representations, options = {}) {
  const input = {
    contractVersion: 4,
    handle: options.handle ?? HANDLE,
    ownerId: options.ownerId ?? OWNER_ID,
    presentationDigest: options.presentationDigest ?? PRESENTATION_DIGEST,
    publicationId: options.publicationId ?? "publication_v4",
    publishedAt: "2026-07-24T00:01:00.000Z",
    representations: Object.fromEntries(
      Object.entries(representations).map(([theme, locales]) => [
        theme,
        Object.fromEntries(Object.entries(locales).map(([locale, revision]) => [
          locale,
          { etag: revision.etag, revision: revision.revision }
        ]))
      ])
    )
  };
  if (Object.hasOwn(options, "expectedStorageEtag")) {
    input.expectedStorageEtag = options.expectedStorageEtag;
  }
  if (Object.hasOwn(options, "canonicalLocale")) {
    input.canonicalLocale = options.canonicalLocale;
  }
  if (Object.hasOwn(options, "canonicalTheme")) {
    input.canonicalTheme = options.canonicalTheme;
  }
  return input;
}

export async function putRepresentations(store, representations) {
  await store.putRevision(representations.en);
  await store.putRevision(representations.ko);
}

export async function putThemeRepresentations(store, representations) {
  for (const theme of ["dark", "light"]) {
    await putRepresentations(store, representations[theme]);
  }
}

function createRevision(ownerId, locale, value, overrides = {}) {
  const body = Buffer.from(value);
  const revision = createProfileMediaRevisionDigest(body);
  return {
    body,
    createdAt: "2026-07-24T00:00:00.000Z",
    etag: `"${revision}"`,
    locale,
    ownerId,
    revision,
    ...overrides
  };
}

export const OWNER_ID = "owner_1";
export const HANDLE = "postmelee";
