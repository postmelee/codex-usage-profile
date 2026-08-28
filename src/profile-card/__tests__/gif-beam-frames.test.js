import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import test from "node:test";

import {
  PROFILE_GIF_BEAM_ASSET_CONTRACT,
  PROFILE_GIF_BEAM_ASSET_URL,
  createProfileGifGoldenFrameRenderer,
  loadProfileGifBeamFrames,
  parseProfileGifBeamFrames
} from "../gif-beam-frames.js";
import { PROFILE_GIF_PRESET } from "../gif-animation.js";

const COMPRESSED_ASSET_SHA256 =
  "aacd0c7bebf857152ec3984160d1212dd10bbc9ae941d16deaba8f986ae8a680";

test("loads the approved Chrome beam capture as one bounded gzip asset", async () => {
  const compressed = await readFile(PROFILE_GIF_BEAM_ASSET_URL);
  const frames = await loadProfileGifBeamFrames({
    async fetchImpl() {
      return new Response(compressed, {
        headers: { "content-length": String(compressed.byteLength) }
      });
    }
  });

  assert.equal(
    createHash("sha256").update(compressed).digest("hex"),
    COMPRESSED_ASSET_SHA256
  );
  assert.deepEqual({
    frameCount: frames.frameCount,
    height: frames.height,
    version: frames.version,
    width: frames.width
  }, {
    frameCount: PROFILE_GIF_PRESET.frameCount,
    height: PROFILE_GIF_PRESET.height,
    version: PROFILE_GIF_BEAM_ASSET_CONTRACT.version,
    width: PROFILE_GIF_PRESET.width
  });
  assert.ok(compressed.byteLength < PROFILE_GIF_BEAM_ASSET_CONTRACT.maxCompressedBytes);
  assert.ok(frames.bytes.byteLength < PROFILE_GIF_BEAM_ASSET_CONTRACT.maxDecompressedBytes);
  assert.ok(frames.effectPixelCounts.every((count) => count > 40_000));
});

test("renders a deterministic source-over frame while preserving the card center", async () => {
  const compressed = await readFile(PROFILE_GIF_BEAM_ASSET_URL);
  const frames = parseProfileGifBeamFrames(gunzipSync(compressed));
  const base = createBase();
  const renderer = createProfileGifGoldenFrameRenderer(base, frames);
  const first = renderer.renderFrame(0);
  const quarter = renderer.renderFrame(24);
  const center = (306 * PROFILE_GIF_PRESET.width + 499) * 4;

  assert.deepEqual(
    Array.from(first.subarray(center, center + 4)),
    Array.from(base.subarray(center, center + 4))
  );
  assert.notDeepEqual(first, quarter);
  assert.equal(
    createHash("sha256").update(first).digest("hex"),
    "88ba300bb147d5c60883a1796614dc5ad5272a07e1899ddc61d15d7bde857505"
  );
  assert.equal(renderer.effectPixelCount, 59_392);
});

test("keeps the approved Chrome beam seamless on a transparent fixed card", async () => {
  const compressed = await readFile(PROFILE_GIF_BEAM_ASSET_URL);
  const frames = parseProfileGifBeamFrames(gunzipSync(compressed));
  const base = createRoundedBase();
  const renderer = createProfileGifGoldenFrameRenderer(base, frames);
  const last = new Uint8ClampedArray(renderer.renderFrame(95));
  const first = new Uint8ClampedArray(renderer.renderFrame(0));
  const second = new Uint8ClampedArray(renderer.renderFrame(1));
  const seamDelta = frameRgbaDelta(last, first);
  const adjacentDelta = frameRgbaDelta(first, second);
  const center = (306 * PROFILE_GIF_PRESET.width + 499) * 4;

  assert.ok(seamDelta > 0, "frame 95 must not duplicate frame 0");
  assert.ok(seamDelta / adjacentDelta > 0.95);
  assert.ok(seamDelta / adjacentDelta < 1.05);
  for (const frame of [last, first, second]) {
    assert.deepEqual(
      Array.from(frame.subarray(center, center + 4)),
      Array.from(base.subarray(center, center + 4))
    );
    for (const pixelIndex of [
      0,
      PROFILE_GIF_PRESET.width - 1,
      (PROFILE_GIF_PRESET.height - 1) * PROFILE_GIF_PRESET.width,
      PROFILE_GIF_PRESET.width * PROFILE_GIF_PRESET.height - 1
    ]) {
      assert.equal(frame[pixelIndex * 4 + 3], 0);
    }
  }
});

test("rejects truncated, trailing, and unsupported beam assets", () => {
  assert.throws(() => parseProfileGifBeamFrames(new Uint8Array(8)), /signature/);

  const unsupported = Uint8Array.from([
    0x42, 0x45, 0x41, 0x4d,
    0x02, 0x00,
    0x60, 0x00
  ]);
  assert.throws(() => parseProfileGifBeamFrames(unsupported), /unsupported/);
});

function createBase() {
  const rgba = new Uint8ClampedArray(
    PROFILE_GIF_PRESET.width * PROFILE_GIF_PRESET.height * 4
  );
  for (let offset = 0; offset < rgba.length; offset += 4) {
    rgba.set([24, 24, 24, 255], offset);
  }
  return rgba;
}

function createRoundedBase() {
  const { borderRadius, height, width } = PROFILE_GIF_PRESET;
  const rgba = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nearestX = Math.max(borderRadius, Math.min(width - borderRadius, x + 0.5));
      const nearestY = Math.max(borderRadius, Math.min(height - borderRadius, y + 0.5));
      const dx = x + 0.5 - nearestX;
      const dy = y + 0.5 - nearestY;
      if (dx * dx + dy * dy > borderRadius * borderRadius) continue;

      const offset = (y * width + x) * 4;
      rgba.set([24, 24, 24, 255], offset);
    }
  }
  return rgba;
}

function frameRgbaDelta(left, right) {
  let total = 0;
  for (let offset = 0; offset < left.length; offset += 1) {
    total += Math.abs(left[offset] - right[offset]);
  }
  return total;
}
