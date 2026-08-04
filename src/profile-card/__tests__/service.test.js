import assert from "node:assert/strict";
import test from "node:test";

import { loadImage } from "@napi-rs/canvas";

import {
  PROFILE_BACKEND_ERROR_CODES,
  PROFILE_VISIBILITY,
  createMemoryProfileBackendStore
} from "../../profile-backend/index.js";
import { CARD_OUTPUT_HEIGHT, CARD_OUTPUT_WIDTH } from "../renderer.js";
import {
  createProfileCardEtag,
  createProfileCardRevision,
  createProfileCardService,
  createProfileCardSourceDigest,
  normalizeGitHubAvatarUrl
} from "../service.js";
import { sampleAccountUsageReadResult } from "../fixtures/sample-account-usage.js";

test("reads owner profile and keeps owner and latest usage visibility aligned", async () => {
  const fixture = createFixture();
  const initial = await fixture.service.getOwnerProfile({ ownerId: OWNER.id });
  assert.equal(initial.visibility, PROFILE_VISIBILITY.PRIVATE);
  assert.deepEqual(initial.usageRecord.usage, sampleAccountUsageReadResult);

  const published = await fixture.service.updateVisibility({
    ownerId: OWNER.id,
    visibility: PROFILE_VISIBILITY.PUBLIC
  });
  assert.equal(published.owner.visibility, PROFILE_VISIBILITY.PUBLIC);
  assert.equal(published.usageRecord.visibility, PROFILE_VISIBILITY.PUBLIC);
  assert.equal(
    fixture.store.getLatestUsageByOwnerId(OWNER.id).visibility,
    PROFILE_VISIBILITY.PUBLIC
  );
});

test("hides missing, private, and visibility-mismatched public cards", async () => {
  const fixture = createFixture();
  for (const method of ["getPublicProfile", "renderPublicCard"]) {
    await assertCardNotFound(() => fixture.service[method]({ handle: OWNER.handle }));
    await assertCardNotFound(() => fixture.service[method]({ handle: "missing" }));
    await assertCardNotFound(() => fixture.service[method]({ handle: "../postmelee" }));
  }

  fixture.store.saveOwner({ ...OWNER, visibility: PROFILE_VISIBILITY.PUBLIC });
  for (const method of ["getPublicProfile", "renderPublicCard"]) {
    await assertCardNotFound(() => fixture.service[method]({ handle: OWNER.handle }));
  }
});

test("returns a public profile from the owner-linked Account Usage record", async () => {
  const fixture = createFixture();
  await fixture.service.updateVisibility({
    ownerId: OWNER.id,
    visibility: PROFILE_VISIBILITY.PUBLIC
  });

  const profile = await fixture.service.getPublicProfile({ handle: " POSTMELEE " });

  assert.equal(profile.owner.id, OWNER.id);
  assert.equal(profile.usageRecord.ownerId, OWNER.id);
  assert.equal(profile.usageRecord.handle, OWNER.handle);
  assert.deepEqual(profile.usageRecord.usage, sampleAccountUsageReadResult);
  assert.equal(profile.visibility, PROFILE_VISIBILITY.PUBLIC);
});

test("fails closed when public owner and Account Usage handles do not match", async () => {
  const fixture = createFixture();
  fixture.store.saveOwner({ ...OWNER, visibility: PROFILE_VISIBILITY.PUBLIC });
  fixture.store.saveLatestUsage({
    ...fixture.store.getLatestUsageByOwnerId(OWNER.id),
    handle: "other",
    visibility: PROFILE_VISIBILITY.PUBLIC
  });

  await assertCardNotFound(() => fixture.service.getPublicProfile({
    handle: OWNER.handle
  }));
  await assertCardNotFound(() => fixture.service.renderPublicCard({
    handle: OWNER.handle
  }));
});

