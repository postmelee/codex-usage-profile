import assert from "node:assert/strict";
import test from "node:test";

import {
  PROFILE_VISIBILITY,
  createMemoryProfileBackendStore
} from "../../profile-backend/index.js";
import { sampleAccountUsageReadResult } from "../../profile-card/fixtures/sample-account-usage.js";
import { createProfileCardService } from "../../profile-card/service.js";
import {
  createProfilePublicationService,
  createR2BindingProfileMediaStore
} from "../index.js";
import { createFakeR2Bucket } from "./_r2-binding-fake.js";

test("failed publish CAS never tombstones a newer R2 publication", async () => {
  const fixture = createFixture();
  const gate = createGate();
  const failingStore = failVisibilityAfterGate(fixture.store, gate);
  const firstService = createService(fixture, {
    idLabel: "first",
    store: failingStore
  });
  const newerService = createService(fixture, { idLabel: "newer" });

  const firstPromise = firstService.publishOwnerCard({ ownerId: OWNER.id });
  await gate.reached.promise;
  const newer = await newerService.publishOwnerCard({ ownerId: OWNER.id });
  gate.release.resolve();

  await assert.rejects(
    () => firstPromise,
    (error) => {
      assert.deepEqual(error.details, {
        compensation: "superseded",
        operation: "publish"
      });
      return true;
    }
  );
  const current = await fixture.mediaStore.getPublishedCard({
    handle: OWNER.handle
  });
  assert.equal(current.publicationId, newer.publication.publicationId);
  assert.equal(fixture.bucket.deleteCalls, 0);
  assert.equal(
    fixture.store.getOwnerById(OWNER.id).visibility,
    PROFILE_VISIBILITY.PUBLIC
  );
});

test("failed unpublish CAS never restores over a newer R2 publication", async () => {
  const fixture = createFixture();
  const initial = await createService(fixture, {
    idLabel: "initial"
  }).publishOwnerCard({ ownerId: OWNER.id });
  const gate = createGate();
  const failingStore = failVisibilityAfterGate(fixture.store, gate);
  const unpublishService = createService(fixture, {
    idLabel: "unpublish",
    store: failingStore
  });
  const newerService = createService(fixture, { idLabel: "newer" });

  const unpublishPromise = unpublishService.unpublishOwnerCard({
    ownerId: OWNER.id
  });
  await gate.reached.promise;
  const newer = await newerService.publishOwnerCard({ ownerId: OWNER.id });
  gate.release.resolve();

  await assert.rejects(
    () => unpublishPromise,
    (error) => {
      assert.deepEqual(error.details, {
        compensation: "superseded",
        operation: "unpublish"
      });
      return true;
    }
  );
  const current = await fixture.mediaStore.getPublishedCard({
    handle: OWNER.handle
  });
  assert.notEqual(current.publicationId, initial.publication.publicationId);
  assert.equal(current.publicationId, newer.publication.publicationId);
  assert.equal(fixture.bucket.deleteCalls, 0);
});

test("failed private visibility CAS restores the prior R2 publication by tombstone ETag", async () => {
  const fixture = createFixture();
  const initial = await createService(fixture, {
    idLabel: "initial"
  }).publishOwnerCard({ ownerId: OWNER.id });
  const gate = createGate();
  const failingStore = failVisibilityAfterGate(fixture.store, gate);
  const service = createService(fixture, {
    idLabel: "unpublish",
    store: failingStore
  });

  const promise = service.unpublishOwnerCard({ ownerId: OWNER.id });
  await gate.reached.promise;
  gate.release.resolve();

  await assert.rejects(
    () => promise,
    (error) => {
      assert.deepEqual(error.details, {
        compensation: "succeeded",
        operation: "unpublish"
      });
      return true;
    }
  );
  const current = await fixture.mediaStore.getPublishedCard({
    handle: OWNER.handle
  });
  assert.equal(current.publicationId, initial.publication.publicationId);
  assert.equal(
    fixture.store.getOwnerById(OWNER.id).visibility,
    PROFILE_VISIBILITY.PUBLIC
  );
});

function createFixture() {
  const store = createMemoryProfileBackendStore();
  store.saveOwner(OWNER);
  store.saveLatestUsage({
    ownerId: OWNER.id,
    handle: OWNER.handle,
    visibility: PROFILE_VISIBILITY.PRIVATE,
    capturedAt: "2026-07-24T00:00:00.000Z",
    uploadedAt: "2026-07-24T00:01:00.000Z",
    usage: sampleAccountUsageReadResult
  });
  const bucket = createFakeR2Bucket();
  const mediaStore = createR2BindingProfileMediaStore({ bucket });
  const cardService = createProfileCardService({
    store,
    fetchImpl: async () => {
      throw new Error("network disabled in test");
    },
    renderPng: async (viewModel) => Buffer.from(
      `png:${viewModel.locale}:${viewModel.usage.summary.lifetimeTokens}`
    )
  });
  return { bucket, cardService, mediaStore, store };
}

function createService(fixture, options = {}) {
  let sequence = 1;
  return createProfilePublicationService({
    cardService: fixture.cardService,
    createId: (prefix) =>
      `${prefix}_${options.idLabel ?? "fixture"}_${sequence++}`,
    mediaStore: fixture.mediaStore,
    now: () => new Date("2026-07-24T01:00:00.000Z"),
    store: options.store ?? fixture.store
  });
}

function failVisibilityAfterGate(store, gate) {
  const atomic = {
    ...store.atomic,
    async updateVisibility() {
      gate.reached.resolve();
      await gate.release.promise;
      throw new Error("injected visibility CAS failure");
    }
  };
  return new Proxy(store, {
    get(target, property, receiver) {
      if (property === "atomic") return atomic;
      return Reflect.get(target, property, receiver);
    }
  });
}

function createGate() {
  return {
    reached: deferred(),
    release: deferred()
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

const OWNER = Object.freeze({
  id: "owner_1",
  authProvider: "github",
  providerUserId: "1",
  githubLogin: "postmelee",
  displayName: "Post Melee",
  handle: "postmelee",
  visibility: PROFILE_VISIBILITY.PRIVATE,
  createdAt: "2026-07-24T00:00:00.000Z",
  updatedAt: "2026-07-24T00:00:00.000Z"
});
