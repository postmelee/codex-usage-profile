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
  createProfileCardService,
  normalizeGitHubAvatarUrl
} from "../service.js";
import { sampleAccountUsageReadResult } from "../fixtures/sample-account-usage.js";

test("reads owner profile and keeps owner and latest usage visibility aligned", () => {
  const fixture = createFixture();
  const initial = fixture.service.getOwnerProfile({ ownerId: OWNER.id });
  assert.equal(initial.visibility, PROFILE_VISIBILITY.PRIVATE);
  assert.deepEqual(initial.usageRecord.usage, sampleAccountUsageReadResult);

  const published = fixture.service.updateVisibility({
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
  await assertCardNotFound(() => fixture.service.renderPublicCard({ handle: OWNER.handle }));
  await assertCardNotFound(() => fixture.service.renderPublicCard({ handle: "missing" }));
  await assertCardNotFound(() => fixture.service.renderPublicCard({ handle: "../postmelee" }));

  fixture.store.saveOwner({ ...OWNER, visibility: PROFILE_VISIBILITY.PUBLIC });
  await assertCardNotFound(() => fixture.service.renderPublicCard({ handle: OWNER.handle }));
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
  fixture.service.updateVisibility({
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
  assert.deepEqual(second.body, first.body);
  assert.equal(conditional.notModified, true);
  assert.equal(conditional.body, null);
  assert.equal(head.body, null);
  assert.equal(fetchCount, 1);
  assert.equal(renderCount, 1);
});

test("changes ETag when locale, owner identity, or latest usage changes", async () => {
  const fixture = createFixture({ renderPng: async () => Buffer.from("png") });
  fixture.service.updateVisibility({
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

  assert.notEqual(english.etag, korean.etag);
  assert.notEqual(english.etag, identityChanged.etag);
  assert.notEqual(identityChanged.etag, usageChanged.etag);
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

test("accepts only HTTPS avatars.githubusercontent.com URLs", () => {
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
  await assert.rejects(callback, (error) => {
    assert.equal(error.code, PROFILE_BACKEND_ERROR_CODES.NOT_FOUND);
    assert.equal(error.message, "Card not found");
    return true;
  });
}
