import assert from "node:assert/strict";
import test from "node:test";

import {
  HEATMAP_CELL_COUNT,
  buildTokenHeatmap,
  formatHeatmapTooltip,
  formatTokenCount,
  getHeatmapLevel,
  normalizeDailyUsageBuckets
} from "../heatmap.js";

const CAPTURED_AT = "2026-08-02T23:59:59.000Z";
const DAILY_USAGE_BUCKETS = Object.freeze([
  Object.freeze({ startDate: "2026-08-03", tokens: 999 }),
  Object.freeze({ startDate: "2026-08-02", tokens: 40 }),
  Object.freeze({ startDate: "2026-08-01", tokens: 30 }),
  Object.freeze({ startDate: "2025-01-01", tokens: 500 }),
  Object.freeze({ startDate: "2026-07-27", tokens: 20 }),
  Object.freeze({ startDate: "2025-08-10", tokens: 7 }),
  Object.freeze({ startDate: "2026-07-26", tokens: 10 })
]);

test("builds an exact 52-week UTC daily range across year and leap boundaries", () => {
  const heatmap = buildTokenHeatmap([
    { startDate: "2024-02-29", tokens: 29 }
  ], {
    capturedAt: "2024-03-01T12:00:00.000Z",
    mode: "daily"
  });

  assert.equal(heatmap.cells.length, HEATMAP_CELL_COUNT);
  assert.equal(heatmap.startDateIso, "2023-03-05");
  assert.equal(heatmap.endDateIso, "2024-03-02");
  assert.equal(heatmap.todayIso, "2024-03-01");
  assert.equal(heatmap.cells[0].dateIso, "2023-03-05");
  assert.equal(heatmap.cells.at(-1).dateIso, "2024-03-02");
  assert.equal(
    heatmap.cells.find((cell) => cell.dateIso === "2024-02-29").tokens,
    29
  );
  assert.deepEqual(heatmap.grid, {
    cellCount: 364,
    columnCount: 52,
    endDateIso: "2024-03-02",
    latestColumn: 51,
    rowCount: 7,
    startDateIso: "2023-03-05",
    weekStartsOn: 0
  });
});

test("fills missing days with zero and excludes future usage from daily values", () => {
  const heatmap = buildTokenHeatmap(DAILY_USAGE_BUCKETS, {
    capturedAt: CAPTURED_AT,
    mode: "daily"
  });
  const first = heatmap.cells[0];
  const missing = heatmap.cells.find((cell) => cell.dateIso === "2025-08-11");
  const today = heatmap.cells.find((cell) => cell.dateIso === "2026-08-02");
  const future = heatmap.cells.find((cell) => cell.dateIso === "2026-08-03");

  assert.equal(heatmap.cells.length, 364);
  assert.equal(first.dateIso, "2025-08-10");
  assert.equal(first.tokens, 7);
  assert.equal(missing.tokens, 0);
  assert.equal(today.tokens, 40);
  assert.equal(today.column, 51);
  assert.equal(today.row, 0);
  assert.equal(today.level, 4);
  assert.equal(future.tokens, 0);
  assert.equal(future.interactive, false);
  assert.equal(future.isFuture, true);
  assert.equal(heatmap.latestTargetKey, "daily:2026-08-02");
  assert.equal(heatmap.monthLabels[0].dateIso, "2025-08-10");
  assert.deepEqual(heatmap.monthLabels.at(-1), {
    column: 50,
    dateIso: "2026-08-01",
    month: 8,
    year: 2026
  });
});

test("aggregates Sunday-Saturday weeks into 52 semantic targets", () => {
  const heatmap = buildTokenHeatmap(DAILY_USAGE_BUCKETS, {
    capturedAt: CAPTURED_AT,
    mode: "weekly"
  });
  const previousWeek = heatmap.cells[50];
  const currentWeek = heatmap.cells[51];

  assert.equal(heatmap.cells.length, 52);
  assert.deepEqual(
    {
      endDateIso: previousWeek.endDateIso,
      row: previousWeek.row,
      rowSpan: previousWeek.rowSpan,
      startDateIso: previousWeek.startDateIso,
      tokens: previousWeek.tokens
    },
    {
      endDateIso: "2026-08-01",
      row: 0,
      rowSpan: 7,
      startDateIso: "2026-07-26",
      tokens: 60
    }
  );
  assert.equal(previousWeek.level, 4);
  assert.equal(currentWeek.startDateIso, "2026-08-02");
  assert.equal(currentWeek.endDateIso, "2026-08-02");
  assert.equal(currentWeek.tokens, 40);
  assert.equal(currentWeek.level, 3);
  assert.equal(heatmap.maxTokens, 60);
  assert.equal(heatmap.latestTargetKey, "weekly:2026-08-02");
});

