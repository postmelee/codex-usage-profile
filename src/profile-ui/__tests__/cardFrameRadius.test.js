import assert from "node:assert/strict";
import test from "node:test";

import {
  CARD_FRAME_LOGICAL_RADIUS,
  CARD_FRAME_LOGICAL_WIDTH,
  resolveCardFrameRadius
} from "../useCardFrameRadius.js";

test("scales the visible card radius from the renderer geometry", () => {
  assert.equal(resolveCardFrameRadius(CARD_FRAME_LOGICAL_WIDTH), 32);
  assert.equal(resolveCardFrameRadius(334), 334 * 32 / 499);
  assert.equal(CARD_FRAME_LOGICAL_RADIUS, 32);
});

test("rejects unusable card widths", () => {
  assert.equal(resolveCardFrameRadius(0), null);
  assert.equal(resolveCardFrameRadius(-1), null);
  assert.equal(resolveCardFrameRadius(Number.NaN), null);
});
