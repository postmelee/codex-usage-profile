import assert from "node:assert/strict";
import test from "node:test";

import { sampleProfileSnapshot } from "../fixtures/sample-snapshot.js";
import {
  selectMostUsedInvocations,
  selectProfileHeader,
  selectProfileStats,
  selectProfileTokenActivity,
  selectProfileViewModel,
  selectShareCardStats,
  selectShareCardUsageInput,
  selectShareCardViewModel
} from "../selectors.js";

test("selects the profile header fields used by full profile and card views", () => {
  assert.deepEqual(selectProfileHeader(sampleProfileSnapshot), {
    displayName: "postmelee",
    username: "meleeisdeveloping",
    planLabel: "Pro",
    avatarAsset: sampleProfileSnapshot.assets.avatar,
    petAsset: sampleProfileSnapshot.assets.pet
  });
});

test("selects the five stats used by the full profile page", () => {
  assert.deepEqual(selectProfileStats(sampleProfileSnapshot), [
    { key: "totalTextTokens", label: "Lifetime tokens", value: 10300000000 },
    { key: "peakTokens", label: "Peak tokens", value: 703000000 },
    { key: "longestTaskDurationMs", label: "Longest task", value: 6780000 },
    { key: "currentStreakDays", label: "Current streak", value: 46 },
    { key: "longestStreakDays", label: "Longest streak", value: 46 }
  ]);
});

test("selects the four stats used by the share card", () => {
  assert.deepEqual(selectShareCardStats(sampleProfileSnapshot), [
    { key: "totalTextTokens", label: "lifetime tokens", value: 10300000000 },
    { key: "peakTokens", label: "peak day", value: 703000000 },
    { key: "currentStreakDays", label: "current streak", value: 46 },
    { key: "longestStreakDays", label: "longest streak", value: 46 }
  ]);
});

test("selects full profile token activity source data", () => {
  const tokenActivity = selectProfileTokenActivity({
    ...sampleProfileSnapshot,
    dailyUsage: [
      { date: "2026-06-02", credits: 2 },
      { date: "2026-06-01", credits: 1 }
    ]
  });

  assert.deepEqual(tokenActivity, {
    capturedAt: "2026-06-06T08:22:18.000Z",
    dailyUsage: [
      { date: "2026-06-01", credits: 1 },
      { date: "2026-06-02", credits: 2 }
    ]
  });
});

test("selects the 26 week share card usage window source data", () => {
  const usage = selectShareCardUsageInput(sampleProfileSnapshot, {
    todayIso: "2026-06-06"
  });

  assert.equal(usage.todayIso, "2026-06-06");
  assert.equal(usage.startDateIso, "2025-12-07");
  assert.equal(usage.dayCount, 182);
  assert.equal(usage.dailyUsage.length, sampleProfileSnapshot.dailyUsage.length);
  assert.deepEqual(usage.dailyUsage.at(-1), {
    date: "2026-06-06",
    credits: 158000000
  });
});

test("sorts and limits most used invocations by usage count", () => {
  const invocations = selectMostUsedInvocations(sampleProfileSnapshot, {
    limit: 2
  });

  assert.deepEqual(invocations.map((item) => item.skillName), [
    "pr-merge-cleanup",
    "task-start"
  ]);
});

test("builds a full profile view model from the sample fixture", () => {
  const viewModel = selectProfileViewModel(sampleProfileSnapshot);

  assert.equal(viewModel.header.displayName, "postmelee");
  assert.equal(viewModel.stats.length, 5);
  assert.equal(viewModel.tokenActivity.dailyUsage.length, 14);
  assert.equal(viewModel.activityInsights.totalThreads, 1735);
  assert.equal(viewModel.mostUsedInvocations.length, 3);
});

test("builds a share card view model from the sample fixture", () => {
  const viewModel = selectShareCardViewModel(sampleProfileSnapshot, {
    todayIso: "2026-06-06"
  });

  assert.equal(viewModel.header.username, "meleeisdeveloping");
  assert.equal(viewModel.stats.length, 4);
  assert.equal(viewModel.usage.dayCount, 182);
  assert.equal(viewModel.usage.dailyUsage.length, 14);
});
