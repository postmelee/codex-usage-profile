import { normalizeAccountUsageReadResult } from "./account-usage.js";
import { buildCardHeatmap } from "./heatmap.js";

export const CARD_LOCALES = Object.freeze(["en", "ko"]);

const CARD_COPY = Object.freeze({
  en: Object.freeze({
    lifetimeTokens: "lifetime tokens",
    peakDailyTokens: "peak day",
    currentStreakDays: "current streak",
    longestStreakDays: "longest streak"
  }),
  ko: Object.freeze({
    lifetimeTokens: "누적 토큰",
    peakDailyTokens: "최대 사용일",
    currentStreakDays: "현재 연속 기록",
    longestStreakDays: "최장 연속 기록"
  })
});

export function buildCardViewModel(options = {}) {
  const owner = normalizeCardOwner(options.owner);
  const usage = normalizeAccountUsageReadResult(options.usage);
  const locale = resolveCardLocale(options.locale);
  const copy = CARD_COPY[locale];
  const summary = usage.summary;

  return {
    header: {
      avatarUrl: owner.avatarUrl,
      displayName: owner.displayName,
      username: `@${owner.githubLogin}`
    },
    heatmap: buildCardHeatmap(usage.dailyUsageBuckets, {
      todayIso: options.todayIso
    }),
    locale,
    stats: [
      createTokenStat(
        "lifetimeTokens",
        copy.lifetimeTokens,
        summary.lifetimeTokens,
        locale
      ),
      createTokenStat(
        "peakDailyTokens",
        copy.peakDailyTokens,
        summary.peakDailyTokens,
        locale
      ),
      createStreakStat(
        "currentStreakDays",
        copy.currentStreakDays,
        summary.currentStreakDays,
        locale
      ),
      createStreakStat(
        "longestStreakDays",
        copy.longestStreakDays,
        summary.longestStreakDays,
        locale
      )
    ],
    usage
  };
}

export function resolveCardLocale(value) {
  const normalized = String(value ?? "en").trim().toLowerCase();

  if (normalized === "ko" || normalized.startsWith("ko-")) {
    return "ko";
  }

  return "en";
}

export function formatCardTokenCount(value, locale = "en") {
  if (value === null) return "—";

  if (resolveCardLocale(locale) === "ko") {
    return formatKoreanTokenCount(value);
  }

  return formatEnglishTokenCount(value);
}

export function formatCardStreak(value, locale = "en") {
  if (value === null) return "—";

  if (resolveCardLocale(locale) === "ko") {
    return `${value}일`;
  }

  return `${value} ${value === 1 ? "day" : "days"}`;
}

function normalizeCardOwner(owner) {
  if (!owner || typeof owner !== "object" || Array.isArray(owner)) {
    throw new TypeError("owner is required");
  }

  const githubLogin = firstNonEmptyString(owner.githubLogin, owner.handle);
  if (!githubLogin) {
    throw new TypeError("owner.githubLogin or owner.handle is required");
  }

  return {
    avatarUrl: firstNonEmptyString(owner.avatarUrl),
    displayName: firstNonEmptyString(
      owner.displayName,
      owner.githubLogin,
      owner.handle
    ),
    githubLogin
  };
}

function createTokenStat(key, label, rawValue, locale) {
  return {
    key,
    label,
    rawValue,
    value: formatCardTokenCount(rawValue, locale)
  };
}

function createStreakStat(key, label, rawValue, locale) {
  return {
    key,
    label,
    rawValue,
    value: formatCardStreak(rawValue, locale)
  };
}

function formatKoreanTokenCount(value) {
  if (value >= 100_000_000) {
    return `${formatDecimal(value / 100_000_000)}억`;
  }

  if (value >= 10_000) {
    return `${formatDecimal(value / 10_000)}만`;
  }

  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatEnglishTokenCount(value) {
  if (value >= 1_000_000_000) {
    return `${formatDecimal(value / 1_000_000_000)}B`;
  }

  if (value >= 1_000_000) {
    return `${formatDecimal(value / 1_000_000)}M`;
  }

  if (value >= 1_000) {
    return `${formatDecimal(value / 1_000)}K`;
  }

  return new Intl.NumberFormat("en-US").format(value);
}

function formatDecimal(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
    useGrouping: false
  }).format(value);
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }

  return null;
}
