const COLUMN_COUNT = 52;
const DAYS_PER_WEEK = 7;
const CELL_COUNT = COLUMN_COUNT * DAYS_PER_WEEK;

export const HEATMAP_MODES = ["daily", "weekly", "cumulative"];

export function buildTokenHeatmap(tokenActivity, options = {}) {
  const mode = HEATMAP_MODES.includes(options.mode) ? options.mode : "daily";
  const todayIso = normalizeIsoDate(options.todayIso ?? tokenActivity.capturedAt);
  const weekStartIso = startOfUtcWeek(todayIso);
  const startDateIso = addDays(weekStartIso, -(COLUMN_COUNT - 1) * DAYS_PER_WEEK);
  const usageByDate = new Map(
    tokenActivity.dailyUsage.map((bucket) => [bucket.date, bucket.credits])
  );
  const dailyCells = Array.from({ length: CELL_COUNT }, (_, index) => {
    const dateIso = addDays(startDateIso, index);
    const credits = usageByDate.get(dateIso) ?? 0;
    const weekIndex = Math.floor(index / DAYS_PER_WEEK);

    return {
      credits,
      dateIso,
      index,
      key: `${mode}:${dateIso}`,
      mode,
      tooltip: "",
      weekIndex,
      weekStartIso: addDays(startDateIso, weekIndex * DAYS_PER_WEEK)
    };
  });
  const weeklyTotals = buildWeeklyTotals(dailyCells);
  const cumulativeTotals = buildCumulativeTotals(weeklyTotals);
  const valuesForLevels = getValuesForLevels(mode, dailyCells, weeklyTotals, cumulativeTotals);
  const maxValue = Math.max(...valuesForLevels, 1);
  const cells = dailyCells.map((cell) => {
    const value = getCellValue(mode, cell, weeklyTotals, cumulativeTotals);

    return {
      ...cell,
      level: getHeatmapLevel(value, maxValue),
      tokenCount: value,
      tooltip: formatHeatmapTooltip(mode, value, cell.dateIso, cell.weekStartIso, todayIso)
    };
  });

  return {
    cells,
    columnCount: COLUMN_COUNT,
    mode,
    monthLabels: buildMonthLabels(startDateIso),
    rowCount: DAYS_PER_WEEK,
    startDateIso,
    todayIso
  };
}

export function getHeatmapLevel(value, maxValue) {
  if (value <= 0 || maxValue <= 0) {
    return 0;
  }

  const ratio = value / maxValue;

  if (ratio >= 0.75) {
    return 4;
  }

  if (ratio >= 0.45) {
    return 3;
  }

  if (ratio >= 0.2) {
    return 2;
  }

  return 1;
}

export function formatHeatmapTooltip(mode, tokenCount, dateIso, weekStartIso, todayIso) {
  const formattedTokens = formatTokenCount(tokenCount);

  if (mode === "weekly") {
    return `${formattedTokens} tokens on week of ${formatTooltipDate(weekStartIso, todayIso)}`;
  }

  if (mode === "cumulative") {
    return `${formattedTokens} tokens through week of ${formatTooltipDate(weekStartIso, todayIso)}`;
  }

  return `${formattedTokens} tokens on ${formatTooltipDate(dateIso, todayIso)}`;
}

export function formatTooltipDate(dateIso, todayIso) {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  const todayYear = Number(todayIso.slice(0, 4));
  const options = {
    day: "numeric",
    month: "short",
    timeZone: "UTC"
  };

  if (date.getUTCFullYear() !== todayYear) {
    options.year = "numeric";
  }

  return new Intl.DateTimeFormat("en-US", options).format(date);
}

function buildWeeklyTotals(cells) {
  return cells.reduce((totals, cell) => {
    totals[cell.weekIndex] = (totals[cell.weekIndex] ?? 0) + cell.credits;
    return totals;
  }, []);
}

function buildCumulativeTotals(weeklyTotals) {
  const totals = [];
  let runningTotal = 0;

  for (const total of weeklyTotals) {
    runningTotal += total ?? 0;
    totals.push(runningTotal);
  }

  return totals;
}

function getValuesForLevels(mode, dailyCells, weeklyTotals, cumulativeTotals) {
  if (mode === "weekly") {
    return weeklyTotals;
  }

  if (mode === "cumulative") {
    return cumulativeTotals;
  }

  return dailyCells.map((cell) => cell.credits);
}

function getCellValue(mode, cell, weeklyTotals, cumulativeTotals) {
  if (mode === "weekly") {
    return weeklyTotals[cell.weekIndex] ?? 0;
  }

  if (mode === "cumulative") {
    return cumulativeTotals[cell.weekIndex] ?? 0;
  }

  return cell.credits;
}

function buildMonthLabels(startDateIso) {
  const startDate = new Date(`${startDateIso}T00:00:00.000Z`);

  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth() + index + 1,
      1
    ));

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      timeZone: "UTC"
    }).format(date);
  });
}

function normalizeIsoDate(value) {
  const date = String(value).length === 10
    ? new Date(`${value}T00:00:00.000Z`)
    : new Date(value);

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

function formatTokenCount(value) {
  if (value >= 1_000_000_000) {
    return `${trimTrailingZero((value / 1_000_000_000).toFixed(1))}B`;
  }

  if (value >= 1_000_000) {
    return `${trimTrailingZero((value / 1_000_000).toFixed(1))}M`;
  }

  if (value >= 1_000) {
    return `${trimTrailingZero((value / 1_000).toFixed(1))}K`;
  }

  return String(value);
}

function trimTrailingZero(value) {
  return value.endsWith(".0") ? value.slice(0, -2) : value;
}
