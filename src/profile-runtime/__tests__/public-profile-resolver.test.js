import assert from "node:assert/strict";
import test from "node:test";

import { PROFILE_VISIBILITY } from "../../profile-backend/store-values.js";
import {
  createStorePublicProfileResolver
} from "../public-profile-resolver.js";

const UPLOADED_AT = "2026-06-11T09:05:00.000Z";
const OWNER_UPDATED_AT = "2026-06-11T09:06:00.001Z";

function createStore(overrides = {}) {
  const owner = {
    cardLocale: "ko",
    handle: "postmelee",
    id: "owner_1",
    updatedAt: OWNER_UPDATED_AT,
    visibility: PROFILE_VISIBILITY.PUBLIC,
    ...overrides.owner
  };
  const usage = overrides.usage === null ? null : {
    handle: "postmelee",
    ownerId: "owner_1",
    uploadedAt: UPLOADED_AT,
    visibility: PROFILE_VISIBILITY.PUBLIC,
    ...overrides.usage
  };

  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    async getPublicProfileSummaryByHandle(handle) {
      calls += 1;
      if (
        handle !== owner.handle ||
        owner.visibility !== PROFILE_VISIBILITY.PUBLIC ||
        !usage ||
        usage.visibility !== PROFILE_VISIBILITY.PUBLIC ||
        usage.handle !== owner.handle
      ) {
        return null;
      }
      return {
        cardLocale: owner.cardLocale,
        handle: owner.handle,
        ownerUpdatedAt: owner.updatedAt,
        uploadedAt: usage.uploadedAt
      };
    }
  };
}

function createMediaStore(overrides = {}) {
  const publication = overrides.authority === null ? null : {
    ownerId: "owner_1",
    publicationId: "publication_1",
    ...overrides.authority
  };
  const social = overrides.social === null ? null : {
    etag: '"social-etag"',
    ownerId: "owner_1",
    publicationId: "publication_1",
    ...overrides.social
  };
  const calls = [];

  return {
    calls,
    async inspectStableCard(options) {
      calls.push(["authority", options]);
      if (overrides.authorityError) throw overrides.authorityError;
      return publication
        ? { kind: "publication", publication }
        : { kind: "missing" };
    },
    async getSocialCard(options) {
      calls.push(["social", options]);
      if (overrides.socialError) throw overrides.socialError;
      return social;
    }
  };
}

test("resolves the minimal summary with one store projection call", async () => {
  const store = createStore();
  const resolve = createStorePublicProfileResolver(store);

  assert.deepEqual(await resolve("postmelee"), {
    cardLocale: "ko",
    handle: "postmelee",
    imageRevisionAt: OWNER_UPDATED_AT,
    socialImageAvailable: true
  });
  assert.equal(store.calls, 1);
});

test("allows a personalized social image only for coherent media metadata", async () => {
  const mediaStore = createMediaStore();
  const resolve = createStorePublicProfileResolver(createStore(), {
    mediaStore
  });

  assert.equal((await resolve("postmelee")).socialImageAvailable, true);
  assert.deepEqual(mediaStore.calls, [
    ["authority", { handle: "postmelee" }],
    ["social", { handle: "postmelee", includeBody: false }]
  ]);
});

test("fails closed when social media is missing or incoherent", async () => {
  const cases = [
    createMediaStore({ authority: null }),
    createMediaStore({ social: null }),
    createMediaStore({ social: { ownerId: "owner_2" } }),
    createMediaStore({ social: { publicationId: "publication_2" } }),
    createMediaStore({ social: { etag: null } }),
    createMediaStore({ authorityError: new Error("R2 unavailable") }),
    createMediaStore({ socialError: new Error("R2 unavailable") })
  ];

  for (const mediaStore of cases) {
    const resolve = createStorePublicProfileResolver(createStore(), {
      mediaStore
    });
    assert.equal((await resolve("postmelee")).socialImageAvailable, false);
  }
});

test("does not read media for a private or missing store projection", async () => {
  const mediaStore = createMediaStore();
  const resolve = createStorePublicProfileResolver(createStore(), {
    mediaStore
  });

  assert.equal(await resolve("ghost"), null);
  assert.deepEqual(mediaStore.calls, []);
});

test("returns null for unknown, private, and incoherent profiles", async () => {
  assert.equal(
    await createStorePublicProfileResolver(createStore())("ghost"),
    null
  );
  assert.equal(
    await createStorePublicProfileResolver(createStore({
      owner: { visibility: PROFILE_VISIBILITY.PRIVATE }
    }))("postmelee"),
    null
  );
  assert.equal(
    await createStorePublicProfileResolver(createStore({ usage: null }))("postmelee"),
    null
  );
  assert.equal(
    await createStorePublicProfileResolver(createStore({
      usage: { visibility: PROFILE_VISIBILITY.PRIVATE }
    }))("postmelee"),
    null
  );
  assert.equal(
    await createStorePublicProfileResolver(createStore({
      usage: { handle: "someone-else" }
    }))("postmelee"),
    null
  );
});

test("falls back to the default card locale when the owner has none", async () => {
  const resolve = createStorePublicProfileResolver(createStore({
    owner: { cardLocale: undefined }
  }));

  assert.equal((await resolve("postmelee")).cardLocale, "en");
});

test("requires a store with the public lookup methods", () => {
  assert.throws(() => createStorePublicProfileResolver(null), TypeError);
  assert.throws(() => createStorePublicProfileResolver({}), TypeError);
  assert.throws(
    () => createStorePublicProfileResolver({ getOwnerByHandle() {} }),
    TypeError
  );
  assert.throws(
    () => createStorePublicProfileResolver(createStore(), { mediaStore: {} }),
    TypeError
  );
});
