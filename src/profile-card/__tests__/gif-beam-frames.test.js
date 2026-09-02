import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gunzipSync, gzipSync } from "node:zlib";
import test from "node:test";

import {
  PROFILE_GIF_BEAM_ASSET_CONTRACT,
  PROFILE_GIF_BEAM_ASSET_URL,
  PROFILE_GIF_LIGHT_BEAM_ASSET_URL,
  createProfileGifGoldenFrameRenderer,
  getProfileGifBeamAssetUrl,
  loadProfileGifBeamFrames,
  parseProfileGifBeamFrames
} from "../gif-beam-frames.js";
import { PROFILE_GIF_PRESET } from "../gif-animation.js";

const COMPRESSED_ASSET_SHA256 =
  "93025a7294a4af8ef481f8723a5639aef1b328b39d1f6186f65462fbdbd08e1a";
const LIGHT_COMPRESSED_ASSET_SHA256 =
  "bb77b1f9484db082319707ff8037e8929082d5c13ec8021f22c5e1dbb03a358d";

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
  assert.ok(frames.effectPixelCounts.every((count) => count > 34_000));
});

test("selects the X-radius dark and light Chrome captures", async () => {
  const compressed = await readFile(PROFILE_GIF_LIGHT_BEAM_ASSET_URL);
  let requestedUrl;
  const frames = await loadProfileGifBeamFrames({
    async fetchImpl(assetUrl) {
      requestedUrl = assetUrl;
      return new Response(compressed, {
        headers: { "content-length": String(compressed.byteLength) }
      });
    },
    theme: "light"
  });

  assert.equal(getProfileGifBeamAssetUrl("dark"), PROFILE_GIF_BEAM_ASSET_URL);
  assert.equal(getProfileGifBeamAssetUrl("light"), PROFILE_GIF_LIGHT_BEAM_ASSET_URL);
  assert.equal(requestedUrl, PROFILE_GIF_LIGHT_BEAM_ASSET_URL);
  assert.equal(
    createHash("sha256").update(compressed).digest("hex"),
    LIGHT_COMPRESSED_ASSET_SHA256
  );
  assert.ok(compressed.byteLength < PROFILE_GIF_BEAM_ASSET_CONTRACT.maxCompressedBytes);
  assert.ok(frames.bytes.byteLength < PROFILE_GIF_BEAM_ASSET_CONTRACT.maxDecompressedBytes);
  assert.ok(frames.effectPixelCounts.every((count) => count > 20_000));
});

test("loads both golden bodies independently of HTTP length and content encoding headers", async () => {
  for (const theme of ["dark", "light"]) {
    const compressed = await readFile(getProfileGifBeamAssetUrl(theme));
    for (const headers of [
      {},
      { "content-length": "0" },
      { "content-length": "1" },
      { "content-length": "unknown" },
      {
        "content-encoding": "gzip",
        "content-length": String(PROFILE_GIF_BEAM_ASSET_CONTRACT.maxCompressedBytes + 1)
      }
    ]) {
      // Fetch has already decoded HTTP Content-Encoding. The body still contains
      // the application's gzip asset, regardless of its wire-length header.
      const frames = await loadProfileGifBeamFrames({
        fetchImpl: async () => new Response(compressed, { headers }),
        theme
      });
      assert.equal(frames.frameCount, 96);
      assert.deepEqual(frames.bytes, new Uint8Array(gunzipSync(compressed)));
    }
  }
  assert.equal(getProfileGifBeamAssetUrl(" LIGHT "), PROFILE_GIF_LIGHT_BEAM_ASSET_URL);
});

test("accepts a valid gzip body exactly at the compressed byte limit", async () => {
  const compressed = await readFile(PROFILE_GIF_LIGHT_BEAM_ASSET_URL);
  assert.equal(compressed[3], 0, "fixture has no optional gzip header fields");
  // Add a legal zero-terminated FCOMMENT without changing the decoded frames.
  const commentLength = PROFILE_GIF_BEAM_ASSET_CONTRACT.maxCompressedBytes - compressed.length;
  const padded = Buffer.concat([
    compressed.subarray(0, 3), Buffer.from([0x10]), compressed.subarray(4, 10),
    Buffer.alloc(commentLength - 1, 0x61), Buffer.from([0]), compressed.subarray(10)
  ]);
  const frames = await loadProfileGifBeamFrames({
    fetchImpl: async () => new Response(padded)
  });
  assert.equal(padded.length, PROFILE_GIF_BEAM_ASSET_CONTRACT.maxCompressedBytes);
  assert.deepEqual(frames.bytes, new Uint8Array(gunzipSync(compressed)));
});

