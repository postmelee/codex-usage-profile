import gifencDefault, * as gifencNamespace from "gifenc";

import {
  PROFILE_GIF_PRESET,
  createProfileGifFrameRenderer
} from "./gif-animation.js";

const ANIMATION_PALETTE_SAMPLE_STRIDE = 128;
const ALPHA_THRESHOLD = 127;
const OPAQUE_PALETTE_FORMAT = "rgb565";
const RESERVED_BASE_COLOR_COUNT = 16;
const RESERVED_EDGE_COLOR_COUNT = 48;
const TRANSPARENT_COLOR = Object.freeze([0, 0, 0, 0]);
const GIFEncoder = gifencNamespace.GIFEncoder ??
  gifencDefault.GIFEncoder ?? gifencDefault;
const quantize = gifencNamespace.quantize ?? gifencDefault.quantize;

export function encodeProfileCardGif(baseRgba, options = {}) {
  throwIfAborted(options.signal);
  const renderer = createProfileGifFrameRenderer(baseRgba, {
    beamFrames: options.beamFrames,
    theme: options.theme
  });
  const frame = new Uint8ClampedArray(baseRgba.length);
  if (!hasTransparentPixels(baseRgba)) {
    throw new Error("GIF base frame must include transparent background pixels");
  }
  const palette = createAnimationPalette(baseRgba, renderer, frame, options.signal);
  const transparentIndex = 0;

  const encoder = GIFEncoder({ initialCapacity: 8 * 1024 * 1024 });
  const paletteMapper = createGifGlobalPaletteMapper(palette, transparentIndex);
  const firstFrame = renderer.renderFrame(0, frame);
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

export function createProfileGifGlobalPalette(baseRgba, options = {}) {
  throwIfAborted(options.signal);
  const renderer = createProfileGifFrameRenderer(baseRgba, {
    beamFrames: options.beamFrames,
    theme: options.theme
  });
  const frame = new Uint8ClampedArray(baseRgba.length);
  return createAnimationPalette(baseRgba, renderer, frame, options.signal);
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

function createAnimationPalette(baseRgba, renderer, frame, signal) {
  const baseColors = selectFrequentColors(baseRgba, RESERVED_BASE_COLOR_COUNT);
  const baseKeys = new Set(baseColors.map(packColor));
  const edgeHistogram = new Map();
  const pixelCount = PROFILE_GIF_PRESET.width * PROFILE_GIF_PRESET.height;
  const maximumSamplePixels = Math.ceil(
    pixelCount / ANIMATION_PALETTE_SAMPLE_STRIDE
  ) * PROFILE_GIF_PRESET.frameCount;
  const sample = new Uint8Array(maximumSamplePixels * 4);
  let sampleLength = 0;

  for (let frameIndex = 0; frameIndex < PROFILE_GIF_PRESET.frameCount; frameIndex += 1) {
    throwIfAborted(signal);
    renderer.renderFrame(frameIndex, frame);
    for (
      let pixelIndex = frameIndex % ANIMATION_PALETTE_SAMPLE_STRIDE;
      pixelIndex < pixelCount;
      pixelIndex += ANIMATION_PALETTE_SAMPLE_STRIDE
    ) {
      const offset = pixelIndex * 4;
      if (frame[offset + 3] <= ALPHA_THRESHOLD) {
        continue;
      }
      const key = packRgb(frame[offset], frame[offset + 1], frame[offset + 2]);
      if (baseKeys.has(key)) {
        continue;
      }
      if (isNearCardEdge(pixelIndex)) {
        edgeHistogram.set(key, (edgeHistogram.get(key) ?? 0) + 1);
      }
      sample.set(frame.subarray(offset, offset + 4), sampleLength);
      sampleLength += 4;
    }
  }

  const edgeColors = selectHistogramColors(edgeHistogram, RESERVED_EDGE_COLOR_COUNT);
  const edgeKeys = new Set(edgeColors.map(packColor));
  let filteredSampleLength = 0;
  for (let offset = 0; offset < sampleLength; offset += 4) {
    const key = packRgb(sample[offset], sample[offset + 1], sample[offset + 2]);
    if (edgeKeys.has(key)) {
      continue;
    }
    sample.copyWithin(filteredSampleLength, offset, offset + 4);
    filteredSampleLength += 4;
  }

  const reservedColors = [...baseColors, ...edgeColors];
  const remainingColorCount = PROFILE_GIF_PRESET.maxColors -
    reservedColors.length - 1;
  const quantizedColors = filteredSampleLength === 0 || remainingColorCount <= 0
    ? []
    : quantize(sample.subarray(0, filteredSampleLength), remainingColorCount, {
      format: OPAQUE_PALETTE_FORMAT
    }).map(([red, green, blue]) => [red, green, blue, 255]);

  return mergePaletteColors(reservedColors, quantizedColors);
}

function selectFrequentColors(rgba, maximumColorCount) {
  const histogram = new Map();
  for (let offset = 0; offset < rgba.length; offset += 4) {
    if (rgba[offset + 3] <= ALPHA_THRESHOLD) {
      continue;
    }
    const key = packRgb(rgba[offset], rgba[offset + 1], rgba[offset + 2]);
    histogram.set(key, (histogram.get(key) ?? 0) + 1);
  }

  return selectHistogramColors(histogram, maximumColorCount);
}

function selectHistogramColors(histogram, maximumColorCount) {
  return [...histogram.entries()]
    .sort((left, right) => right[1] - left[1] || left[0] - right[0])
    .slice(0, maximumColorCount)
    .map(([key]) => unpackColor(key));
}

function isNearCardEdge(pixelIndex) {
  const { borderRadius, height, width } = PROFILE_GIF_PRESET;
  const pointX = pixelIndex % width + 0.5;
  const pointY = Math.floor(pixelIndex / width) + 0.5;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const qx = Math.abs(pointX - halfWidth) - (halfWidth - borderRadius);
  const qy = Math.abs(pointY - halfHeight) - (halfHeight - borderRadius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  const inwardDistance = -(outside + inside - borderRadius);
  return inwardDistance <= borderRadius;
}

function mergePaletteColors(reservedColors, quantizedColors) {
  const colors = [TRANSPARENT_COLOR];
  const seen = new Set();

  for (const color of [...reservedColors, ...quantizedColors]) {
    const key = packColor(color);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    colors.push(color);
    if (colors.length === PROFILE_GIF_PRESET.maxColors) {
      break;
    }
  }
  return colors;
}

function hasTransparentPixels(rgba) {
  for (let offset = 3; offset < rgba.length; offset += 4) {
    if (rgba[offset] <= ALPHA_THRESHOLD) {
      return true;
    }
  }
  return false;
}

function packColor(color) {
  return packRgb(color[0], color[1], color[2]);
}

function packRgb(red, green, blue) {
  return red | (green << 8) | (blue << 16);
}

function unpackColor(key) {
  return [key & 255, (key >>> 8) & 255, (key >>> 16) & 255, 255];
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
