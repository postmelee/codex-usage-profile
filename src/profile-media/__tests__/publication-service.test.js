import assert from "node:assert/strict";
import test from "node:test";

import {
  PROFILE_BACKEND_ERROR_CODES,
  PROFILE_VISIBILITY,
  createMemoryProfileBackendStore
} from "../../profile-backend/index.js";
import { createProfileCardService } from "../../profile-card/service.js";
import { sampleAccountUsageReadResult } from "../../profile-card/fixtures/sample-account-usage.js";
import {
  createMemoryProfileMediaStore,
  createProfileMediaStoreError,
  createProfilePublicationService
} from "../index.js";

test("publishes both locale revisions before exposing public visibility", async () => {
  const fixture = createFixture();

  const result = await fixture.service.updateVisibility({
    ownerId: OWNER.id,
    visibility: PROFILE_VISIBILITY.PUBLIC
  });
  const english = await fixture.mediaStore.getPublishedCard({
    handle: OWNER.handle,
    locale: "en"
  });
  const korean = await fixture.mediaStore.getPublishedCard({
    handle: OWNER.handle,
    locale: "ko"
  });

  assert.equal(result.operation, "publish");
  assert.equal(result.idempotent, false);
  assert.equal(result.visibility, PROFILE_VISIBILITY.PUBLIC);
  assert.equal(result.owner.visibility, PROFILE_VISIBILITY.PUBLIC);
  assert.equal(result.usageRecord.visibility, PROFILE_VISIBILITY.PUBLIC);
  assert.equal(fixture.store.getLatestSnapshotByOwnerId(OWNER.id).visibility,
    PROFILE_VISIBILITY.PUBLIC);
  const lifetimeTokens = sampleAccountUsageReadResult.summary.lifetimeTokens;
  assert.deepEqual(english.body, Buffer.from(`png:en:${lifetimeTokens}`));
  assert.deepEqual(korean.body, Buffer.from(`png:ko:${lifetimeTokens}`));
  assert.equal(english.publicationId, korean.publicationId);
  assert.equal(english.representations.en.etag, english.etag);
  assert.equal(english.representations.ko.etag, korean.etag);
});

test("keeps an exact public request idempotent and repairs a missing stable publication", async () => {
  const fixture = createFixture();
  const first = await fixture.service.publishOwnerCard({ ownerId: OWNER.id });
  const repeated = await fixture.service.publishOwnerCard({ ownerId: OWNER.id });

  assert.equal(repeated.idempotent, true);
  assert.equal(repeated.publication.publicationId, first.publication.publicationId);

  await fixture.mediaStore.unpublishCard({ handle: OWNER.handle });
  const repaired = await fixture.service.publishOwnerCard({ ownerId: OWNER.id });

  assert.equal(repaired.idempotent, false);
  assert.notEqual(repaired.publication.publicationId, first.publication.publicationId);
  assert.notEqual(
    await fixture.mediaStore.getPublishedCard({ handle: OWNER.handle }),
    null
  );
});

test("repairs a public publication whose stable metadata cannot be read", async () => {
  const fixture = createFixture();
  const first = await fixture.service.publishOwnerCard({ ownerId: OWNER.id });
  let failInspection = true;
  const mediaStore = wrapMediaStore(fixture.mediaStore, {
    async getPublishedCard(options) {
      if (failInspection) {
        failInspection = false;
        throw createProfileMediaStoreError("unavailable", "invalid stable metadata");
      }
      return fixture.mediaStore.getPublishedCard(options);
    }
  });
  const service = createPublicationService({
    store: fixture.store,
    mediaStore,
    cardService: fixture.cardService,
    createId: (prefix) => `${prefix}_repair`
  });

  const repaired = await service.publishOwnerCard({ ownerId: OWNER.id });

  assert.equal(repaired.idempotent, false);
  assert.notEqual(repaired.publication.publicationId, first.publication.publicationId);
  assert.notEqual(await fixture.mediaStore.getPublishedCard({ handle: OWNER.handle }), null);
});

test("does not persist media while refresh observes a private owner", async () => {
  const baseMediaStore = createMemoryProfileMediaStore();
  const calls = [];
  const mediaStore = wrapMediaStore(baseMediaStore, {
    async putRevision(options) {
      calls.push(["putRevision", options.locale]);
      return baseMediaStore.putRevision(options);
    },
    async publishRevision(options) {
      calls.push(["publishRevision", options.handle]);
      return baseMediaStore.publishRevision(options);
    }
  });
  const fixture = createFixture({ mediaStore });

  const result = await fixture.service.refreshPublishedCard({ ownerId: OWNER.id });

  assert.equal(result.operation, "refresh_skipped");
  assert.equal(result.visibility, PROFILE_VISIBILITY.PRIVATE);
  assert.deepEqual(calls, []);
  assert.equal(await baseMediaStore.getPublishedCard({ handle: OWNER.handle }), null);
});