test("builds 52 cumulative week targets from the visible range start", () => {
  const heatmap = buildTokenHeatmap(DAILY_USAGE_BUCKETS, {
    capturedAt: CAPTURED_AT,
    mode: "cumulative"
  });

  assert.equal(heatmap.cells.length, 52);
  assert.equal(heatmap.cells[0].tokens, 7);
  assert.equal(heatmap.cells[50].tokens, 67);
  assert.equal(heatmap.cells[51].tokens, 107);
  assert.equal(heatmap.cells[51].level, 4);
  assert.equal(heatmap.maxTokens, 107);
  assert.equal(heatmap.latestTargetKey, "cumulative:2026-08-02");
});

test("anchors to the captured date before falling back to the latest bucket", () => {
  const captured = buildTokenHeatmap(DAILY_USAGE_BUCKETS, {
    capturedAt: CAPTURED_AT
  });
  const latestBucket = buildTokenHeatmap([
    { startDate: "2026-07-31", tokens: 1 },
    { startDate: "2026-08-02", tokens: 2 }
  ]);

  assert.equal(captured.todayIso, "2026-08-02");
  assert.equal(latestBucket.todayIso, "2026-08-02");
});

test("formats English and Korean compact plus exact token tooltips", () => {
  const daily = {
    dateIso: "2026-08-02",
    mode: "daily",
    tokens: 123_456_789
  };
  const weekly = {
    endDateIso: "2026-08-01",
    mode: "weekly",
    startDateIso: "2026-07-26",
    tokens: 1
  };
  const cumulative = {
    endDateIso: "2026-08-02",
    mode: "cumulative",
    startDateIso: "2025-08-10",
    tokens: 0
  };

  assert.equal(
    formatHeatmapTooltip(daily, "en"),
    "August 2, 2026 · 123.5M tokens (123,456,789)"
  );
  assert.equal(
    formatHeatmapTooltip(daily, "ko-KR"),
    "2026년 8월 2일 · 1.2억 토큰 (123,456,789)"
  );
  assert.equal(
    formatHeatmapTooltip(weekly, "en"),
    "Jul 26, 2026–Aug 1, 2026 · 1 token (1)"
  );
  assert.equal(
    formatHeatmapTooltip(cumulative, "ko"),
    "2026년 8월 2일까지 · 0 토큰 (0)"
  );
  assert.equal(formatTokenCount(1_500_000_000, "en"), "1.5B");
  assert.equal(formatTokenCount(150_000_000, "ko"), "1.5억");
});

test("matches Account Usage bucket validation and sorting rules", () => {
  assert.deepEqual(normalizeDailyUsageBuckets([
    { startDate: "2026-08-02", tokens: 2 },
    { startDate: "2026-08-01", tokens: 1 }
  ]), [
    { startDate: "2026-08-01", tokens: 1 },
    { startDate: "2026-08-02", tokens: 2 }
  ]);
  assert.deepEqual(normalizeDailyUsageBuckets(null), []);

  assert.throws(
    () => normalizeDailyUsageBuckets([{ startDate: "2026-02-30", tokens: 1 }]),
    /valid UTC date/
  );
  assert.throws(
    () => normalizeDailyUsageBuckets([{ startDate: "2026-08-02", tokens: -1 }]),
    /non-negative safe integer/
  );
  assert.throws(
    () => normalizeDailyUsageBuckets([{ startDate: "2026-08-02", tokens: 1.5 }]),
    /non-negative safe integer/
  );
  assert.throws(
    () => normalizeDailyUsageBuckets([
      { startDate: "2026-08-02", tokens: 1 },
      { startDate: "2026-08-02", tokens: 2 }
    ]),
    /must not duplicate/
  );
  assert.throws(
    () => normalizeDailyUsageBuckets([
      { extra: true, startDate: "2026-08-02", tokens: 1 }
    ]),
    /is not allowed/
  );
});

test("assigns stable mode-relative intensity levels", () => {
  assert.equal(getHeatmapLevel(0, 100), 0);
  assert.equal(getHeatmapLevel(10, 100), 1);
  assert.equal(getHeatmapLevel(25, 100), 2);
  assert.equal(getHeatmapLevel(50, 100), 3);
  assert.equal(getHeatmapLevel(80, 100), 4);
});
