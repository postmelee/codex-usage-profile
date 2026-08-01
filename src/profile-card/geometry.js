export const CARD_LOGICAL_WIDTH = 499;
export const CARD_LOGICAL_HEIGHT = 306;

export const CARD_HEATMAP_COLUMN_COUNT = 26;
export const CARD_HEATMAP_ROW_COUNT = 7;
export const CARD_HEATMAP_CELL_COUNT = (
  CARD_HEATMAP_COLUMN_COUNT * CARD_HEATMAP_ROW_COUNT
);

export const CARD_HEATMAP_X = 32;
export const CARD_HEATMAP_Y = 96;
export const CARD_HEATMAP_WIDTH = 435;
export const CARD_HEATMAP_HEIGHT = 115;
export const CARD_HEATMAP_CELL_SIZE = 14;
export const CARD_HEATMAP_COLUMN_STEP = (
  (CARD_HEATMAP_WIDTH - CARD_HEATMAP_CELL_SIZE) /
  Math.max(CARD_HEATMAP_COLUMN_COUNT - 1, 1)
);
export const CARD_HEATMAP_ROW_STEP = (
  (CARD_HEATMAP_HEIGHT - CARD_HEATMAP_CELL_SIZE) /
  Math.max(CARD_HEATMAP_ROW_COUNT - 1, 1)
);

export const CARD_HEATMAP_BOUNDS = Object.freeze({
  height: CARD_HEATMAP_HEIGHT,
  width: CARD_HEATMAP_WIDTH,
  x: CARD_HEATMAP_X,
  y: CARD_HEATMAP_Y
});

export function getCardHeatmapCellGeometry(column, row) {
  requireGridCoordinate(column, CARD_HEATMAP_COLUMN_COUNT, "column");
  requireGridCoordinate(row, CARD_HEATMAP_ROW_COUNT, "row");

  const x = CARD_HEATMAP_X + column * CARD_HEATMAP_COLUMN_STEP;
  const y = CARD_HEATMAP_Y + row * CARD_HEATMAP_ROW_STEP;
  const width = CARD_HEATMAP_CELL_SIZE;
  const height = CARD_HEATMAP_CELL_SIZE;

  return Object.freeze({
    centerX: x + width / 2,
    centerY: y + height / 2,
    column,
    height,
    heightPercent: toPercent(height, CARD_LOGICAL_HEIGHT),
    index: column * CARD_HEATMAP_ROW_COUNT + row,
    leftPercent: toPercent(x, CARD_LOGICAL_WIDTH),
    row,
    topPercent: toPercent(y, CARD_LOGICAL_HEIGHT),
    width,
    widthPercent: toPercent(width, CARD_LOGICAL_WIDTH),
    x,
    y
  });
}

function requireGridCoordinate(value, limit, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value >= limit) {
    throw new RangeError(`${label} must be an integer between 0 and ${limit - 1}`);
  }
}

function toPercent(value, total) {
  return value / total * 100;
}
