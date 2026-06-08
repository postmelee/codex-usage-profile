const COMPACT_SUFFIXES = [
  [1_000_000_000, "B"],
  [1_000_000, "M"],
  [1_000, "K"]
];

export function formatStatValue(key, value) {
  if (value == null) {
    return "Unavailable";
  }

  switch (key) {
    case "totalTextTokens":
    case "peakTokens":
      return formatCompactNumber(value);
    case "longestTaskDurationMs":
      return formatDuration(value);
    case "currentStreakDays":
    case "longestStreakDays":
      return `${formatInteger(value)} days`;
    default:
      return formatInteger(value);
  }
}

export function formatCompactNumber(value) {
  for (const [size, suffix] of COMPACT_SUFFIXES) {
    if (value >= size) {
      const scaled = value / size;
      const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 1;
      return `${trimTrailingZero(scaled.toFixed(digits))}${suffix}`;
    }
  }

  return formatInteger(value);
}

export function formatDuration(milliseconds) {
  const totalMinutes = Math.round(milliseconds / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes}m`;
  }

  if (minutes <= 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

export function formatInteger(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0
  }).format(value);
}

export function formatPercent(value) {
  return `${formatInteger(value)}%`;
}

export function formatReasoningEffort(effort) {
  return {
    none: "None",
    minimal: "Minimal",
    low: "Low",
    medium: "Medium",
    high: "High",
    xhigh: "Extra High"
  }[effort] ?? effort;
}

function trimTrailingZero(value) {
  return value.endsWith(".0") ? value.slice(0, -2) : value;
}
