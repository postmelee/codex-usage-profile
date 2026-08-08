import assert from "node:assert/strict";
import test from "node:test";

import {
  CARD_LOGICAL_HEIGHT,
  CARD_LOGICAL_WIDTH
} from "../renderer.js";
import {
  SOCIAL_CANVAS_HEIGHT,
  SOCIAL_CANVAS_MIN_HORIZONTAL_PADDING,
  SOCIAL_CANVAS_MIN_VERTICAL_PADDING,
  SOCIAL_CANVAS_WIDTH,
  SOCIAL_CARD_LOGICAL_HEIGHT,
  SOCIAL_CARD_LOGICAL_WIDTH,
  computeSocialCanvasLayout
} from "../social-canvas.js";

test("targets the 1.91:1 social preview canvas", () => {
  assert.equal(SOCIAL_CANVAS_WIDTH, 1200);
  assert.equal(SOCIAL_CANVAS_HEIGHT, 630);
});

test("tracks the card logical dimensions used by the renderers", () => {
  assert.equal(SOCIAL_CARD_LOGICAL_WIDTH, CARD_LOGICAL_WIDTH);
  assert.equal(SOCIAL_CARD_LOGICAL_HEIGHT, CARD_LOGICAL_HEIGHT);
});

test("keeps the card inside the safe area with the planned padding", () => {
  const layout = computeSocialCanvasLayout();

  assert.equal(layout.cardWidth, 960);
  assert.ok(Math.abs(layout.cardHeight - 588.6974) < 0.001);
  assert.equal(layout.cardX, SOCIAL_CANVAS_MIN_HORIZONTAL_PADDING);
  assert.ok(layout.cardY >= SOCIAL_CANVAS_MIN_VERTICAL_PADDING);
});

test("centers the card on both axes", () => {
  const layout = computeSocialCanvasLayout();

  assert.equal(
    layout.cardX,
    layout.canvasWidth - layout.cardX - layout.cardWidth
  );
  assert.equal(
    layout.cardY,
    layout.canvasHeight - layout.cardY - layout.cardHeight
  );
});

test("preserves the card aspect ratio", () => {
  const layout = computeSocialCanvasLayout();
  const expected = CARD_LOGICAL_WIDTH / CARD_LOGICAL_HEIGHT;

  assert.ok(Math.abs((layout.cardWidth / layout.cardHeight) - expected) < 1e-9);
  assert.ok(Math.abs(layout.scale - (layout.cardWidth / CARD_LOGICAL_WIDTH)) < 1e-9);
});

test("never overflows the canvas", () => {
  const layout = computeSocialCanvasLayout();

  assert.ok(layout.cardX >= 0);
  assert.ok(layout.cardY >= 0);
  assert.ok(layout.cardX + layout.cardWidth <= layout.canvasWidth);
  assert.ok(layout.cardY + layout.cardHeight <= layout.canvasHeight);
});

test("falls back to a height limited fit when vertical space is tighter", () => {
  const layout = computeSocialCanvasLayout({
    canvasHeight: 400,
    canvasWidth: 1200,
    horizontalPadding: 20,
    verticalPadding: 20
  });

  assert.ok(Math.abs(layout.cardHeight - 360) < 1e-9);
  assert.ok(layout.cardWidth < 1160);
  assert.ok(layout.cardX > 20);
});

test("is deterministic across repeated calls", () => {
  assert.deepEqual(computeSocialCanvasLayout(), computeSocialCanvasLayout());
});

test("rejects padding that leaves no room and invalid dimensions", () => {
  assert.throws(
    () => computeSocialCanvasLayout({ horizontalPadding: 600 }),
    TypeError
  );
  assert.throws(() => computeSocialCanvasLayout({ canvasWidth: 0 }), TypeError);
  assert.throws(
    () => computeSocialCanvasLayout({ verticalPadding: -1 }),
    TypeError
  );
});
