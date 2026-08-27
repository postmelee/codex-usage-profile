import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createCanvas, loadImage } from "@napi-rs/canvas";

import { PROFILE_GIF_PRESET } from "../gif-animation.js";
import { assertProfileGifContract } from "../gif-binary.js";
import {
  createGifGlobalPaletteMapper,
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

test("keeps the representative public card comfortably below 15MB", async () => {
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

  const bytes = encodeProfileCardGif(
    context.getImageData(
      0,
      0,
      PROFILE_GIF_PRESET.width,
      PROFILE_GIF_PRESET.height
    ).data
  );
  const metadata = assertProfileGifContract(bytes);

  assert.ok(metadata.byteLength < 5_000_000);
});

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