test("cancels oversized compressed bodies even without an accurate length header", async () => {
  for (const headers of [{}, { "content-length": "1" }]) {
    let cancelled = false;
    let pulled = 0;
    let decompressionStarted = false;
    const body = new ReadableStream({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(pulled === 1
          ? PROFILE_GIF_BEAM_ASSET_CONTRACT.maxCompressedBytes : 1));
        if (pulled === 3) controller.close();
      },
      cancel() { cancelled = true; }
    }, { highWaterMark: 0 });
    await assert.rejects(loadProfileGifBeamFrames({
      fetchImpl: async () => new Response(body, { headers }),
      DecompressionStream: class {
        constructor() {
          decompressionStarted = true;
          return new DecompressionStream("gzip");
        }
      }
    }), { name: "RangeError", message: "GIF beam asset exceeds its compressed size contract" });
    assert.equal(cancelled, true);
    assert.equal(pulled, 2);
    assert.equal(decompressionStarted, false);
    assert.equal(body.locked, false);
  }
});

test("rejects gzip data expanding beyond the decoded byte limit", async () => {
  const compressed = gzipSync(new Uint8Array(
    PROFILE_GIF_BEAM_ASSET_CONTRACT.maxDecompressedBytes + 1
  ));
  await assert.rejects(loadProfileGifBeamFrames({
    fetchImpl: async () => new Response(compressed)
  }), { name: "RangeError", message: "GIF beam asset exceeds its decoded size contract" });
});

test("stops reading and cancels as soon as decoded bytes exceed the limit", async () => {
  let cancelled = false;
  let pulled = 0;
  const readable = new ReadableStream({
    pull(controller) {
      pulled += 1;
      controller.enqueue(new Uint8Array(pulled === 1
        ? PROFILE_GIF_BEAM_ASSET_CONTRACT.maxDecompressedBytes : 1));
      if (pulled === 3) controller.close();
    },
    cancel() {
      cancelled = true;
      throw new Error("cancellation failure must not hide the size error");
    }
  }, { highWaterMark: 0 });
  await assert.rejects(loadProfileGifBeamFrames({
    fetchImpl: async () => new Response(new Uint8Array([1])),
    DecompressionStream: class {
      constructor(format) {
        assert.equal(format, "gzip");
        return { readable, writable: new WritableStream() };
      }
    }
  }), { name: "RangeError", message: "GIF beam asset exceeds its decoded size contract" });
  assert.equal(cancelled, true);
  assert.equal(pulled, 2);
  assert.equal(readable.locked, false);
});

test("keeps malformed and empty gzip bodies as decompression errors", async () => {
  for (const bytes of [new Uint8Array(), new Uint8Array([1, 2, 3])]) {
    await assert.rejects(loadProfileGifBeamFrames({
      fetchImpl: async () => new Response(bytes)
    }), { name: "Error", message: "GIF beam asset could not be decompressed" });
  }
});

test("keeps light and dark on the same perimeter motion while changing contrast", async () => {
  const [darkCompressed, lightCompressed] = await Promise.all([
    readFile(PROFILE_GIF_BEAM_ASSET_URL),
    readFile(PROFILE_GIF_LIGHT_BEAM_ASSET_URL)
  ]);
  const darkFrames = parseProfileGifBeamFrames(gunzipSync(darkCompressed));
  const lightFrames = parseProfileGifBeamFrames(gunzipSync(lightCompressed));
  const base = createBase([255, 255, 255, 255]);
  const renderer = createProfileGifGoldenFrameRenderer(base, lightFrames);
  const first = renderer.renderFrame(0);
  const quarter = renderer.renderFrame(24);
  const middle = renderer.renderFrame(48);
  const thirdQuarter = renderer.renderFrame(72);
  const last = renderer.renderFrame(95);
  const center = (306 * PROFILE_GIF_PRESET.width + 499) * 4;

  assert.notDeepEqual(first, last);
  assert.notDeepEqual(quarter, middle);
  assert.notDeepEqual(middle, thirdQuarter);
  assert.deepEqual(
    Array.from(middle.subarray(center, center + 4)),
    Array.from(base.subarray(center, center + 4))
  );
  const expectedQuadrants = [
    "bottom-left",
    "top-left",
    "top-right",
    "bottom-right"
  ];
  assert.deepEqual(
    [0, 24, 48, 72].map((frameIndex) => (
      getBeamAlphaQuadrant(darkFrames, frameIndex)
    )),
    expectedQuadrants
  );
  assert.deepEqual(
    [0, 24, 48, 72].map((frameIndex) => (
      getBeamAlphaQuadrant(lightFrames, frameIndex)
    )),
    expectedQuadrants
  );
  assert.equal(
    createHash("sha256").update(middle).digest("hex"),
    "5f99fb8f32f94e9a4b6cacc611e13d709601cab0e6eda2e4c2004eca1beb4a93"
  );
  assert.equal(renderer.effectPixelCount, 57_327);

  const seamDelta = frameRgbaDelta(last, first);
  const adjacentDelta = frameRgbaDelta(first, renderer.renderFrame(1));
  assert.ok(seamDelta / adjacentDelta > 0.95);
  assert.ok(seamDelta / adjacentDelta < 1.05);
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
    "2472305d83419a3fb4e753d5fa32e3230014c39c3ddb80890454b460c0e8993d"
  );
  assert.equal(renderer.effectPixelCount, 54_117);
});

