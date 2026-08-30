import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createCanvas, loadImage } from "@napi-rs/canvas";

import {
  GIF_EXPORT_PRESET_VERSION,
  PROFILE_CARD_BORDER_BEAM_PRESET,
  PROFILE_CARD_LIGHT_BORDER_BEAM_PRESET,
  PROFILE_GIF_PRESET,
  createProfileGifFrameRenderer,
  getProfileCardBorderBeamPreset,
  getProfileGifFrameAngle,
  getProfileGifFramePhase
} from "../gif-animation.js";

test("fixes the approved browser GIF and web border beam contract", () => {
  assert.equal(GIF_EXPORT_PRESET_VERSION, 2);
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
    version: 2,
    width: 998
  });
  assert.deepEqual(PROFILE_CARD_BORDER_BEAM_PRESET, {
    brightness: 1.05,
    colorVariant: "ocean",
    durationSeconds: 4.8,
    size: "md",
    strength: 0.82
  });
  assert.deepEqual(PROFILE_CARD_LIGHT_BORDER_BEAM_PRESET, {
    brightness: 1.05,
    colorVariant: "ocean",
    durationSeconds: 4.8,
    size: "md",
    strength: 0.82,
    style: {
      "--beam-bloom-opacity": 1.25,
      "--beam-inner-opacity": 2.5,
      "--beam-stroke-opacity": 5
    }
  });
  assert.equal(getProfileCardBorderBeamPreset("dark"), PROFILE_CARD_BORDER_BEAM_PRESET);
  assert.equal(
    getProfileCardBorderBeamPreset("light"),
    PROFILE_CARD_LIGHT_BORDER_BEAM_PRESET
  );
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

test("matches the approved conic beam golden signature and loop seam", async () => {
  const png = await readFile(new URL(
    "../../../public/assets/codex-card-sample.png",
    import.meta.url
  ));
  const image = await loadImage(png);
  const canvas = createCanvas(PROFILE_GIF_PRESET.width, PROFILE_GIF_PRESET.height);
  const context = canvas.getContext("2d");
  context.drawImage(
    image,
    0,
    0,
    PROFILE_GIF_PRESET.width,
    PROFILE_GIF_PRESET.height
  );
  const base = context.getImageData(
    0,
    0,
    PROFILE_GIF_PRESET.width,
    PROFILE_GIF_PRESET.height
  ).data;
  const renderer = createProfileGifFrameRenderer(base);
  const reference = [
    { changed: 52_892, frameIndex: 0, p95: 54, x: 222.4, y: 469.3 },
    { changed: 43_635, frameIndex: 24, p95: 39, x: 233, y: 137.5 },
    { changed: 51_550, frameIndex: 48, p95: 56, x: 870, y: 180.8 },
    { changed: 53_470, frameIndex: 72, p95: 64, x: 737.8, y: 512.5 },
    { changed: 53_128, frameIndex: 95, p95: 56, x: 241.6, y: 483.4 }
  ];
  const { frames, signatures } = measureGoldenSignatures(renderer, reference);

  for (const [index, expected] of reference.entries()) {
    const actual = signatures[index];
    assertClose(actual.changed, expected.changed, 12_000, `frame ${expected.frameIndex} footprint`);
    assertClose(actual.p95, expected.p95, 25, `frame ${expected.frameIndex} falloff`);
    assertClose(actual.x, expected.x, 55, `frame ${expected.frameIndex} horizontal center`);
    assertClose(actual.y, expected.y, 28, `frame ${expected.frameIndex} vertical center`);
  }

  const changedCounts = signatures.map(({ changed }) => changed);
  assert.ok(
    Math.max(...changedCounts) - Math.min(...changedCounts) >= 5_000,
    "fixed ocean gradients must vary the visible beam footprint"
  );

  const loopSeamDelta = frameRgbDelta(frames.get(95), frames.get(0));
  const adjacentDelta = frameRgbDelta(frames.get(0), frames.get(1));
  assert.ok(loopSeamDelta > adjacentDelta * 0.75);
  assert.ok(loopSeamDelta < adjacentDelta * 1.25);
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

function measureGoldenSignatures(renderer, reference) {
  const temporalMinimum = new Uint8ClampedArray(
    PROFILE_GIF_PRESET.width * PROFILE_GIF_PRESET.height * 4
  );
  const reusableFrame = new Uint8ClampedArray(temporalMinimum.length);
  const frames = new Map();
  temporalMinimum.fill(255);

  for (let frameIndex = 0; frameIndex < PROFILE_GIF_PRESET.frameCount; frameIndex += 1) {
    renderer.renderFrame(frameIndex, reusableFrame);
    if (
      frameIndex === 1 ||
      reference.some((entry) => entry.frameIndex === frameIndex)
    ) {
      frames.set(frameIndex, new Uint8ClampedArray(reusableFrame));
    }
    for (let offset = 0; offset < reusableFrame.length; offset += 4) {
      temporalMinimum[offset] = Math.min(
        temporalMinimum[offset],
        reusableFrame[offset]
      );
      temporalMinimum[offset + 1] = Math.min(
        temporalMinimum[offset + 1],
        reusableFrame[offset + 1]
      );
      temporalMinimum[offset + 2] = Math.min(
        temporalMinimum[offset + 2],
        reusableFrame[offset + 2]
      );
    }
  }

  return {
    frames,
    signatures: reference.map(({ frameIndex }) =>
      measureFrameSignature(frames.get(frameIndex), temporalMinimum, frameIndex)
    )
  };
}

function measureFrameSignature(frame, temporalMinimum, frameIndex) {
  const deltas = [];
  let changed = 0;
  let totalDelta = 0;
  let weightedX = 0;
  let weightedY = 0;

  for (let offset = 0; offset < frame.length; offset += 4) {
    const delta = Math.abs(frame[offset] - temporalMinimum[offset]) +
      Math.abs(frame[offset + 1] - temporalMinimum[offset + 1]) +
      Math.abs(frame[offset + 2] - temporalMinimum[offset + 2]);
    if (delta <= 0) {
      continue;
    }
    const pixelIndex = offset / 4;
    changed += 1;
    totalDelta += delta;
    weightedX += (pixelIndex % PROFILE_GIF_PRESET.width) * delta;
    weightedY += Math.floor(pixelIndex / PROFILE_GIF_PRESET.width) * delta;
    deltas.push(delta);
  }

  deltas.sort((left, right) => left - right);
  return {
    changed,
    frameIndex,
    p95: deltas[Math.floor((deltas.length - 1) * 0.95)] ?? 0,
    x: weightedX / totalDelta,
    y: weightedY / totalDelta
  };
}

function frameRgbDelta(first, second) {
  let delta = 0;
  for (let offset = 0; offset < first.length; offset += 4) {
    delta += Math.abs(first[offset] - second[offset]) +
      Math.abs(first[offset + 1] - second[offset + 1]) +
      Math.abs(first[offset + 2] - second[offset + 2]);
  }
  return delta;
}

function assertClose(actual, expected, tolerance, label) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${actual} to stay within ${tolerance} of ${expected}`
  );
}
