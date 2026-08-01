import {
  CARD_HEATMAP_CELL_COUNT,
  CARD_HEATMAP_COLUMN_COUNT,
  CARD_HEATMAP_ROW_COUNT
} from "./geometry.js";

export {
  CARD_HEATMAP_CELL_COUNT,
  CARD_HEATMAP_COLUMN_COUNT,
  CARD_HEATMAP_ROW_COUNT
} from "./geometry.js";

export const CARD_HEATMAP_LEVEL_COLORS = Object.freeze([
  "#2f2f2f",
  "#203d59",
  "#245380",
  "#2a72b5",
  "#339cff"
]);

export function buildCardHeatmap(dailyUsageBuckets, options = {}) {
  const todayIso = normalizeIsoDate(
    options.todayIso ?? getLatestBucketDate(dailyUsageBuckets) ?? new Date()
  );
  const endWeekStartIso = startOfUtcWeek(todayIso);
  const startDateIso = addDays(
    endWeekStartIso,
    -(CARD_HEATMAP_COLUMN_COUNT - 1) * CARD_HEATMAP_ROW_COUNT
  );
  const usageByDate = new Map(
    dailyUsageBuckets.map((bucket) => [bucket.startDate, bucket.tokens])
  );
  const values = Array.from({ length: CARD_HEATMAP_CELL_COUNT }, (_, index) => {
    const column = Math.floor(index / CARD_HEATMAP_ROW_COUNT);
    const row = index % CARD_HEATMAP_ROW_COUNT;
    const dateIso = addDays(startDateIso, index);
    const isFuture = dateIso > todayIso;

    return {
      column,
      dateIso,
      index,
      row,
      tokens: isFuture ? 0 : usageByDate.get(dateIso) ?? 0
    };
  });
  const maxTokens = Math.max(...values.map((cell) => cell.tokens), 1);

  return {
    cells: values.map((cell) => ({
      ...cell,
      color: CARD_HEATMAP_LEVEL_COLORS[getCardHeatmapLevel(cell.tokens, maxTokens)],
      level: getCardHeatmapLevel(cell.tokens, maxTokens)
    })),
    columnCount: CARD_HEATMAP_COLUMN_COUNT,
    rowCount: CARD_HEATMAP_ROW_COUNT,
    startDateIso,
    todayIso
  };
}

export function getCardHeatmapLevel(value, maxValue) {
  if (value <= 0 || maxValue <= 0) {
    return 0;
  }

  const ratio = value / maxValue;

  if (ratio >= 0.75) return 4;
  if (ratio >= 0.45) return 3;
  if (ratio >= 0.2) return 2;
  return 1;
}

function getLatestBucketDate(dailyUsageBuckets) {
  return dailyUsageBuckets.reduce((latest, bucket) => (
    !latest || bucket.startDate > latest ? bucket.startDate : latest
  ), null);
}

function normalizeIsoDate(value) {
  const text = value instanceof Date ? value.toISOString() : String(value);
  const date = text.length === 10
    ? new Date(`${text}T00:00:00.000Z`)
    : new Date(text);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError("todayIso must be a valid date");
  }

  return date.toISOString().slice(0, 10);
}

function startOfUtcWeek(dateIso) {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date.toISOString().slice(0, 10);
}

function addDays(dateIso, days) {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
