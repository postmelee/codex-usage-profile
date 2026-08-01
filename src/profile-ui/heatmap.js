export const HEATMAP_COLUMN_COUNT = 52;
export const HEATMAP_ROW_COUNT = 7;
export const HEATMAP_CELL_COUNT = HEATMAP_COLUMN_COUNT * HEATMAP_ROW_COUNT;
export const HEATMAP_MODES = Object.freeze(["daily", "weekly", "cumulative"]);

const DAILY_BUCKET_KEYS = Object.freeze(["startDate", "tokens"]);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEK_START_DAY = 0;

export function buildTokenHeatmap(dailyUsageBuckets, options = {}) {
  const mode = normalizeMode(options.mode);
  const normalizedBuckets = normalizeDailyUsageBuckets(dailyUsageBuckets);
  const todayIso = resolveAnchorDate(normalizedBuckets, options);
  const currentWeekStartIso = startOfUtcWeek(todayIso);
  const startDateIso = addDays(
    currentWeekStartIso,
    -(HEATMAP_COLUMN_COUNT - 1) * HEATMAP_ROW_COUNT
  );
  const endDateIso = addDays(startDateIso, HEATMAP_CELL_COUNT - 1);
  const usageByDate = new Map(
    normalizedBuckets
      .filter((bucket) => (
        bucket.startDate >= startDateIso && bucket.startDate <= todayIso
      ))
      .map((bucket) => [bucket.startDate, bucket.tokens])
  );
  const dailyCells = buildDailyCells({
    startDateIso,
    todayIso,
    usageByDate
  });
  const weeklyTargets = buildWeeklyTargets(dailyCells, todayIso);
  const cumulativeTargets = buildCumulativeTargets(weeklyTargets);
  const targets = selectModeTargets(
    mode,
    dailyCells,
    weeklyTargets,
    cumulativeTargets
  );
  const maxTokens = Math.max(0, ...targets.map((target) => target.tokens));
  const cells = targets.map((target) => Object.freeze({
    ...target,
    interactive: target.isFuture !== true,
    key: `${mode}:${target.key}`,
    level: getHeatmapLevel(target.tokens, maxTokens),
    mode,
    tooltip: formatHeatmapTooltip({ ...target, mode }, options.locale)
  }));
  const latestTarget = findLatestTarget(cells, mode, todayIso);

  return Object.freeze({
    cells: Object.freeze(cells),
    columnCount: HEATMAP_COLUMN_COUNT,
    endDateIso,
    grid: Object.freeze({
      cellCount: HEATMAP_CELL_COUNT,
      columnCount: HEATMAP_COLUMN_COUNT,
      endDateIso,
      latestColumn: HEATMAP_COLUMN_COUNT - 1,
      rowCount: HEATMAP_ROW_COUNT,
      startDateIso,
      weekStartsOn: WEEK_START_DAY
    }),
    latestTargetKey: latestTarget?.key ?? null,
    maxTokens,
    mode,
    monthLabels: Object.freeze(buildMonthLabels(startDateIso)),
    rowCount: HEATMAP_ROW_COUNT,
    startDateIso,
    todayIso
  });
}

export function getHeatmapLevel(value, maxValue) {
  if (value <= 0 || maxValue <= 0) return 0;

  const ratio = value / maxValue;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.45) return 3;
  if (ratio >= 0.2) return 2;
  return 1;
}

export function formatHeatmapTooltip(target, locale = "en") {
  requireHeatmapTarget(target);
  const normalizedLocale = normalizeLocale(locale);
  const tokenLabel = formatTokenLabel(target.tokens, normalizedLocale);

  if (target.mode === "cumulative") {
    const date = formatFullDate(target.endDateIso, normalizedLocale);
    return normalizedLocale === "ko"
      ? `${date}까지 · ${tokenLabel}`
      : `Through ${date} · ${tokenLabel}`;
  }

  if (target.mode === "weekly") {
    const range = formatDateRange(
      target.startDateIso,
      target.endDateIso,
      normalizedLocale
    );
    return `${range} · ${tokenLabel}`;
  }

  return `${formatFullDate(target.dateIso, normalizedLocale)} · ${tokenLabel}`;
}

