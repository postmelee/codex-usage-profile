import assert from "node:assert/strict";
import test from "node:test";

import { createMemoryProfileBackendStore } from "../../profile-backend/store.js";
import { PROFILE_VISIBILITY } from "../../profile-backend/store-values.js";
import { createProfileCardService } from "../../profile-card/service.js";
import {
  sampleAccountUsageReadResult
} from "../../profile-card/fixtures/sample-account-usage.js";
import { createMemoryProfileMediaStore } from "../media-store-contract.js";
import { createProfilePublicationService } from "../publication-service.js";

const OWNER = Object.freeze({
  id: "owner_github_1",
  authProvider: "github",
  providerUserId: "1",
  githubLogin: "postmelee",
  displayName: "Taegyu Lee",
  handle: "postmelee",
  visibility: PROFILE_VISIBILITY.PRIVATE,
  cardLocale: "ko",
  createdAt: "2026-07-22T00:00:00.000Z",
  updatedAt: "2026-07-22T00:00:00.000Z"
});

function createFixture(options = {}) {
  const store = createMemoryProfileBackendStore();
  store.saveOwner({ ...OWNER, ...options.owner });
  store.saveLatestUsage({
    ownerId: OWNER.id,
    handle: OWNER.handle,
    visibility: PROFILE_VISIBILITY.PRIVATE,
    capturedAt: "2026-07-22T00:00:00.000Z",
    uploadedAt: "2026-07-22T00:01:00.000Z",
    usage: sampleAccountUsageReadResult
  });

  const mediaStore = createMemoryProfileMediaStore();
  let service = null;
  const cardService = createProfileCardService({
    store,
    ensureCardStyleMedia: async (ensureOptions) => (
      service?.ensurePublishedCardVariants({
        ownerId: ensureOptions.owner.id,
        owner: ensureOptions.owner,
        cardLocale: ensureOptions.cardLocale,
        cardStyle: ensureOptions.cardStyle
      })
    ),
    fetchImpl: async () => { throw new Error("network disabled in test"); },
    renderPng: async (viewModel) => Buffer.from(
      `card:${viewModel.theme}:${viewModel.locale}`
    ),
    renderSocialPng: options.disableSocial
      ? undefined
      : async (viewModel) => Buffer.from(
        `social:${viewModel.theme}:${viewModel.locale}`
      )
  });

  let nextId = 1;
  service = createProfilePublicationService({
    cardService,
    createId: (prefix) => `${prefix}_${nextId++}`,
    mediaStore,
    now: () => new Date("2026-07-22T01:00:00.000Z"),
    store
  });

  return { cardService, mediaStore, service, store };
}

test("publishing writes one social object from the saved card settings", async () => {
  const { mediaStore, service } = createFixture();

  await service.publishOwnerCard({ ownerId: OWNER.id });
  const social = await mediaStore.getSocialCard({ handle: OWNER.handle });

  assert.equal(social.socialKey, "cards/v2/public/postmelee/social.png");
  assert.equal(social.handle, OWNER.handle);
  assert.equal(social.ownerId, OWNER.id);
  assert.equal(Buffer.from(social.body).toString(), "social:dark:ko");
});

test("the social object follows the saved locale and theme", async () => {
  const { mediaStore, service } = createFixture({
    owner: {
      cardLocale: "en",
      cardStyle: {
        schemaVersion: 1,
        theme: "light",
        effect: { preset: "none", version: 1 }
      }
    }
  });

  await service.publishOwnerCard({ ownerId: OWNER.id });
  const social = await mediaStore.getSocialCard({ handle: OWNER.handle });

  assert.equal(Buffer.from(social.body).toString(), "social:light:en");
});

test("saving new card settings refreshes the same social object", async () => {
  const { cardService, mediaStore, service } = createFixture();

  await service.publishOwnerCard({ ownerId: OWNER.id });
  const before = await mediaStore.getSocialCard({ handle: OWNER.handle });

  await cardService.updateCardSettings({
    ownerId: OWNER.id,
    cardLocale: "en",
    cardStyle: {
      schemaVersion: 1,
      theme: "light",
      effect: { preset: "none", version: 1 }
    }
  });
  const after = await mediaStore.getSocialCard({ handle: OWNER.handle });

  assert.equal(after.socialKey, before.socialKey);
  assert.equal(Buffer.from(after.body).toString(), "social:light:en");
  assert.notEqual(after.etag, before.etag);
});

test("unpublishing removes the social object", async () => {
  const { mediaStore, service } = createFixture();

  await service.publishOwnerCard({ ownerId: OWNER.id });
  assert.notEqual(await mediaStore.getSocialCard({ handle: OWNER.handle }), null);

  await service.unpublishOwnerCard({ ownerId: OWNER.id });
  assert.equal(await mediaStore.getSocialCard({ handle: OWNER.handle }), null);
});

test("publishing still succeeds when the card service cannot render social output", async () => {
  const { mediaStore, service, store } = createFixture({ disableSocial: true });

  const result = await service.publishOwnerCard({ ownerId: OWNER.id });

  assert.equal(result.visibility, PROFILE_VISIBILITY.PUBLIC);
  assert.equal(await mediaStore.getSocialCard({ handle: OWNER.handle }), null);
  assert.equal(
    (await store.getOwnerById(OWNER.id)).visibility,
    PROFILE_VISIBILITY.PUBLIC
  );
});
