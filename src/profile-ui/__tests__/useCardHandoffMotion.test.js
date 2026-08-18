import assert from "node:assert/strict";
import test from "node:test";

import {
  CARD_HANDOFF_IDENTITY_TRANSFORM,
  CARD_HANDOFF_MODES,
  buildRectTransform,
  isRectMeaningfullyVisible,
  isRectWithinViewport,
  readCardOpacity,
  resolveCardHandoffMotion
} from "../useCardHandoffMotion.js";

const VIEWPORT = Object.freeze({
  bottom: 844,
  height: 844,
  left: 0,
  right: 390,
  top: 0,
  width: 390
});

test("keeps safe fine-pointer cards on the scaled FLIP path", () => {
  const source = rect(30, 220, 330, 202);
  const target = rect(20, 180, 350, 214);

  const motion = resolveCardHandoffMotion({
    coarsePointer: false,
    source,
    target,
    viewport: VIEWPORT
  });

  assert.equal(motion.mode, CARD_HANDOFF_MODES.SCALE);
  assert.equal(motion.value, buildRectTransform(source, target).value);
});

test("uses target-sized center translation for coarse pointers", () => {
  const source = rect(40, 500, 310, 190);
  const target = rect(20, 170, 350, 214);

  const motion = resolveCardHandoffMotion({
    coarsePointer: true,
    source,
    target,
    viewport: VIEWPORT
  });

  assert.equal(motion.mode, CARD_HANDOFF_MODES.TRANSLATE);
  assert.equal(motion.value, "translate3d(0px, 318px, 0) scale(1)");
});

test("settles at the target when target-sized center translation leaves the viewport", () => {
  const source = rect(20, 400, 1120, 684);
  const target = rect(20, 170, 350, 214);

  const motion = resolveCardHandoffMotion({
    coarsePointer: true,
    source,
    target,
    viewport: VIEWPORT
  });

  assert.deepEqual(motion, {
    distance: 0,
    mode: CARD_HANDOFF_MODES.TARGET,
    value: CARD_HANDOFF_IDENTITY_TRANSFORM
  });
});

test("allows an explicit target-sized offscreen close handoff", () => {
  const source = rect(20, 400, 1120, 684);
  const target = rect(20, 170, 350, 214);

  const motion = resolveCardHandoffMotion({
    allowOffscreenTranslate: true,
    coarsePointer: true,
    source,
    target,
    viewport: VIEWPORT
  });

  assert.equal(motion.mode, CARD_HANDOFF_MODES.TRANSLATE);
  assert.equal(motion.value, "translate3d(385px, 465px, 0) scale(1)");
});

test("allows a target-sized handoff from a meaningfully visible clipped source", () => {
  const source = rect(20, -107, 350, 214);
  const target = rect(20, 170, 350, 214);

  const motion = resolveCardHandoffMotion({
    allowPartialTranslate: true,
    coarsePointer: true,
    source,
    target,
    viewport: VIEWPORT
  });

  assert.equal(motion.mode, CARD_HANDOFF_MODES.TRANSLATE);
  assert.equal(motion.value, "translate3d(0px, -277px, 0) scale(1)");
  assert.equal(isRectMeaningfullyVisible(source, VIEWPORT), true);
});

test("rejects clipped or oversized sources without meaningful viewport overlap", () => {
  const target = rect(20, 170, 350, 214);

  for (const source of [
    rect(20, -180, 350, 214),
    rect(20, 400, 1120, 684)
  ]) {
    assert.deepEqual(resolveCardHandoffMotion({
      allowPartialTranslate: true,
      coarsePointer: true,
      source,
      target,
      viewport: VIEWPORT
    }), {
      distance: 0,
      mode: CARD_HANDOFF_MODES.TARGET,
      value: CARD_HANDOFF_IDENTITY_TRANSFORM
    });
  }
});

test("preserves a fully transparent card opacity during phased handoff", () => {
  assert.equal(readCardOpacity("0"), 0);
  assert.equal(readCardOpacity("0.45"), 0.45);
  assert.equal(readCardOpacity("invalid"), 1);
  assert.equal(readCardOpacity(undefined, 0.25), 0.25);
});

test("downgrades an unsafe fine-pointer scale to a safe translation", () => {
  const source = rect(110, 420, 170, 104);
  const target = rect(20, 170, 350, 214);

  const motion = resolveCardHandoffMotion({
    coarsePointer: false,
    source,
    target,
    viewport: VIEWPORT
  });

  assert.equal(motion.mode, CARD_HANDOFF_MODES.TRANSLATE);
  assert.equal(motion.value, "translate3d(0px, 195px, 0) scale(1)");
});

test("settles at the target when viewport geometry cannot be trusted", () => {
  assert.deepEqual(resolveCardHandoffMotion({
    coarsePointer: true,
    source: rect(20, 400, 350, 214),
    target: rect(20, 170, 350, 214),
    viewport: { ...VIEWPORT, right: 400 }
  }), {
    distance: 0,
    mode: CARD_HANDOFF_MODES.TARGET,
    value: CARD_HANDOFF_IDENTITY_TRANSFORM
  });
  assert.equal(isRectWithinViewport(null, VIEWPORT), false);
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
