export const PROFILE_SNAPSHOT_SCHEMA_VERSION = 1;

const TOP_LEVEL_KEYS = [
  "schemaVersion",
  "capturedAt",
  "profile",
  "summary",
  "dailyUsage",
  "activityInsights",
  "topInvocations",
  "assets"
];

const PROFILE_KEYS = ["displayName", "username", "planLabel"];
const SUMMARY_KEYS = [
  "totalTextTokens",
  "peakTokens",
  "longestTaskDurationMs",
  "currentStreakDays",
  "longestStreakDays"
];
const DAILY_USAGE_KEYS = ["date", "credits"];
const INSIGHTS_KEYS = [
  "fastModePercent",
  "reasoningEffort",
  "reasoningEffortPercent",
  "skillsExplored",
  "totalSkillsUsed",
  "totalThreads"
];
const INVOCATION_KEYS = [
  "type",
  "pluginId",
  "pluginName",
  "skillId",
  "skillName",
  "usageCount"
];
const ASSETS_KEYS = ["avatar", "pet"];
const ASSET_KEYS = ["kind", "url", "assetRef", "contentType"];
const ASSET_KINDS = new Set([
  "remote-url",
  "data-url",
  "uploaded-asset",
  "codex-asset",
  "spritesheet"
]);
const INVOCATION_TYPES = new Set(["plugin", "skill"]);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateProfileSnapshot(value) {
  const errors = [];

  if (!isRecord(value)) {
    errors.push("$: expected object");
    return { ok: false, errors };
  }

  validateExactKeys("$", value, TOP_LEVEL_KEYS, errors);
  validateLiteral("$.schemaVersion", value.schemaVersion, PROFILE_SNAPSHOT_SCHEMA_VERSION, errors);
  validateIsoDateTime("$.capturedAt", value.capturedAt, errors);
  validateProfile("$.profile", value.profile, errors);
  validateSummary("$.summary", value.summary, errors);
  validateDailyUsage("$.dailyUsage", value.dailyUsage, errors);
  validateActivityInsights("$.activityInsights", value.activityInsights, errors);
  validateTopInvocations("$.topInvocations", value.topInvocations, errors);
  validateAssets("$.assets", value.assets, errors);

  return { ok: errors.length === 0, errors };
}

export function assertProfileSnapshot(value) {
  const result = validateProfileSnapshot(value);

  if (!result.ok) {
    throw new TypeError(`Invalid profile snapshot:\n${result.errors.join("\n")}`);
  }

  return value;
}

export function isProfileSnapshot(value) {
  return validateProfileSnapshot(value).ok;
}

function validateProfile(path, value, errors) {
  if (!expectRecord(path, value, errors)) return;

  validateExactKeys(path, value, PROFILE_KEYS, errors);
  validateNullableString(`${path}.displayName`, value.displayName, errors);
  validateNullableString(`${path}.username`, value.username, errors);
  validateNullableString(`${path}.planLabel`, value.planLabel, errors);
}

function validateSummary(path, value, errors) {
  if (!expectRecord(path, value, errors)) return;

  validateExactKeys(path, value, SUMMARY_KEYS, errors);
  for (const key of SUMMARY_KEYS) {
    validateNullableNonNegativeInteger(`${path}.${key}`, value[key], errors);
  }
}