export function formatTokenCount(value, locale = "en") {
  requireTokenCount(value, "value");
  const normalizedLocale = normalizeLocale(locale);
  const units = normalizedLocale === "ko"
    ? [
        [1_000_000_000_000, "조"],
        [100_000_000, "억"],
        [10_000, "만"]
      ]
    : [
        [1_000_000_000_000, "T"],
        [1_000_000_000, "B"],
        [1_000_000, "M"],
        [1_000, "K"]
      ];

  for (const [divisor, suffix] of units) {
    if (value >= divisor) {
      return `${trimTrailingZero((value / divisor).toFixed(1))}${suffix}`;
    }
  }

  return new Intl.NumberFormat(
    normalizedLocale === "ko" ? "ko-KR" : "en-US"
  ).format(value);
}

export function normalizeDailyUsageBuckets(value) {
  if (value === null) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new TypeError("dailyUsageBuckets must be an array or null");
  }

  const seenDates = new Set();
  const normalized = value.map((bucket, index) => {
    const path = `dailyUsageBuckets[${index}]`;
    if (!isRecord(bucket)) {
      throw new TypeError(`${path} must be an object`);
    }

    const keys = Object.keys(bucket);
    for (const key of keys) {
      if (!DAILY_BUCKET_KEYS.includes(key)) {
        throw new TypeError(`${path}.${key} is not allowed`);
      }
    }
    for (const key of DAILY_BUCKET_KEYS) {
      if (!Object.hasOwn(bucket, key)) {
        throw new TypeError(`${path}.${key} is required`);
      }
    }

    const startDate = requireIsoDate(bucket.startDate, `${path}.startDate`);
    requireTokenCount(bucket.tokens, `${path}.tokens`);
    if (seenDates.has(startDate)) {
      throw new TypeError(`${path}.startDate must not duplicate ${startDate}`);
    }
    seenDates.add(startDate);

    return Object.freeze({ startDate, tokens: bucket.tokens });
  });

  normalized.sort((left, right) => left.startDate.localeCompare(right.startDate));
  return Object.freeze(normalized);
}

function buildDailyCells({ startDateIso, todayIso, usageByDate }) {
  return Array.from({ length: HEATMAP_CELL_COUNT }, (_, index) => {
    const dateIso = addDays(startDateIso, index);
    const isFuture = dateIso > todayIso;
    const column = Math.floor(index / HEATMAP_ROW_COUNT);
    const row = index % HEATMAP_ROW_COUNT;

    return Object.freeze({
      column,
      dateIso,
      endDateIso: dateIso,
      index,
      isFuture,
      key: dateIso,
      row,
      rowSpan: 1,
      startDateIso: dateIso,
      tokens: isFuture ? 0 : usageByDate.get(dateIso) ?? 0
    });
  });
}

function buildWeeklyTargets(dailyCells, todayIso) {
  return Array.from({ length: HEATMAP_COLUMN_COUNT }, (_, column) => {
    const weekCells = dailyCells.slice(
      column * HEATMAP_ROW_COUNT,
      (column + 1) * HEATMAP_ROW_COUNT
    );
    const startDateIso = weekCells[0].dateIso;
    const scheduledEndDateIso = weekCells.at(-1).dateIso;
    const endDateIso = scheduledEndDateIso > todayIso
      ? todayIso
      : scheduledEndDateIso;
    const tokens = weekCells.reduce((total, cell) => total + cell.tokens, 0);

    return Object.freeze({
      column,
      endDateIso,
      index: column,
      key: startDateIso,
      row: 0,
      rowSpan: HEATMAP_ROW_COUNT,
      startDateIso,
      tokens
    });
  });
}

