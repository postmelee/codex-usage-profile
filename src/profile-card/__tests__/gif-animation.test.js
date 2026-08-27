import assert from "node:assert/strict";
import test from "node:test";

import {
  GIF_EXPORT_PRESET_VERSION,
  PROFILE_CARD_BORDER_BEAM_PRESET,
  PROFILE_GIF_PRESET,
  createProfileGifFrameRenderer,
  getProfileGifFrameAngle,
  getProfileGifFramePhase
} from "../gif-animation.js";

test("fixes the approved browser GIF and web border beam contract", () => {
  assert.equal(GIF_EXPORT_PRESET_VERSION, 1);
  assert.deepEqual(PROFILE_GIF_PRESET, {
    borderRadius: 64,
    durationMs: 4_800,
    durationSeconds: 4.8,
    fps: 20,
    frameCount: 96,
    frameDelayMs: 50,
    height: 612,
    jobTimeoutMs: 60_000,
    logicalHeight: 306,
    logicalWidth: 499,
    loopCount: 0,
    maxBytes: 15_000_000,
    maxColors: 256,
    scale: 2,
    sourceMaxBytes: 10_000_000,
    version: 1,
    width: 998
  });
  assert.deepEqual(PROFILE_CARD_BORDER_BEAM_PRESET, {
    brightness: 1.05,
    colorVariant: "ocean",
    durationSeconds: 4.8,
    size: "md",
    strength: 0.82
  });
});

test("uses 96 unique phases without duplicating the 360 degree endpoint", () => {
  assert.equal(getProfileGifFramePhase(0), 0);
  assert.equal(getProfileGifFrameAngle(0), 0);
  assert.equal(getProfileGifFrameAngle(24), 90);
  assert.equal(getProfileGifFrameAngle(48), 180);
  assert.equal(getProfileGifFrameAngle(72), 270);
  assert.equal(getProfileGifFrameAngle(95), 356.25);
  assert.equal(360 - getProfileGifFrameAngle(95), 3.75);
  assert.throws(() => getProfileGifFramePhase(96), RangeError);
});

test("keeps the card fixed while the beam visits each perimeter quadrant", () => {
  const base = createBaseFrame();
  const renderer = createProfileGifFrameRenderer(base);
  const expectedQuadrants = [
    [0, 1],
    [0, 0],
    [1, 0],
    [1, 1]
  ];

  assert.ok(renderer.effectPixelCount > 20_000);

  for (const [listIndex, frameIndex] of [0, 24, 48, 72].entries()) {
    const frame = renderer.renderFrame(frameIndex);
    const centroid = changedPixelCentroid(base, frame);
    assert.equal(
      centroid.x >= PROFILE_GIF_PRESET.width / 2 ? 1 : 0,
      expectedQuadrants[listIndex][0],
      `frame ${frameIndex} horizontal beam position`
    );
    assert.equal(
      centroid.y >= PROFILE_GIF_PRESET.height / 2 ? 1 : 0,
      expectedQuadrants[listIndex][1],
      `frame ${frameIndex} vertical beam position`
    );
    assert.deepEqual(
      readPixel(frame, 499, 306),
      readPixel(base, 499, 306),
      `frame ${frameIndex} must not transform card content`
    );
    assert.equal(readPixel(frame, 0, 0)[3], 0);
  }
});

test("reuses a caller-provided frame buffer", () => {
  const base = createBaseFrame();
  const renderer = createProfileGifFrameRenderer(base);
  const target = new Uint8ClampedArray(base.length);

  assert.equal(renderer.renderFrame(0, target), target);
  assert.throws(
    () => renderer.renderFrame(0, new Uint8ClampedArray(4)),
    TypeError
  );
});

function createBaseFrame() {
  const { width, height, borderRadius } = PROFILE_GIF_PRESET;
  const rgba = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!insideRoundedRect(x + 0.5, y + 0.5, width, height, borderRadius)) {
        continue;
      }
      const offset = (y * width + x) * 4;
      rgba[offset] = 13;
      rgba[offset + 1] = 20;
      rgba[offset + 2] = 36;
      rgba[offset + 3] = 255;
    }
  }

  const markerOffset = (306 * width + 499) * 4;
  rgba.set([222, 38, 92, 255], markerOffset);
  return rgba;
}

function insideRoundedRect(x, y, width, height, radius) {
  const nearestX = Math.max(radius, Math.min(width - radius, x));
  const nearestY = Math.max(radius, Math.min(height - radius, y));
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

function changedPixelCentroid(base, frame) {
  let count = 0;
  let sumX = 0;
  let sumY = 0;

  for (let offset = 0; offset < base.length; offset += 4) {
    if (
      base[offset] === frame[offset] &&
      base[offset + 1] === frame[offset + 1] &&
      base[offset + 2] === frame[offset + 2]
    ) {
      continue;
    }
    const pixelIndex = offset / 4;
    sumX += pixelIndex % PROFILE_GIF_PRESET.width;
    sumY += Math.floor(pixelIndex / PROFILE_GIF_PRESET.width);
    count += 1;
  }

  assert.ok(count > 0, "beam must change perimeter pixels");
  return { x: sumX / count, y: sumY / count };
}

function readPixel(rgba, x, y) {
  const offset = (y * PROFILE_GIF_PRESET.width + x) * 4;
  return Array.from(rgba.subarray(offset, offset + 4));
}
