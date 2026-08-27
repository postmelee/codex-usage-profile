export const PROFILE_CARD_BORDER_BEAM_PRESET = Object.freeze({
  brightness: 1.05,
  colorVariant: "ocean",
  durationSeconds: 4.8,
  size: "md",
  strength: 0.82
});

export const GIF_EXPORT_PRESET_VERSION = 1;

export const PROFILE_GIF_PRESET = Object.freeze({
  borderRadius: 64,
  durationMs: 4_800,
  durationSeconds: PROFILE_CARD_BORDER_BEAM_PRESET.durationSeconds,
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
  version: GIF_EXPORT_PRESET_VERSION,
  width: 998
});

const BEAM_EDGE_FADE_DEPTH = 56;
const BEAM_STROKE_WIDTH = 2;
const BEAM_BLOOM_SIGMA = 9;
const BEAM_INNER_SHADOW_SIGMA = 10;
const OCEAN_GRADIENTS = Object.freeze([
  Object.freeze({ color: [100, 80, 220], position: [0.33, -0.074], size: [70, 40] }),
  Object.freeze({ color: [60, 120, 255], position: [0.12, -0.05], size: [60, 35] }),
  Object.freeze({ color: [80, 100, 200], position: [0.021, 0.683], size: [40, 70] }),
  Object.freeze({ color: [50, 140, 220], position: [0.021, 0.683], size: [20, 35] }),
  Object.freeze({ color: [120, 80, 255], position: [0.744, 1], size: [180, 32] }),
  Object.freeze({ color: [70, 130, 255], position: [0.55, 1], size: [85, 26] }),
  Object.freeze({ color: [140, 100, 240], position: [0.939, 0], size: [74, 32] }),
  Object.freeze({ color: [90, 110, 230], position: [1, 0.271], size: [26, 42] }),
  Object.freeze({ color: [130, 70, 255], position: [1, 0.271], size: [52, 48] })
]);
const BEAM_MASK_PROFILE = Object.freeze([
  [0, 0], [0.3, 0], [0.36, 0.1], [0.44, 0.35], [0.52, 1],
  [0.8, 1], [0.86, 0.35], [0.92, 0.1], [0.95, 0], [1, 0]
]);
const DARK_STROKE_PROFILE = Object.freeze([
  [0, 0], [0.54, 0], [0.57, 0.1], [0.6, 0.3], [0.63, 0.6],
  [0.66, 0.75], [0.69, 0.6], [0.72, 0.3], [0.75, 0.1],
  [0.78, 0], [1, 0]
]);
const LIGHT_STROKE_PROFILE = Object.freeze([
  [0, 0], [0.54, 0], [0.57, 0.08], [0.6, 0.2], [0.63, 0.4],
  [0.66, 0.55], [0.69, 0.4], [0.72, 0.2], [0.75, 0.08],
  [0.78, 0], [1, 0]
]);
const DARK_BLOOM_PROFILE = Object.freeze([
  [0, 0], [0.58, 0], [0.62, 0.03], [0.65, 0.08], [0.67, 0.2],
  [0.69, 0.45], [0.7, 0.85], [0.705, 0.85], [0.715, 0.45],
  [0.73, 0.2], [0.75, 0.08], [0.78, 0.03], [0.82, 0], [1, 0]
]);
const LIGHT_BLOOM_PROFILE = Object.freeze([
  [0, 0], [0.58, 0], [0.62, 0.02], [0.65, 0.08], [0.67, 0.2],
  [0.69, 0.4], [0.7, 0.6], [0.705, 0.6], [0.715, 0.4],
  [0.73, 0.2], [0.75, 0.08], [0.78, 0.02], [0.82, 0], [1, 0]
]);
const DARK_BEAM_THEME = Object.freeze({
  bloomOpacity: 0.24,
  conicColor: [255, 255, 255],
  innerOpacity: 0.42,
  innerShadowColor: [255, 255, 255],
  innerShadowOpacity: 0.03,
  saturation: 1.2,
  strokeOpacity: 0.26
});
const LIGHT_BEAM_THEME = Object.freeze({
  bloomOpacity: 0.34,
  conicColor: [0, 0, 0],
  innerOpacity: 0.26,
  innerShadowColor: [0, 0, 0],
  innerShadowOpacity: 0.02,
  saturation: 1.5,
  strokeOpacity: 0.12
});

export function getProfileGifFramePhase(frameIndex) {
  assertFrameIndex(frameIndex);
  return frameIndex / PROFILE_GIF_PRESET.frameCount;
}

export function getProfileGifFrameAngle(frameIndex) {
  return getProfileGifFramePhase(frameIndex) * 360;
}

export function createProfileGifFrameRenderer(baseRgba, options = {}) {
  assertBaseRgba(baseRgba);

  const base = new Uint8ClampedArray(baseRgba);
  const geometry = createBeamGeometry(base);
  const theme = options.theme === "light" ? LIGHT_BEAM_THEME : DARK_BEAM_THEME;

  return Object.freeze({
    effectPixelCount: geometry.pixelOffsets.length,
    renderFrame(frameIndex, target) {
      const phase = getProfileGifFramePhase(frameIndex);
      const output = normalizeTarget(target, base.length);
      output.set(base);
      compositeBeam(output, base, geometry, phase, theme);
      return output;
    }
  });
}