test("memoizes avatar and PNG by strong ETag and supports conditional reads", async () => {
  let fetchCount = 0;
  let renderCount = 0;
  const fixture = createFixture({
    fetchImpl: async () => {
      fetchCount += 1;
      return new Response(Buffer.from("avatar"), {
        headers: { "content-type": "image/png" }
      });
    },
    renderPng: async (_viewModel, options) => {
      renderCount += 1;
      assert.equal(Buffer.from(options.avatarSource).toString(), "avatar");
      return Buffer.from(`png-${renderCount}`);
    }
  });
  await fixture.service.updateVisibility({
    ownerId: OWNER.id,
    visibility: PROFILE_VISIBILITY.PUBLIC
  });

  const first = await fixture.service.renderPublicCard({ handle: OWNER.handle });
  const second = await fixture.service.renderPublicCard({ handle: OWNER.handle });
  const conditional = await fixture.service.renderPublicCard({
    handle: OWNER.handle,
    ifNoneMatch: first.etag
  });
  const head = await fixture.service.renderPublicCard({
    handle: OWNER.handle,
    includeBody: false
  });

  assert.match(first.etag, /^"[A-Za-z0-9_-]{43}"$/);
  assert.match(first.revision, /^[A-Za-z0-9_-]{43}$/);
  assert.match(first.sourceDigest, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(first.revision, createProfileCardRevision(first.body));
  assert.equal(first.etag, createProfileCardEtag(first.body));
  assert.deepEqual(second.body, first.body);
  assert.equal(conditional.notModified, true);
  assert.equal(conditional.body, null);
  assert.equal(head.body, null);
  assert.equal(fetchCount, 1);
  assert.equal(renderCount, 1);
});

test("separates private light previews while keeping public cards dark", async () => {
  const renderedThemes = [];
  const fixture = createFixture({
    renderPng: async (viewModel, options) => {
      renderedThemes.push([viewModel.theme, options.theme]);
      return Buffer.from(`png-${options.theme}`);
    }
  });

  const ownerDark = await fixture.service.renderOwnerCard({ ownerId: OWNER.id });
  const ownerLight = await fixture.service.renderOwnerCard({
    ownerId: OWNER.id,
    theme: "light"
  });
  const ownerLightCached = await fixture.service.renderOwnerCard({
    ownerId: OWNER.id,
    theme: "light"
  });
  const ownerFallback = await fixture.service.renderOwnerCard({
    ownerId: OWNER.id,
    theme: "unsupported"
  });

  assert.equal(ownerDark.theme, "dark");
  assert.equal(ownerLight.theme, "light");
  assert.notEqual(ownerDark.sourceDigest, ownerLight.sourceDigest);
  assert.equal(ownerLight.sourceDigest, ownerLightCached.sourceDigest);
  assert.equal(ownerFallback.sourceDigest, ownerDark.sourceDigest);
  assert.deepEqual(renderedThemes, [["dark", "dark"], ["light", "light"]]);

  await fixture.service.updateVisibility({
    ownerId: OWNER.id,
    visibility: PROFILE_VISIBILITY.PUBLIC
  });
  const publicCard = await fixture.service.renderPublicCard({
    handle: OWNER.handle,
    theme: "light"
  });

  assert.equal(publicCard.theme, "dark");
  assert.deepEqual(renderedThemes.at(-1), ["dark", "dark"]);
});

test("separates renderer source digests from final PNG revisions", async () => {
  const fixture = createFixture({ renderPng: async () => Buffer.from("png") });
  await fixture.service.updateVisibility({
    ownerId: OWNER.id,
    visibility: PROFILE_VISIBILITY.PUBLIC
  });
  const english = await fixture.service.renderPublicCard({
    handle: OWNER.handle, includeBody: false, locale: "en"
  });
  const korean = await fixture.service.renderPublicCard({
    handle: OWNER.handle, includeBody: false, locale: "ko"
  });

  fixture.store.saveOwner({
    ...fixture.store.getOwnerById(OWNER.id),
    displayName: "Updated name",
    updatedAt: "2026-06-11T00:02:00.000Z"
  });
  const identityChanged = await fixture.service.renderPublicCard({
    handle: OWNER.handle, includeBody: false
  });
  fixture.store.saveLatestUsage({
    ...fixture.store.getLatestUsageByOwnerId(OWNER.id),
    uploadedAt: "2026-06-11T00:03:00.000Z"
  });
  const usageChanged = await fixture.service.renderPublicCard({
    handle: OWNER.handle, includeBody: false
  });

  assert.notEqual(english.sourceDigest, korean.sourceDigest);
  assert.notEqual(english.sourceDigest, identityChanged.sourceDigest);
  assert.notEqual(identityChanged.sourceDigest, usageChanged.sourceDigest);
  assert.equal(english.revision, korean.revision);
  assert.equal(english.etag, identityChanged.etag);
  assert.equal(identityChanged.etag, usageChanged.etag);
});

test("changes final revision when avatar bytes change at the same URL", async () => {
  const renderPng = async (_viewModel, options) => Buffer.from(options.avatarSource);
  const first = createFixture({
    fetchImpl: async () => new Response(Buffer.from("avatar-one"), {
      headers: { "content-type": "image/png" }
    }),
    renderPng
  });
  const second = createFixture({
    fetchImpl: async () => new Response(Buffer.from("avatar-two"), {
      headers: { "content-type": "image/png" }
    }),
    renderPng
  });

  const firstCard = await first.service.renderOwnerCard({ ownerId: OWNER.id });
  const secondCard = await second.service.renderOwnerCard({ ownerId: OWNER.id });

  assert.equal(firstCard.sourceDigest, secondCard.sourceDigest);
  assert.notEqual(firstCard.revision, secondCard.revision);
  assert.notEqual(firstCard.etag, secondCard.etag);
});

test("validates profile card digest helper inputs", () => {
  const options = {
    locale: "en",
    owner: OWNER,
    usage: sampleAccountUsageReadResult,
    usageRecord: { uploadedAt: "2026-06-11T00:01:00.000Z" }
  };
  assert.match(createProfileCardSourceDigest(options), /^[A-Za-z0-9_-]{43}$/);
  assert.equal(
    createProfileCardSourceDigest(options),
    createProfileCardSourceDigest({ ...options, theme: "dark" })
  );
  assert.notEqual(
    createProfileCardSourceDigest(options),
    createProfileCardSourceDigest({ ...options, theme: "light" })
  );
  assert.throws(() => createProfileCardRevision(Buffer.alloc(0)), /must not be empty/);
  assert.throws(() => createProfileCardEtag("png"), /Buffer or Uint8Array/);
});

test("renders a valid PNG when avatar loading fails", async () => {
  const fixture = createFixture({
    fetchImpl: async () => { throw new Error("network unavailable"); }
  });
  const result = await fixture.service.renderOwnerCard({ ownerId: OWNER.id });
  const image = await loadImage(result.body);
  assert.equal(image.width, CARD_OUTPUT_WIDTH);
  assert.equal(image.height, CARD_OUTPUT_HEIGHT);
});

test("rejects unsupported and oversized avatar responses before rendering", async () => {
  const responses = [
    new Response(Buffer.from("not-an-image"), {
      headers: { "content-type": "text/plain" }
    }),
    new Response(Buffer.from("small-body"), {
      headers: {
        "content-length": String(2 * 1024 * 1024 + 1),
        "content-type": "image/png"
      }
    })
  ];
  for (const response of responses) {
    let renderedAvatar = "not-called";
    const fixture = createFixture({
      fetchImpl: async () => response,
      renderPng: async (_viewModel, options) => {
        renderedAvatar = options.avatarSource;
        return Buffer.from("png");
      }
    });
    await fixture.service.renderOwnerCard({ ownerId: OWNER.id });
    assert.equal(renderedAvatar, null);
  }
});

test("accepts only HTTPS avatars.githubusercontent.com URLs", async () => {
  assert.equal(
    normalizeGitHubAvatarUrl("https://avatars.githubusercontent.com/u/12345?v=4"),
    "https://avatars.githubusercontent.com/u/12345?v=4"
  );
  assert.equal(normalizeGitHubAvatarUrl("http://avatars.githubusercontent.com/u/1"), null);
  assert.equal(normalizeGitHubAvatarUrl("https://example.com/avatar.png"), null);
  assert.equal(normalizeGitHubAvatarUrl("not-a-url"), null);
});

const OWNER = Object.freeze({
  id: "owner_1",
  authProvider: "github",
  providerUserId: "1",
  githubLogin: "postmelee",
  displayName: "Post Melee",
  avatarUrl: "https://avatars.githubusercontent.com/u/12345?v=4",
  handle: "postmelee",
  visibility: PROFILE_VISIBILITY.PRIVATE,
  createdAt: "2026-06-11T00:00:00.000Z",
  updatedAt: "2026-06-11T00:00:00.000Z"
});

function createFixture(options = {}) {
  const store = createMemoryProfileBackendStore();
  store.saveOwner(OWNER);
  store.saveLatestUsage({
    ownerId: OWNER.id,
    handle: OWNER.handle,
    visibility: PROFILE_VISIBILITY.PRIVATE,
    capturedAt: "2026-06-11T00:00:00.000Z",
    uploadedAt: "2026-06-11T00:01:00.000Z",
    usage: sampleAccountUsageReadResult
  });
  return {
    store,
    service: createProfileCardService({
      store,
      now: () => new Date("2026-06-11T00:02:00.000Z"),
      fetchImpl: options.fetchImpl ?? (async () => {
        throw new Error("network disabled in test");
      }),
      renderPng: options.renderPng
    })
  };
}

async function assertCardNotFound(callback) {
  await assert.rejects(Promise.resolve().then(callback), (error) => {
    assert.equal(error.code, PROFILE_BACKEND_ERROR_CODES.NOT_FOUND);
    assert.equal(error.message, "Card not found");
    return true;
  });
}
