import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCardHeatmapTooltip,
  hasCardHeatmapData,
  moveCardHeatmapFocusIndex,
  resolveCardHeatmapTooltipPlacement
} from "../cardHeatmapTooltip.js";

test("detects whether daily usage can anchor the stable card heatmap", () => {
  assert.equal(hasCardHeatmapData(null), false);
  assert.equal(hasCardHeatmapData([]), false);
  assert.equal(hasCardHeatmapData([
    { startDate: "2026-06-11", tokens: 1 }
  ]), true);
});

test("formats English and Korean tooltip labels in UTC", () => {
  const cell = { dateIso: "2026-06-11", tokens: 100_000_000 };

  assert.equal(
    formatCardHeatmapTooltip(cell, "en-US"),
    "Jun 11, 2026 · 100M tokens"
  );
  assert.equal(
    formatCardHeatmapTooltip(cell, "ko-KR"),
    "2026년 6월 11일 · 1억 토큰"
  );
  assert.equal(
    formatCardHeatmapTooltip({ ...cell, tokens: 1 }, "en"),
    "Jun 11, 2026 · 1 token"
  );
  assert.equal(
    formatCardHeatmapTooltip({ ...cell, tokens: 0 }, "en"),
    "Jun 11, 2026 · 0 tokens"
  );
});

test("rejects malformed tooltip cells", () => {
  assert.throws(() => formatCardHeatmapTooltip(null), /heatmap cell/);
  assert.throws(
    () => formatCardHeatmapTooltip({ dateIso: "2026-02-30", tokens: 1 }),
    /ISO date/
  );
  assert.throws(
    () => formatCardHeatmapTooltip({ dateIso: "2026-06-11", tokens: -1 }),
    /non-negative safe integer/
  );
});

test("moves one column-major roving focus with arrow keys", () => {
  assert.equal(moveCardHeatmapFocusIndex(10, "ArrowUp"), 9);
  assert.equal(moveCardHeatmapFocusIndex(10, "ArrowDown"), 11);
  assert.equal(moveCardHeatmapFocusIndex(10, "ArrowLeft"), 3);
  assert.equal(moveCardHeatmapFocusIndex(10, "ArrowRight"), 17);
  assert.equal(moveCardHeatmapFocusIndex(10, "Enter"), 10);

  assert.equal(moveCardHeatmapFocusIndex(0, "ArrowUp"), 0);
  assert.equal(moveCardHeatmapFocusIndex(0, "ArrowLeft"), 0);
  assert.equal(moveCardHeatmapFocusIndex(181, "ArrowDown"), 181);
  assert.equal(moveCardHeatmapFocusIndex(181, "ArrowRight"), 181);
});

test("supports focused tests with smaller grid dimensions", () => {
  const options = { columnCount: 2, rowCount: 2 };

  assert.equal(moveCardHeatmapFocusIndex(0, "ArrowRight", options), 2);
  assert.equal(moveCardHeatmapFocusIndex(2, "ArrowDown", options), 3);
  assert.throws(
    () => moveCardHeatmapFocusIndex(4, "ArrowLeft", options),
    /index/
  );
  assert.throws(
    () => moveCardHeatmapFocusIndex(0, "ArrowLeft", { rowCount: 0 }),
    /grid dimensions/
  );
});

test("centers a tooltip above an interior heatmap cell", () => {
  const placement = resolveCardHeatmapTooltipPlacement({
    anchorRect: rect(200, 180, 14, 14),
    containerRect: rect(100, 100, 499, 306),
    tooltipSize: { height: 30, width: 140 },
    viewportRect: rect(0, 0, 800, 600)
  });

  assert.deepEqual(placement, {
    left: 137,
    placement: "top",
    top: 142
  });
  assert.equal(Object.isFrozen(placement), true);
});

test("clamps edge tooltips and falls back below when the top cannot fit", () => {
  const placement = resolveCardHeatmapTooltipPlacement({
    anchorRect: rect(104, 108, 14, 14),
    containerRect: rect(100, 100, 499, 306),
    tooltipSize: { height: 40, width: 180 },
    viewportRect: rect(0, 0, 260, 500)
  });

  assert.deepEqual(placement, {
    left: 108,
    placement: "bottom",
    top: 130
  });
});

test("chooses and clamps the side with more space when neither side fits", () => {
  const placement = resolveCardHeatmapTooltipPlacement({
    anchorRect: rect(140, 145, 14, 14),
    containerRect: rect(100, 100, 200, 100),
    gap: 8,
    padding: 8,
    tooltipSize: { height: 70, width: 120 },
    viewportRect: rect(0, 0, 400, 400)
  });

  assert.deepEqual(placement, {
    left: 108,
    placement: "top",
    top: 108
  });
});

function rect(left, top, width, height) {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width
  };
}
