export const USAGE_SNAPSHOT_V2_SCHEMA_VERSION = 2;

const TOP_LEVEL_REQUIRED_KEYS = [
  "schemaVersion",
  "capturedAt",
  "usage",
  "models",
  "activity",
  "skills",
  "plugins"
];
const TOP_LEVEL_OPTIONAL_KEYS = [
  "producer",
  "codexProfile",
  "codexAssets",
  "extensions"
];
const PRODUCER_KEYS = ["name", "version"];
const CODEX_PROFILE_KEYS = ["displayName", "username", "planLabel"];
const USAGE_KEYS = ["totalTokens", "peakDailyTokens", "tokenBreakdown", "daily"];
const TOKEN_BREAKDOWN_KEYS = [
  "inputTokens",
  "outputTokens",
  "cacheReadTokens",
  "cacheWriteTokens",
  "reasoningTokens"
];
const DAILY_USAGE_KEYS = ["date", "totalTokens", ...TOKEN_BREAKDOWN_KEYS];
const MODELS_KEYS = ["favoriteModel", "items"];
const MODEL_USAGE_KEYS = [
  "model",
  "displayName",
  "totalTokens",
  "usageCount",
  "basis",
  ...TOKEN_BREAKDOWN_KEYS
];
const MODEL_USAGE_BASIS = new Set(["tokens", "usage_count", "duration", "unknown"]);
const ACTIVITY_KEYS = [
  "longestTaskDurationMs",
  "currentStreakDays",
  "longestStreakDays",
  "fastModePercent",
  "reasoningEffort",
  "reasoningEffortPercent",
  "totalThreads"
];
const SKILLS_KEYS = ["exploredCount", "totalUsed", "topSkills"];
const PLUGINS_KEYS = ["topPlugins"];
const RANKING_ITEM_KEYS = ["id", "name", "displayName", "usageCount"];
const CODEX_ASSETS_KEYS = ["avatar", "pet"];
const ASSET_KEYS = ["kind", "url", "assetRef", "contentType"];
const ASSET_KINDS = new Set([
  "remote-url",
  "data-url",
  "uploaded-asset",
  "codex-asset",
  "spritesheet"
]);
const SAFE_SECRET_SUFFIXES = new Set(["digest", "hash", "fingerprint"]);
const SECRET_WORDS = new Set(["password", "secret"]);
const KEY_PREFIX_WORDS = new Set([
  "access",
  "api",
  "auth",
  "codex",
  "github",
  "openai",
  "private",
  "upload"
]);
const TOKEN_PREFIX_WORDS = new Set([
  "access",
  "api",
  "auth",
  "bearer",
  "cli",
  "codex",
  "github",
  "id",
  "openai",
  "refresh",
  "upload"
]);
const SECRET_VALUE_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/i,
  /\bCODEX_ACCESS_TOKEN\s*=/i,
  /"access_token"\s*:/i,
  /"refresh_token"\s*:/i,
  /\bsk-[A-Za-z0-9_-]{10,}\b/,
  /\bgh[opsu]_[A-Za-z0-9_]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/
];
const LOCAL_PRIVATE_PATH_RE = /^(?:\/Users\/|\/home\/|\/var\/|\/private\/var\/|[A-Za-z]:\\)/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateUsageSnapshotV2(value) {
  const errors = [];

  collectForbiddenSnapshotFields(value, "$", errors, new WeakSet());

  if (!isRecord(value)) {
    errors.push("$: expected object");
    return { ok: false, errors };
  }

  validateKeys("$", value, TOP_LEVEL_REQUIRED_KEYS, TOP_LEVEL_OPTIONAL_KEYS, errors);
  validateLiteral("$.schemaVersion", value.schemaVersion, USAGE_SNAPSHOT_V2_SCHEMA_VERSION, errors);
  validateIsoDateTime("$.capturedAt", value.capturedAt, errors);
  validateOptionalProducer("$.producer", value.producer, errors);
  validateOptionalCodexProfile("$.codexProfile", value.codexProfile, errors);
  validateUsage("$.usage", value.usage, errors);
  validateModels("$.models", value.models, errors);
  validateActivity("$.activity", value.activity, errors);
  validateSkills("$.skills", value.skills, errors);
  validatePlugins("$.plugins", value.plugins, errors);
  validateOptionalCodexAssets("$.codexAssets", value.codexAssets, errors);
  validateOptionalExtensions("$.extensions", value.extensions, errors);

  return { ok: errors.length === 0, errors };
}

export function assertUsageSnapshotV2(value) {
  const result = validateUsageSnapshotV2(value);

  if (!result.ok) {
    throw new TypeError(`Invalid usage snapshot v2:\n${result.errors.join("\n")}`);
  }

  return value;
}

export function isUsageSnapshotV2(value) {
  return validateUsageSnapshotV2(value).ok;
}

