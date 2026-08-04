import assert from "node:assert/strict";
import test from "node:test";

import {
  CARD_HEATMAP_CELL_COUNT,
  CARD_HEATMAP_COLUMN_COUNT,
  CARD_HEATMAP_ROW_COUNT,
  buildCardHeatmap,
  getCardHeatmapLevel
} from "../heatmap.js";
import { CARD_THEME_PALETTES } from "../theme.js";
import {
  SAMPLE_CARD_TODAY_ISO,
  sampleAccountUsageReadResult
} from "../fixtures/sample-account-usage.js";

test("builds a 26 week column-major heatmap with the latest week on the right", () => {
  const heatmap = buildCardHeatmap(
    sampleAccountUsageReadResult.dailyUsageBuckets,
    { todayIso: SAMPLE_CARD_TODAY_ISO }
  );

  assert.equal(heatmap.columnCount, CARD_HEATMAP_COLUMN_COUNT);
  assert.equal(heatmap.rowCount, CARD_HEATMAP_ROW_COUNT);
  assert.equal(heatmap.cells.length, CARD_HEATMAP_CELL_COUNT);
  assert.equal(heatmap.startDateIso, "2025-12-14");
  assert.equal(heatmap.todayIso, SAMPLE_CARD_TODAY_ISO);
  assert.equal(heatmap.cells.at(-1).dateIso, "2026-06-13");
  assert.equal(heatmap.cells.at(-1).tokens, 0);

  const finalColumn = heatmap.cells
    .filter((cell) => cell.column === CARD_HEATMAP_COLUMN_COUNT - 1)
    .map((cell) => cell.level)
    .join("");

  assert.equal(finalColumn, "1111100");
});

test("matches the card heatmap level thresholds", () => {
  assert.equal(getCardHeatmapLevel(0, 100), 0);
  assert.equal(getCardHeatmapLevel(10, 100), 1);
  assert.equal(getCardHeatmapLevel(20, 100), 2);
  assert.equal(getCardHeatmapLevel(45, 100), 3);
  assert.equal(getCardHeatmapLevel(75, 100), 4);
});

test("renders null daily buckets as an empty heatmap", () => {
  const heatmap = buildCardHeatmap([], { todayIso: "2026-06-11" });

  assert.equal(heatmap.cells.every((cell) => cell.level === 0), true);
});

test("maps the same usage levels through the selected card palette", () => {
  const dark = buildCardHeatmap(
    sampleAccountUsageReadResult.dailyUsageBuckets,
    { theme: "dark", todayIso: SAMPLE_CARD_TODAY_ISO }
  );
  const light = buildCardHeatmap(
    sampleAccountUsageReadResult.dailyUsageBuckets,
    { theme: "light", todayIso: SAMPLE_CARD_TODAY_ISO }
  );

  assert.deepEqual(
    dark.cells.map((cell) => cell.level),
    light.cells.map((cell) => cell.level)
  );
  assert.equal(dark.cells[0].color, CARD_THEME_PALETTES.dark.heatmap[0]);
  assert.equal(light.cells[0].color, CARD_THEME_PALETTES.light.heatmap[0]);
  assert.equal(light.theme, "light");
});
