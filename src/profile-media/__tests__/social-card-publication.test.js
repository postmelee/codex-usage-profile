import assert from "node:assert/strict";
import test from "node:test";

import { createMemoryProfileBackendStore } from "../../profile-backend/store.js";
import { PROFILE_VISIBILITY } from "../../profile-backend/store-values.js";
import { createProfileCardService } from "../../profile-card/service.js";
import {
  sampleAccountUsageReadResult
} from "../../profile-card/fixtures/sample-account-usage.js";
import {
  createMemoryProfileMediaStore,
  createProfileMediaStoreError
} from "../media-store-contract.js";
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
        usageRecord: ensureOptions.usageRecord,
        cardLocale: ensureOptions.cardLocale,
        cardStyle: ensureOptions.cardStyle
      }).then(async (preparation) => {
        await options.afterPrepare?.(preparation);
        return preparation;
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
  const card = await mediaStore.getPublishedCard({ handle: OWNER.handle });

  assert.equal(Buffer.from(social.body).toString(), "social:light:en");
  assert.equal(card.canonicalLocale, "en");
  assert.equal(card.canonicalTheme, "light");
  assert.equal(Buffer.from(card.body).toString(), "card:light:en");
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

test("a failed card-settings CAS leaves the stable social object unchanged", async () => {
  const { cardService, mediaStore, service, store } = createFixture();
  await service.publishOwnerCard({ ownerId: OWNER.id });
  const before = await mediaStore.getSocialCard({ handle: OWNER.handle });
  const beforeCard = await mediaStore.getPublishedCard({ handle: OWNER.handle });
  const originalUpdate = store.atomic.updateCardSettings;
  store.atomic.updateCardSettings = async () => {
    throw new Error("forced card settings conflict");
  };

  await assert.rejects(
    () => cardService.updateCardSettings({
      ownerId: OWNER.id,
      cardLocale: "en",
      cardStyle: {
        schemaVersion: 1,
        theme: "light",
        effect: { preset: "none", version: 1 }
      }
    }),
    /forced card settings conflict/
  );
  store.atomic.updateCardSettings = originalUpdate;

  const after = await mediaStore.getSocialCard({ handle: OWNER.handle });
  const afterCard = await mediaStore.getPublishedCard({ handle: OWNER.handle });
  assert.equal(after.etag, before.etag);
  assert.equal(Buffer.from(after.body).toString(), "social:dark:ko");
  assert.equal(afterCard.publicationId, beforeCard.publicationId);
  assert.equal(afterCard.canonicalLocale, "ko");
  assert.equal(afterCard.canonicalTheme, "dark");
  assert.equal((await store.getOwnerById(OWNER.id)).cardLocale, "ko");
});

test("only the winning concurrent card-settings request commits social media", async () => {
  let waiting = 0;
  let release;
  const barrier = new Promise((resolve) => { release = resolve; });
  const fixture = createFixture({
    async afterPrepare() {
      waiting += 1;
      if (waiting === 2) release();
      await barrier;
    }
  });
  const { cardService, mediaStore, service } = fixture;
  await service.publishOwnerCard({ ownerId: OWNER.id });
  const putSocialCard = mediaStore.putSocialCard.bind(mediaStore);
  const publishRevision = mediaStore.publishRevision.bind(mediaStore);
  let commitWrites = 0;
  let publicationWrites = 0;
  mediaStore.putSocialCard = async (options) => {
    commitWrites += 1;
    return putSocialCard(options);
  };
  mediaStore.publishRevision = async (options) => {
    publicationWrites += 1;
    return publishRevision(options);
  };
  const update = () => cardService.updateCardSettings({
    ownerId: OWNER.id,
    cardLocale: "en",
    cardStyle: {
      schemaVersion: 1,
      theme: "dark",
      effect: { preset: "none", version: 1 }
    }
  });

  const results = await Promise.allSettled([update(), update()]);
  assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(results.filter(({ status }) => status === "rejected").length, 1);
  assert.equal(commitWrites, 1);
  assert.equal(publicationWrites, 1);
  assert.equal(
    (await mediaStore.getPublishedCard({ handle: OWNER.handle })).canonicalLocale,
    "en"
  );
  assert.equal(
    Buffer.from((await mediaStore.getSocialCard({ handle: OWNER.handle })).body)
      .toString(),
    "social:dark:en"
  );
});

test("an exact settings retry repairs a post-CAS authority failure", async () => {
  const { cardService, mediaStore, service, store } = createFixture();
  await service.publishOwnerCard({ ownerId: OWNER.id });
  const previous = await mediaStore.getPublishedCard({ handle: OWNER.handle });
  const publishRevision = mediaStore.publishRevision.bind(mediaStore);
  let failCommit = true;
  mediaStore.publishRevision = async (options) => {
    if (failCommit && options.canonicalTheme === "light") {
      failCommit = false;
      throw createProfileMediaStoreError(
        "unavailable",
        "injected authority failure"
      );
    }
    return publishRevision(options);
  };
  const settings = {
    ownerId: OWNER.id,
    cardLocale: "en",
    cardStyle: {
      schemaVersion: 1,
      theme: "light",
      effect: { preset: "none", version: 1 }
    }
  };

  await assert.rejects(
    () => cardService.updateCardSettings(settings),
    (error) => error.code === "media_unavailable"
  );
  assert.equal((await store.getOwnerById(OWNER.id)).cardLocale, "en");
  const stale = await mediaStore.getPublishedCard({ handle: OWNER.handle });
  assert.equal(stale.publicationId, previous.publicationId);
  assert.equal(stale.canonicalTheme, "dark");

  await cardService.updateCardSettings(settings);
  const repaired = await mediaStore.getPublishedCard({ handle: OWNER.handle });
  const social = await mediaStore.getSocialCard({ handle: OWNER.handle });
  assert.equal(repaired.canonicalLocale, "en");
  assert.equal(repaired.canonicalTheme, "light");
  assert.equal(Buffer.from(repaired.body).toString(), "card:light:en");
  assert.equal(Buffer.from(social.body).toString(), "social:light:en");
  assert.equal(social.publicationId, repaired.publicationId);
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