function validateOptionalProducer(path, value, errors) {
  if (value === undefined) return;
  if (!expectRecord(path, value, errors)) return;

  validateKeys(path, value, PRODUCER_KEYS, [], errors);
  validateNonEmptyString(`${path}.name`, value.name, errors);
  validateNonEmptyString(`${path}.version`, value.version, errors);
}

function validateOptionalCodexProfile(path, value, errors) {
  if (value === undefined) return;
  if (!expectRecord(path, value, errors)) return;

  validateKeys(path, value, CODEX_PROFILE_KEYS, [], errors);
  validateNullableString(`${path}.displayName`, value.displayName, errors);
  validateNullableString(`${path}.username`, value.username, errors);
  validateNullableString(`${path}.planLabel`, value.planLabel, errors);
}

function validateUsage(path, value, errors) {
  if (!expectRecord(path, value, errors)) return;

  validateKeys(path, value, USAGE_KEYS, [], errors);
  validateNonNegativeInteger(`${path}.totalTokens`, value.totalTokens, errors);
  validateNullableNonNegativeInteger(`${path}.peakDailyTokens`, value.peakDailyTokens, errors);
  validateTokenBreakdown(`${path}.tokenBreakdown`, value.tokenBreakdown, errors);
  validateDailyUsage(`${path}.daily`, value.daily, errors);
}

function validateTokenBreakdown(path, value, errors) {
  if (!expectRecord(path, value, errors)) return;

  validateKeys(path, value, TOKEN_BREAKDOWN_KEYS, [], errors);
  validateTokenBreakdownFields(path, value, errors);
}

function validateTokenBreakdownFields(path, value, errors) {
  for (const key of TOKEN_BREAKDOWN_KEYS) {
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

    validateKeys(bucketPath, bucket, DAILY_USAGE_KEYS, [], errors);
    validateIsoDate(`${bucketPath}.date`, bucket.date, errors);
    validateNonNegativeInteger(`${bucketPath}.totalTokens`, bucket.totalTokens, errors);
    validateTokenBreakdownFields(bucketPath, bucket, errors);
  });
}

function validateModels(path, value, errors) {
  if (!expectRecord(path, value, errors)) return;

  validateKeys(path, value, MODELS_KEYS, [], errors);
  validateNullableModelUsage(`${path}.favoriteModel`, value.favoriteModel, errors);
  validateModelUsageArray(`${path}.items`, value.items, errors);
}

function validateNullableModelUsage(path, value, errors) {
  if (value === null) return;
  validateModelUsage(path, value, errors);
}

function validateModelUsageArray(path, value, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${path}: expected array`);
    return;
  }

  value.forEach((item, index) => {
    validateModelUsage(`${path}[${index}]`, item, errors);
  });
}

function validateModelUsage(path, value, errors) {
  if (!expectRecord(path, value, errors)) return;

  validateKeys(path, value, MODEL_USAGE_KEYS, [], errors);
  validateNonEmptyString(`${path}.model`, value.model, errors);
  validateNullableString(`${path}.displayName`, value.displayName, errors);
  validateNullableNonNegativeInteger(`${path}.totalTokens`, value.totalTokens, errors);
  validateNullableNonNegativeInteger(`${path}.usageCount`, value.usageCount, errors);
  validateEnum(`${path}.basis`, value.basis, MODEL_USAGE_BASIS, errors);
  validateTokenBreakdownFields(path, value, errors);
}

function validateActivity(path, value, errors) {
  if (!expectRecord(path, value, errors)) return;

  validateKeys(path, value, ACTIVITY_KEYS, [], errors);
  validateNullableNonNegativeInteger(`${path}.longestTaskDurationMs`, value.longestTaskDurationMs, errors);
  validateNullableNonNegativeInteger(`${path}.currentStreakDays`, value.currentStreakDays, errors);
  validateNullableNonNegativeInteger(`${path}.longestStreakDays`, value.longestStreakDays, errors);
  validateNullablePercent(`${path}.fastModePercent`, value.fastModePercent, errors);
  validateNullableString(`${path}.reasoningEffort`, value.reasoningEffort, errors);
  validateNullablePercent(`${path}.reasoningEffortPercent`, value.reasoningEffortPercent, errors);
  validateNullableNonNegativeInteger(`${path}.totalThreads`, value.totalThreads, errors);
}

function validateSkills(path, value, errors) {
  if (!expectRecord(path, value, errors)) return;

  validateKeys(path, value, SKILLS_KEYS, [], errors);
  validateNullableNonNegativeInteger(`${path}.exploredCount`, value.exploredCount, errors);
  validateNullableNonNegativeInteger(`${path}.totalUsed`, value.totalUsed, errors);
  validateRankingItems(`${path}.topSkills`, value.topSkills, errors);
}

function validatePlugins(path, value, errors) {
  if (!expectRecord(path, value, errors)) return;

  validateKeys(path, value, PLUGINS_KEYS, [], errors);
  validateRankingItems(`${path}.topPlugins`, value.topPlugins, errors);
}

function validateRankingItems(path, value, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${path}: expected array`);
    return;
  }

  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!expectRecord(itemPath, item, errors)) return;

    validateKeys(itemPath, item, RANKING_ITEM_KEYS, [], errors);
    validateNonEmptyString(`${itemPath}.id`, item.id, errors);
    validateNullableString(`${itemPath}.name`, item.name, errors);
    validateNullableString(`${itemPath}.displayName`, item.displayName, errors);
    validateNonNegativeInteger(`${itemPath}.usageCount`, item.usageCount, errors);
  });
}

