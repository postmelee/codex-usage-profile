import assert from "node:assert/strict";
import test from "node:test";

import {
  CLI_TOKEN_PREFIX,
  PROFILE_VISIBILITY,
  createCliTokenService,
  createMemoryProfileBackendStore,
  createProfileBackendHttpHandler
} from "../../../src/profile-backend/index.js";
import { createServiceClient } from "../src/service-client.js";
import { submitAccountUsage } from "../src/submit.js";

const SERVICE_ORIGIN = "http://127.0.0.1:5177";

test("updates the stable card ETag through accepted and idempotent CLI submissions", async () => {
  const fixture = createBackendFixture(PROFILE_VISIBILITY.PUBLIC);
  const firstDocument = createDocument();
  const first = await runSubmit(fixture, firstDocument);
  const firstCard = await fixture.fetchImpl(
    `${SERVICE_ORIGIN}/u/postmelee/card.png`,
    { method: "HEAD" }
  );
  const repeated = await runSubmit(fixture, firstDocument);

  fixture.setNow("2026-07-13T00:03:00.000Z");
  const later = await runSubmit(fixture, createDocument({
    capturedAt: "2026-07-13T00:01:00.000Z",
    summary: {
      ...firstDocument.summary,
      lifetimeTokens: firstDocument.summary.lifetimeTokens + 1
    }
  }));
  const laterCard = await fixture.fetchImpl(
    `${SERVICE_ORIGIN}/u/postmelee/card.png`,
    { method: "HEAD" }
  );
  const usageRecord = fixture.store.getLatestUsageByOwnerId("owner_1");
  const device = fixture.store.getSubmittedDeviceByOwnerAndKey("owner_1", "device_1");

  assert.equal(first.submission.status, "accepted");
  assert.equal(repeated.submission.status, "unchanged");
  assert.equal(repeated.submission.idempotent, true);
  assert.equal(later.submission.status, "accepted");
  assert.equal(firstCard.status, 200);
  assert.equal(laterCard.status, 200);
  assert.notEqual(firstCard.headers.get("etag"), laterCard.headers.get("etag"));
  assert.equal(usageRecord.visibility, PROFILE_VISIBILITY.PUBLIC);
  assert.equal(usageRecord.usage.summary.lifetimeTokens, 101);
  assert.equal(device.displayName, "MacBook");
  assert.equal(device.lastSubmittedAt, "2026-07-13T00:03:00.000Z");
});

test("keeps private owner usage and card visibility private after submit", async () => {
  const fixture = createBackendFixture(PROFILE_VISIBILITY.PRIVATE);
  await runSubmit(fixture, createDocument());
  const card = await fixture.fetchImpl(`${SERVICE_ORIGIN}/u/postmelee/card.png`);
  const usageRecord = fixture.store.getLatestUsageByOwnerId("owner_1");

  assert.equal(usageRecord.visibility, PROFILE_VISIBILITY.PRIVATE);
  assert.equal(card.status, 404);
});

async function runSubmit(fixture, document) {
  return submitAccountUsage({
    readAccountUsage: async () => document,
    client: fixture.client,
    token: fixture.token,
    timeoutMs: 30_000,
    deviceId: "device_1",
    deviceName: "MacBook"
  });
}

function createBackendFixture(visibility) {
  const store = createMemoryProfileBackendStore();
  let current = new Date("2026-07-13T00:02:00.000Z");
  const createId = createIdFactory();
  store.saveOwner({
    id: "owner_1",
    authProvider: "github",
    providerUserId: "1",
    githubLogin: "postmelee",
    displayName: "Post Melee",
    handle: "postmelee",
    visibility
  });
  const tokenService = createCliTokenService({
    store,
    now: () => current,
    createId,
    createToken: () => `${CLI_TOKEN_PREFIX}integration_secret`
  });
  const { token } = tokenService.issueCliToken({ ownerId: "owner_1" });
  const handler = createProfileBackendHttpHandler({
    store,
    tokenService,
    now: () => current,
    createId,
    publicBaseUrl: SERVICE_ORIGIN
  });
  const fetchImpl = (url, options = {}) => handler(new Request(url, options));

  return {
    store,
    token,
    fetchImpl,
    client: createServiceClient({
      serviceOrigin: SERVICE_ORIGIN,
      fetchImpl
    }),
    setNow(value) {
      current = new Date(value);
    }
  };
}

function createDocument(overrides = {}) {
  return {
    contractVersion: 1,
    capturedAt: "2026-07-13T00:00:00.000Z",
    summary: {
      lifetimeTokens: 100,
      peakDailyTokens: 50,
      longestRunningTurnSec: 10,
      currentStreakDays: 2,
      longestStreakDays: 3
    },
    dailyUsageBuckets: [
      { startDate: "2026-07-13", tokens: 100 }
    ],
    ...overrides
  };
}

function createIdFactory() {
  let next = 1;
  return (prefix) => `${prefix}_${next++}`;
}
