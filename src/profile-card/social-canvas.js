export const SOCIAL_CARD_LOGICAL_WIDTH = 499;
export const SOCIAL_CARD_LOGICAL_HEIGHT = 306;
export const SOCIAL_CANVAS_WIDTH = 1200;
export const SOCIAL_CANVAS_HEIGHT = 630;
export const SOCIAL_CANVAS_MIN_HORIZONTAL_PADDING = 120;
export const SOCIAL_CANVAS_MIN_VERTICAL_PADDING = 20;
export const SOCIAL_CARD_ASPECT_RATIO =
  SOCIAL_CARD_LOGICAL_WIDTH / SOCIAL_CARD_LOGICAL_HEIGHT;

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

  return Object.freeze({
    canvasHeight,
    canvasWidth,
    cardHeight,
    cardWidth,
    cardX: (canvasWidth - cardWidth) / 2,
    cardY: (canvasHeight - cardHeight) / 2,
    scale: cardWidth / SOCIAL_CARD_LOGICAL_WIDTH
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
