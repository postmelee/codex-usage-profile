import assert from "node:assert/strict";
import test from "node:test";

import { sampleProfileSnapshot } from "../../profile-snapshot/fixtures/sample-snapshot.js";
import {
  buildTokenHeatmap,
  formatHeatmapTooltip,
  getHeatmapLevel
} from "../heatmap.js";

const tokenActivity = {
  capturedAt: sampleProfileSnapshot.capturedAt,
  dailyUsage: sampleProfileSnapshot.dailyUsage
};

test("builds a 52 week daily heatmap with missing days filled as zero", () => {
  const heatmap = buildTokenHeatmap(tokenActivity, {
    mode: "daily",
    todayIso: "2026-06-06"
  });
  const zeroCell = heatmap.cells.find((cell) => cell.dateIso === "2025-07-20");
  const peakCell = heatmap.cells.find((cell) => cell.dateIso === "2026-06-02");

  assert.equal(heatmap.mode, "daily");
  assert.equal(heatmap.cells.length, 364);
  assert.equal(heatmap.columnCount, 52);
  assert.equal(heatmap.rowCount, 7);
  assert.equal(heatmap.startDateIso, "2025-06-08");
  assert.deepEqual(heatmap.monthLabels, [
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun"
  ]);
  assert.equal(zeroCell.tokenCount, 0);
  assert.equal(zeroCell.tooltip, "0 tokens on Jul 20, 2025");
  assert.equal(peakCell.tokenCount, 703000000);
  assert.equal(peakCell.level, 4);
});

test("aggregates weekly token totals across all days in a week", () => {
  const heatmap = buildTokenHeatmap(tokenActivity, {
    mode: "weekly",
    todayIso: "2026-06-06"
  });
  const juneSecondCell = heatmap.cells.find((cell) => cell.dateIso === "2026-06-02");
  const juneSixthCell = heatmap.cells.find((cell) => cell.dateIso === "2026-06-06");

  assert.equal(heatmap.mode, "weekly");
  assert.equal(juneSecondCell.weekStartIso, "2026-05-31");
  assert.equal(juneSecondCell.tokenCount, 2012000000);
  assert.equal(juneSixthCell.tokenCount, juneSecondCell.tokenCount);
  assert.equal(juneSecondCell.tooltip, "2B tokens on week of May 31");
});

test("builds cumulative weekly totals", () => {
  const heatmap = buildTokenHeatmap(tokenActivity, {
    mode: "cumulative",
    todayIso: "2026-06-06"
  });
  const mayTwentyFourthCell = heatmap.cells.find((cell) => cell.dateIso === "2026-05-24");
  const juneSecondCell = heatmap.cells.find((cell) => cell.dateIso === "2026-06-02");

  assert.equal(heatmap.mode, "cumulative");
  assert.equal(mayTwentyFourthCell.tokenCount, 952000000);
  assert.equal(juneSecondCell.tokenCount, 2964000000);
  assert.equal(juneSecondCell.tooltip, "3B tokens through week of May 31");
  assert.equal(juneSecondCell.level, 4);
});

test("formats tooltip labels for daily, weekly, and cumulative modes", () => {
  assert.equal(
    formatHeatmapTooltip("daily", 0, "2025-07-20", "2025-07-20", "2026-06-06"),
    "0 tokens on Jul 20, 2025"
  );
  assert.equal(
    formatHeatmapTooltip("weekly", 2012000000, "2026-06-02", "2026-05-31", "2026-06-06"),
    "2B tokens on week of May 31"
  );
  assert.equal(
    formatHeatmapTooltip("cumulative", 2964000000, "2026-06-02", "2026-05-31", "2026-06-06"),
    "3B tokens through week of May 31"
  );
});

test("assigns stable heatmap levels", () => {
  assert.equal(getHeatmapLevel(0, 100), 0);
  assert.equal(getHeatmapLevel(10, 100), 1);
  assert.equal(getHeatmapLevel(25, 100), 2);
  assert.equal(getHeatmapLevel(50, 100), 3);
  assert.equal(getHeatmapLevel(80, 100), 4);
});
