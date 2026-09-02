import {
  SOCIAL_CARD_LOGICAL_HEIGHT,
  SOCIAL_CARD_LOGICAL_RADIUS,
  SOCIAL_CARD_LOGICAL_WIDTH
} from "./social-canvas.js";
import {
  CARD_THEME_PALETTES,
  normalizeCardTheme
} from "./theme.js";

export const PROFILE_ATTACHMENT_SCALE = 2;
export const PROFILE_ATTACHMENT_PRESET_VERSION = 1;
export const PROFILE_ATTACHMENT_SOURCE_MAX_BYTES = 10_000_000;
export const PROFILE_ATTACHMENT_WIDTH =
  SOCIAL_CARD_LOGICAL_WIDTH * PROFILE_ATTACHMENT_SCALE;
export const PROFILE_ATTACHMENT_HEIGHT =
  SOCIAL_CARD_LOGICAL_HEIGHT * PROFILE_ATTACHMENT_SCALE;
export const PROFILE_ATTACHMENT_RADIUS =
  SOCIAL_CARD_LOGICAL_RADIUS * PROFILE_ATTACHMENT_SCALE;

export const PROFILE_ATTACHMENT_PRESET = Object.freeze({
  height: PROFILE_ATTACHMENT_HEIGHT,
  logicalHeight: SOCIAL_CARD_LOGICAL_HEIGHT,
  logicalRadius: SOCIAL_CARD_LOGICAL_RADIUS,
  logicalWidth: SOCIAL_CARD_LOGICAL_WIDTH,
  radius: PROFILE_ATTACHMENT_RADIUS,
  scale: PROFILE_ATTACHMENT_SCALE,
  sourceMaxBytes: PROFILE_ATTACHMENT_SOURCE_MAX_BYTES,
  version: PROFILE_ATTACHMENT_PRESET_VERSION,
  width: PROFILE_ATTACHMENT_WIDTH
});

export function getProfileAttachmentSurface(theme) {
  const normalizedTheme = normalizeCardTheme(theme);
  return Object.freeze({
    backgroundColor: CARD_THEME_PALETTES[normalizedTheme].background,
    outline: null,
    outlineWidth: 0,
    theme: normalizedTheme
  });
}

export function drawProfileAttachmentCanvas(context, source, options = {}) {
  assertCanvasContext(context);
  if (
    context.canvas &&
    (
      context.canvas.width !== PROFILE_ATTACHMENT_WIDTH ||
      context.canvas.height !== PROFILE_ATTACHMENT_HEIGHT
    )
  ) {
    throw new RangeError(
      `Profile attachment canvas must be ${PROFILE_ATTACHMENT_WIDTH}x${PROFILE_ATTACHMENT_HEIGHT}`
    );
  }
  if (!source) {
    throw new TypeError("Profile attachment source image is required");
  }

  const surface = getProfileAttachmentSurface(options.theme);
  context.save();
  try {
    context.globalCompositeOperation = "source-over";
    context.fillStyle = surface.backgroundColor;
    context.fillRect(
      0,
      0,
      PROFILE_ATTACHMENT_WIDTH,
      PROFILE_ATTACHMENT_HEIGHT
    );
    context.imageSmoothingEnabled = true;
    if ("imageSmoothingQuality" in context) {
      context.imageSmoothingQuality = "high";
    }
    context.drawImage(
      source,
      0,
      0,
      PROFILE_ATTACHMENT_WIDTH,
      PROFILE_ATTACHMENT_HEIGHT
    );
  } finally {
    context.restore();
  }
  return surface;
}

function assertCanvasContext(context) {
  for (const method of [
    "drawImage",
    "fillRect",
    "restore",
    "save"
  ]) {
    if (typeof context?.[method] !== "function") {
      throw new TypeError(
        "Profile attachment rendering requires a Canvas 2D context"
      );
    }
  }
}
