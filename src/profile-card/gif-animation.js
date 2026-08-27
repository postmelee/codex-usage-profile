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

const BEAM_START_PHASE = 0.796;
const BEAM_ARC_SIGMA = 0.06;
const BEAM_CORE_SIGMA = 0.044;
const BEAM_GLOW_DEPTH = 24;
const BEAM_GLOW_SIGMA = 10;
const BEAM_CORE_SIGMA_PX = 1.45;
const OCEAN_BLUE = Object.freeze([62, 124, 255]);
const OCEAN_VIOLET = Object.freeze([126, 75, 255]);

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
  const themeFactor = options.theme === "light" ? 0.74 : 1;

  return Object.freeze({
    effectPixelCount: geometry.pixelOffsets.length,
    renderFrame(frameIndex, target) {
      const phase = getProfileGifFramePhase(frameIndex);
      const output = normalizeTarget(target, base.length);
      output.set(base);
      compositeBeam(output, base, geometry, phase, themeFactor);
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
  const pathPhases = [];
  const inwardDistances = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = (y * width + x) * 4;
      if (base[pixelOffset + 3] <= 127) {
        continue;
      }

      const inwardDistance = getRoundedRectInwardDistance(
        x + 0.5,
        y + 0.5,
        width,
        height,
        radius
      );
      if (inwardDistance < 0 || inwardDistance > BEAM_GLOW_DEPTH) {
        continue;
      }

      pixelOffsets.push(pixelOffset);
      pathPhases.push(getRoundedRectPathPhase(
        x + 0.5,
        y + 0.5,
        width,
        height,
        radius
      ));
      inwardDistances.push(inwardDistance);
    }
  }

  return Object.freeze({
    inwardDistances: Float32Array.from(inwardDistances),
    pathPhases: Float32Array.from(pathPhases),
    pixelOffsets: Uint32Array.from(pixelOffsets)
  });
}

function compositeBeam(output, base, geometry, framePhase, themeFactor) {
  const beamPhase = wrapPhase(BEAM_START_PHASE + framePhase);
  const { brightness, strength } = PROFILE_CARD_BORDER_BEAM_PRESET;

  for (let index = 0; index < geometry.pixelOffsets.length; index += 1) {
    const pixelOffset = geometry.pixelOffsets[index];
    const arcDelta = circularDelta(geometry.pathPhases[index], beamPhase);
    const inwardDistance = geometry.inwardDistances[index];
    const arcGlow = gaussian(arcDelta, BEAM_ARC_SIGMA);

    if (arcGlow < 0.003) {
      continue;
    }

    const distanceGlow = gaussian(inwardDistance, BEAM_GLOW_SIGMA);
    const core = gaussian(arcDelta, BEAM_CORE_SIGMA) *
      gaussian(inwardDistance, BEAM_CORE_SIGMA_PX);
    const opacity = Math.min(
      0.92,
      (arcGlow * distanceGlow * 0.22 + core * 0.42) *
        strength * brightness * themeFactor
    );
    const colorMix = Math.max(0, Math.min(1, 0.5 + arcDelta / 0.16));
    const red = mix(OCEAN_VIOLET[0], OCEAN_BLUE[0], colorMix);
    const green = mix(OCEAN_VIOLET[1], OCEAN_BLUE[1], colorMix);
    const blue = mix(OCEAN_VIOLET[2], OCEAN_BLUE[2], colorMix);

    output[pixelOffset] = blend(base[pixelOffset], red, opacity);
    output[pixelOffset + 1] = blend(base[pixelOffset + 1], green, opacity);
    output[pixelOffset + 2] = blend(base[pixelOffset + 2], blue, opacity);
  }
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

function getRoundedRectPathPhase(x, y, width, height, radius) {
  const horizontalLength = width - radius * 2;
  const verticalLength = height - radius * 2;
  const arcLength = Math.PI * radius / 2;
  const perimeter = horizontalLength * 2 + verticalLength * 2 + arcLength * 4;
  let distance;

  if (y < radius) {
    if (x < radius) {
      const angle = normalizeAngle(Math.atan2(y - radius, x - radius));
      distance = horizontalLength * 2 + verticalLength * 2 + arcLength * 3 +
        (angle - Math.PI) * radius;
    } else if (x > width - radius) {
      const angle = Math.atan2(y - radius, x - (width - radius));
      distance = horizontalLength + (angle + Math.PI / 2) * radius;
    } else {
      distance = x - radius;
    }
  } else if (y > height - radius) {
    if (x > width - radius) {
      const angle = Math.atan2(y - (height - radius), x - (width - radius));
      distance = horizontalLength + arcLength + verticalLength + angle * radius;
    } else if (x < radius) {
      const angle = Math.atan2(y - (height - radius), x - radius);
      distance = horizontalLength * 2 + verticalLength + arcLength * 2 +
        (angle - Math.PI / 2) * radius;
    } else {
      distance = horizontalLength + verticalLength + arcLength * 2 +
        (width - radius - x);
    }
  } else if (x > width - radius) {
    distance = horizontalLength + arcLength + (y - radius);
  } else if (x < radius) {
    distance = horizontalLength * 2 + verticalLength + arcLength * 3 +
      (height - radius - y);
  } else {
    const topDistance = y;
    const bottomDistance = height - y;
    distance = topDistance <= bottomDistance
      ? x - radius
      : horizontalLength + verticalLength + arcLength * 2 +
        (width - radius - x);
  }

  return wrapPhase(distance / perimeter);
}

function circularDelta(value, center) {
  let delta = value - center;
  if (delta > 0.5) {
    delta -= 1;
  } else if (delta < -0.5) {
    delta += 1;
  }
  return delta;
}

function gaussian(value, sigma) {
  const normalized = value / sigma;
  return Math.exp(-0.5 * normalized * normalized);
}

function normalizeAngle(angle) {
  return angle < 0 ? angle + Math.PI * 2 : angle;
}

function wrapPhase(phase) {
  return ((phase % 1) + 1) % 1;
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
