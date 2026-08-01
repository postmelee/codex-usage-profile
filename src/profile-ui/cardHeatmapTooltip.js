import {
  CARD_HEATMAP_COLUMN_COUNT,
  CARD_HEATMAP_ROW_COUNT
} from "../profile-card/geometry.js";
import {
  formatCardTokenCount,
  resolveCardLocale
} from "../profile-card/view-model.js";

export const CARD_HEATMAP_TOOLTIP_GAP = 8;
export const CARD_HEATMAP_TOOLTIP_PADDING = 8;

const ARROW_KEYS = new Set([
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp"
]);

export function hasCardHeatmapData(dailyUsageBuckets) {
  return Array.isArray(dailyUsageBuckets) && dailyUsageBuckets.length > 0;
}

export function formatCardHeatmapTooltip(cell, locale = "en") {
  if (!cell || typeof cell !== "object" || Array.isArray(cell)) {
    throw new TypeError("cell must be a heatmap cell");
  }

  const date = parseIsoDate(cell.dateIso);
  const tokens = requireTokenCount(cell.tokens);
  const normalizedLocale = resolveCardLocale(locale);
  const formattedDate = new Intl.DateTimeFormat(
    normalizedLocale === "ko" ? "ko-KR" : "en-US",
    {
      day: "numeric",
      month: normalizedLocale === "ko" ? "long" : "short",
      timeZone: "UTC",
      year: "numeric"
    }
  ).format(date);
  const formattedTokens = formatCardTokenCount(tokens, normalizedLocale);

  if (normalizedLocale === "ko") {
    return `${formattedDate} · ${formattedTokens} 토큰`;
  }

  return `${formattedDate} · ${formattedTokens} ${tokens === 1 ? "token" : "tokens"}`;
}

export function moveCardHeatmapFocusIndex(
  index,
  key,
  options = {}
) {
  const columnCount = options.columnCount ?? CARD_HEATMAP_COLUMN_COUNT;
  const rowCount = options.rowCount ?? CARD_HEATMAP_ROW_COUNT;
  requireGridDimensions(columnCount, rowCount);

  const cellCount = columnCount * rowCount;
  if (!Number.isSafeInteger(index) || index < 0 || index >= cellCount) {
    throw new RangeError(`index must be an integer between 0 and ${cellCount - 1}`);
  }
  if (!ARROW_KEYS.has(key)) return index;

  const column = Math.floor(index / rowCount);
  const row = index % rowCount;
  const nextColumn = key === "ArrowLeft"
    ? Math.max(column - 1, 0)
    : key === "ArrowRight"
      ? Math.min(column + 1, columnCount - 1)
      : column;
  const nextRow = key === "ArrowUp"
    ? Math.max(row - 1, 0)
    : key === "ArrowDown"
      ? Math.min(row + 1, rowCount - 1)
      : row;

  return nextColumn * rowCount + nextRow;
}

export function resolveCardHeatmapTooltipPlacement(options = {}) {
  const anchor = requireRect(options.anchorRect, "anchorRect");
  const container = requireRect(options.containerRect, "containerRect");
  const viewport = requireRect(options.viewportRect, "viewportRect");
  const tooltip = requireSize(options.tooltipSize, "tooltipSize");
  const gap = requireNonNegativeNumber(
    options.gap ?? CARD_HEATMAP_TOOLTIP_GAP,
    "gap"
  );
  const padding = requireNonNegativeNumber(
    options.padding ?? CARD_HEATMAP_TOOLTIP_PADDING,
    "padding"
  );

  const minLeft = Math.max(container.left + padding, viewport.left + padding);
  const maxRight = Math.min(container.right - padding, viewport.right - padding);
  const maxLeft = Math.max(minLeft, maxRight - tooltip.width);
  const anchorCenter = anchor.left + anchor.width / 2;
  const left = clamp(anchorCenter - tooltip.width / 2, minLeft, maxLeft);

  const minTop = Math.max(container.top + padding, viewport.top + padding);
  const maxBottom = Math.min(
    container.bottom - padding,
    viewport.bottom - padding
  );
  const aboveTop = anchor.top - gap - tooltip.height;
  const belowTop = anchor.bottom + gap;
  const fitsAbove = aboveTop >= minTop;
  const fitsBelow = belowTop + tooltip.height <= maxBottom;

  let placement;
  let requestedTop;
  if (
    fitsAbove ||
    (!fitsBelow && spaceAbove(anchor, minTop, gap) >=
      spaceBelow(anchor, maxBottom, gap))
  ) {
    placement = "top";
    requestedTop = aboveTop;
  } else {
    placement = "bottom";
    requestedTop = belowTop;
  }

  const maxTop = Math.max(minTop, maxBottom - tooltip.height);

  return Object.freeze({
    left,
    placement,
    top: clamp(requestedTop, minTop, maxTop)
  });
}

function parseIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError("cell.dateIso must be an ISO date");
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new TypeError("cell.dateIso must be an ISO date");
  }
  return date;
}

function requireTokenCount(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("cell.tokens must be a non-negative safe integer");
  }
  return value;
}

function requireGridDimensions(columnCount, rowCount) {
  if (
    !Number.isSafeInteger(columnCount) || columnCount < 1 ||
    !Number.isSafeInteger(rowCount) || rowCount < 1 ||
    columnCount * rowCount > Number.MAX_SAFE_INTEGER
  ) {
    throw new RangeError("grid dimensions must be positive safe integers");
  }
}

function requireRect(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a rectangle`);
  }

  const left = requireFiniteNumber(value.left, `${label}.left`);
  const top = requireFiniteNumber(value.top, `${label}.top`);
  const right = requireFiniteNumber(value.right, `${label}.right`);
  const bottom = requireFiniteNumber(value.bottom, `${label}.bottom`);
  if (right < left || bottom < top) {
    throw new RangeError(`${label} edges must be ordered`);
  }

  const width = value.width === undefined
    ? right - left
    : requireNonNegativeNumber(value.width, `${label}.width`);
  const height = value.height === undefined
    ? bottom - top
    : requireNonNegativeNumber(value.height, `${label}.height`);

  return { bottom, height, left, right, top, width };
}

function requireSize(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a size`);
  }

  return {
    height: requireNonNegativeNumber(value.height, `${label}.height`),
    width: requireNonNegativeNumber(value.width, `${label}.width`)
  };
}

function requireFiniteNumber(value, label) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  return value;
}

function requireNonNegativeNumber(value, label) {
  const normalized = requireFiniteNumber(value, label);
  if (normalized < 0) {
    throw new RangeError(`${label} must be non-negative`);
  }
  return normalized;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function spaceAbove(anchor, minTop, gap) {
  return anchor.top - gap - minTop;
}

function spaceBelow(anchor, maxBottom, gap) {
  return maxBottom - anchor.bottom - gap;
}
