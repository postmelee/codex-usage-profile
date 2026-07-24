import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import pg from "pg";

import {
  PROFILE_VISIBILITY,
  createMemoryProfileBackendStore
} from "../../profile-backend/index.js";
import { loadMigrations, migrateUp } from "../../profile-backend/postgres/migrate.js";
import { createPostgresProfileBackendStore } from "../../profile-backend/postgres/store.js";
import { sampleAccountUsageReadResult } from "../../profile-card/fixtures/sample-account-usage.js";
import { createProfileCardService } from "../../profile-card/service.js";
import {
  createMemoryProfileMediaStore,
  createProfilePublicationService
} from "../index.js";

test("memory fixture fences two concurrent publishes for one owner", async () => {
  const fixture = await createMemoryFixture();
  const gate = createGate();
  const service = createPublicationService(fixture, gateMediaPublication(
    fixture.mediaStore,
    gate
  ));

  const firstPromise = service.publishOwnerCard({ ownerId: OWNER_A.id });
  await gate.reached.promise;
  const secondPromise = service.publishOwnerCard({ ownerId: OWNER_A.id });
  await Promise.resolve();
  assert.equal(gate.calls, 1);

  gate.release.resolve();
  const results = await Promise.allSettled([firstPromise, secondPromise]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(
    results.find((result) => result.status === "rejected").reason.code,
    "media_unavailable"
  );
  assert.equal(
    fixture.store.getOwnerById(OWNER_A.id).visibility,
    PROFILE_VISIBILITY.PUBLIC
  );
  assert.notEqual(
    await fixture.mediaStore.getPublishedCard({ handle: OWNER_A.handle }),
    null
  );
});

test("memory fixture leaves one coherent result for concurrent publish and unpublish", async () => {
  const fixture = await createMemoryFixture();
  const gate = createGate();
  const service = createPublicationService(fixture, gateMediaPublication(
    fixture.mediaStore,
    gate
  ));

  const publishPromise = service.publishOwnerCard({ ownerId: OWNER_A.id });
  await gate.reached.promise;
  const unpublishPromise = service.unpublishOwnerCard({ ownerId: OWNER_A.id });
  await Promise.resolve();
  assert.equal(gate.calls, 1);

  gate.release.resolve();
  const results = await Promise.allSettled([publishPromise, unpublishPromise]);
  assert.equal(results.some((result) => result.status === "fulfilled"), true);
  const owner = fixture.store.getOwnerById(OWNER_A.id);
  const publication = await fixture.mediaStore.getPublishedCard({
    handle: OWNER_A.handle
  });
  assert.equal(
    owner.visibility === PROFILE_VISIBILITY.PUBLIC,
    publication !== null
  );
});

test("memory fixture keeps one coherent state after refresh races with unpublish", async () => {
  const fixture = await createMemoryFixture();
  const initialService = createPublicationService(fixture, fixture.mediaStore);
  await initialService.publishOwnerCard({ ownerId: OWNER_A.id });
  fixture.store.saveLatestUsage({
    ...fixture.store.getLatestUsageByOwnerId(OWNER_A.id),
    capturedAt: "2026-07-23T01:00:00.000Z",
    uploadedAt: "2026-07-23T01:01:00.000Z",
    usage: withLifetimeTokens(1_000_000_000)
  });

  const gate = createGate();
  const service = createPublicationService(fixture, gateMediaPublication(
    fixture.mediaStore,
    gate
  ));
  const refreshPromise = service.refreshPublishedCard({ ownerId: OWNER_A.id });
  await gate.reached.promise;
  const unpublishPromise = service.unpublishOwnerCard({ ownerId: OWNER_A.id });
  await Promise.resolve();
  assert.equal(gate.calls, 1);

  gate.release.resolve();
  const results = await Promise.allSettled([refreshPromise, unpublishPromise]);

  const owner = fixture.store.getOwnerById(OWNER_A.id);
  const publication = await fixture.mediaStore.getPublishedCard({
    handle: OWNER_A.handle
  });
  assert.equal(
    owner.visibility === PROFILE_VISIBILITY.PUBLIC,
    publication !== null
  );
  assert.equal(results.some((result) => result.status === "fulfilled"), true);
});

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "";
test("Postgres allows different owners to publish without a global media lock", {
  skip: TEST_DATABASE_URL === "" ? "TEST_DATABASE_URL is not set" : false
}, async (t) => {
  const fixture = await createPostgresFixture(t);
  const ownerAGate = createGate();
  const ownerBReached = deferred();
  const mediaStore = wrapMediaStore(fixture.mediaStore, {
    async putRevision(options) {
      if (options.ownerId === OWNER_A.id && ownerAGate.calls === 0) {
        ownerAGate.calls += 1;
        ownerAGate.reached.resolve();
        await ownerAGate.release.promise;
      }
      if (options.ownerId === OWNER_B.id) ownerBReached.resolve();
      return fixture.mediaStore.putRevision(options);
    }
  });
  const service = createPublicationService(fixture, mediaStore);

  const ownerAPromise = service.publishOwnerCard({ ownerId: OWNER_A.id });
  await ownerAGate.reached.promise;
  const ownerBPromise = service.publishOwnerCard({ ownerId: OWNER_B.id });
  await withTimeout(ownerBReached.promise, 1_000);

  ownerAGate.release.resolve();
  await Promise.all([ownerAPromise, ownerBPromise]);

  assert.equal(
    (await fixture.store.getOwnerById(OWNER_A.id)).visibility,
    PROFILE_VISIBILITY.PUBLIC
  );
  assert.equal(
    (await fixture.store.getOwnerById(OWNER_B.id)).visibility,
    PROFILE_VISIBILITY.PUBLIC
  );
});

async function createMemoryFixture() {
  const store = createMemoryProfileBackendStore();
  await seedOwner(store, OWNER_A);
  const mediaStore = createMemoryProfileMediaStore();
  return {
    cardService: createCardService(store),
    mediaStore,
    store
  };
}

async function createPostgresFixture(t) {
  const schema = `cup_media_conc_${randomBytes(4).toString("hex")}`;
  const admin = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  await admin.query(`SET search_path TO ${schema}`);
  await migrateUp({ client: admin, migrations: await loadMigrations() });
  const pool = new pg.Pool({
    connectionString: TEST_DATABASE_URL,
    max: 4,
    options: `-csearch_path=${schema}`
  });
  const store = createPostgresProfileBackendStore({ pool });
  t.after(async () => {
    await store.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });
  await seedOwner(store, OWNER_A);
  await seedOwner(store, OWNER_B);
  return {
    cardService: createCardService(store),
    mediaStore: createMemoryProfileMediaStore(),
    store
  };
}

async function seedOwner(store, owner) {
  await store.saveOwner(owner);
  await store.saveLatestUsage({
    ownerId: owner.id,
    handle: owner.handle,
    visibility: PROFILE_VISIBILITY.PRIVATE,
    capturedAt: "2026-07-23T00:00:00.000Z",
    uploadedAt: "2026-07-23T00:01:00.000Z",
    usage: sampleAccountUsageReadResult
  });
}

function createCardService(store) {
  return createProfileCardService({
    store,
    fetchImpl: async () => {
      throw new Error("network disabled in test");
    },
    renderPng: async (viewModel) => Buffer.from(
      `png:${viewModel.handle}:${viewModel.locale}:${viewModel.usage.summary.lifetimeTokens}`
    )
  });
}

function createPublicationService(fixture, mediaStore) {
  let nextId = 1;
  return createProfilePublicationService({
    cardService: fixture.cardService,
    createId: (prefix) => `${prefix}_${nextId++}`,
    mediaStore,
    now: () => new Date("2026-07-23T02:00:00.000Z"),
    store: fixture.store
  });
}

function gateMediaPublication(base, gate) {
  return wrapMediaStore(base, {
    async publishRevision(options) {
      gate.calls += 1;
      if (gate.calls === 1) {
        gate.reached.resolve();
        await gate.release.promise;
      }
      return base.publishRevision(options);
    }
  });
}

function wrapMediaStore(base, overrides = {}) {
  return {
    getPublishedCard: (...args) => base.getPublishedCard(...args),
    getRevision: (...args) => base.getRevision(...args),
    inspectStableCard: (...args) => base.inspectStableCard(...args),
    publishRevision: (...args) => base.publishRevision(...args),
    putRevision: (...args) => base.putRevision(...args),
    unpublishCard: (...args) => base.unpublishCard(...args),
    ...overrides
  };
}

function createGate() {
  return {
    calls: 0,
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

async function withTimeout(promise, timeoutMs) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("concurrency barrier timed out")),
          timeoutMs
        );
      })
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function withLifetimeTokens(increment) {
  return {
    ...sampleAccountUsageReadResult,
    summary: {
      ...sampleAccountUsageReadResult.summary,
      lifetimeTokens:
        sampleAccountUsageReadResult.summary.lifetimeTokens + increment
    }
  };
}

const OWNER_A = Object.freeze({
  id: "owner_a",
  authProvider: "github",
  providerUserId: "github_a",
  githubLogin: "owner-a",
  displayName: "Owner A",
  handle: "owner-a",
  visibility: PROFILE_VISIBILITY.PRIVATE
});

const OWNER_B = Object.freeze({
  id: "owner_b",
  authProvider: "github",
  providerUserId: "github_b",
  githubLogin: "owner-b",
  displayName: "Owner B",
  handle: "owner-b",
  visibility: PROFILE_VISIBILITY.PRIVATE
});
