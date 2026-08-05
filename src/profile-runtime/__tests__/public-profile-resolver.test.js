import assert from "node:assert/strict";
import test from "node:test";

import { PROFILE_VISIBILITY } from "../../profile-backend/store-values.js";
import {
  createStorePublicProfileResolver
} from "../public-profile-resolver.js";

const UPLOADED_AT = "2026-06-11T09:05:00.000Z";

function createStore(overrides = {}) {
  const owner = {
    cardLocale: "ko",
    handle: "postmelee",
    id: "owner_1",
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

  return {
    async getOwnerByHandle(handle) {
      return handle === owner.handle ? owner : null;
    },
    async getLatestUsageByOwnerId(ownerId) {
      return ownerId === owner.id ? usage : null;
    }
  };
}

test("resolves the minimal summary the document handler needs", async () => {
  const resolve = createStorePublicProfileResolver(createStore());

  assert.deepEqual(await resolve("postmelee"), {
    cardLocale: "ko",
    handle: "postmelee",
    uploadedAt: UPLOADED_AT
  });
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
});
