import assert from "node:assert/strict";
import test from "node:test";

import {
  PROFILE_MEDIA_CACHE_CONTROL,
  PROFILE_MEDIA_CONTENT_TYPE,
  createMemoryProfileMediaStore,
  createProfileMediaRevisionDigest,
  createProfileMediaSocialKey,
  normalizeProfileMediaSocialRecord,
  supportsProfileMediaSocialCard
} from "../media-store-contract.js";

const HANDLE = "postmelee";
const OWNER_ID = "owner_github_1";
const PUBLICATION_ID = "profile_media_1";
const CREATED_AT = "2026-06-11T09:05:00.000Z";
const PRESENTATION_DIGEST = createProfileMediaRevisionDigest(
  Buffer.from("presentation")
);
const BODY = Buffer.from("social-card-bytes");

function createInput(overrides = {}) {
  const body = overrides.body ?? BODY;
  const revision = createProfileMediaRevisionDigest(body);
  return {
    body,
    contentType: PROFILE_MEDIA_CONTENT_TYPE,
    createdAt: CREATED_AT,
    etag: `"${revision}"`,
    handle: HANDLE,
    ownerId: OWNER_ID,
    presentationDigest: PRESENTATION_DIGEST,
    publicationId: PUBLICATION_ID,
    revision,
    ...overrides
  };
}

test("uses one stable social key per handle", () => {
  assert.equal(
    createProfileMediaSocialKey({ handle: HANDLE }),
    "cards/v2/public/postmelee/social.png"
  );
  assert.equal(
    createProfileMediaSocialKey({ handle: "foo-bar" }),
    "cards/v2/public/foo-bar/social.png"
  );
  assert.throws(() => createProfileMediaSocialKey({ handle: "Bad Handle" }), TypeError);
});

test("normalizes a social record with the shared media defaults", () => {
  const record = normalizeProfileMediaSocialRecord(createInput());

  assert.equal(record.handle, HANDLE);
  assert.equal(record.ownerId, OWNER_ID);
  assert.equal(record.publicationId, PUBLICATION_ID);
  assert.equal(record.presentationDigest, PRESENTATION_DIGEST);
  assert.equal(record.cacheControl, PROFILE_MEDIA_CACHE_CONTROL);
  assert.equal(record.contentType, PROFILE_MEDIA_CONTENT_TYPE);
  assert.equal(record.socialKey, "cards/v2/public/postmelee/social.png");
});

test("rejects social records that break the shared invariants", () => {
  assert.throws(
    () => normalizeProfileMediaSocialRecord(createInput({ etag: '"nope"' })),
    TypeError
  );
  assert.throws(
    () => normalizeProfileMediaSocialRecord(createInput({ presentationDigest: undefined })),
    TypeError
  );
  assert.throws(
    () => normalizeProfileMediaSocialRecord(createInput({ publicationId: "" })),
    TypeError
  );
  assert.throws(
    () => normalizeProfileMediaSocialRecord(
      createInput({ contentType: "image/jpeg" })
    ),
    TypeError
  );
});

test("memory store keeps exactly one social object per handle", async () => {
  const store = createMemoryProfileMediaStore();

  assert.equal(await store.getSocialCard({ handle: HANDLE }), null);

  await store.putSocialCard(createInput());
  const first = await store.getSocialCard({ handle: HANDLE });
  assert.equal(first.socialKey, "cards/v2/public/postmelee/social.png");
  assert.equal(Buffer.from(first.body).equals(BODY), true);

  const nextBody = Buffer.from("updated-social-bytes");
  await store.putSocialCard(createInput({ body: nextBody }));
  const second = await store.getSocialCard({ handle: HANDLE });

  assert.equal(Buffer.from(second.body).equals(nextBody), true);
  assert.notEqual(second.etag, first.etag);
});

test("memory store can omit the social body for metadata reads", async () => {
  const store = createMemoryProfileMediaStore();
  await store.putSocialCard(createInput());

  const metadata = await store.getSocialCard({
    handle: HANDLE,
    includeBody: false
  });

  assert.equal(metadata.body, undefined);
  assert.equal(typeof metadata.etag, "string");
});

test("memory store deletes the social object explicitly and on unpublish", async () => {
  const store = createMemoryProfileMediaStore();
  await store.putSocialCard(createInput());

  assert.deepEqual(
    await store.deleteSocialCard({ handle: HANDLE }),
    { deleted: true, handle: HANDLE }
  );
  assert.equal(await store.getSocialCard({ handle: HANDLE }), null);
  assert.deepEqual(
    await store.deleteSocialCard({ handle: HANDLE }),
    { deleted: false, handle: HANDLE }
  );
});

test("social support is an optional store capability", () => {
  assert.equal(supportsProfileMediaSocialCard(createMemoryProfileMediaStore()), true);
  assert.equal(supportsProfileMediaSocialCard({}), false);
  assert.equal(supportsProfileMediaSocialCard(null), false);
  assert.equal(
    supportsProfileMediaSocialCard({
      deleteSocialCard() {},
      getSocialCard() {}
    }),
    false
  );
});