function validateDailyUsage(path, value, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${path}: expected array`);
    return;
  }

  value.forEach((bucket, index) => {
    const bucketPath = `${path}[${index}]`;
    if (!expectRecord(bucketPath, bucket, errors)) return;

    validateExactKeys(bucketPath, bucket, DAILY_USAGE_KEYS, errors);
    validateIsoDate(`${bucketPath}.date`, bucket.date, errors);
    validateNonNegativeInteger(`${bucketPath}.credits`, bucket.credits, errors);
  });
}

function validateActivityInsights(path, value, errors) {
  if (!expectRecord(path, value, errors)) return;

  validateExactKeys(path, value, INSIGHTS_KEYS, errors);
  validateNullablePercent(`${path}.fastModePercent`, value.fastModePercent, errors);
  validateNullableString(`${path}.reasoningEffort`, value.reasoningEffort, errors);
  validateNullablePercent(`${path}.reasoningEffortPercent`, value.reasoningEffortPercent, errors);
  validateNullableNonNegativeInteger(`${path}.skillsExplored`, value.skillsExplored, errors);
  validateNullableNonNegativeInteger(`${path}.totalSkillsUsed`, value.totalSkillsUsed, errors);
  validateNullableNonNegativeInteger(`${path}.totalThreads`, value.totalThreads, errors);
}

function validateTopInvocations(path, value, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${path}: expected array`);
    return;
  }

  value.forEach((invocation, index) => {
    const invocationPath = `${path}[${index}]`;
    if (!expectRecord(invocationPath, invocation, errors)) return;

    validateExactKeys(invocationPath, invocation, INVOCATION_KEYS, errors);
    validateEnum(`${invocationPath}.type`, invocation.type, INVOCATION_TYPES, errors);
    validateNullableString(`${invocationPath}.pluginId`, invocation.pluginId, errors);
    validateNullableString(`${invocationPath}.pluginName`, invocation.pluginName, errors);
    validateNullableString(`${invocationPath}.skillId`, invocation.skillId, errors);
    validateNullableString(`${invocationPath}.skillName`, invocation.skillName, errors);
    validateNonNegativeInteger(`${invocationPath}.usageCount`, invocation.usageCount, errors);
  });
}

function validateAssets(path, value, errors) {
  if (!expectRecord(path, value, errors)) return;

  validateExactKeys(path, value, ASSETS_KEYS, errors);
  validateNullableAsset(`${path}.avatar`, value.avatar, errors);
  validateNullableAsset(`${path}.pet`, value.pet, errors);
}

function validateNullableAsset(path, value, errors) {
  if (value === null) return;
  if (!expectRecord(path, value, errors)) return;

  validateExactKeys(path, value, ASSET_KEYS, errors);
  validateEnum(`${path}.kind`, value.kind, ASSET_KINDS, errors);
  validateNullableString(`${path}.url`, value.url, errors);
  validateNullableString(`${path}.assetRef`, value.assetRef, errors);
  validateNullableString(`${path}.contentType`, value.contentType, errors);

  if (value.url === null && value.assetRef === null) {
    errors.push(`${path}: expected url or assetRef`);
  }
}

function validateExactKeys(path, value, allowedKeys, errors) {
  const allowed = new Set(allowedKeys);

  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      errors.push(`${path}.${key}: unknown field`);
    }
  }

  for (const key of allowedKeys) {
    if (!Object.hasOwn(value, key)) {
      errors.push(`${path}.${key}: missing field`);
    }
  }
}

function validateLiteral(path, value, expected, errors) {
  if (value !== expected) {
    errors.push(`${path}: expected ${expected}`);
  }
}

function validateNullableString(path, value, errors) {
  if (value === null) return;
  if (typeof value !== "string") {
    errors.push(`${path}: expected string or null`);
  }
}

function validateNonNegativeInteger(path, value, errors) {
  if (!Number.isInteger(value) || value < 0) {
    errors.push(`${path}: expected non-negative integer`);
  }
}

function validateNullableNonNegativeInteger(path, value, errors) {
  if (value === null) return;
  validateNonNegativeInteger(path, value, errors);
}

function validateNullablePercent(path, value, errors) {
  if (value === null) return;
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    errors.push(`${path}: expected percent between 0 and 100 or null`);
  }
}

function validateEnum(path, value, allowedValues, errors) {
  if (typeof value !== "string" || !allowedValues.has(value)) {
    errors.push(`${path}: expected one of ${Array.from(allowedValues).join(", ")}`);
  }
}

function validateIsoDate(path, value, errors) {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) {
    errors.push(`${path}: expected YYYY-MM-DD date`);
    return;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    errors.push(`${path}: expected valid UTC date`);
  }
}

function validateIsoDateTime(path, value, errors) {
  if (typeof value !== "string") {
    errors.push(`${path}: expected ISO date-time string`);
    return;
  }

  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    errors.push(`${path}: expected valid ISO date-time string`);
  }
}

function expectRecord(path, value, errors) {
  if (!isRecord(value)) {
    errors.push(`${path}: expected object`);
    return false;
  }

  return true;
}

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}
