import { createProfileMediaRevisionDigest } from "../index.js";

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

export async function putRepresentations(store, representations) {
  await store.putRevision(representations.en);
  await store.putRevision(representations.ko);
}

function createRevision(ownerId, locale, value) {
  const body = Buffer.from(value);
  const revision = createProfileMediaRevisionDigest(body);
  return {
    body,
    createdAt: "2026-07-24T00:00:00.000Z",
    etag: `"${revision}"`,
    locale,
    ownerId,
    revision
  };
}

export const OWNER_ID = "owner_1";
export const HANDLE = "postmelee";
