const RESULT_KEYS = Object.freeze([
  "summary",
  "dailyUsageBuckets"
]);

const DOCUMENT_KEYS = Object.freeze([
  "contractVersion",
  "capturedAt",
  "summary",
  "dailyUsageBuckets"
]);

const SUMMARY_KEYS = Object.freeze([
  "lifetimeTokens",
  "peakDailyTokens",
  "longestRunningTurnSec",
  "currentStreakDays",
  "longestStreakDays"
]);

const DAILY_BUCKET_KEYS = Object.freeze([
  "startDate",
  "tokens"
]);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const ACCOUNT_USAGE_CONTRACT_VERSION = 1;
export const DEFAULT_ACCOUNT_USAGE_FUTURE_SKEW_MS = 5 * 60 * 1000;

export function validateAccountUsageDocument(value, options = {}) {
  const errors = [];

  if (!isRecord(value)) {
    return {
      errors: ["$: expected object"],
      ok: false
    };
  }

  validateExactKeys("$", value, DOCUMENT_KEYS, errors);

  if (value.contractVersion !== ACCOUNT_USAGE_CONTRACT_VERSION) {
    errors.push(
      `$.contractVersion: expected ${ACCOUNT_USAGE_CONTRACT_VERSION}`
    );
  }

  validateCapturedAt("$.capturedAt", value.capturedAt, errors, options);
  validateSummary("$.summary", value.summary, errors);
  validateDailyUsageBuckets("$.dailyUsageBuckets", value.dailyUsageBuckets, errors);

  return {
    errors,
    ok: errors.length === 0
  };
}

export function assertAccountUsageDocument(value, options = {}) {
  const result = validateAccountUsageDocument(value, options);

  if (!result.ok) {
    throw new TypeError(`Invalid Account Usage Contract:\n${result.errors.join("\n")}`);
  }

  return value;
}

export function normalizeAccountUsageDocument(value, options = {}) {
  assertAccountUsageDocument(value, options);

  return {
    contractVersion: ACCOUNT_USAGE_CONTRACT_VERSION,
    capturedAt: new Date(value.capturedAt).toISOString(),
    summary: normalizeSummary(value.summary),
    dailyUsageBuckets: value.dailyUsageBuckets === null
      ? null
      : normalizeDailyUsageBuckets(value.dailyUsageBuckets)
  };
}

export function projectAccountUsageReadResult(document) {
  const normalized = normalizeAccountUsageDocument(document, {
    maxFutureSkewMs: Number.POSITIVE_INFINITY
  });

  return {
    summary: normalized.summary,
    dailyUsageBuckets: normalized.dailyUsageBuckets
  };
}

export function validateAccountUsageReadResult(value) {
  const errors = [];

  if (!isRecord(value)) {
    return {
      errors: ["$: expected object"],
      ok: false
    };
  }

  validateExactKeys("$", value, RESULT_KEYS, errors);
  validateSummary("$.summary", value.summary, errors);
  validateDailyUsageBuckets("$.dailyUsageBuckets", value.dailyUsageBuckets, errors);

  return {
    errors,
    ok: errors.length === 0
  };
}

export function assertAccountUsageReadResult(value) {
  const result = validateAccountUsageReadResult(value);

  if (!result.ok) {
    throw new TypeError(`Invalid account/usage/read result:\n${result.errors.join("\n")}`);
  }

  return value;
}

export function isAccountUsageReadResult(value) {
  return validateAccountUsageReadResult(value).ok;
}

export function normalizeAccountUsageReadResult(value) {
  assertAccountUsageReadResult(value);

  return {
    summary: normalizeSummary(value.summary),
    dailyUsageBuckets: value.dailyUsageBuckets === null
      ? []
      : normalizeDailyUsageBuckets(value.dailyUsageBuckets)
  };
}

function normalizeSummary(value) {
  return Object.fromEntries(
    SUMMARY_KEYS.map((key) => [key, value[key]])
  );
}

function normalizeDailyUsageBuckets(value) {
  return value
    .map((bucket) => ({
      startDate: bucket.startDate,
      tokens: bucket.tokens
    }))
    .sort((left, right) => left.startDate.localeCompare(right.startDate));
}

function validateSummary(path, value, errors) {
  if (!expectRecord(path, value, errors)) return;

  validateExactKeys(path, value, SUMMARY_KEYS, errors);

  for (const key of SUMMARY_KEYS) {
    validateNullableNonNegativeInteger(`${path}.${key}`, value[key], errors);
  }
}

function validateDailyUsageBuckets(path, value, errors) {
  if (value === null) return;

  if (!Array.isArray(value)) {
    errors.push(`${path}: expected array or null`);
    return;
  }

  const seenDates = new Set();

  value.forEach((bucket, index) => {
    const bucketPath = `${path}[${index}]`;
    if (!expectRecord(bucketPath, bucket, errors)) return;

    validateExactKeys(bucketPath, bucket, DAILY_BUCKET_KEYS, errors);
    validateIsoDate(`${bucketPath}.startDate`, bucket.startDate, errors);
    validateNonNegativeInteger(`${bucketPath}.tokens`, bucket.tokens, errors);

    if (typeof bucket.startDate === "string") {
      if (seenDates.has(bucket.startDate)) {
        errors.push(`${bucketPath}.startDate: duplicate date`);
      }
      seenDates.add(bucket.startDate);
    }
  });
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

function validateNullableNonNegativeInteger(path, value, errors) {
  if (value === null) return;
  validateNonNegativeInteger(path, value, errors);
}

function validateNonNegativeInteger(path, value, errors) {
  if (!Number.isSafeInteger(value) || value < 0) {
    errors.push(`${path}: expected non-negative safe integer`);
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

function validateCapturedAt(path, value, errors, options) {
  if (typeof value !== "string" || !value.endsWith("Z")) {
    errors.push(`${path}: expected ISO 8601 UTC string`);
    return;
  }

  const capturedAt = new Date(value);
  if (Number.isNaN(capturedAt.getTime())) {
    errors.push(`${path}: expected valid timestamp`);
    return;
  }

  const now = normalizeNow(options.now);
  const maxFutureSkewMs = normalizeFutureSkew(options.maxFutureSkewMs);
  if (capturedAt.getTime() > now.getTime() + maxFutureSkewMs) {
    errors.push(`${path}: must not be more than ${maxFutureSkewMs}ms in the future`);
  }
}

function normalizeNow(value) {
  const resolved = typeof value === "function" ? value() : value;
  const date = resolved === undefined ? new Date() : new Date(resolved);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError("now must resolve to a valid date");
  }

  return date;
}

function normalizeFutureSkew(value) {
  if (value === Number.POSITIVE_INFINITY) {
    return value;
  }

  const resolved = value ?? DEFAULT_ACCOUNT_USAGE_FUTURE_SKEW_MS;
  if (!Number.isSafeInteger(resolved) || resolved < 0) {
    throw new TypeError("maxFutureSkewMs must be a non-negative safe integer");
  }

  return resolved;
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
