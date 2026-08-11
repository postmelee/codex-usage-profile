import assert from "node:assert/strict";
import test from "node:test";

import {
  PROFILE_MEDIA_STABLE_STATE_KINDS,
  createProfileMediaStableKey,
  createR2BindingProfileMediaStore
} from "../index.js";
import { createFakeR2Bucket } from "./_r2-binding-fake.js";
import {
  HANDLE,
  createRepresentations,
  createThemeRepresentations,
  publicationInput,
  putRepresentations,
  putThemeRepresentations,
  themePublicationInput
} from "./_r2-fixtures.js";

test("native R2 binding stores immutable revisions and locale publications", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const revisions = createRepresentations("v1");

  const first = await store.putRevision(revisions.en);
  const retry = await store.putRevision(revisions.en);
  await store.putRevision(revisions.ko);
  const published = await store.publishRevision(publicationInput(revisions, {
    expectedStorageEtag: null,
    publicationId: "publication_1"
  }));

  assert.equal(first.idempotent, false);
  assert.equal(retry.idempotent, true);
  assert.match(published.storageEtag, /^r2-\d+$/);
  assert.deepEqual(published.body, revisions.en.body);
  assert.deepEqual(
    (await store.getPublishedCard({ handle: HANDLE, locale: "ko" })).body,
    revisions.ko.body
  );

  const notModified = await store.getPublishedCard({
    handle: HANDLE,
    ifNoneMatch: revisions.ko.etag,
    locale: "ko"
  });
  assert.equal(notModified.notModified, true);
  assert.equal(notModified.body, null);

  const head = await store.getPublishedCard({
    handle: HANDLE,
    includeBody: false
  });
  assert.equal(head.body, null);
  assert.equal(head.etag, revisions.en.etag);
  assert.equal(bucket.deleteCalls, 0);
});

test("native R2 binding uses a conditional tombstone for unpublish", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const revisions = createRepresentations("v1");
  await putRepresentations(store, revisions);
  const published = await store.publishRevision(publicationInput(revisions, {
    expectedStorageEtag: null,
    publicationId: "publication_1"
  }));

  const removed = await store.unpublishCard({
    expectedStorageEtag: published.storageEtag,
    handle: HANDLE,
    tombstoneId: "tombstone_1",
    unpublishedAt: "2026-07-24T00:02:00.000Z"
  });
  const state = await store.inspectStableCard({ handle: HANDLE });

  assert.equal(removed.publicationId, "publication_1");
  assert.equal(await store.getPublishedCard({ handle: HANDLE }), null);
  assert.deepEqual(state, {
    handle: HANDLE,
    kind: PROFILE_MEDIA_STABLE_STATE_KINDS.UNPUBLISHED,
    stableKey: createProfileMediaStableKey({ handle: HANDLE }),
    storageEtag: removed.unpublishedStorageEtag,
    tombstoneId: "tombstone_1",
    unpublishedAt: "2026-07-24T00:02:00.000Z"
  });
  assert.notEqual(await store.getRevision(revisions.en), null);
  assert.equal(bucket.deleteCalls, 0);
});

test("native R2 binding republishes only over the observed tombstone", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const first = createRepresentations("v1");
  const next = createRepresentations("v2");
  await putRepresentations(store, first);
  await putRepresentations(store, next);
  const published = await store.publishRevision(publicationInput(first, {
    expectedStorageEtag: null,
    publicationId: "publication_1"
  }));
  const removed = await store.unpublishCard({
    expectedStorageEtag: published.storageEtag,
    handle: HANDLE,
    tombstoneId: "tombstone_1",
    unpublishedAt: "2026-07-24T00:02:00.000Z"
  });

  await assert.rejects(
    () => store.publishRevision(publicationInput(next, {
      expectedStorageEtag: published.storageEtag,
      publicationId: "publication_stale"
    })),
    (error) => error.code === "conflict"
  );
  const republished = await store.publishRevision(publicationInput(next, {
    expectedStorageEtag: removed.unpublishedStorageEtag,
    publicationId: "publication_2"
  }));

  assert.equal(republished.publicationId, "publication_2");
  assert.deepEqual(republished.body, next.en.body);
});

