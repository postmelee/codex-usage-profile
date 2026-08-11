import assert from "node:assert/strict";
import test from "node:test";

import {
  assertUsageSnapshotV2,
  isUsageSnapshotV2,
  validateUsageSnapshotV2
} from "../v2-schema.js";
import { sampleUsageSnapshotV2 } from "../fixtures/sample-v2-snapshot.js";

test("validates the sample usage snapshot v2", () => {
  const result = validateUsageSnapshotV2(sampleUsageSnapshotV2);

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(isUsageSnapshotV2(sampleUsageSnapshotV2), true);
  assert.equal(assertUsageSnapshotV2(sampleUsageSnapshotV2), sampleUsageSnapshotV2);
});

test("validates a minimal usage snapshot v2", () => {
  const candidate = {
    schemaVersion: 2,
    capturedAt: "2026-06-12T00:00:00.000Z",
    usage: {
      totalTokens: 0,
      peakDailyTokens: null,
      tokenBreakdown: {
        inputTokens: null,
        outputTokens: null,
        cacheReadTokens: null,
        cacheWriteTokens: null,
        reasoningTokens: null
      },
      daily: []
    },
    models: {
      favoriteModel: null,
      items: []
    },
    activity: {
      longestTaskDurationMs: null,
      currentStreakDays: null,
      longestStreakDays: null,
      fastModePercent: null,
      reasoningEffort: null,
      reasoningEffortPercent: null,
      totalThreads: null
    },
    skills: {
      exploredCount: null,
      totalUsed: null,
      topSkills: []
    },
    plugins: {
      topPlugins: []
    }
  };

  assert.equal(validateUsageSnapshotV2(candidate).ok, true);
});

test("rejects unknown top-level fields", () => {
  const candidate = structuredClone(sampleUsageSnapshotV2);
  candidate.unexpected = true;

  const result = validateUsageSnapshotV2(candidate);

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /\$\.unexpected: unknown field/);
});

test("rejects invalid daily usage buckets", () => {
  const candidate = structuredClone(sampleUsageSnapshotV2);
  candidate.usage.daily[0] = {
    date: "2026-02-31",
    totalTokens: -1,
    inputTokens: null,
    outputTokens: null,
    cacheReadTokens: null,
    cacheWriteTokens: null,
    reasoningTokens: null
  };

  const result = validateUsageSnapshotV2(candidate);

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /\$\.usage\.daily\[0\]\.date: expected valid UTC date/);
  assert.match(result.errors.join("\n"), /\$\.usage\.daily\[0\]\.totalTokens: expected non-negative integer/);
});

test("rejects GitHub-facing fields in analyzer snapshots", () => {
  const candidate = structuredClone(sampleUsageSnapshotV2);
  candidate.extensions["tokenmon.cardHints"] = {
    githubAvatarUrl: "https://avatars.example.test/u/1"
  };

  const result = validateUsageSnapshotV2(candidate);

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /githubAvatarUrl: forbidden GitHub-facing field/);
});

test("rejects credential-like keys and values", () => {
  const candidate = structuredClone(sampleUsageSnapshotV2);
  candidate.extensions["codexUsageProfile.test"] = {
    accessToken: "ghp_1234567890abcdefghijklmnopqrstuv",
    env: "CODEX_ACCESS_TOKEN=local-secret"
  };

  const result = validateUsageSnapshotV2(candidate);

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /accessToken: forbidden credential-like field/);
  assert.match(result.errors.join("\n"), /accessToken: forbidden credential-like value/);
  assert.match(result.errors.join("\n"), /env: forbidden credential-like value/);
});

test("rejects non-namespaced extension keys", () => {
  const candidate = structuredClone(sampleUsageSnapshotV2);
  candidate.extensions = {
    cardHints: {}
  };

  const result = validateUsageSnapshotV2(candidate);

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /\$\.extensions\.cardHints: expected namespaced extension key/);
});

test("throws a useful error for invalid usage snapshot v2 payloads", () => {
  assert.throws(
    () => assertUsageSnapshotV2({}),
    /Invalid usage snapshot v2:\n\$\.schemaVersion/
  );
});