function buildCumulativeTargets(weeklyTargets) {
  let runningTotal = 0;

  return weeklyTargets.map((week) => {
    runningTotal += week.tokens;
    return Object.freeze({ ...week, tokens: runningTotal });
  });
}

function selectModeTargets(mode, dailyCells, weeklyTargets, cumulativeTargets) {
  if (mode === "weekly") return weeklyTargets;
  if (mode === "cumulative") return cumulativeTargets;
  return dailyCells;
}

function buildMonthLabels(startDateIso) {
  const labelsByMonth = new Map();

  for (let index = 0; index < HEATMAP_CELL_COUNT; index += 1) {
    const dateIso = addDays(startDateIso, index);
    const monthKey = dateIso.slice(0, 7);
    if (labelsByMonth.has(monthKey)) continue;

    labelsByMonth.set(monthKey, Object.freeze({
      column: Math.floor(index / HEATMAP_ROW_COUNT),
      dateIso,
      month: Number(dateIso.slice(5, 7)),
      year: Number(dateIso.slice(0, 4))
    }));
  }

  return [...labelsByMonth.values()];
}

function findLatestTarget(cells, mode, todayIso) {
  if (mode !== "daily") return cells.at(-1) ?? null;
  return cells.find((cell) => cell.dateIso === todayIso) ?? cells.at(-1) ?? null;
}

function resolveAnchorDate(buckets, options) {
  const candidate = options.todayIso ?? options.capturedAt ?? buckets.at(-1)?.startDate;
  if (candidate !== undefined) return normalizeDateInput(candidate, "heatmap anchor");
  return new Date().toISOString().slice(0, 10);
}

function normalizeMode(value) {
  return HEATMAP_MODES.includes(value) ? value : "daily";
}

function normalizeLocale(value) {
  return String(value ?? "en").toLowerCase().startsWith("ko") ? "ko" : "en";
}

function formatTokenLabel(tokens, locale) {
  const compact = formatTokenCount(tokens, locale);
  const exact = new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "en-US")
    .format(tokens);

  if (locale === "ko") return `${compact} 토큰 (${exact})`;
  return `${compact} ${tokens === 1 ? "token" : "tokens"} (${exact})`;
}

function formatFullDate(dateIso, locale) {
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric"
  }).format(new Date(`${dateIso}T00:00:00.000Z`));
}

function formatDateRange(startDateIso, endDateIso, locale) {
  const start = new Date(`${startDateIso}T00:00:00.000Z`);
  const end = new Date(`${endDateIso}T00:00:00.000Z`);
  const formatter = new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric"
  });
  return `${formatter.format(start)}–${formatter.format(end)}`;
}

function requireHeatmapTarget(value) {
  if (!isRecord(value)) throw new TypeError("target must be a heatmap target");
  if (!HEATMAP_MODES.includes(value.mode)) {
    throw new TypeError("target.mode must be daily, weekly, or cumulative");
  }
  requireTokenCount(value.tokens, "target.tokens");
  if (value.mode === "daily") {
    requireIsoDate(value.dateIso, "target.dateIso");
  } else {
    requireIsoDate(value.startDateIso, "target.startDateIso");
    requireIsoDate(value.endDateIso, "target.endDateIso");
  }
}

function requireTokenCount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`);
  }
}

function requireIsoDate(value, label) {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) {
    throw new TypeError(`${label} must be a YYYY-MM-DD date`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new TypeError(`${label} must be a valid UTC date`);
  }
  return value;
}

function normalizeDateInput(value, label) {
  if (typeof value !== "string") {
    throw new TypeError(`${label} must be an ISO date or timestamp`);
  }
  if (ISO_DATE_RE.test(value)) return requireIsoDate(value, label);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`${label} must be an ISO date or timestamp`);
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

function trimTrailingZero(value) {
  return value.endsWith(".0") ? value.slice(0, -2) : value;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
