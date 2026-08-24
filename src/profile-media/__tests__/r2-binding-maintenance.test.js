import assert from "node:assert/strict";
import test from "node:test";

import {
  createProfileMediaRevisionKey,
  createProfileMediaStableKey,
  createR2BindingProfileMediaMaintenance,
  createR2BindingProfileMediaStore
} from "../index.js";
import { createFakeR2Bucket } from "./_r2-binding-fake.js";
import {
  HANDLE,
  OWNER_ID,
  createRepresentations,
  createThemeRepresentations,
  publicationInput,
  putRepresentations,
  putThemeRepresentations,
  themePublicationInput
} from "./_r2-fixtures.js";

test("R2 owner manifest counts and protects every v4 theme object", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const maintenance = createR2BindingProfileMediaMaintenance({
    bucket,
    mediaStore: store,
    now: () => NOW
  });
  const revisions = createThemeRepresentations("theme-manifest");
  await putThemeRepresentations(store, revisions);
  await store.publishRevision(themePublicationInput(revisions, {
    canonicalLocale: "ko",
    canonicalTheme: "light",
    expectedStorageEtag: null
  }));

  const ownerPlan = await maintenance.planOwnerDeletion(OWNER_SCOPE);
  const retention = await maintenance.planRetention({
    now: new Date("2027-07-24T00:00:00.000Z"),
    recentRevisions: 1,
    retentionDays: 90
  });

  assert.equal(ownerPlan.summary.objectCount, 6);
  assert.equal(ownerPlan.manifest.revisions.length, 4);
  assert.equal(ownerPlan.manifest.stableObjectKeys.length, 2);
  assert.equal(ownerPlan.manifest.stable.publication.contractVersion, 4);
  assert.equal(ownerPlan.manifest.stable.publication.canonicalLocale, "ko");
  assert.equal(ownerPlan.manifest.stable.publication.canonicalTheme, "light");
  assert.equal(
    ownerPlan.manifest.stable.publication.representations.light.ko.theme,
    "light"
  );
  assert.deepEqual(retention.candidates, []);

  const stableKey = createProfileMediaStableKey({ handle: HANDLE });
  bucket.objects.get(stableKey).customMetadata["canonical-locale"] = "en";
  bucket.objects.get(stableKey).customMetadata["canonical-theme"] = "dark";
  const changedPlan = await maintenance.planOwnerDeletion(OWNER_SCOPE);
  assert.notEqual(
    changedPlan.summary.contentDigest,
    ownerPlan.summary.contentDigest
  );
});

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

test("R2 owner revision deletion is bounded and resumes from the actual manifest", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const revisionSets = Array.from({ length: 5 }, (_, index) =>
    createRepresentations(`batch-${index + 1}`)
  );
  for (const revisions of revisionSets) {
    await putRepresentations(store, revisions);
  }
  const published = await store.publishRevision(publicationInput(
    revisionSets[0],
    { expectedStorageEtag: null }
  ));
  const maintenance = createR2BindingProfileMediaMaintenance({
    bucket,
    mediaStore: store,
    now: () => NOW
  });
  await maintenance.tombstoneOwnerPublication({
    ...OWNER_SCOPE,
    apply: true,
    expectedStorageEtag: published.storageEtag,
    tombstoneId: "maintenance_batch",
    unpublishedAt: NOW
  });

  const initial = await maintenance.planOwnerDeletion(OWNER_SCOPE);
  assert.equal(initial.manifest.revisions.length, 10);
  const first = await maintenance.deleteOwnerRevisionBatch({
    ...OWNER_SCOPE,
    apply: true,
    expectedContentDigest: initial.summary.contentDigest,
    expectedObjectCount: initial.summary.objectCount
  });
  assert.equal(first.deletedRevisionCount, 8);
  assert.equal(first.remainingRevisionCount, 2);
  assert.equal(first.plan.manifest.revisions.length, 2);
  assert.equal(bucket.deleteCalls, 8);

  const second = await maintenance.deleteOwnerRevisionBatch({
    ...OWNER_SCOPE,
    apply: true,
    expectedContentDigest: first.plan.summary.contentDigest,
    expectedObjectCount: first.plan.summary.objectCount
  });
  assert.equal(second.deletedRevisionCount, 2);
  assert.equal(second.remainingRevisionCount, 0);
  assert.equal(bucket.deleteCalls, 10);
  await assert.rejects(
    maintenance.deleteOwnerRevisionBatch({
      ...OWNER_SCOPE,
      apply: true,
      batchSize: 33,
      expectedContentDigest: second.plan.summary.contentDigest,
      expectedObjectCount: second.plan.summary.objectCount
    }),
    /batchSize must be an integer from 1 to 32/
  );
});

