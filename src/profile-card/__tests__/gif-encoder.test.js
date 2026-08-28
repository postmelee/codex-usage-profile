import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createCanvas, loadImage } from "@napi-rs/canvas";

import {
  PROFILE_GIF_PRESET,
  createProfileGifFrameRenderer
} from "../gif-animation.js";
import { assertProfileGifContract } from "../gif-binary.js";
import {
  createGifGlobalPaletteMapper,
  createProfileGifGlobalPalette,
  encodeProfileCardGif
} from "../gif-encoder.js";

test("encodes the complete transparent 20fps loop with one global palette", () => {
  const progress = [];
  const bytes = encodeProfileCardGif(createRepresentativeBase(), {
    onProgress: ({ completedFrames }) => progress.push(completedFrames)
  });
  const metadata = assertProfileGifContract(bytes);

  assert.equal(metadata.frameCount, 96);
  assert.equal(metadata.loopCount, 0);
  assert.ok(metadata.globalColorTableSize <= 256);
  assert.equal(metadata.localColorTableCount, 0);
  assert.ok(bytes.length < PROFILE_GIF_PRESET.maxBytes);
  assert.equal(progress.length, 96);
  assert.deepEqual(progress.slice(0, 2), [1, 2]);
  assert.deepEqual(progress.slice(-2), [95, 96]);
});

test("rejects an opaque base that cannot provide a transparent GIF index", () => {
  const base = new Uint8ClampedArray(
    PROFILE_GIF_PRESET.width * PROFILE_GIF_PRESET.height * 4
  );
  for (let offset = 0; offset < base.length; offset += 4) {
    base.set([20, 24, 36, 255], offset);
  }

  assert.throws(
    () => encodeProfileCardGif(base),
    /transparent background pixels/
  );
});

test("maps identical card colors to one stable global palette index", () => {
  const palette = [
    [0, 0, 0, 0],
    [24, 24, 24, 255],
    [27, 28, 36, 255]
  ];
  const mapper = createGifGlobalPaletteMapper(palette, 0);
  const first = mapper.apply(Uint8ClampedArray.from([
    24, 24, 24, 255,
    25, 27, 31, 255
  ]));
  const second = mapper.apply(Uint8ClampedArray.from([
    25, 27, 31, 255,
    24, 24, 24, 255
  ]));

  assert.equal(first[0], second[1]);
  assert.equal(first[1], second[0]);
  assert.notEqual(first[0], first[1]);
});

test("preserves approved-frame color fidelity with the animation-wide palette", async () => {
  const base = await loadRepresentativePublicCard();
  const palette = createProfileGifGlobalPalette(base);
  const mapper = createGifGlobalPaletteMapper(palette, 0);
  const renderer = createProfileGifFrameRenderer(base);
  const frame = new Uint8ClampedArray(base.length);
  let comparedPixels = 0;
  let edgePixels = 0;
  let edgeSquaredError = 0;
  let exactPixels = 0;
  let squaredError = 0;

  assert.deepEqual(palette[0], [0, 0, 0, 0]);
  assert.ok(palette.length <= PROFILE_GIF_PRESET.maxColors);

  for (let frameIndex = 0; frameIndex < PROFILE_GIF_PRESET.frameCount; frameIndex += 1) {
    renderer.renderFrame(frameIndex, frame);
    const indexed = mapper.apply(frame);
    for (let pixelIndex = frameIndex % 128; pixelIndex < indexed.length; pixelIndex += 128) {
      const offset = pixelIndex * 4;
      if (frame[offset + 3] <= 127) continue;
      const color = palette[indexed[pixelIndex]];
      let exact = true;
      const isEdge = isNearApprovedCardEdge(pixelIndex);
      for (let channel = 0; channel < 3; channel += 1) {
        const delta = frame[offset + channel] - color[channel];
        squaredError += delta * delta;
        if (isEdge) {
          edgeSquaredError += delta * delta;
        }
        exact &&= delta === 0;
      }
      edgePixels += isEdge ? 1 : 0;
      comparedPixels += 1;
      exactPixels += exact ? 1 : 0;
    }
  }

  assert.ok(exactPixels / comparedPixels > 0.9);
  assert.ok(Math.sqrt(squaredError / (comparedPixels * 3)) < 0.8);
  assert.ok(Math.sqrt(edgeSquaredError / (edgePixels * 3)) < 0.75);
});

test("keeps the representative public card comfortably below 15MB", async () => {
  const base = await loadRepresentativePublicCard();
  const bytes = encodeProfileCardGif(base);
  const metadata = assertProfileGifContract(bytes);

  assert.ok(metadata.byteLength < PROFILE_GIF_PRESET.maxBytes);
});

async function loadRepresentativePublicCard() {
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
  return context.getImageData(
    0,
    0,
    PROFILE_GIF_PRESET.width,
    PROFILE_GIF_PRESET.height
  ).data;
}

function isNearApprovedCardEdge(pixelIndex) {
  const { borderRadius, height, width } = PROFILE_GIF_PRESET;
  const pointX = pixelIndex % width + 0.5;
  const pointY = Math.floor(pixelIndex / width) + 0.5;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const qx = Math.abs(pointX - halfWidth) - (halfWidth - borderRadius);
  const qy = Math.abs(pointY - halfHeight) - (halfHeight - borderRadius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return -(outside + inside - borderRadius) <= borderRadius;
}

function createRepresentativeBase() {
  const { width, height, borderRadius } = PROFILE_GIF_PRESET;
  const rgba = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nearestX = Math.max(borderRadius, Math.min(width - borderRadius, x + 0.5));
      const nearestY = Math.max(borderRadius, Math.min(height - borderRadius, y + 0.5));
      const dx = x + 0.5 - nearestX;
      const dy = y + 0.5 - nearestY;
      if (dx * dx + dy * dy > borderRadius * borderRadius) {
        continue;
      }

      const offset = (y * width + x) * 4;
      const stripe = Math.floor(x / 40) % 4;
      rgba[offset] = 12 + stripe * 7;
      rgba[offset + 1] = 19 + stripe * 8;
      rgba[offset + 2] = 35 + stripe * 12;
      rgba[offset + 3] = 255;
    }
  }
  return rgba;
}
