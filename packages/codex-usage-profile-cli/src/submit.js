import {
  ACCOUNT_USAGE_CONTRACT_VERSION,
  CodexUsageError
} from "codex-usage-analyzer";

import { CliError } from "./errors.js";
import { ServiceClientError } from "./service-client.js";

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
const BUCKET_KEYS = Object.freeze(["startDate", "tokens"]);
const AMBIGUOUS_NETWORK_CODES = new Set(["network_error", "request_timeout"]);

const ANALYZER_ERROR_MESSAGES = Object.freeze({
  INVALID_TIMEOUT: "Analyzer timeout is invalid.",
  CODEX_NOT_FOUND: "Codex CLI was not found. Install or update Codex first.",
  APP_SERVER_START_FAILED: "Codex app-server could not be started.",
  APP_SERVER_EXITED: "Codex app-server exited before returning usage.",
  APP_SERVER_TIMEOUT: "Codex app-server timed out while reading usage.",
  APP_SERVER_PROTOCOL_ERROR: "Codex app-server returned an invalid protocol response.",
  APP_SERVER_RPC_ERROR: "Codex could not read account usage. Confirm ChatGPT sign-in.",
  INVALID_ACCOUNT_USAGE_RESPONSE: "Codex returned an invalid account usage response."
});

export async function submitAccountUsage(options = {}) {
  const {
    readAccountUsage,
    client,
    token,
    timeoutMs,
    deviceId,
    deviceName,
    sleep = () => Promise.resolve(),
    retryDelayMs = 250
  } = options;

  if (typeof readAccountUsage !== "function" || !client) {
    throw new TypeError("readAccountUsage and client are required");
  }

  let document;
  try {
    document = await readAccountUsage({ timeoutMs });
  } catch (error) {
    throw mapAnalyzerError(error);
  }

  assertAccountUsageDocument(document);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await client.submitAccountUsage({
        token,
        document,
        deviceId,
        deviceName
      });
    } catch (error) {
      if (attempt === 0 && isAmbiguousNetworkError(error)) {
        await sleep(retryDelayMs);
        continue;
      }
      throw mapSubmitError(error);
    }
  }

  throw new CliError("submit_failed", "Usage submission failed.");
}

export function assertAccountUsageDocument(value) {
  const errors = [];
  if (!isRecord(value)) {
    throw invalidDocument(["$: expected object"]);
  }

  validateExactKeys("$", value, DOCUMENT_KEYS, errors);
  if (value.contractVersion !== ACCOUNT_USAGE_CONTRACT_VERSION) {
    errors.push(`$.contractVersion: expected ${ACCOUNT_USAGE_CONTRACT_VERSION}`);
  }
  if (!isCanonicalUtcTimestamp(value.capturedAt)) {
    errors.push("$.capturedAt: expected canonical ISO 8601 UTC timestamp");
  }
  validateSummary(value.summary, errors);
  validateBuckets(value.dailyUsageBuckets, errors);

  if (errors.length > 0) throw invalidDocument(errors);
  return value;
}

export function mapAnalyzerError(error) {
  const code = error instanceof CodexUsageError || typeof error?.code === "string"
    ? error.code
    : null;
  const message = ANALYZER_ERROR_MESSAGES[code];
  if (message) return new CliError(`analyzer_${code.toLowerCase()}`, message);
  return new CliError("analyzer_failed", "Could not read Codex account usage.");
}

export function mapSubmitError(error) {
  if (!(error instanceof ServiceClientError)) {
    return new CliError("submit_failed", "Usage submission failed.");
  }
  if ([401, 410].includes(error.status)) {
    return new CliError(
      "submit_auth_failed",
      "Login expired or was revoked. Run login again; stored credentials were not removed."
    );
  }
  if (error.status === 409) {
    return new CliError("submit_conflict", "Usage is older than or conflicts with the stored revision.");
  }
  if (error.status === 429) {
    const suffix = error.retryAfterSeconds
      ? ` Retry after ${error.retryAfterSeconds} seconds.`
      : "";
    return new CliError("submit_rate_limited", `Usage submission was rate limited.${suffix}`);
  }
  if ([413, 415].includes(error.status)) {
    return new CliError("submit_contract_rejected", "The service rejected the usage contract.");
  }
  if (AMBIGUOUS_NETWORK_CODES.has(error.code)) {
    return new CliError(
      "submit_network_failed",
      "The submission result is unknown after a network failure. Run submit again safely."
    );
  }
  return new CliError("submit_failed", "The service rejected the usage submission.");
}

function isAmbiguousNetworkError(error) {
  return error instanceof ServiceClientError && AMBIGUOUS_NETWORK_CODES.has(error.code);
}

function validateSummary(value, errors) {
  if (!isRecord(value)) {
    errors.push("$.summary: expected object");
    return;
  }
  validateExactKeys("$.summary", value, SUMMARY_KEYS, errors);
  for (const key of SUMMARY_KEYS) {
    if (value[key] !== null && (!Number.isSafeInteger(value[key]) || value[key] < 0)) {
      errors.push(`$.summary.${key}: expected non-negative safe integer or null`);
    }
  }
}

function validateBuckets(value, errors) {
  if (value === null) return;
  if (!Array.isArray(value)) {
    errors.push("$.dailyUsageBuckets: expected array or null");
    return;
  }

  const dates = new Set();
  value.forEach((bucket, index) => {
    const path = `$.dailyUsageBuckets[${index}]`;
    if (!isRecord(bucket)) {
      errors.push(`${path}: expected object`);
      return;
    }
    validateExactKeys(path, bucket, BUCKET_KEYS, errors);
    if (!isDateOnly(bucket.startDate)) errors.push(`${path}.startDate: expected valid YYYY-MM-DD`);
    if (!Number.isSafeInteger(bucket.tokens) || bucket.tokens < 0) {
      errors.push(`${path}.tokens: expected non-negative safe integer`);
    }
    if (dates.has(bucket.startDate)) errors.push(`${path}.startDate: duplicate date`);
    dates.add(bucket.startDate);
  });
}

function validateExactKeys(path, value, keys, errors) {
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${path}.${key}: unknown field`);
  }
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) errors.push(`${path}.${key}: missing field`);
  }
}

function isCanonicalUtcTimestamp(value) {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function isDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function invalidDocument(errors) {
  return new CliError(
    "invalid_account_usage_document",
    `Analyzer returned an invalid Account Usage Contract (${errors.length} validation errors).`
  );
}
