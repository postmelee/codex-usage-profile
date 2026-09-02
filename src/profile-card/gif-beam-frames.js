import { normalizeCardTheme } from "./theme.js";

const ASSET_MAGIC = Object.freeze([0x42, 0x45, 0x41, 0x4d]);
const ASSET_VERSION = 1;
const FRAME_COUNT = 96;
const FRAME_HEIGHT = 612;
const FRAME_WIDTH = 998;
const MAX_COMPRESSED_BYTES = 3_000_000;
const MAX_DECOMPRESSED_BYTES = 25_000_000;

export const PROFILE_GIF_BEAM_ASSET_CONTRACT = Object.freeze({
  frameCount: FRAME_COUNT,
  height: FRAME_HEIGHT,
  maxCompressedBytes: MAX_COMPRESSED_BYTES,
  maxDecompressedBytes: MAX_DECOMPRESSED_BYTES,
  version: ASSET_VERSION,
  width: FRAME_WIDTH
});

export const PROFILE_GIF_BEAM_ASSET_URL = new URL(
  "./assets/ocean-beam-x-radius-v2.rgba-runs.bin",
  import.meta.url
);

export const PROFILE_GIF_LIGHT_BEAM_ASSET_URL = new URL(
  "./assets/ocean-light-keyline-x-radius-v2.rgba-runs.bin",
  import.meta.url
);

export function getProfileGifBeamAssetUrl(theme) {
  return normalizeCardTheme(theme) === "light"
    ? PROFILE_GIF_LIGHT_BEAM_ASSET_URL
    : PROFILE_GIF_BEAM_ASSET_URL;
}

export async function loadProfileGifBeamFrames(options = {}) {
  const environment = options.environment ?? globalThis;
  const fetchImpl = options.fetchImpl ?? environment.fetch?.bind(environment);
  const DecompressionStreamConstructor = options.DecompressionStream ??
    environment.DecompressionStream;
  const assetUrl = options.assetUrl ?? getProfileGifBeamAssetUrl(options.theme);

  if (
    typeof fetchImpl !== "function" ||
    typeof DecompressionStreamConstructor !== "function"
  ) {
    throw new TypeError("GIF beam assets require fetch and gzip decompression");
  }

  let response;
  try {
    response = await fetchImpl(assetUrl);
  } catch {
    throw new Error("GIF beam asset could not be loaded");
  }
  if (!response?.ok || !response.body) {
    throw new Error("GIF beam asset could not be loaded");
  }

  let bytes;
  try {
    // Fetch decodes HTTP Content-Encoding before exposing the body, so its
    // Content-Length can be absent or describe different bytes. Bound the
    // actual gzip asset instead, before starting application-level decoding.
    const compressed = await readBoundedBytes(
      response.body,
      MAX_COMPRESSED_BYTES,
      "GIF beam asset exceeds its compressed size contract"
    );
    const decompressed = new Response(compressed).body.pipeThrough(
      new DecompressionStreamConstructor("gzip")
    );
    bytes = await readBoundedBytes(
      decompressed,
      MAX_DECOMPRESSED_BYTES,
      "GIF beam asset exceeds its decoded size contract"
    );
  } catch (error) {
    if (error instanceof RangeError) throw error;
    throw new Error("GIF beam asset could not be decompressed");
  }
  return parseProfileGifBeamFrames(bytes);
}

