import { CARD_HEATMAP_ROW_COUNT } from "../heatmap.js";

export const SAMPLE_CARD_TODAY_ISO = "2026-06-11";

const REFERENCE_LEVEL_COLUMNS = Object.freeze([
  "0000000", "0000000", "0000000", "0000000", "0000000", "0000000",
  "0000000", "0000000", "0000000", "0000000", "0000000", "0000000",
  "0000000", "0000000", "0011122", "2122113", "3113243", "2212212",
  "2321211", "1113222", "3222111", "2201121", "2112101", "1112121",
  "1211021", "1111100"
]);

const TOKENS_BY_LEVEL = Object.freeze([
  0,
  10_000_000,
  30_000_000,
  60_000_000,
  100_000_000
]);

export const sampleCardOwner = Object.freeze({
  avatarUrl: "/assets/postmelee-avatar.png",
  displayName: "postmelee",
  githubLogin: "meleeisdeveloping",
  handle: "meleeisdeveloping"
});

export const sampleAccountUsageReadResult = deepFreeze({
  summary: {
    lifetimeTokens: 14_350_000_000,
    peakDailyTokens: 700_000_000,
    longestRunningTurnSec: 6_780,
    currentStreakDays: 7,
    longestStreakDays: 49
  },
  dailyUsageBuckets: buildReferenceDailyUsageBuckets()
});

function buildReferenceDailyUsageBuckets() {
  const startDateIso = "2025-12-14";
  const buckets = [];

  REFERENCE_LEVEL_COLUMNS.forEach((rows, column) => {
    Array.from(rows).forEach((levelText, row) => {
      const level = Number(levelText);
      const dateIso = addDays(
        startDateIso,
        column * CARD_HEATMAP_ROW_COUNT + row
      );

      if (level > 0 && dateIso <= SAMPLE_CARD_TODAY_ISO) {
        buckets.push({
          startDate: dateIso,
          tokens: TOKENS_BY_LEVEL[level]
        });
      }
    });
  });

  return buckets;
}

function addDays(dateIso, days) {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }

  return value;
}