function validateOptionalCodexAssets(path, value, errors) {
  if (value === undefined) return;
  if (!expectRecord(path, value, errors)) return;

  validateKeys(path, value, CODEX_ASSETS_KEYS, [], errors);
  validateNullableAsset(`${path}.avatar`, value.avatar, errors);
  validateNullableAsset(`${path}.pet`, value.pet, errors);
}

function validateNullableAsset(path, value, errors) {
  if (value === null) return;
  if (!expectRecord(path, value, errors)) return;

  validateKeys(path, value, ASSET_KEYS, [], errors);
  validateEnum(`${path}.kind`, value.kind, ASSET_KINDS, errors);
  validateNullableString(`${path}.url`, value.url, errors);
  validateNullableString(`${path}.assetRef`, value.assetRef, errors);
  validateNullableString(`${path}.contentType`, value.contentType, errors);

  if (value.url === null && value.assetRef === null) {
    errors.push(`${path}: expected url or assetRef`);
  }
}

function validateOptionalExtensions(path, value, errors) {
  if (value === undefined) return;
  if (!expectRecord(path, value, errors)) return;

  for (const key of Object.keys(value)) {
    if (!key.includes(".")) {
      errors.push(`${path}.${key}: expected namespaced extension key`);
    }
  }
}

function validateKeys(path, value, requiredKeys, optionalKeys, errors) {
  const allowed = new Set([...requiredKeys, ...optionalKeys]);

  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      errors.push(`${path}.${key}: unknown field`);
    }
  }

  for (const key of requiredKeys) {
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

function validateNonEmptyString(path, value, errors) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${path}: expected non-empty string`);
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

  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
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
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function collectForbiddenSnapshotFields(value, path, errors, seen) {
  if (typeof value === "string") {
    if (isForbiddenSecretValue(value)) {
      errors.push(`${path}: forbidden credential-like value`);
    }

    if (LOCAL_PRIVATE_PATH_RE.test(value)) {
      errors.push(`${path}: forbidden private local path`);
    }

    return;
  }

  if (value === null || typeof value !== "object") {
    return;
  }

  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectForbiddenSnapshotFields(item, `${path}[${index}]`, errors, seen);
    });
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    const keyReason = getForbiddenKeyReason(key);

    if (keyReason) {
      errors.push(`${childPath}: forbidden ${keyReason}`);
    }

    collectForbiddenSnapshotFields(child, childPath, errors, seen);
  }
}

function getForbiddenKeyReason(key) {
  const words = keyToWords(key);

  if (words.includes("github")) {
    return "GitHub-facing field";
  }

  if (isForbiddenSecretKey(words, key)) {
    return "credential-like field";
  }

  return null;
}

function isForbiddenSecretKey(words, key) {
  const lowerKey = String(key).toLowerCase();
  if (lowerKey === "auth.json" || lowerKey === "authjson") {
    return true;
  }

  if (words.length === 0) {
    return false;
  }

  if (words.some((word) => SECRET_WORDS.has(word))) {
    return !words.some((word) => SAFE_SECRET_SUFFIXES.has(word));
  }

  if (words.includes("authorization") || words.includes("bearer")) {
    return true;
  }

  const keyIndex = words.indexOf("key");
  if (keyIndex !== -1) {
    const nextWord = words[keyIndex + 1];
    if (SAFE_SECRET_SUFFIXES.has(nextWord)) {
      return false;
    }

    const previousWord = words[keyIndex - 1];
    return KEY_PREFIX_WORDS.has(previousWord);
  }

  const tokenIndex = words.indexOf("token");
  if (tokenIndex === -1) {
    return false;
  }

  const nextWord = words[tokenIndex + 1];
  if (SAFE_SECRET_SUFFIXES.has(nextWord)) {
    return false;
  }

  const previousWord = words[tokenIndex - 1];
  return words.length === 1 || TOKEN_PREFIX_WORDS.has(previousWord);
}

function isForbiddenSecretValue(value) {
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function keyToWords(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