async function readBoundedBytes(stream, maxBytes, sizeErrorMessage) {
  const reader = stream.getReader();
  const chunks = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new RangeError(sizeErrorMessage);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export function parseProfileGifBeamFrames(input) {
  const bytes = normalizeBytes(input);
  if (bytes.byteLength < 8 || bytes.byteLength > MAX_DECOMPRESSED_BYTES) {
    throw new RangeError("GIF beam asset has an invalid byte length");
  }
  for (let index = 0; index < ASSET_MAGIC.length; index += 1) {
    if (bytes[index] !== ASSET_MAGIC[index]) {
      throw new TypeError("GIF beam asset has an invalid signature");
    }
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint16(4, true);
  const frameCount = view.getUint16(6, true);
  if (version !== ASSET_VERSION || frameCount !== FRAME_COUNT) {
    throw new TypeError("GIF beam asset has an unsupported contract");
  }

  const frameOffsets = new Uint32Array(frameCount);
  const effectPixelCounts = new Uint32Array(frameCount);
  let offset = 8;
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    assertReadable(bytes, offset, 6);
    const frameByteLength = view.getUint32(offset, true);
    const frameStart = offset + 4;
    const frameEnd = frameStart + frameByteLength;
    assertReadable(bytes, frameStart, frameByteLength);
    frameOffsets[frameIndex] = frameStart;

    const runCount = view.getUint16(frameStart, true);
    let runOffset = frameStart + 2;
    let pixelCount = 0;
    for (let runIndex = 0; runIndex < runCount; runIndex += 1) {
      assertReadable(bytes, runOffset, 6);
      const y = view.getUint16(runOffset, true);
      const x = view.getUint16(runOffset + 2, true);
      const length = view.getUint16(runOffset + 4, true);
      runOffset += 6;
      if (
        y >= FRAME_HEIGHT ||
        x >= FRAME_WIDTH ||
        length <= 0 ||
        x + length > FRAME_WIDTH
      ) {
        throw new RangeError("GIF beam asset contains an invalid pixel run");
      }
      const rgbaByteLength = length * 4;
      assertReadable(bytes, runOffset, rgbaByteLength);
      for (let alphaOffset = runOffset + 3;
        alphaOffset < runOffset + rgbaByteLength;
        alphaOffset += 4) {
        if (bytes[alphaOffset] === 0) {
          throw new TypeError("GIF beam asset runs must contain visible pixels");
        }
      }
      runOffset += rgbaByteLength;
      pixelCount += length;
    }
    if (runOffset !== frameEnd) {
      throw new RangeError("GIF beam asset frame length does not match its runs");
    }
    effectPixelCounts[frameIndex] = pixelCount;
    offset = frameEnd;
  }
  if (offset !== bytes.byteLength) {
    throw new RangeError("GIF beam asset contains trailing bytes");
  }

  return Object.freeze({
    bytes,
    effectPixelCounts,
    frameCount,
    frameOffsets,
    height: FRAME_HEIGHT,
    version,
    width: FRAME_WIDTH
  });
}

export function createProfileGifGoldenFrameRenderer(baseRgba, beamFrames) {
  assertBase(baseRgba);
  assertFrames(beamFrames);
  const base = new Uint8ClampedArray(baseRgba);
  const { bytes, effectPixelCounts, frameOffsets } = beamFrames;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  return Object.freeze({
    effectPixelCount: Math.max(...effectPixelCounts),
    renderFrame(frameIndex, target) {
      assertFrameIndex(frameIndex);
      const output = normalizeTarget(target, base.length);
      output.set(base);

      let runOffset = frameOffsets[frameIndex];
      const runCount = view.getUint16(runOffset, true);
      runOffset += 2;
      for (let runIndex = 0; runIndex < runCount; runIndex += 1) {
        const y = view.getUint16(runOffset, true);
        const x = view.getUint16(runOffset + 2, true);
        const length = view.getUint16(runOffset + 4, true);
        runOffset += 6;
        let outputOffset = (y * FRAME_WIDTH + x) * 4;
        for (let pixel = 0; pixel < length; pixel += 1) {
          compositeSourceOver(output, outputOffset, bytes, runOffset);
          outputOffset += 4;
          runOffset += 4;
        }
      }
      return output;
    }
  });
}

function compositeSourceOver(output, outputOffset, source, sourceOffset) {
  const sourceAlpha = source[sourceOffset + 3];
  const destinationAlpha = output[outputOffset + 3];
  const retainedAlpha = destinationAlpha * (255 - sourceAlpha) / 255;
  const outputAlpha = sourceAlpha + retainedAlpha;

  for (let channel = 0; channel < 3; channel += 1) {
    output[outputOffset + channel] = outputAlpha === 0
      ? 0
      : Math.round(
        (source[sourceOffset + channel] * sourceAlpha +
          output[outputOffset + channel] * retainedAlpha) /
        outputAlpha
      );
  }
  output[outputOffset + 3] = Math.round(outputAlpha);
}

function normalizeBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  throw new TypeError("GIF beam asset must be byte data");
}

function assertReadable(bytes, offset, length) {
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(length) ||
    offset < 0 ||
    length < 0 ||
    offset + length > bytes.byteLength
  ) {
    throw new RangeError("GIF beam asset ended unexpectedly");
  }
}

function assertBase(baseRgba) {
  if (
    (!(baseRgba instanceof Uint8Array) &&
      !(baseRgba instanceof Uint8ClampedArray)) ||
    baseRgba.length !== FRAME_WIDTH * FRAME_HEIGHT * 4
  ) {
    throw new TypeError("GIF golden renderer requires a 998 by 612 RGBA base");
  }
}

function assertFrames(beamFrames) {
  if (
    !beamFrames ||
    beamFrames.version !== ASSET_VERSION ||
    beamFrames.frameCount !== FRAME_COUNT ||
    beamFrames.width !== FRAME_WIDTH ||
    beamFrames.height !== FRAME_HEIGHT ||
    !(beamFrames.bytes instanceof Uint8Array) ||
    !(beamFrames.frameOffsets instanceof Uint32Array) ||
    !(beamFrames.effectPixelCounts instanceof Uint32Array)
  ) {
    throw new TypeError("GIF golden renderer requires validated beam frames");
  }
}

function assertFrameIndex(frameIndex) {
  if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= FRAME_COUNT) {
    throw new RangeError(`GIF frame index must be between 0 and ${FRAME_COUNT - 1}`);
  }
}

function normalizeTarget(target, expectedLength) {
  if (target === undefined) return new Uint8ClampedArray(expectedLength);
  if (!(target instanceof Uint8ClampedArray) || target.length !== expectedLength) {
    throw new TypeError("GIF frame target must be a matching Uint8ClampedArray");
  }
  return target;
}
