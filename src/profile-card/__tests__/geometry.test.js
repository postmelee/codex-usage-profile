import assert from "node:assert/strict";
import test from "node:test";

import {
  CARD_HEATMAP_BOUNDS,
  CARD_HEATMAP_CELL_COUNT,
  CARD_HEATMAP_CELL_SIZE,
  CARD_HEATMAP_COLUMN_COUNT,
  CARD_HEATMAP_COLUMN_STEP,
  CARD_HEATMAP_ROW_COUNT,
  CARD_HEATMAP_ROW_STEP,
  CARD_LOGICAL_HEIGHT,
  CARD_LOGICAL_WIDTH,
  getCardHeatmapCellGeometry
} from "../geometry.js";

test("defines the renderer card and 26 by 7 heatmap geometry", () => {
  assert.equal(CARD_LOGICAL_WIDTH, 499);
  assert.equal(CARD_LOGICAL_HEIGHT, 306);
  assert.equal(CARD_HEATMAP_COLUMN_COUNT, 26);
  assert.equal(CARD_HEATMAP_ROW_COUNT, 7);
  assert.equal(CARD_HEATMAP_CELL_COUNT, 182);
  assert.equal(CARD_HEATMAP_CELL_SIZE, 14);
  assert.deepEqual(CARD_HEATMAP_BOUNDS, {
    height: 115,
    width: 435,
    x: 32,
    y: 96
  });
  assert.equal(Object.isFrozen(CARD_HEATMAP_BOUNDS), true);
  assert.equal(CARD_HEATMAP_COLUMN_STEP, 16.84);
  assert.equal(CARD_HEATMAP_ROW_STEP, 101 / 6);
});

test("maps the first and last column-major cells to renderer coordinates", () => {
  const first = getCardHeatmapCellGeometry(0, 0);
  const last = getCardHeatmapCellGeometry(25, 6);

  assert.equal(Object.isFrozen(first), true);
  assert.deepEqual(
    pickLogicalGeometry(first),
    {
      centerX: 39,
      centerY: 103,
      column: 0,
      height: 14,
      index: 0,
      row: 0,
      width: 14,
      x: 32,
      y: 96
    }
  );
  assert.deepEqual(
    pickLogicalGeometry(last),
    {
      centerX: 460,
      centerY: 204,
      column: 25,
      height: 14,
      index: 181,
      row: 6,
      width: 14,
      x: 453,
      y: 197
    }
  );
  assert.equal(first.leftPercent, 32 / 499 * 100);
  assert.equal(first.topPercent, 96 / 306 * 100);
  assert.equal(last.widthPercent, 14 / 499 * 100);
  assert.equal(last.heightPercent, 14 / 306 * 100);
});

test("rejects heatmap coordinates outside the shared grid", () => {
  for (const [column, row, message] of [
    [-1, 0, /column/],
    [26, 0, /column/],
    [0.5, 0, /column/],
    [0, -1, /row/],
    [0, 7, /row/],
    [0, 1.5, /row/]
  ]) {
    assert.throws(
      () => getCardHeatmapCellGeometry(column, row),
      message
    );
  }
});

function pickLogicalGeometry(value) {
  return Object.fromEntries([
    "centerX",
    "centerY",
    "column",
    "height",
    "index",
    "row",
    "width",
    "x",
    "y"
  ].map((key) => [key, value[key]]));
}