test("rolls back private visibility when an immutable write fails", async () => {
  const baseMediaStore = createMemoryProfileMediaStore();
  const mediaStore = wrapMediaStore(baseMediaStore, {
    async putRevision(options) {
      if (options.locale === "ko") {
        throw createProfileMediaStoreError("unavailable", "injected write failure");
      }
      return baseMediaStore.putRevision(options);
    }
  });
  const fixture = createFixture({ mediaStore });

  await assert.rejects(
    () => fixture.service.publishOwnerCard({ ownerId: OWNER.id }),
    (error) => {
      assert.equal(error.code, PROFILE_BACKEND_ERROR_CODES.MEDIA_UNAVAILABLE);
      assert.equal(error.status, 503);
      assert.deepEqual(error.details, {
        compensation: "not_needed",
        operation: "media_operation"
      });
      return true;
    }
  );
  assert.equal(fixture.store.getOwnerById(OWNER.id).visibility,
    PROFILE_VISIBILITY.PRIVATE);
  assert.equal(await baseMediaStore.getPublishedCard({ handle: OWNER.handle }), null);
});

test("removes a newly published stable object when the structured transaction fails", async () => {
  const fixture = createFixture();
  failTransactionAfterRunner(fixture.store);

  await assert.rejects(
    () => fixture.service.publishOwnerCard({ ownerId: OWNER.id }),
    (error) => {
      assert.equal(error.code, PROFILE_BACKEND_ERROR_CODES.MEDIA_UNAVAILABLE);
      assert.deepEqual(error.details, {
        compensation: "succeeded",
        operation: "publish"
      });
      return true;
    }
  );
  assert.equal(fixture.store.getOwnerById(OWNER.id).visibility,
    PROFILE_VISIBILITY.PRIVATE);
  assert.equal(await fixture.mediaStore.getPublishedCard({ handle: OWNER.handle }), null);
});

test("records failed publication compensation without exposing its cause", async () => {
  const baseMediaStore = createMemoryProfileMediaStore();
  const mediaStore = wrapMediaStore(baseMediaStore, {
    async unpublishCard() {
      throw createProfileMediaStoreError("unavailable", "secret endpoint detail");
    }
  });
  const fixture = createFixture({ mediaStore });
  failTransactionAfterRunner(fixture.store);

  await assert.rejects(
    () => fixture.service.publishOwnerCard({ ownerId: OWNER.id }),
    (error) => {
      assert.equal(error.message, "Profile media is temporarily unavailable");
      assert.deepEqual(error.details, {
        compensation: "failed",
        operation: "publish"
      });
      assert.equal(JSON.stringify(error).includes("secret endpoint detail"), false);
      return true;
    }
  );
  assert.notEqual(await baseMediaStore.getPublishedCard({ handle: OWNER.handle }), null);
});

test("restores the previous stable publication when a post-copy read fails", async () => {
  const fixture = createFixture();
  const first = await fixture.service.publishOwnerCard({ ownerId: OWNER.id });
  const previousBody = Buffer.from(first.publication.body);
  fixture.store.saveLatestUsage({
    ...fixture.store.getLatestUsageByOwnerId(OWNER.id),
    uploadedAt: "2026-07-22T02:00:00.000Z",
    usage: {
      ...sampleAccountUsageReadResult,
      summary: {
        ...sampleAccountUsageReadResult.summary,
        lifetimeTokens: sampleAccountUsageReadResult.summary.lifetimeTokens + 1_000_000_000
      }
    }
  });
  let failAfterCopy = true;
  const mediaStore = wrapMediaStore(fixture.mediaStore, {
    async publishRevision(options) {
      const published = await fixture.mediaStore.publishRevision(options);
      if (failAfterCopy) {
        failAfterCopy = false;
        throw createProfileMediaStoreError("unavailable", "post-copy read failed");
      }
      return published;
    }
  });
  const service = createPublicationService({
    store: fixture.store,
    mediaStore,
    cardService: fixture.cardService
  });

  await assert.rejects(
    () => service.refreshPublishedCard({ ownerId: OWNER.id }),
    (error) => {
      assert.deepEqual(error.details, {
        compensation: "succeeded",
        operation: "publish"
      });
      return true;
    }
  );
  const restored = await fixture.mediaStore.getPublishedCard({ handle: OWNER.handle });
  assert.equal(restored.publicationId, first.publication.publicationId);
  assert.deepEqual(restored.body, previousBody);
});

