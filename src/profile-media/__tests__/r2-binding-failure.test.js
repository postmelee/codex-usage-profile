import assert from "node:assert/strict";
import test from "node:test";

import {
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

test("native R2 binding maps revision and stable PUT failures to unavailable", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const revisions = createRepresentations("v1");

  bucket.failNext("put");
  await assert.rejects(
    () => store.putRevision(revisions.en),
    (error) => error.code === "unavailable"
  );

  await putRepresentations(store, revisions);
  bucket.failNext("put");
  await assert.rejects(
    () => store.publishRevision(publicationInput(revisions, {
      expectedStorageEtag: null,
      publicationId: "publication_1"
    })),
    (error) => error.code === "unavailable"
  );
  assert.equal(await store.getPublishedCard({ handle: HANDLE }), null);
});

test("failed stable replacement preserves the prior R2 publication", async () => {
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

  bucket.failNext("put");
  await assert.rejects(
    () => store.publishRevision(publicationInput(next, {
      expectedStorageEtag: published.storageEtag,
      publicationId: "publication_2"
    })),
    (error) => error.code === "unavailable"
  );

  const current = await store.getPublishedCard({ handle: HANDLE });
  assert.equal(current.publicationId, "publication_1");
  assert.deepEqual(current.body, first.en.body);
});

test("failed tombstone PUT keeps the prior R2 publication public", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const revisions = createRepresentations("v1");
  await putRepresentations(store, revisions);
  const published = await store.publishRevision(publicationInput(revisions, {
    expectedStorageEtag: null,
    publicationId: "publication_1"
  }));

  bucket.failNext("put");
  await assert.rejects(
    () => store.unpublishCard({
      expectedStorageEtag: published.storageEtag,
      handle: HANDLE,
      tombstoneId: "tombstone_1",
      unpublishedAt: "2026-07-24T00:02:00.000Z"
    }),
    (error) => error.code === "unavailable"
  );

  assert.equal(
    (await store.getPublishedCard({ handle: HANDLE })).publicationId,
    "publication_1"
  );
});

test("stable R2 read retries one conditional race and returns one publication", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const first = createRepresentations("v1");
  const next = createRepresentations("v2");
  await putRepresentations(store, first);
  await putRepresentations(store, next);
  const firstPublication = await store.publishRevision(publicationInput(first, {
    expectedStorageEtag: null,
    publicationId: "publication_1"
  }));
  const nextPublication = await store.publishRevision(publicationInput(next, {
    expectedStorageEtag: firstPublication.storageEtag,
    publicationId: "publication_2"
  }));
  const stableKey = createProfileMediaStableKey({ handle: HANDLE });
  const nextObject = cloneStoredObject(bucket.objects.get(stableKey));
  await store.publishRevision(publicationInput(first, {
    expectedStorageEtag: nextPublication.storageEtag,
    publicationId: "publication_3"
  }));
  bucket.beforeNext("get", () => {
    bucket.objects.set(stableKey, cloneStoredObject(nextObject));
  });

  const current = await store.getPublishedCard({ handle: HANDLE });

  assert.equal(current.publicationId, "publication_2");
  assert.deepEqual(current.body, next.en.body);
});

test("repeated stable R2 read races fail unavailable", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const first = createRepresentations("v1");
  const next = createRepresentations("v2");
  await putRepresentations(store, first);
  await putRepresentations(store, next);
  const firstPublication = await store.publishRevision(publicationInput(first, {
    expectedStorageEtag: null,
    publicationId: "publication_1"
  }));
  await store.publishRevision(publicationInput(next, {
    expectedStorageEtag: firstPublication.storageEtag,
    publicationId: "publication_2"
  }));
  const stableKey = createProfileMediaStableKey({ handle: HANDLE });
  const nextObject = cloneStoredObject(bucket.objects.get(stableKey));
  await store.publishRevision(publicationInput(first, {
    expectedStorageEtag: nextObject.etag,
    publicationId: "publication_3"
  }));
  const firstObject = cloneStoredObject(bucket.objects.get(stableKey));
  bucket.beforeNext("get", () => {
    bucket.objects.set(stableKey, cloneStoredObject(nextObject));
  });
  bucket.beforeNext("get", () => {
    bucket.objects.set(stableKey, cloneStoredObject(firstObject));
  });

  await assert.rejects(
    () => store.getPublishedCard({ handle: HANDLE }),
    (error) =>
      error.code === "unavailable" &&
      error.message === "stable media changed repeatedly during read"
  );
});

test("light R2 HEAD to GET race retries against the dark authority", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const first = createThemeRepresentations("v4-first");
  const next = createThemeRepresentations("v4-next");
  await putThemeRepresentations(store, first);
  await putThemeRepresentations(store, next);
  const firstPublication = await store.publishRevision(themePublicationInput(first, {
    expectedStorageEtag: null,
    publicationId: "publication_first"
  }));
  await store.publishRevision(themePublicationInput(next, {
    expectedStorageEtag: firstPublication.storageEtag,
    publicationId: "publication_next"
  }));
  const lightKey = createProfileMediaStableKey({ handle: HANDLE, theme: "light" });
  const nextLight = cloneStoredObject(bucket.objects.get(lightKey));
  const nextAuthority = cloneStoredObject(
    bucket.objects.get(createProfileMediaStableKey({ handle: HANDLE }))
  );
  const current = await store.inspectStableCard({ handle: HANDLE });
  await store.publishRevision(themePublicationInput(first, {
    expectedStorageEtag: current.storageEtag,
    publicationId: "publication_third"
  }));
  bucket.beforeNext("get", () => {
    bucket.objects.set(lightKey, cloneStoredObject(nextLight));
    bucket.objects.set(
      createProfileMediaStableKey({ handle: HANDLE }),
      cloneStoredObject(nextAuthority)
    );
  });

  const read = await store.getPublishedCard({ handle: HANDLE, theme: "light" });
  assert.equal(read.publicationId, "publication_next");
  assert.deepEqual(read.body, next.light.en.body);
});

test("R2 stable read rejects canonical authority drift with the same storage ETag", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const revisions = createThemeRepresentations("canonical-drift");
  await putThemeRepresentations(store, revisions);
  await store.publishRevision(themePublicationInput(revisions, {
    expectedStorageEtag: null
  }));
  const stableKey = createProfileMediaStableKey({ handle: HANDLE });
  bucket.beforeNext("get", () => {
    bucket.objects.get(stableKey).customMetadata["canonical-theme"] = "light";
  });

  await assert.rejects(
    () => store.getPublishedCard({ handle: HANDLE }),
    (error) =>
      error.code === "unavailable" &&
      error.message === "stable media changed repeatedly during read"
  );
});

function cloneStoredObject(object) {
  return {
    ...object,
    body: Buffer.from(object.body),
    customMetadata: { ...object.customMetadata },
    httpMetadata: { ...object.httpMetadata },
    uploaded: new Date(object.uploaded)
  };
}
