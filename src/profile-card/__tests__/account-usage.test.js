import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCOUNT_USAGE_CONTRACT_VERSION,
  assertAccountUsageDocument,
  assertAccountUsageReadResult,
  isAccountUsageReadResult,
  normalizeAccountUsageDocument,
  normalizeAccountUsageReadResult,
  projectAccountUsageReadResult,
  validateAccountUsageDocument,
  validateAccountUsageReadResult
} from "../account-usage.js";
import { sampleAccountUsageReadResult } from "../fixtures/sample-account-usage.js";

test("accepts the documented account/usage/read result shape", () => {
  assert.equal(isAccountUsageReadResult(sampleAccountUsageReadResult), true);
  assert.equal(
    assertAccountUsageReadResult(sampleAccountUsageReadResult),
    sampleAccountUsageReadResult
  );
});

test("accepts and normalizes Account Usage Contract v1", () => {
  const document = createDocument({
    dailyUsageBuckets: [
      { startDate: "2026-06-11", tokens: 20 },
      { startDate: "2026-06-10", tokens: 10 }
    ]
  });
  const options = { now: () => new Date("2026-06-11T00:02:00.000Z") };

  assert.equal(assertAccountUsageDocument(document, options), document);
  assert.deepEqual(normalizeAccountUsageDocument(document, options), {
    ...document,
    dailyUsageBuckets: [
      { startDate: "2026-06-10", tokens: 10 },
      { startDate: "2026-06-11", tokens: 20 }
    ]
  });
});

test("preserves null Account Usage Contract semantics in card projection", () => {
  const document = createDocument({
    summary: Object.fromEntries(
      Object.keys(sampleAccountUsageReadResult.summary).map((key) => [key, null])
    ),
    dailyUsageBuckets: null
  });

  assert.deepEqual(projectAccountUsageReadResult(document), {
    summary: document.summary,
    dailyUsageBuckets: null
  });
});

test("rejects unsupported, unknown, and future Account Usage documents", () => {
  const document = createDocument({
    contractVersion: 2,
    capturedAt: "2026-06-11T00:06:00.000Z",
    username: "spoofed"
  });
  const result = validateAccountUsageDocument(document, {
    now: () => new Date("2026-06-11T00:00:00.000Z")
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /contractVersion/);
  assert.match(result.errors.join("\n"), /username: unknown field/);
  assert.match(result.errors.join("\n"), /more than 300000ms in the future/);
});

test("normalizes nullable summary values and daily buckets", () => {
  const normalized = normalizeAccountUsageReadResult({
    summary: {
      lifetimeTokens: null,
      peakDailyTokens: null,
      longestRunningTurnSec: null,
      currentStreakDays: null,
      longestStreakDays: null
    },
    dailyUsageBuckets: null
  });

  assert.deepEqual(normalized, {
    summary: {
      lifetimeTokens: null,
      peakDailyTokens: null,
      longestRunningTurnSec: null,
      currentStreakDays: null,
      longestStreakDays: null
    },
    dailyUsageBuckets: []
  });
});

test("sorts daily buckets without mutating the input", () => {
  const value = {
    summary: structuredClone(sampleAccountUsageReadResult.summary),
    dailyUsageBuckets: [
      { startDate: "2026-06-11", tokens: 20 },
      { startDate: "2026-06-10", tokens: 10 }
    ]
  };
  const normalized = normalizeAccountUsageReadResult(value);

  assert.deepEqual(
    normalized.dailyUsageBuckets.map((bucket) => bucket.startDate),
    ["2026-06-10", "2026-06-11"]
  );
  assert.equal(value.dailyUsageBuckets[0].startDate, "2026-06-11");
});

test("rejects identity and avatar fields from CLI usage input", () => {
  const candidate = structuredClone(sampleAccountUsageReadResult);
  candidate.displayName = "spoofed";
  candidate.avatarUrl = "https://attacker.example/avatar.png";

  const result = validateAccountUsageReadResult(candidate);

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /\$\.displayName: unknown field/);
  assert.match(result.errors.join("\n"), /\$\.avatarUrl: unknown field/);
});

test("rejects invalid dates, duplicate dates, and negative values", () => {
  const candidate = structuredClone(sampleAccountUsageReadResult);
  candidate.summary.lifetimeTokens = -1;
  candidate.dailyUsageBuckets = [
    { startDate: "2026-02-30", tokens: 1 },
    { startDate: "2026-02-30", tokens: -2 }
  ];

  const result = validateAccountUsageReadResult(candidate);

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /lifetimeTokens/);
  assert.match(result.errors.join("\n"), /valid UTC date/);
  assert.match(result.errors.join("\n"), /duplicate date/);
  assert.match(result.errors.join("\n"), /non-negative safe integer/);
});

function createDocument(overrides = {}) {
  return {
    contractVersion: ACCOUNT_USAGE_CONTRACT_VERSION,
    capturedAt: "2026-06-11T00:00:00.000Z",
    summary: structuredClone(sampleAccountUsageReadResult.summary),
    dailyUsageBuckets: structuredClone(sampleAccountUsageReadResult.dailyUsageBuckets),
    ...overrides
  };
}
