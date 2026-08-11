import {
  PROFILE_SNAPSHOT_SCHEMA_VERSION,
  assertProfileSnapshot
} from "./schema.js";

const PLAN_LABELS = new Map([
  ["business", "Business"],
  ["enterprise", "Enterprise"],
  ["enterprise_cbp_usage_based", "Enterprise"],
  ["free", "Free"],
  ["free_workspace", "Free"],
  ["go", "Go"],
  ["guest", "Free"],
  ["plus", "Plus"],
  ["pro", "Pro"],
  ["prolite", "Pro"],
  ["self_serve_business_usage_based", "Business"],
  ["team", "Team"]
]);

export function normalizeCodexProfileSnapshot(raw, options = {}) {
  const source = asRecord(raw);
  const profile = asRecord(source.profile);
  const stats = asRecord(source.stats);

  const snapshot = {
    schemaVersion: PROFILE_SNAPSHOT_SCHEMA_VERSION,
    capturedAt: normalizeCapturedAt(options.capturedAt),
    profile: {
      displayName: normalizeText(profile.display_name),
      username: normalizeText(profile.username),
      planLabel: normalizePlanLabel(
        options.planLabel ??
        profile.plan_label ??
        profile.plan ??
        asRecord(source.account).plan_label ??
        asRecord(source.account).plan
      )
    },
    summary: {
      totalTextTokens: nullableNonNegativeInteger(stats.lifetime_tokens),
      peakTokens: nullableNonNegativeInteger(stats.peak_daily_tokens),
      longestTaskDurationMs: secondsToMilliseconds(stats.longest_running_turn_sec),
      currentStreakDays: nullableNonNegativeInteger(stats.current_streak_days),
      longestStreakDays: nullableNonNegativeInteger(stats.longest_streak_days)
    },
    dailyUsage: normalizeDailyUsage(stats.daily_usage_buckets),
    activityInsights: {
      fastModePercent: nullablePercent(stats.fast_mode_usage_percentage),
      reasoningEffort: normalizeText(stats.most_used_reasoning_effort),
      reasoningEffortPercent: nullablePercent(stats.most_used_reasoning_effort_percentage),
      skillsExplored: nullableNonNegativeInteger(stats.unique_skills_used),
      totalSkillsUsed: nullableNonNegativeInteger(stats.total_skills_used),
      totalThreads: nullableNonNegativeInteger(stats.total_threads)
    },
    topInvocations: normalizeTopInvocations(stats.top_invocations),
    assets: {
      avatar: normalizeAssetOption(options.avatarAsset, profile.profile_picture_url),
      pet: normalizeAssetOption(options.petAsset, null)
    }
  };

  return assertProfileSnapshot(snapshot);
}

function normalizeDailyUsage(value) {
  if (!Array.isArray(value)) return [];

  return value.map((bucket) => {
    const source = asRecord(bucket);

    return {
      date: normalizeText(source.start_date) ?? "",
      credits: nonNegativeInteger(source.tokens)
    };
  });
}

function normalizeTopInvocations(value) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const source = asRecord(item);
    const type = normalizeInvocationType(source.type);

    if (type === null) return [];

    return [{
      type,
      pluginId: normalizeText(source.plugin_id),
      pluginName: normalizeText(source.plugin_name),
      skillId: normalizeText(source.skill_id),
      skillName: normalizeText(source.skill_name),
      usageCount: nonNegativeInteger(source.usage_count)
    }];
  });
}

function normalizeInvocationType(value) {
  if (value === "plugin" || value === "skill") return value;
  return null;
}

function normalizeAssetOption(option, fallbackUrl) {
  if (option !== undefined) return normalizeAsset(option);

  const url = normalizeText(fallbackUrl);
  if (url === null) return null;

  return {
    kind: "remote-url",
    url,
    assetRef: null,
    contentType: null
  };
}

function normalizeAsset(value) {
  if (value === null) return null;

  const source = asRecord(value);
  const kind = normalizeText(source.kind) ?? "uploaded-asset";

  return {
    kind,
    url: normalizeText(source.url),
    assetRef: normalizeText(source.assetRef),
    contentType: normalizeText(source.contentType)
  };
}

function normalizeCapturedAt(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim().length > 0) {
    return new Date(value).toISOString();
  }

  return new Date().toISOString();
}

function normalizePlanLabel(value) {
  const text = normalizeText(value);
  if (text === null) return null;

  const key = text.toLowerCase();
  if (PLAN_LABELS.has(key)) return PLAN_LABELS.get(key);

  return text
    .split(/[_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function secondsToMilliseconds(value) {
  const seconds = nullableNonNegativeInteger(value);
  return seconds === null ? null : seconds * 1000;
}

function nullablePercent(value) {
  if (value === null || value === undefined) return null;

  const number = Number(value);
  if (!Number.isFinite(number)) return null;

  return Math.min(100, Math.max(0, number));
}

function nullableNonNegativeInteger(value) {
  if (value === null || value === undefined) return null;

  const number = Number(value);
  if (!Number.isFinite(number)) return null;

  return Math.max(0, Math.round(number));
}

function nonNegativeInteger(value) {
  return nullableNonNegativeInteger(value) ?? 0;
}

function normalizeText(value) {
  if (typeof value !== "string") return null;

  const text = value.trim();
  return text.length === 0 ? null : text;
}

function asRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
}
