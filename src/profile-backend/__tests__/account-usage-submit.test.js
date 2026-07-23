import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCOUNT_USAGE_CONTRACT_VERSION,
  createProfileCardService
} from "../../profile-card/index.js";
import { sampleAccountUsageReadResult } from "../../profile-card/fixtures/sample-account-usage.js";
import {
  CLI_TOKEN_PREFIX,
  PROFILE_BACKEND_ERROR_CODES,
  PROFILE_VISIBILITY,
  ProfileBackendError,
  createAccountUsageRateLimiter,
  createAccountUsageSubmitService,
  createCliTokenService,
  createMemoryProfileBackendStore
} from "../index.js";

test("stores Account Usage Contract v1 for the bearer token owner", async () => {
  const fixture = await createFixture();
  const result = await fixture.service.submitAccountUsage({
    token: fixture.token,
    document: createDocument(),
    device: { id: "device-1", name: "MacBook Pro" }
  });
  const stored = fixture.store.getLatestUsageByOwnerId(OWNER.id);
  const device = fixture.store.getSubmittedDeviceByOwnerAndKey(OWNER.id, "device-1");

  assert.equal(result.idempotent, false);
  assert.match(result.revision, /^usage_[A-Za-z0-9_-]{43}$/);
  assert.equal(stored.contractVersion, ACCOUNT_USAGE_CONTRACT_VERSION);
  assert.equal(stored.capturedAt, "2026-07-11T00:00:00.000Z");
  assert.equal(stored.uploadedAt, "2026-07-11T00:02:00.000Z");
  assert.deepEqual(stored.usage, sampleAccountUsageReadResult);
  assert.equal(device.displayName, "MacBook Pro");
  assert.equal(result.owner.id, OWNER.id);
});

test("preserves null usage semantics and supports exact idempotent retries", async () => {
  const fixture = await createFixture();
  const document = createDocument({
    summary: Object.fromEntries(
      Object.keys(sampleAccountUsageReadResult.summary).map((key) => [key, null])
    ),
    dailyUsageBuckets: null
  });
  const first = await fixture.service.submitAccountUsage({
    token: fixture.token,
    document
  });

  fixture.setNow("2026-07-11T00:03:00.000Z");
  const second = await fixture.service.submitAccountUsage({
    token: fixture.token,
    document
  });
  const stored = fixture.store.getLatestUsageByOwnerId(OWNER.id);

  assert.equal(first.idempotent, false);
  assert.equal(second.idempotent, true);
  assert.equal(second.usageRecord.uploadedAt, first.usageRecord.uploadedAt);
  assert.equal(stored.usage.dailyUsageBuckets, null);
  assert.deepEqual(stored.usage.summary, document.summary);
});

test("rejects stale, conflicting, future, and identity-bearing documents", async () => {
  const fixture = await createFixture();
  await fixture.service.submitAccountUsage({
    token: fixture.token,
    document: createDocument()
  });

  await assertBackendError(
    () => fixture.service.submitAccountUsage({
      token: fixture.token,
      document: createDocument({ capturedAt: "2026-07-10T00:00:00.000Z" })
    }),
    PROFILE_BACKEND_ERROR_CODES.CONFLICT
  );
  await assertBackendError(
    () => fixture.service.submitAccountUsage({
      token: fixture.token,
      document: createDocument({
        summary: {
          ...sampleAccountUsageReadResult.summary,
          lifetimeTokens: sampleAccountUsageReadResult.summary.lifetimeTokens + 1
        }
      })
    }),
    PROFILE_BACKEND_ERROR_CODES.CONFLICT
  );

  const futureFixture = await createFixture();
  await assertBackendError(
    () => futureFixture.service.submitAccountUsage({
      token: futureFixture.token,
      document: createDocument({ capturedAt: "2026-07-11T00:08:00.000Z" })
    }),
    PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED
  );
  await assertBackendError(
    () => futureFixture.service.submitAccountUsage({
      token: futureFixture.token,
      document: createDocument({ username: "spoofed" })
    }),
    PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED
  );
  await assertBackendError(
    () => futureFixture.service.submitAccountUsage({
      token: futureFixture.token,
      document: createDocument({
        githubToken: "ghp_1234567890abcdefghijklmnopqrstuv"
      })
    }),
    PROFILE_BACKEND_ERROR_CODES.FORBIDDEN_SECRET
  );
});