test("places both captured effects on the X 32px output radius", async () => {
  for (const assetUrl of [
    PROFILE_GIF_BEAM_ASSET_URL,
    PROFILE_GIF_LIGHT_BEAM_ASSET_URL
  ]) {
    const frames = parseProfileGifBeamFrames(gunzipSync(await readFile(assetUrl)));
    assert.equal(maximumAlphaAt(frames, 0, 0), 0);
    assert.equal(maximumAlphaAt(frames, 5, 5), 0);
    assert.ok(maximumAlphaAt(frames, 9, 10) > 0);
    assert.ok(maximumAlphaAt(frames, 32, 0) > 0);
  }
});

test("keeps the approved Chrome beam seamless on an opaque fixed card", async () => {
  const compressed = await readFile(PROFILE_GIF_BEAM_ASSET_URL);
  const frames = parseProfileGifBeamFrames(gunzipSync(compressed));
  const base = createOpaqueRoundedBase();
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
      assert.equal(frame[pixelIndex * 4 + 3], 255);
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

function createBase(color = [24, 24, 24, 255]) {
  const rgba = new Uint8ClampedArray(
    PROFILE_GIF_PRESET.width * PROFILE_GIF_PRESET.height * 4
  );
  for (let offset = 0; offset < rgba.length; offset += 4) {
    rgba.set(color, offset);
  }
  return rgba;
}

function createOpaqueRoundedBase() {
  const { borderRadius, height, width } = PROFILE_GIF_PRESET;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < rgba.length; offset += 4) {
    rgba.set([24, 24, 24, 255], offset);
  }

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

function maximumAlphaAt(frames, targetX, targetY) {
  const view = new DataView(
    frames.bytes.buffer,
    frames.bytes.byteOffset,
    frames.bytes.byteLength
  );
  let maximumAlpha = 0;
  for (let frameIndex = 0; frameIndex < frames.frameCount; frameIndex += 1) {
    let offset = frames.frameOffsets[frameIndex];
    const runCount = view.getUint16(offset, true);
    offset += 2;
    for (let runIndex = 0; runIndex < runCount; runIndex += 1) {
      const y = view.getUint16(offset, true);
      const x = view.getUint16(offset + 2, true);
      const length = view.getUint16(offset + 4, true);
      offset += 6;
      if (y === targetY && targetX >= x && targetX < x + length) {
        maximumAlpha = Math.max(
          maximumAlpha,
          frames.bytes[offset + (targetX - x) * 4 + 3]
        );
      }
      offset += length * 4;
    }
  }
  return maximumAlpha;
}

function getBeamAlphaQuadrant(frames, frameIndex) {
  const view = new DataView(
    frames.bytes.buffer,
    frames.bytes.byteOffset,
    frames.bytes.byteLength
  );
  let offset = frames.frameOffsets[frameIndex];
  const runCount = view.getUint16(offset, true);
  let alphaTotal = 0;
  let weightedX = 0;
  let weightedY = 0;
  offset += 2;

  for (let runIndex = 0; runIndex < runCount; runIndex += 1) {
    const y = view.getUint16(offset, true);
    const x = view.getUint16(offset + 2, true);
    const length = view.getUint16(offset + 4, true);
    offset += 6;
    for (let pixel = 0; pixel < length; pixel += 1) {
      const alpha = frames.bytes[offset + pixel * 4 + 3];
      alphaTotal += alpha;
      weightedX += (x + pixel) * alpha;
      weightedY += y * alpha;
    }
    offset += length * 4;
  }

  const horizontal = weightedX / alphaTotal < PROFILE_GIF_PRESET.width / 2
    ? "left"
    : "right";
  const vertical = weightedY / alphaTotal < PROFILE_GIF_PRESET.height / 2
    ? "top"
    : "bottom";
  return `${vertical}-${horizontal}`;
}
