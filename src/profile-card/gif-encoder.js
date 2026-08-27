import gifencDefault, * as gifencNamespace from "gifenc";

import {
  PROFILE_GIF_PRESET,
  createProfileGifFrameRenderer
} from "./gif-animation.js";

const PALETTE_FORMAT = "rgba4444";
const ALPHA_THRESHOLD = 127;
const GIFEncoder = gifencNamespace.GIFEncoder ??
  gifencDefault.GIFEncoder ?? gifencDefault;
const quantize = gifencNamespace.quantize ?? gifencDefault.quantize;

export function encodeProfileCardGif(baseRgba, options = {}) {
  throwIfAborted(options.signal);
  const renderer = createProfileGifFrameRenderer(baseRgba, {
    theme: options.theme
  });
  const frame = new Uint8ClampedArray(baseRgba.length);
  const firstFrame = renderer.renderFrame(0, frame);
  const palette = quantize(firstFrame, PROFILE_GIF_PRESET.maxColors, {
    clearAlpha: true,
    clearAlphaColor: 0,
    clearAlphaThreshold: ALPHA_THRESHOLD,
    format: PALETTE_FORMAT,
    oneBitAlpha: ALPHA_THRESHOLD
  });
  const transparentIndex = palette.findIndex((color) => color[3] === 0);

  if (transparentIndex < 0) {
    throw new Error("GIF base frame must include transparent background pixels");
  }

  const encoder = GIFEncoder({ initialCapacity: 8 * 1024 * 1024 });
  const paletteMapper = createGifGlobalPaletteMapper(palette, transparentIndex);
  writeFrame(
    encoder,
    paletteMapper.apply(firstFrame),
    palette,
    transparentIndex,
    true
  );
  reportProgress(options.onProgress, 1);

  for (let frameIndex = 1; frameIndex < PROFILE_GIF_PRESET.frameCount; frameIndex += 1) {
    throwIfAborted(options.signal);
    renderer.renderFrame(frameIndex, frame);
    writeFrame(
      encoder,
      paletteMapper.apply(frame),
      palette,
      transparentIndex,
      false
    );
    reportProgress(options.onProgress, frameIndex + 1);
  }

  encoder.finish();
  const bytes = encoder.bytes();
  if (bytes.length >= PROFILE_GIF_PRESET.maxBytes) {
    throw new RangeError(
      `Encoded GIF is ${bytes.length} bytes; it must stay below ${PROFILE_GIF_PRESET.maxBytes}`
    );
  }
  return bytes;
}

export function createGifGlobalPaletteMapper(palette, transparentIndex) {
  if (!Array.isArray(palette) || palette.length === 0 || palette.length > 256) {
    throw new TypeError("GIF palette must contain between 1 and 256 colors");
  }
  if (
    !Number.isInteger(transparentIndex) ||
    transparentIndex < 0 ||
    transparentIndex >= palette.length ||
    palette[transparentIndex]?.[3] !== 0
  ) {
    throw new TypeError("GIF palette must identify a transparent color index");
  }

  const cache = new Map();
  const opaquePalette = palette
    .map((color, index) => ({ color, index }))
    .filter(({ color }) => color[3] !== 0);

  return Object.freeze({
    apply(rgba) {
      const indexed = new Uint8Array(rgba.length / 4);
      for (let offset = 0, pixel = 0; offset < rgba.length; offset += 4, pixel += 1) {
        if (rgba[offset + 3] <= ALPHA_THRESHOLD) {
          indexed[pixel] = transparentIndex;
          continue;
        }

        const key = rgba[offset] | (rgba[offset + 1] << 8) | (rgba[offset + 2] << 16);
        let paletteIndex = cache.get(key);
        if (paletteIndex === undefined) {
          paletteIndex = findNearestOpaqueColor(
            rgba[offset],
            rgba[offset + 1],
            rgba[offset + 2],
            opaquePalette
          );
          cache.set(key, paletteIndex);
        }
        indexed[pixel] = paletteIndex;
      }
      return indexed;
    }
  });
}

function writeFrame(encoder, indexed, palette, transparentIndex, first) {
  encoder.writeFrame(
    indexed,
    PROFILE_GIF_PRESET.width,
    PROFILE_GIF_PRESET.height,
    {
      delay: PROFILE_GIF_PRESET.frameDelayMs,
      dispose: 1,
      palette: first ? palette : undefined,
      repeat: PROFILE_GIF_PRESET.loopCount,
      transparent: true,
      transparentIndex
    }
  );
}

function findNearestOpaqueColor(red, green, blue, palette) {
  let nearestIndex = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const entry of palette) {
    const redDelta = entry.color[0] - red;
    const greenDelta = entry.color[1] - green;
    const blueDelta = entry.color[2] - blue;
    const distance = redDelta * redDelta +
      greenDelta * greenDelta +
      blueDelta * blueDelta;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = entry.index;
    }
  }

  if (nearestIndex < 0) {
    throw new TypeError("GIF palette must include at least one opaque color");
  }
  return nearestIndex;
}

function reportProgress(onProgress, completedFrames) {
  if (typeof onProgress === "function") {
    onProgress(Object.freeze({
      completedFrames,
      totalFrames: PROFILE_GIF_PRESET.frameCount
    }));
  }
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("GIF encoding was aborted", "AbortError");
  }
}
