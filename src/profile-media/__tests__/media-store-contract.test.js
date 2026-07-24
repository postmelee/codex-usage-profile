import assert from "node:assert/strict";
import test from "node:test";

import {
  PROFILE_MEDIA_CACHE_CONTROL,
  PROFILE_MEDIA_CONTENT_TYPE,
  PROFILE_MEDIA_STABLE_STATE_KINDS,
  PROFILE_MEDIA_STORE_CONTRACT_VERSION,
  assertProfileMediaStoreContract,
  createMemoryProfileMediaStore,
  createProfileMediaObjectKeys,
  createProfileMediaRevisionDigest,
  createProfileMediaRevisionKey,
  createProfileMediaStableKey,
  normalizeProfileMediaLocale
} from "../media-store-contract.js";

const EN_REVISION = createProfileMediaRevisionDigest(Buffer.from("english-png"));
const KO_REVISION = createProfileMediaRevisionDigest(Buffer.from("korean-png"));

test("media contract creates owner revision and handle stable keys", () => {
  assert.equal(PROFILE_MEDIA_STORE_CONTRACT_VERSION, 3);
  assert.deepEqual(createProfileMediaObjectKeys({
    ownerId: "owner_1",
    handle: "postmelee",
    locale: "ko",
    revision: KO_REVISION
  }), {
    revisionKey: `cards/v2/owners/owner_1/revisions/ko/${KO_REVISION}.png`,
    stableKey: "cards/v2/public/postmelee/card.png"
  });
  assert.equal(
    createProfileMediaRevisionKey({
      ownerId: "owner_1",
      locale: "en",
      revision: EN_REVISION
    }),
    `cards/v2/owners/owner_1/revisions/en/${EN_REVISION}.png`
  );
  assert.equal(
    createProfileMediaStableKey({ handle: "postmelee" }),
    "cards/v2/public/postmelee/card.png"
  );
  assert.throws(
    () => createProfileMediaRevisionKey({
      ownerId: "../owner",
      locale: "en",
      revision: EN_REVISION
    }),
    /safe object-key segment/
  );
  assert.throws(
    () => createProfileMediaStableKey({ handle: "Not Canonical" }),
    /canonical public handle/
  );
});

test("normalizes supported media locales and falls back to English", () => {
  assert.equal(normalizeProfileMediaLocale("ko-KR"), "ko");
  assert.equal(normalizeProfileMediaLocale("en-US"), "en");
  assert.equal(normalizeProfileMediaLocale("fr"), "en");
  assert.throws(
    () => normalizeProfileMediaLocale("fr", { fallback: false }),
    /locale must be en or ko/
  );
});

test("media contract publishes one atomic locale set behind a stable handle", async () => {
  const store = assertProfileMediaStoreContract(createMemoryProfileMediaStore());
  const en = createRevision("en", "english-png");
  const ko = createRevision("ko", "korean-png");
  const first = await store.putRevision(en);
  const retry = await store.putRevision(en);
  await store.putRevision(ko);
  const published = await store.publishRevision(createPublication({ en, ko }));
  const stable = await store.inspectStableCard({ handle: "postmelee" });

  assert.equal(first.idempotent, false);
  assert.equal(retry.idempotent, true);
  assert.equal(published.stableKey, "cards/v2/public/postmelee/card.png");
  assert.equal(published.contentType, PROFILE_MEDIA_CONTENT_TYPE);
  assert.equal(published.cacheControl, PROFILE_MEDIA_CACHE_CONTROL);
  assert.equal(published.publicationId, "publication_1");
  assert.equal(stable.kind, PROFILE_MEDIA_STABLE_STATE_KINDS.PUBLICATION);
  assert.equal(stable.storageEtag, published.storageEtag);
  await assert.rejects(
    () => store.unpublishCard({
      expectedStorageEtag: '"stale"',
      handle: "postmelee",
      tombstoneId: "tombstone_stale",
      unpublishedAt: "2026-07-21T00:02:00.000Z"
    }),
    (error) => error.code === "conflict"
  );
  assert.deepEqual(published.body, Buffer.from("english-png"));
  assert.deepEqual(
    (await store.getPublishedCard({ handle: "postmelee", locale: "ko" })).body,
    Buffer.from("korean-png")
  );

  const notModified = await store.getPublishedCard({
    handle: "postmelee",
    locale: "ko",
    ifNoneMatch: `"${KO_REVISION}"`
  });
  assert.equal(notModified.notModified, true);
  assert.equal(notModified.body, null);
  assert.equal(notModified.etag, `"${KO_REVISION}"`);

  const head = await store.getPublishedCard({
    handle: "postmelee",
    locale: "en",
    includeBody: false
  });
  assert.equal(head.notModified, false);
  assert.equal(head.body, null);
});