export function renderProfileGifFrame(baseRgba, frameIndex, options = {}) {
  return createProfileGifFrameRenderer(baseRgba, options).renderFrame(frameIndex);
}

function createBeamGeometry(base) {
  const { width, height, borderRadius: radius } = PROFILE_GIF_PRESET;
  const pixelOffsets = [];
  const conicPhases = [];
  const inwardDistances = [];
  const outerColors = [];
  const innerColors = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = (y * width + x) * 4;
      if (base[pixelOffset + 3] <= 127) {
        continue;
      }

      const pointX = x + 0.5;
      const pointY = y + 0.5;
      const inwardDistance = getRoundedRectInwardDistance(
        pointX,
        pointY,
        width,
        height,
        radius
      );
      if (inwardDistance < 0 || inwardDistance > BEAM_EDGE_FADE_DEPTH) {
        continue;
      }

      pixelOffsets.push(pixelOffset);
      conicPhases.push(getConicPhase(pointX, pointY, width, height));
      inwardDistances.push(inwardDistance);
      outerColors.push(...sampleOceanGradient(pointX, pointY, 1, 1));
      innerColors.push(...sampleOceanGradient(pointX, pointY, 0.9, 0.45));
    }
  }

  return Object.freeze({
    conicPhases: Float32Array.from(conicPhases),
    innerColors: Float32Array.from(innerColors),
    inwardDistances: Float32Array.from(inwardDistances),
    outerColors: Float32Array.from(outerColors),
    pixelOffsets: Uint32Array.from(pixelOffsets)
  });
}

function compositeBeam(output, base, geometry, framePhase, theme) {
  const { brightness, strength } = PROFILE_CARD_BORDER_BEAM_PRESET;
  const strokeProfile = theme === LIGHT_BEAM_THEME
    ? LIGHT_STROKE_PROFILE
    : DARK_STROKE_PROFILE;
  const bloomProfile = theme === LIGHT_BEAM_THEME
    ? LIGHT_BLOOM_PROFILE
    : DARK_BLOOM_PROFILE;

  for (let index = 0; index < geometry.pixelOffsets.length; index += 1) {
    const pixelOffset = geometry.pixelOffsets[index];
    const colorOffset = index * 4;
    const inwardDistance = geometry.inwardDistances[index];
    const conicPosition = wrapPhase(geometry.conicPhases[index] - framePhase);
    const mask = sampleProfile(BEAM_MASK_PROFILE, conicPosition);

    if (mask <= 0) {
      continue;
    }

    const edgeFade = clamp01(1 - inwardDistance / BEAM_EDGE_FADE_DEPTH);
    const innerShadowAlpha = gaussian(inwardDistance, BEAM_INNER_SHADOW_SIGMA) *
      theme.innerShadowOpacity;
    const innerLayer = overlayColor(
      geometry.innerColors.subarray(colorOffset, colorOffset + 4),
      theme.innerShadowColor,
      innerShadowAlpha
    );
    blendLayer(
      output,
      base,
      pixelOffset,
      filteredColor(innerLayer, brightness, theme.saturation),
      innerLayer[3] * mask * edgeFade * theme.innerOpacity * strength
    );

    const strokeAlpha = sampleProfile(strokeProfile, conicPosition);
    const outerLayer = overlayColor(
      geometry.outerColors.subarray(colorOffset, colorOffset + 4),
      theme.conicColor,
      strokeAlpha
    );
    const strokeCoverage = clamp01(BEAM_STROKE_WIDTH + 0.5 - inwardDistance);
    blendLayer(
      output,
      output,
      pixelOffset,
      filteredColor(outerLayer, brightness, theme.saturation),
      outerLayer[3] * mask * strokeCoverage * theme.strokeOpacity * strength
    );

    const bloomAlpha = sampleProfile(bloomProfile, conicPosition) *
      gaussian(inwardDistance, BEAM_BLOOM_SIGMA) *
      theme.bloomOpacity * strength;
    blendLayer(
      output,
      output,
      pixelOffset,
      filteredColor([...theme.conicColor, 1], brightness, theme.saturation),
      bloomAlpha
    );
  }
}

