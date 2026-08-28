import { normalizeCardTheme } from "./theme.js";

export const SOCIAL_CARD_LOGICAL_WIDTH = 499;
export const SOCIAL_CARD_LOGICAL_HEIGHT = 306;
export const SOCIAL_CARD_LOGICAL_RADIUS = 32;
export const SOCIAL_CANVAS_WIDTH = 1200;
export const SOCIAL_CANVAS_HEIGHT = 630;
export const SOCIAL_OUTPUT_SCALE = 2;
export const SOCIAL_OUTPUT_WIDTH = SOCIAL_CANVAS_WIDTH * SOCIAL_OUTPUT_SCALE;
export const SOCIAL_OUTPUT_HEIGHT = SOCIAL_CANVAS_HEIGHT * SOCIAL_OUTPUT_SCALE;
export const SOCIAL_CANVAS_MIN_HORIZONTAL_PADDING = 120;
export const SOCIAL_CANVAS_MIN_VERTICAL_PADDING = 20;
export const SOCIAL_CARD_ASPECT_RATIO =
  SOCIAL_CARD_LOGICAL_WIDTH / SOCIAL_CARD_LOGICAL_HEIGHT;
export const SOCIAL_LIGHT_CANVAS_COLOR = "#F3F5F7";
export const SOCIAL_LIGHT_BORDER_COLOR = "#D0D7DE";
export const SOCIAL_LIGHT_BORDER_WIDTH = 1;

export function computeSocialCanvasLayout(options = {}) {
  const canvasWidth = requirePositiveNumber(
    options.canvasWidth ?? SOCIAL_CANVAS_WIDTH,
    "canvasWidth"
  );
  const canvasHeight = requirePositiveNumber(
    options.canvasHeight ?? SOCIAL_CANVAS_HEIGHT,
    "canvasHeight"
  );
  const horizontalPadding = requireNonNegativeNumber(
    options.horizontalPadding ?? SOCIAL_CANVAS_MIN_HORIZONTAL_PADDING,
    "horizontalPadding"
  );
  const verticalPadding = requireNonNegativeNumber(
    options.verticalPadding ?? SOCIAL_CANVAS_MIN_VERTICAL_PADDING,
    "verticalPadding"
  );

  const availableWidth = canvasWidth - (horizontalPadding * 2);
  const availableHeight = canvasHeight - (verticalPadding * 2);
  if (availableWidth <= 0 || availableHeight <= 0) {
    throw new TypeError("social canvas padding leaves no room for the card");
  }

  const widthLimitedHeight = availableWidth / SOCIAL_CARD_ASPECT_RATIO;
  const cardWidth = widthLimitedHeight <= availableHeight
    ? availableWidth
    : availableHeight * SOCIAL_CARD_ASPECT_RATIO;
  const cardHeight = cardWidth / SOCIAL_CARD_ASPECT_RATIO;

  const outputScale = requirePositiveNumber(
    options.outputScale ?? SOCIAL_OUTPUT_SCALE,
    "outputScale"
  );

  return Object.freeze({
    canvasHeight,
    canvasWidth,
    cardHeight,
    cardWidth,
    outputHeight: canvasHeight * outputScale,
    outputScale,
    outputWidth: canvasWidth * outputScale,
    cardX: (canvasWidth - cardWidth) / 2,
    cardY: (canvasHeight - cardHeight) / 2,
    scale: cardWidth / SOCIAL_CARD_LOGICAL_WIDTH
  });
}

export function getSocialCanvasSurface(theme, layout) {
  if (normalizeCardTheme(theme) !== "light") return null;

  const resolvedLayout = layout ?? computeSocialCanvasLayout();
  const outlineInset = SOCIAL_LIGHT_BORDER_WIDTH / 2;

  return Object.freeze({
    backgroundColor: SOCIAL_LIGHT_CANVAS_COLOR,
    borderColor: SOCIAL_LIGHT_BORDER_COLOR,
    borderWidth: SOCIAL_LIGHT_BORDER_WIDTH,
    outline: Object.freeze({
      height: resolvedLayout.cardHeight - (outlineInset * 2),
      radius: (SOCIAL_CARD_LOGICAL_RADIUS * resolvedLayout.scale) - outlineInset,
      width: resolvedLayout.cardWidth - (outlineInset * 2),
      x: resolvedLayout.cardX + outlineInset,
      y: resolvedLayout.cardY + outlineInset
    })
  });
}

function requirePositiveNumber(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive number`);
  }
  return value;
}

function requireNonNegativeNumber(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative number`);
  }
  return value;
}