test("failed locale publication preserves the previous stable publication", async () => {
  const store = createMemoryProfileMediaStore();
  const firstEn = createRevision("en", "english-v1");
  const firstKo = createRevision("ko", "korean-v1");
  await store.putRevision(firstEn);
  await store.putRevision(firstKo);
  await store.publishRevision(createPublication({ en: firstEn, ko: firstKo }));

  const nextEn = createRevision("en", "english-v2");
  const missingKo = createRevision("ko", "korean-v2");
  await store.putRevision(nextEn);
  await assert.rejects(
    () => store.publishRevision(createPublication({
      en: nextEn,
      ko: missingKo,
      publicationId: "publication_2"
    })),
    (error) => error.code === "not_found"
  );

  const stillPublished = await store.getPublishedCard({ handle: "postmelee" });
  assert.equal(stillPublished.publicationId, "publication_1");
  assert.deepEqual(stillPublished.body, Buffer.from("english-v1"));
});

test("immutable conflicts and stable handle ownership fail closed", async () => {
  const store = createMemoryProfileMediaStore();
  const en = createRevision("en", "english-png");
  const ko = createRevision("ko", "korean-png");
  await store.putRevision(en);
  await store.putRevision(ko);

  await assert.rejects(
    () => store.putRevision({ ...en, body: Buffer.from("changed") }),
    (error) => error.code === "conflict"
  );
  await store.publishRevision(createPublication({ en, ko }));
  await assert.rejects(
    () => store.publishRevision(createPublication({
      en: { ...en, ownerId: "owner_2" },
      ko: { ...ko, ownerId: "owner_2" },
      ownerId: "owner_2"
    })),
    (error) => ["conflict", "not_found"].includes(error.code)
  );
});

test("unpublish hides the stable publication and retains revisions", async () => {
  const store = createMemoryProfileMediaStore();
  const en = createRevision("en", "english-png");
  const ko = createRevision("ko", "korean-png");
  await store.putRevision(en);
  await store.putRevision(ko);
  const published = await store.publishRevision(createPublication({ en, ko }));

  const removed = await store.unpublishCard({
    expectedStorageEtag: published.storageEtag,
    handle: "postmelee",
    tombstoneId: "tombstone_1",
    unpublishedAt: "2026-07-21T00:02:00.000Z"
  });
  const stable = await store.inspectStableCard({ handle: "postmelee" });

  assert.equal(removed.publicationId, "publication_1");
  assert.equal(stable.kind, PROFILE_MEDIA_STABLE_STATE_KINDS.UNPUBLISHED);
  assert.equal(stable.storageEtag, removed.unpublishedStorageEtag);
  assert.equal(await store.getPublishedCard({ handle: "postmelee" }), null);
  assert.equal(
    (await store.getRevision({
      ownerId: "owner_1",
      locale: "en",
      revision: EN_REVISION
    })).etag,
    `"${EN_REVISION}"`
  );
  assert.equal(await store.unpublishCard({ handle: "postmelee" }), null);
});

function createRevision(locale, body, overrides = {}) {
  const bytes = Buffer.from(body);
  const revision = createProfileMediaRevisionDigest(bytes);
  return {
    ownerId: "owner_1",
    locale,
    revision,
    body: bytes,
    etag: `"${revision}"`,
    createdAt: "2026-07-21T00:00:00.000Z",
    ...overrides
  };
}

function createPublication(options) {
  return {
    ownerId: options.ownerId ?? "owner_1",
    handle: "postmelee",
    publicationId: options.publicationId ?? "publication_1",
    representations: {
      en: {
        revision: options.en.revision,
        etag: options.en.etag
      },
      ko: {
        revision: options.ko.revision,
        etag: options.ko.etag
      }
    },
    publishedAt: "2026-07-21T00:01:00.000Z"
  };
}