function sampleOceanGradient(x, y, sizeScale, alphaScale) {
  const { width, height, scale } = PROFILE_GIF_PRESET;
  let alpha = 0;
  let premultipliedRed = 0;
  let premultipliedGreen = 0;
  let premultipliedBlue = 0;

  for (let index = OCEAN_GRADIENTS.length - 1; index >= 0; index -= 1) {
    const gradient = OCEAN_GRADIENTS[index];
    const radiusX = gradient.size[0] * scale * sizeScale;
    const radiusY = gradient.size[1] * scale * sizeScale;
    const normalizedX = (x - gradient.position[0] * width) / radiusX;
    const normalizedY = (y - gradient.position[1] * height) / radiusY;
    const distance = Math.hypot(normalizedX, normalizedY);
    if (distance >= 1) {
      continue;
    }

    const layerAlpha = (1 - distance) * alphaScale;
    const retainedAlpha = 1 - layerAlpha;
    premultipliedRed = gradient.color[0] * layerAlpha +
      premultipliedRed * retainedAlpha;
    premultipliedGreen = gradient.color[1] * layerAlpha +
      premultipliedGreen * retainedAlpha;
    premultipliedBlue = gradient.color[2] * layerAlpha +
      premultipliedBlue * retainedAlpha;
    alpha = layerAlpha + alpha * retainedAlpha;
  }

  if (alpha <= 0) {
    return [0, 0, 0, 0];
  }
  return [
    premultipliedRed / alpha,
    premultipliedGreen / alpha,
    premultipliedBlue / alpha,
    alpha
  ];
}

function overlayColor(background, foreground, foregroundAlpha) {
  const backgroundAlpha = background[3];
  const retainedAlpha = 1 - foregroundAlpha;
  const alpha = foregroundAlpha + backgroundAlpha * retainedAlpha;
  if (alpha <= 0) {
    return [0, 0, 0, 0];
  }
  return [
    (foreground[0] * foregroundAlpha + background[0] * backgroundAlpha * retainedAlpha) / alpha,
    (foreground[1] * foregroundAlpha + background[1] * backgroundAlpha * retainedAlpha) / alpha,
    (foreground[2] * foregroundAlpha + background[2] * backgroundAlpha * retainedAlpha) / alpha,
    alpha
  ];
}

function filteredColor(color, brightness, saturation) {
  const luminance = color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
  return [
    clampByte((luminance + (color[0] - luminance) * saturation) * brightness),
    clampByte((luminance + (color[1] - luminance) * saturation) * brightness),
    clampByte((luminance + (color[2] - luminance) * saturation) * brightness),
    color[3]
  ];
}

function blendLayer(output, background, pixelOffset, color, opacity) {
  const amount = clamp01(opacity);
  if (amount <= 0) {
    return;
  }
  output[pixelOffset] = blend(background[pixelOffset], color[0], amount);
  output[pixelOffset + 1] = blend(background[pixelOffset + 1], color[1], amount);
  output[pixelOffset + 2] = blend(background[pixelOffset + 2], color[2], amount);
}

function sampleProfile(profile, position) {
  for (let index = 1; index < profile.length; index += 1) {
    const right = profile[index];
    if (position > right[0]) {
      continue;
    }
    const left = profile[index - 1];
    const span = right[0] - left[0];
    const amount = span <= 0 ? 0 : (position - left[0]) / span;
    return mix(left[1], right[1], amount);
  }
  return profile[profile.length - 1][1];
}

function getRoundedRectInwardDistance(x, y, width, height, radius) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const qx = Math.abs(x - halfWidth) - (halfWidth - radius);
  const qy = Math.abs(y - halfHeight) - (halfHeight - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return -(outside + inside - radius);
}

function getConicPhase(x, y, width, height) {
  return wrapPhase(Math.atan2(x - width / 2, height / 2 - y) / (Math.PI * 2));
}

function gaussian(value, sigma) {
  const normalized = value / sigma;
  return Math.exp(-0.5 * normalized * normalized);
}

function wrapPhase(phase) {
  return ((phase % 1) + 1) % 1;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function clampByte(value) {
  return Math.max(0, Math.min(255, value));
}

function mix(start, end, amount) {
  return start + (end - start) * amount;
}

function blend(start, end, opacity) {
  return Math.round(start + (end - start) * opacity);
}

function normalizeTarget(target, expectedLength) {
  if (target === undefined) {
    return new Uint8ClampedArray(expectedLength);
  }
  if (!(target instanceof Uint8ClampedArray) || target.length !== expectedLength) {
    throw new TypeError("GIF frame target must be a matching Uint8ClampedArray");
  }
  return target;
}

function assertBaseRgba(baseRgba) {
  const expectedLength = PROFILE_GIF_PRESET.width * PROFILE_GIF_PRESET.height * 4;
  if (
    !(baseRgba instanceof Uint8Array) &&
    !(baseRgba instanceof Uint8ClampedArray)
  ) {
    throw new TypeError("GIF base frame must be RGBA byte data");
  }
  if (baseRgba.length !== expectedLength) {
    throw new RangeError(`GIF base frame must contain ${expectedLength} RGBA bytes`);
  }
}

function assertFrameIndex(frameIndex) {
  if (
    !Number.isInteger(frameIndex) ||
    frameIndex < 0 ||
    frameIndex >= PROFILE_GIF_PRESET.frameCount
  ) {
    throw new RangeError(
      `GIF frame index must be between 0 and ${PROFILE_GIF_PRESET.frameCount - 1}`
    );
  }
}
