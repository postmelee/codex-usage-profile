import assert from "node:assert/strict";
import test from "node:test";

import {
  createProfileMediaRevisionKey,
  createR2BindingProfileMediaMaintenance,
  createR2BindingProfileMediaStore
} from "../index.js";
import { createFakeR2Bucket } from "./_r2-binding-fake.js";
import {
  HANDLE,
  OWNER_ID,
  createRepresentations,
  publicationInput,
  putRepresentations
} from "./_r2-fixtures.js";

test("R2 owner deletion requires a tombstone and exact revision manifest", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const maintenance = createR2BindingProfileMediaMaintenance({
    bucket,
    mediaStore: store,
    now: () => NOW
  });
  const revisions = createRepresentations("delete-v1");
  await putRepresentations(store, revisions);
  const published = await store.publishRevision(publicationInput(revisions, {
    expectedStorageEtag: null
  }));

  const publicPlan = await maintenance.planOwnerDeletion(OWNER_SCOPE);
  assert.equal(publicPlan.summary.objectCount, 3);
  assert.equal(publicPlan.manifest.revisions.length, 2);
  await assert.rejects(
    maintenance.deleteOwnerRevisions({
      ...OWNER_SCOPE,
      apply: true,
      expectedContentDigest: publicPlan.summary.contentDigest,
      expectedObjectCount: publicPlan.summary.objectCount
    }),
    /cannot be deleted while a publication is stable/
  );

  const tombstoned = await maintenance.tombstoneOwnerPublication({
    ...OWNER_SCOPE,
    apply: true,
    expectedStorageEtag: published.storageEtag,
    tombstoneId: "maintenance_tombstone",
    unpublishedAt: NOW
  });
  assert.equal(tombstoned.stable.kind, "unpublished");
  const deletePlan = await maintenance.planOwnerDeletion(OWNER_SCOPE);
  await maintenance.deleteOwnerRevisions({
    ...OWNER_SCOPE,
    apply: true,
    expectedContentDigest: deletePlan.summary.contentDigest,
    expectedObjectCount: deletePlan.summary.objectCount
  });

  const finalPlan = await maintenance.planOwnerDeletion(OWNER_SCOPE);
  assert.equal(finalPlan.manifest.revisions.length, 0);
  assert.equal(finalPlan.manifest.stable.kind, "unpublished");
  assert.equal(bucket.deleteCalls, 2);
});

test("R2 revision deletion stops before mutation when a newer publication wins", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const revisions = createRepresentations("race-v1");
  await putRepresentations(store, revisions);
  const published = await store.publishRevision(publicationInput(revisions, {
    expectedStorageEtag: null
  }));
  const maintenance = createR2BindingProfileMediaMaintenance({
    bucket,
    mediaStore: store,
    beforeDeleteRevision: async ({ plan }) => {
      const stable = await store.inspectStableCard({ handle: HANDLE });
      if (stable.kind === "unpublished") {
        await store.publishRevision(publicationInput(revisions, {
          expectedStorageEtag: stable.storageEtag,
          publicationId: "publication_newer"
        }));
      }
      assert.equal(plan.manifest.ownerId, OWNER_ID);
    }
  });
  await maintenance.tombstoneOwnerPublication({
    ...OWNER_SCOPE,
    apply: true,
    expectedStorageEtag: published.storageEtag,
    tombstoneId: "maintenance_tombstone",
    unpublishedAt: NOW
  });
  const plan = await maintenance.planOwnerDeletion(OWNER_SCOPE);

  await assert.rejects(
    maintenance.deleteOwnerRevisions({
      ...OWNER_SCOPE,
      apply: true,
      expectedContentDigest: plan.summary.contentDigest,
      expectedObjectCount: plan.summary.objectCount
    }),
    /stable publication changed/
  );
  assert.equal(bucket.deleteCalls, 0);
  assert.equal(
    (await store.inspectStableCard({ handle: HANDLE })).publication.publicationId,
    "publication_newer"
  );
});

test("R2 retention reuses referenced, recent, and age protections", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const first = createRepresentations("retention-first");
  const middle = createRepresentations("retention-middle");
  const recent = createRepresentations("retention-recent");
  await putRepresentations(store, first);
  await putRepresentations(store, middle);
  await putRepresentations(store, recent);
  ageRevisions(bucket, first, 200);
  ageRevisions(bucket, middle, 180);
  ageRevisions(bucket, recent, 10);
  await store.publishRevision(publicationInput(first, {
    expectedStorageEtag: null
  }));
  const maintenance = createR2BindingProfileMediaMaintenance({
    bucket,
    mediaStore: store,
    now: () => NOW
  });

  const plan = await maintenance.planRetention({
    now: NOW,
    recentRevisions: 1,
    retentionDays: 90
  });
  assert.deepEqual(
    plan.candidates.map((candidate) => candidate.key),
    [middle.en, middle.ko]
      .map((record) => createProfileMediaRevisionKey(record))
      .sort()
  );

  await maintenance.applyRetention({
    apply: true,
    expectedContentDigest: plan.summary.contentDigest,
    expectedObjectCount: plan.summary.objectCount,
    now: NOW,
    recentRevisions: 1,
    retentionDays: 90
  });
  assert.equal(await store.getRevision(middle.en), null);
  assert.equal(await store.getRevision(middle.ko), null);
  assert.notEqual(await store.getRevision(first.en), null);
  assert.notEqual(await store.getRevision(recent.en), null);
});

test("R2 repair requires exact application and storage revisions", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const revisions = createRepresentations("repair-v1");
  await putRepresentations(store, revisions);
  const published = await store.publishRevision(publicationInput(revisions, {
    expectedStorageEtag: null,
    publicationId: "publication_1"
  }));
  const maintenance = createR2BindingProfileMediaMaintenance({
    bucket,
    mediaStore: store
  });
  const tombstoned = await maintenance.tombstoneOwnerPublication({
    ...OWNER_SCOPE,
    apply: true,
    expectedStorageEtag: published.storageEtag,
    tombstoneId: "maintenance_tombstone",
    unpublishedAt: NOW
  });

  await assert.rejects(
    maintenance.repairPublication({
      ...OWNER_SCOPE,
      apply: true,
      expectedStorageEtag: published.storageEtag,
      publication: publicationInput(revisions)
    }),
    /changed before repair/
  );

  const repaired = await maintenance.repairPublication({
    ...OWNER_SCOPE,
    apply: true,
    expectedStorageEtag: tombstoned.stable.storageEtag,
    publication: publicationInput(revisions, {
      publicationId: "publication_repaired"
    })
  });
  assert.equal(repaired.publication.publicationId, "publication_repaired");
  assert.equal(repaired.publication.representations.en.etag, revisions.en.etag);
});

function ageRevisions(bucket, representations, days) {
  for (const record of Object.values(representations)) {
    bucket.objects.get(createProfileMediaRevisionKey(record)).uploaded = new Date(
      NOW.getTime() - days * 24 * 60 * 60 * 1_000
    );
  }
}

const OWNER_SCOPE = Object.freeze({
  handle: HANDLE,
  ownerId: OWNER_ID
});
const NOW = new Date("2026-07-24T00:00:00.000Z");
