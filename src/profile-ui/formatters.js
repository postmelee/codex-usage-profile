import {
  formatLocalizedNumber,
  formatMessage,
  resolveLocale
} from "./i18n.js";

export function formatStatValue(key, value, locale = "en") {
  if (value == null) {
    return formatMessage(locale, "profile.stat.unavailable");
  }

  switch (key) {
    case "totalTextTokens":
    case "peakTokens":
      return formatCompactNumber(value, locale);
    case "longestTaskDurationMs":
      return formatDuration(value, locale);
    case "longestRunningTurnSec":
      return formatDuration(value * 1_000, locale);
    case "currentStreakDays":
    case "longestStreakDays":
      return formatMessage(
        locale,
        value === 1 ? "profile.stat.day.one" : "profile.stat.day.other",
        { count: formatInteger(value, locale) }
      );
    default:
      return formatInteger(value, locale);
  }
}

export function formatCompactNumber(value, locale = "en") {
  return formatLocalizedNumber(value, resolveLocale(locale), {
    maximumFractionDigits: 1,
    notation: "compact"
  });
}

export function formatDuration(milliseconds, locale = "en") {
  const totalMinutes = Math.round(milliseconds / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return formatMessage(locale, "profile.duration.minutes", {
      count: formatInteger(minutes, locale)
    });
  }

  if (minutes <= 0) {
    return formatMessage(locale, "profile.duration.hours", {
      count: formatInteger(hours, locale)
    });
  }

  return `${formatMessage(locale, "profile.duration.hours", {
    count: formatInteger(hours, locale)
  })} ${formatMessage(locale, "profile.duration.minutes", {
    count: formatInteger(minutes, locale)
  })}`;
}

export function formatInteger(value, locale = "en") {
  return formatLocalizedNumber(value, resolveLocale(locale), {
    maximumFractionDigits: 0
  });
}

export function formatPercent(value, locale = "en") {
  return `${formatInteger(value, locale)}%`;
}

export function formatReasoningEffort(effort, locale = "en") {
  const id = {
    none: "profile.reasoning.none",
    minimal: "profile.reasoning.minimal",
    low: "profile.reasoning.low",
    medium: "profile.reasoning.medium",
    high: "profile.reasoning.high",
    xhigh: "profile.reasoning.xhigh"
  }[effort];

  return id ? formatMessage(locale, id) : effort;
}