test("native R2 binding rejects immutable and stable precondition conflicts", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const revisions = createRepresentations("v1");
  await putRepresentations(store, revisions);
  const published = await store.publishRevision(publicationInput(revisions, {
    expectedStorageEtag: null,
    publicationId: "publication_1"
  }));

  await assert.rejects(
    () => store.putRevision({
      ...revisions.en,
      body: Buffer.from("different")
    }),
    (error) => error.code === "conflict"
  );
  await assert.rejects(
    () => store.unpublishCard({
      expectedStorageEtag: '"stale"',
      handle: HANDLE,
      tombstoneId: "tombstone_1",
      unpublishedAt: "2026-07-24T00:02:00.000Z"
    }),
    (error) => error.code === "conflict"
  );
  assert.equal(
    (await store.getPublishedCard({ handle: HANDLE })).storageEtag,
    published.storageEtag
  );
});

test("native R2 binding fails closed on malformed stable metadata", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const revisions = createRepresentations("v1");
  await putRepresentations(store, revisions);
  await store.publishRevision(publicationInput(revisions, {
    expectedStorageEtag: null,
    publicationId: "publication_1"
  }));
  bucket.objects.get(createProfileMediaStableKey({ handle: HANDLE }))
    .customMetadata = { kind: "publication", handle: HANDLE };

  await assert.rejects(
    () => store.getPublishedCard({ handle: HANDLE }),
    (error) => error.code === "invalid"
  );
});

test("native R2 binding rejects bytes that do not match application ETags", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const revisions = createRepresentations("v1");
  await putRepresentations(store, revisions);
  await store.publishRevision(publicationInput(revisions, {
    expectedStorageEtag: null,
    publicationId: "publication_1"
  }));
  bucket.objects.get(createProfileMediaStableKey({ handle: HANDLE })).body =
    Buffer.from("tampered");

  await assert.rejects(
    () => store.getPublishedCard({ handle: HANDLE }),
    (error) => error.code === "invalid"
  );
});

test("native R2 binding serves light only when it matches the dark authority", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const revisions = createThemeRepresentations("v4");
  await putThemeRepresentations(store, revisions);
  const published = await store.publishRevision(themePublicationInput(revisions, {
    expectedStorageEtag: null
  }));

  const dark = await store.getPublishedCard({ handle: HANDLE, theme: "dark" });
  const light = await store.getPublishedCard({
    handle: HANDLE,
    locale: "ko",
    theme: "light"
  });

  assert.equal(published.contractVersion, 4);
  assert.equal(dark.theme, "dark");
  assert.deepEqual(dark.body, revisions.dark.en.body);
  assert.equal(light.theme, "light");
  assert.deepEqual(light.body, revisions.light.ko.body);
  assert.equal(
    light.stableKey,
    createProfileMediaStableKey({ handle: HANDLE, theme: "light" })
  );
});

test("native R2 binding fails closed when the light object is missing or stale", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const revisions = createThemeRepresentations("v4");
  await putThemeRepresentations(store, revisions);
  await store.publishRevision(themePublicationInput(revisions, {
    expectedStorageEtag: null
  }));
  const lightKey = createProfileMediaStableKey({ handle: HANDLE, theme: "light" });

  bucket.objects.delete(lightKey);
  await assert.rejects(
    () => store.getPublishedCard({ handle: HANDLE, theme: "light" }),
    (error) => error.code === "not_found"
  );

  await store.publishRevision(themePublicationInput(revisions, {
    expectedStorageEtag: (await store.inspectStableCard({ handle: HANDLE })).storageEtag,
    publicationId: "publication_v4_retry"
  }));
  bucket.objects.get(lightKey).customMetadata["publication-id"] = "stale";
  await assert.rejects(
    () => store.getPublishedCard({ handle: HANDLE, theme: "light" }),
    (error) => error.code === "invalid"
  );
});

test("native R2 binding rejects light metadata drift", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const revisions = createThemeRepresentations("v4");
  await putThemeRepresentations(store, revisions);
  await store.publishRevision(themePublicationInput(revisions, {
    expectedStorageEtag: null
  }));
  const lightKey = createProfileMediaStableKey({ handle: HANDLE, theme: "light" });
  bucket.objects.get(lightKey).customMetadata["presentation-digest"] =
    revisions.light.en.revision;

  await assert.rejects(
    () => store.getPublishedCard({ handle: HANDLE, theme: "light" }),
    (error) => error.code === "invalid"
  );
});
