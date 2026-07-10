import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAccountUsageReadResult,
  isAccountUsageReadResult,
  normalizeAccountUsageReadResult,
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