test("returns status metadata without returning usage values", async () => {
  const fixture = await createFixture();
  await fixture.service.submitAccountUsage({
    token: fixture.token,
    document: createDocument()
  });
  const status = await fixture.service.getAccountUsageStatus({ token: fixture.token });
  const serialized = JSON.stringify({
    owner: { handle: status.owner.handle },
    tokenRecord: { id: status.tokenRecord.id },
    latest: status.usageRecord && {
      capturedAt: status.usageRecord.capturedAt,
      uploadedAt: status.usageRecord.uploadedAt,
      revision: status.revision
    }
  });

  assert.equal(status.owner.handle, OWNER.handle);
  assert.match(status.revision, /^usage_/);
  assert.equal(serialized.includes("lifetimeTokens"), false);
  assert.equal(serialized.includes(fixture.token), false);
});

test("rate limiter returns Retry-After and isolates token keys", async () => {
  let current = new Date("2026-07-11T00:00:00.000Z");
  const limiter = createAccountUsageRateLimiter({
    now: () => current,
    burstLimit: 2,
    burstWindowMs: 10_000,
    sustainedLimit: 4,
    sustainedWindowMs: 60_000
  });

  limiter.consume("token-1");
  limiter.consume("token-1");
  limiter.consume("token-2");

  assert.throws(() => limiter.consume("token-1"), (error) => {
    assert.equal(error.code, PROFILE_BACKEND_ERROR_CODES.RATE_LIMITED);
    assert.deepEqual(error.headers, { "retry-after": "10" });
    return true;
  });

  current = new Date("2026-07-11T00:00:11.000Z");
  limiter.consume("token-1");
});

test("changes the public card ETag after a newer Account Usage submit", async () => {
  const fixture = await createFixture();
  fixture.store.saveOwner({
    ...OWNER,
    visibility: PROFILE_VISIBILITY.PUBLIC
  });
  await fixture.service.submitAccountUsage({
    token: fixture.token,
    document: createDocument()
  });
  const cardService = createProfileCardService({
    store: fixture.store,
    now: () => new Date("2026-07-11T00:04:00.000Z")
  });
  const before = await cardService.renderPublicCard({
    handle: OWNER.handle,
    includeBody: false
  });

  fixture.setNow("2026-07-11T00:03:00.000Z");
  await fixture.service.submitAccountUsage({
    token: fixture.token,
    document: createDocument({
      capturedAt: "2026-07-11T00:01:00.000Z",
      summary: {
        ...sampleAccountUsageReadResult.summary,
        lifetimeTokens: sampleAccountUsageReadResult.summary.lifetimeTokens + 1_000_000_000
      }
    })
  });
  const after = await cardService.renderPublicCard({
    handle: OWNER.handle,
    includeBody: false
  });

  assert.notEqual(before.etag, after.etag);
});

async function createFixture() {
  const store = createMemoryProfileBackendStore();
  let current = new Date("2026-07-11T00:02:00.000Z");
  store.saveOwner(OWNER);
  const tokenService = createCliTokenService({
    store,
    now: () => current,
    createId: () => "cli_token_1",
    createToken: () => `${CLI_TOKEN_PREFIX}test_account_usage`
  });
  const { token } = await tokenService.issueCliToken({ ownerId: OWNER.id });

  return {
    store,
    token,
    service: createAccountUsageSubmitService({
      store,
      tokenService,
      now: () => current,
      createId: () => "submitted_device_1"
    }),
    setNow(value) {
      current = new Date(value);
    }
  };
}

function createDocument(overrides = {}) {
  return {
    contractVersion: ACCOUNT_USAGE_CONTRACT_VERSION,
    capturedAt: "2026-07-11T00:00:00.000Z",
    summary: structuredClone(sampleAccountUsageReadResult.summary),
    dailyUsageBuckets: structuredClone(sampleAccountUsageReadResult.dailyUsageBuckets),
    ...overrides
  };
}

async function assertBackendError(callback, code) {
  await assert.rejects(async () => callback(), (error) => {
    assert.equal(error instanceof ProfileBackendError, true);
    assert.equal(error.code, code);
    return true;
  });
}

const OWNER = Object.freeze({
  id: "owner_1",
  authProvider: "github",
  providerUserId: "1",
  githubLogin: "postmelee",
  handle: "postmelee",
  visibility: PROFILE_VISIBILITY.PRIVATE,
  createdAt: "2026-07-11T00:00:00.000Z",
  updatedAt: "2026-07-11T00:00:00.000Z"
});