test("R2 owner revision deletion replans safely after a partial batch failure", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const revisionSets = Array.from({ length: 3 }, (_, index) =>
    createRepresentations(`partial-${index + 1}`)
  );
  for (const revisions of revisionSets) {
    await putRepresentations(store, revisions);
  }
  const published = await store.publishRevision(publicationInput(
    revisionSets[0],
    { expectedStorageEtag: null }
  ));
  let attempts = 0;
  const interrupted = createR2BindingProfileMediaMaintenance({
    bucket,
    mediaStore: store,
    beforeDeleteRevision() {
      attempts += 1;
      if (attempts === 3) throw new Error("injected batch interruption");
    }
  });
  await interrupted.tombstoneOwnerPublication({
    ...OWNER_SCOPE,
    apply: true,
    expectedStorageEtag: published.storageEtag,
    tombstoneId: "maintenance_partial",
    unpublishedAt: NOW
  });
  const initial = await interrupted.planOwnerDeletion(OWNER_SCOPE);
  await assert.rejects(
    interrupted.deleteOwnerRevisionBatch({
      ...OWNER_SCOPE,
      apply: true,
      expectedContentDigest: initial.summary.contentDigest,
      expectedObjectCount: initial.summary.objectCount
    }),
    /injected batch interruption/
  );

  const resumed = createR2BindingProfileMediaMaintenance({
    bucket,
    mediaStore: store
  });
  const current = await resumed.planOwnerDeletion(OWNER_SCOPE);
  assert.equal(current.manifest.revisions.length, 4);
  const result = await resumed.deleteOwnerRevisionBatch({
    ...OWNER_SCOPE,
    apply: true,
    batchSize: 2,
    expectedContentDigest: current.summary.contentDigest,
    expectedObjectCount: current.summary.objectCount
  });
  assert.equal(result.deletedRevisionCount, 2);
  assert.equal(result.remainingRevisionCount, 2);
  assert.equal(bucket.deleteCalls, 4);
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

test("R2 revision batch rejects an immutable object ETag change", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const revisions = createRepresentations("immutable-change");
  await putRepresentations(store, revisions);
  const published = await store.publishRevision(publicationInput(revisions, {
    expectedStorageEtag: null
  }));
  let changed = false;
  const maintenance = createR2BindingProfileMediaMaintenance({
    bucket,
    mediaStore: store,
    beforeDeleteRevision({ revision }) {
      if (changed) return;
      changed = true;
      bucket.objects.get(revision.key).etag = "changed-storage-etag";
    }
  });
  await maintenance.tombstoneOwnerPublication({
    ...OWNER_SCOPE,
    apply: true,
    expectedStorageEtag: published.storageEtag,
    tombstoneId: "maintenance_immutable_change",
    unpublishedAt: NOW
  });
  const plan = await maintenance.planOwnerDeletion(OWNER_SCOPE);

  await assert.rejects(
    maintenance.deleteOwnerRevisionBatch({
      ...OWNER_SCOPE,
      apply: true,
      expectedContentDigest: plan.summary.contentDigest,
      expectedObjectCount: plan.summary.objectCount
    }),
    /immutable revision changed before deletion/
  );
  assert.equal(bucket.deleteCalls, 0);
});

test("R2 revision batch fails when a deleted object remains readable", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const revisions = createRepresentations("delete-remains");
  await putRepresentations(store, revisions);
  const published = await store.publishRevision(publicationInput(revisions, {
    expectedStorageEtag: null
  }));
  const nativeDelete = bucket.delete.bind(bucket);
  bucket.delete = async (key) => {
    const object = bucket.objects.get(key);
    await nativeDelete(key);
    bucket.objects.set(key, object);
  };
  const maintenance = createR2BindingProfileMediaMaintenance({
    bucket,
    mediaStore: store
  });
  await maintenance.tombstoneOwnerPublication({
    ...OWNER_SCOPE,
    apply: true,
    expectedStorageEtag: published.storageEtag,
    tombstoneId: "maintenance_delete_remains",
    unpublishedAt: NOW
  });
  const plan = await maintenance.planOwnerDeletion(OWNER_SCOPE);

  await assert.rejects(
    maintenance.deleteOwnerRevisionBatch({
      ...OWNER_SCOPE,
      apply: true,
      expectedContentDigest: plan.summary.contentDigest,
      expectedObjectCount: plan.summary.objectCount
    }),
    /immutable revision remained after deletion/
  );
  assert.equal(bucket.deleteCalls, 1);
  assert.equal(
    (await maintenance.planOwnerDeletion(OWNER_SCOPE)).manifest.revisions.length,
    2
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

test("R2 maintenance preserves canonical selection across tombstone and repair", async () => {
  const bucket = createFakeR2Bucket();
  const store = createR2BindingProfileMediaStore({ bucket });
  const revisions = createThemeRepresentations("repair-canonical");
  await putThemeRepresentations(store, revisions);
  const published = await store.publishRevision(themePublicationInput(revisions, {
    canonicalLocale: "ko",
    canonicalTheme: "light",
    expectedStorageEtag: null,
    publicationId: "publication_canonical"
  }));
  const maintenance = createR2BindingProfileMediaMaintenance({
    bucket,
    mediaStore: store
  });
  const tombstoned = await maintenance.tombstoneOwnerPublication({
    ...OWNER_SCOPE,
    apply: true,
    expectedStorageEtag: published.storageEtag,
    tombstoneId: "maintenance_canonical",
    unpublishedAt: NOW
  });

  assert.equal(tombstoned.previousPublication.canonicalLocale, "ko");
  assert.equal(tombstoned.previousPublication.canonicalTheme, "light");

  await assert.rejects(
    () => maintenance.repairPublication({
      ...OWNER_SCOPE,
      apply: true,
      expectedStorageEtag: tombstoned.stable.storageEtag,
      publication: themePublicationInput(revisions, {
        publicationId: "publication_missing_canonical_pair"
      })
    }),
    /requires canonicalLocale and canonicalTheme/
  );

  const repaired = await maintenance.repairPublication({
    ...OWNER_SCOPE,
    apply: true,
    expectedStorageEtag: tombstoned.stable.storageEtag,
    publication: themePublicationInput(revisions, {
      canonicalLocale: "ko",
      canonicalTheme: "light",
      publicationId: "publication_canonical_repaired"
    })
  });
  assert.equal(repaired.publication.canonicalLocale, "ko");
  assert.equal(repaired.publication.canonicalTheme, "light");
  assert.equal(repaired.stable.publication.canonicalLocale, "ko");
  assert.equal(repaired.stable.publication.canonicalTheme, "light");
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
