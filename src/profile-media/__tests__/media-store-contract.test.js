import assert from "node:assert/strict";
import test from "node:test";

import {
  PROFILE_MEDIA_CACHE_CONTROL,
  PROFILE_MEDIA_CONTENT_TYPE,
  PROFILE_MEDIA_STORE_CONTRACT_VERSION,
  assertProfileMediaStoreContract,
  createMemoryProfileMediaStore,
  createProfileMediaObjectKeys
} from "../media-store-contract.js";

test("media contract creates stable and immutable owner card keys", () => {
  assert.equal(PROFILE_MEDIA_STORE_CONTRACT_VERSION, 1);
  assert.deepEqual(createProfileMediaObjectKeys({
    ownerId: "owner_1",
    revision: "usage_abc123"
  }), {
    revisionKey: "cards/v1/owners/owner_1/revisions/usage_abc123.png",
    stableKey: "cards/v1/owners/owner_1/card.png"
  });
  assert.throws(
    () => createProfileMediaObjectKeys({ ownerId: "../owner", revision: "revision_1" }),
    /safe object-key segment/
  );
});

test("media contract preserves immutable revisions and publishes one stable card", async () => {
  const store = assertProfileMediaStoreContract(createMemoryProfileMediaStore());
  const first = await store.putRevision(createRevision());
  const retry = await store.putRevision(createRevision());
  const published = await store.publishRevision({
    ownerId: "owner_1",
    revision: "usage_abc123",
    publishedAt: "2026-07-21T00:01:00.000Z"
  });

  assert.equal(first.idempotent, false);
  assert.equal(retry.idempotent, true);
  assert.equal(published.stableKey, "cards/v1/owners/owner_1/card.png");
  assert.equal(published.contentType, PROFILE_MEDIA_CONTENT_TYPE);
  assert.equal(published.cacheControl, PROFILE_MEDIA_CACHE_CONTROL);
  assert.deepEqual((await store.getPublishedCard({ ownerId: "owner_1" })).body, Buffer.from("png"));

  await assert.rejects(
    () => store.putRevision(createRevision({ body: Buffer.from("changed") })),
    (error) => error.code === "conflict"
  );
});

test("unpublish removes only the stable card and retains immutable revisions", async () => {
  const store = createMemoryProfileMediaStore();
  await store.putRevision(createRevision());
  await store.publishRevision({
    ownerId: "owner_1",
    revision: "usage_abc123",
    publishedAt: "2026-07-21T00:01:00.000Z"
  });

  const removed = await store.unpublishCard({ ownerId: "owner_1" });

  assert.equal(removed.revision, "usage_abc123");
  assert.equal(await store.getPublishedCard({ ownerId: "owner_1" }), null);
  assert.equal(
    (await store.getRevision({ ownerId: "owner_1", revision: "usage_abc123" })).etag,
    '"etag-1"'
  );
  await assert.rejects(
    () => store.publishRevision({ ownerId: "owner_2", revision: "missing" }),
    (error) => error.code === "not_found"
  );
});

function createRevision(overrides = {}) {
  return {
    ownerId: "owner_1",
    revision: "usage_abc123",
    body: Buffer.from("png"),
    etag: '"etag-1"',
    createdAt: "2026-07-21T00:00:00.000Z",
    ...overrides
  };
}
