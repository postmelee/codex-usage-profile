import {
  SOCIAL_CARD_LOGICAL_HEIGHT,
  SOCIAL_CARD_LOGICAL_RADIUS,
  SOCIAL_CARD_LOGICAL_WIDTH,
  SOCIAL_LIGHT_BORDER_COLOR,
  SOCIAL_LIGHT_BORDER_WIDTH,
  SOCIAL_LIGHT_CANVAS_COLOR
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

const LIGHT_OUTLINE_WIDTH =
  SOCIAL_LIGHT_BORDER_WIDTH * PROFILE_ATTACHMENT_SCALE;
const LIGHT_OUTLINE_INSET = LIGHT_OUTLINE_WIDTH / 2;

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
  if (normalizedTheme === "light") {
    return Object.freeze({
      backgroundColor: SOCIAL_LIGHT_CANVAS_COLOR,
      outline: Object.freeze({
        color: SOCIAL_LIGHT_BORDER_COLOR,
        height: PROFILE_ATTACHMENT_HEIGHT - (LIGHT_OUTLINE_INSET * 2),
        radius: PROFILE_ATTACHMENT_RADIUS - LIGHT_OUTLINE_INSET,
        width: PROFILE_ATTACHMENT_WIDTH - (LIGHT_OUTLINE_INSET * 2),
        x: LIGHT_OUTLINE_INSET,
        y: LIGHT_OUTLINE_INSET
      }),
      outlineWidth: LIGHT_OUTLINE_WIDTH,
      theme: normalizedTheme
    });
  }

  return Object.freeze({
    backgroundColor: CARD_THEME_PALETTES.dark.background,
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

    if (surface.outline) {
      context.strokeStyle = surface.outline.color;
      context.lineWidth = surface.outlineWidth;
      context.beginPath();
      context.roundRect(
        surface.outline.x,
        surface.outline.y,
        surface.outline.width,
        surface.outline.height,
        surface.outline.radius
      );
      context.stroke();
    }
  } finally {
    context.restore();
  }
  return surface;
}

function assertCanvasContext(context) {
  for (const method of [
    "beginPath",
    "drawImage",
    "fillRect",
    "restore",
    "roundRect",
    "save",
    "stroke"
  ]) {
    if (typeof context?.[method] !== "function") {
      throw new TypeError(
        "Profile attachment rendering requires a Canvas 2D context"
      );
    }
  }
}