test("keeps public visibility when stable deletion fails", async () => {
  const fixture = createFixture();
  await fixture.service.publishOwnerCard({ ownerId: OWNER.id });
  const failingMediaStore = wrapMediaStore(fixture.mediaStore, {
    async unpublishCard() {
      throw createProfileMediaStoreError("unavailable", "injected delete failure");
    }
  });
  const failingService = createPublicationService({
    store: fixture.store,
    mediaStore: failingMediaStore,
    cardService: fixture.cardService
  });

  await assert.rejects(
    () => failingService.unpublishOwnerCard({ ownerId: OWNER.id }),
    (error) => error.code === PROFILE_BACKEND_ERROR_CODES.MEDIA_UNAVAILABLE
  );
  assert.equal(fixture.store.getOwnerById(OWNER.id).visibility,
    PROFILE_VISIBILITY.PUBLIC);
  assert.notEqual(
    await fixture.mediaStore.getPublishedCard({ handle: OWNER.handle }),
    null
  );
});

test("unpublishes only the stable object and reads the owner first in its transaction", async () => {
  const fixture = createFixture();
  await fixture.service.publishOwnerCard({ ownerId: OWNER.id });
  const published = await fixture.mediaStore.getPublishedCard({ handle: OWNER.handle });
  const calls = recordTransactionCalls(fixture.store);

  const result = await fixture.service.unpublishOwnerCard({ ownerId: OWNER.id });

  assert.equal(calls[0], "getOwnerById");
  assert.equal(result.visibility, PROFILE_VISIBILITY.PRIVATE);
  assert.equal(await fixture.mediaStore.getPublishedCard({ handle: OWNER.handle }), null);
  for (const locale of ["en", "ko"]) {
    const representation = published.representations[locale];
    assert.notEqual(await fixture.mediaStore.getRevision({
      ownerId: OWNER.id,
      locale,
      revision: representation.revision
    }), null);
  }
});

function createFixture(options = {}) {
  const store = options.store ?? createMemoryProfileBackendStore();
  store.saveOwner(OWNER);
  store.saveLatestUsage({
    ownerId: OWNER.id,
    handle: OWNER.handle,
    visibility: PROFILE_VISIBILITY.PRIVATE,
    capturedAt: "2026-07-22T00:00:00.000Z",
    uploadedAt: "2026-07-22T00:01:00.000Z",
    usage: sampleAccountUsageReadResult
  });
  store.saveLatestSnapshot({
    ownerId: OWNER.id,
    handle: OWNER.handle,
    visibility: PROFILE_VISIBILITY.PRIVATE,
    capturedAt: "2026-07-22T00:00:00.000Z",
    uploadedAt: "2026-07-22T00:01:00.000Z",
    schemaVersion: 1,
    snapshot: { schemaVersion: 1 }
  });

  const mediaStore = options.mediaStore ?? createMemoryProfileMediaStore();
  const cardService = createProfileCardService({
    store,
    fetchImpl: async () => { throw new Error("network disabled in test"); },
    renderPng: async (viewModel) => Buffer.from(
      `png:${viewModel.locale}:${viewModel.usage.summary.lifetimeTokens}`
    )
  });

  return {
    cardService,
    mediaStore,
    service: createPublicationService({ store, mediaStore, cardService }),
    store
  };
}

function createPublicationService(options) {
  let nextId = 1;
  return createProfilePublicationService({
    ...options,
    createId: options.createId ?? ((prefix) => `${prefix}_${nextId++}`),
    now: () => new Date("2026-07-22T01:00:00.000Z")
  });
}

function wrapMediaStore(base, overrides = {}) {
  return {
    getPublishedCard: (...args) => base.getPublishedCard(...args),
    getRevision: (...args) => base.getRevision(...args),
    publishRevision: (...args) => base.publishRevision(...args),
    putRevision: (...args) => base.putRevision(...args),
    unpublishCard: (...args) => base.unpublishCard(...args),
    ...overrides
  };
}

function failTransactionAfterRunner(store) {
  const transaction = store.transaction.bind(store);
  store.transaction = (runner) => transaction(async (tx) => {
    await runner(tx);
    throw new Error("injected structured commit failure");
  });
}

function recordTransactionCalls(store) {
  const calls = [];
  const transaction = store.transaction.bind(store);
  store.transaction = (runner) => transaction((tx) => runner(new Proxy(tx, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;
      return (...args) => {
        calls.push(String(property));
        return value.apply(target, args);
      };
    }
  })));
  return calls;
}

const OWNER = Object.freeze({
  id: "owner_1",
  authProvider: "github",
  providerUserId: "1",
  githubLogin: "postmelee",
  displayName: "Post Melee",
  avatarUrl: "https://avatars.githubusercontent.com/u/12345?v=4",
  handle: "postmelee",
  visibility: PROFILE_VISIBILITY.PRIVATE,
  createdAt: "2026-07-22T00:00:00.000Z",
  updatedAt: "2026-07-22T00:00:00.000Z"
});
