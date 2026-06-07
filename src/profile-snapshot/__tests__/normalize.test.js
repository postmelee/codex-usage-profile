import assert from "node:assert/strict";
import test from "node:test";

import { normalizeCodexProfileSnapshot } from "../normalize.js";
import { validateProfileSnapshot } from "../schema.js";

test("normalizes a Codex profile response into a valid snapshot", () => {
  const snapshot = normalizeCodexProfileSnapshot(createRawCodexProfileResponse(), {
    capturedAt: "2026-06-06T08:22:18.000Z",
    planLabel: "pro",
    petAsset: {
      kind: "spritesheet",
      url: "https://example.com/pet.png",
      assetRef: "codex-pet:example",
      contentType: "image/png"
    }
  });

  assert.deepEqual(snapshot.profile, {
    displayName: "postmelee",
    username: "meleeisdeveloping",
    planLabel: "Pro"
  });
  assert.deepEqual(snapshot.summary, {
    totalTextTokens: 10300000000,
    peakTokens: 703000000,
    longestTaskDurationMs: 6780000,
    currentStreakDays: 46,
    longestStreakDays: 46
  });
  assert.deepEqual(snapshot.dailyUsage, [
    { date: "2026-06-01", credits: 314000000 },
    { date: "2026-06-02", credits: 703000000 }
  ]);
  assert.equal(snapshot.activityInsights.fastModePercent, 55);
  assert.equal(snapshot.activityInsights.reasoningEffort, "xhigh");
  assert.equal(snapshot.topInvocations.length, 2);
  assert.deepEqual(snapshot.assets.avatar, {
    kind: "remote-url",
    url: "https://example.com/avatar.png",
    assetRef: null,
    contentType: null
  });
  assert.equal(validateProfileSnapshot(snapshot).ok, true);
});

test("does not copy token-like fields from raw input", () => {
  const raw = createRawCodexProfileResponse();
  raw.access_token = "top-level-secret";
  raw.refresh_token = "refresh-secret";
  raw.CODEX_ACCESS_TOKEN = "env-secret";
  raw.auth = { auth_json: "serialized-auth-secret" };
  raw.profile.access_token = "profile-secret";
  raw.stats.refresh_token = "stats-secret";
  raw.stats.top_invocations[0].credential = "invocation-secret";

  const snapshot = normalizeCodexProfileSnapshot(raw, {
    capturedAt: "2026-06-06T08:22:18.000Z"
  });
  const serialized = JSON.stringify(snapshot);

  assert.equal(serialized.includes("top-level-secret"), false);
  assert.equal(serialized.includes("refresh-secret"), false);
  assert.equal(serialized.includes("env-secret"), false);
  assert.equal(serialized.includes("serialized-auth-secret"), false);
  assert.equal(serialized.includes("profile-secret"), false);
  assert.equal(serialized.includes("stats-secret"), false);
  assert.equal(serialized.includes("invocation-secret"), false);
  assert.equal(validateProfileSnapshot(snapshot).ok, true);
});

test("normalizes nullish optional Codex fields to safe snapshot defaults", () => {
  const snapshot = normalizeCodexProfileSnapshot({
    profile: {
      display_name: "  ",
      username: null
    },
    stats: {
      daily_usage_buckets: null,
      top_invocations: null
    }
  }, {
    capturedAt: new Date("2026-06-06T08:22:18.000Z")
  });

  assert.deepEqual(snapshot.profile, {
    displayName: null,
    username: null,
    planLabel: null
  });
  assert.deepEqual(snapshot.summary, {
    totalTextTokens: null,
    peakTokens: null,
    longestTaskDurationMs: null,
    currentStreakDays: null,
    longestStreakDays: null
  });
  assert.deepEqual(snapshot.dailyUsage, []);
  assert.deepEqual(snapshot.topInvocations, []);
  assert.deepEqual(snapshot.assets, {
    avatar: null,
    pet: null
  });
  assert.equal(validateProfileSnapshot(snapshot).ok, true);
});

test("filters top invocations with unsupported types", () => {
  const raw = createRawCodexProfileResponse();
  raw.stats.top_invocations.push({
    type: "unknown",
    plugin_name: "unsupported",
    usage_count: 10
  });

  const snapshot = normalizeCodexProfileSnapshot(raw, {
    capturedAt: "2026-06-06T08:22:18.000Z"
  });

  assert.equal(snapshot.topInvocations.length, 2);
  assert.equal(validateProfileSnapshot(snapshot).ok, true);
});

function createRawCodexProfileResponse() {
  return {
    profile: {
      display_name: " postmelee ",
      username: " meleeisdeveloping ",
      profile_picture_url: " https://example.com/avatar.png "
    },
    stats: {
      lifetime_tokens: 10300000000,
      peak_daily_tokens: 703000000,
      longest_running_turn_sec: 6780,
      current_streak_days: 46,
      longest_streak_days: 46,
      daily_usage_buckets: [
        { start_date: "2026-06-01", tokens: 314000000 },
        { start_date: "2026-06-02", tokens: 703000000 }
      ],
      fast_mode_usage_percentage: 55,
      most_used_reasoning_effort: "xhigh",
      most_used_reasoning_effort_percentage: 76,
      unique_skills_used: 49,
      total_skills_used: 3144,
      total_threads: 1735,
      top_invocations: [
        {
          type: "skill",
          skill_id: "task-start",
          skill_name: "task-start",
          usage_count: 436
        },
        {
          type: "plugin",
          plugin_id: "plugin:merge-cleanup",
          plugin_name: "merge-cleanup",
          usage_count: 563
        }
      ]
    },
    metadata: {
      stats_error: ""
    }
  };
}
