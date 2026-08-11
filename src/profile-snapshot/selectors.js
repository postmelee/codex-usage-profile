const PROFILE_STAT_DEFINITIONS = [
  ["totalTextTokens", "Lifetime tokens"],
  ["peakTokens", "Peak tokens"],
  ["longestTaskDurationMs", "Longest task"],
  ["currentStreakDays", "Current streak"],
  ["longestStreakDays", "Longest streak"]
];

const SHARE_CARD_STAT_DEFINITIONS = [
  ["totalTextTokens", "lifetime tokens"],
  ["peakTokens", "peak day"],
  ["currentStreakDays", "current streak"],
  ["longestStreakDays", "longest streak"]
];

const SHARE_CARD_DAY_COUNT = 26 * 7;

export function selectProfileViewModel(snapshot) {
  return {
    header: selectProfileHeader(snapshot),
    stats: selectProfileStats(snapshot),
    tokenActivity: selectProfileTokenActivity(snapshot),
    activityInsights: selectActivityInsights(snapshot),
    mostUsedInvocations: selectMostUsedInvocations(snapshot)
  };
}

export function selectShareCardViewModel(snapshot, options = {}) {
  return {
    header: selectProfileHeader(snapshot),
    stats: selectShareCardStats(snapshot),
    usage: selectShareCardUsageInput(snapshot, options)
  };
}

export function selectProfileHeader(snapshot) {
  return {
    displayName: snapshot.profile.displayName,
    username: snapshot.profile.username,
    planLabel: snapshot.profile.planLabel,
    avatarAsset: snapshot.assets.avatar,
    petAsset: snapshot.assets.pet
  };
}

export function selectProfileStats(snapshot) {
  return PROFILE_STAT_DEFINITIONS.map(([key, label]) => ({
    key,
    label,
    value: snapshot.summary[key]
  }));
}

export function selectShareCardStats(snapshot) {
  return SHARE_CARD_STAT_DEFINITIONS.map(([key, label]) => ({
    key,
    label,
    value: snapshot.summary[key]
  }));
}

export function selectProfileTokenActivity(snapshot) {
  return {
    capturedAt: snapshot.capturedAt,
    dailyUsage: sortDailyUsage(snapshot.dailyUsage)
  };
}

export function selectShareCardUsageInput(snapshot, options = {}) {
  const todayIso = normalizeTodayIso(options.todayIso, snapshot.capturedAt);
  const startDateIso = addDays(startOfUtcWeek(todayIso), -(SHARE_CARD_DAY_COUNT - 7));

  return {
    todayIso,
    startDateIso,
    dayCount: SHARE_CARD_DAY_COUNT,
    dailyUsage: sortDailyUsage(snapshot.dailyUsage).filter((bucket) => (
      bucket.date >= startDateIso && bucket.date <= todayIso
    ))
  };
}

export function selectActivityInsights(snapshot) {
  return { ...snapshot.activityInsights };
}

export function selectMostUsedInvocations(snapshot, options = {}) {
  const limit = Number.isInteger(options.limit) && options.limit >= 0
    ? options.limit
    : 5;

  return [...snapshot.topInvocations]
    .sort((left, right) => right.usageCount - left.usageCount)
    .slice(0, limit);
}

function sortDailyUsage(dailyUsage) {
  return [...dailyUsage].sort((left, right) => left.date.localeCompare(right.date));
}

function normalizeTodayIso(todayIso, capturedAt) {
  if (typeof todayIso === "string" && todayIso.length > 0) {
    return toIsoDate(todayIso);
  }

  return toIsoDate(capturedAt);
}

function toIsoDate(value) {
  const date = value.length === 10
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
