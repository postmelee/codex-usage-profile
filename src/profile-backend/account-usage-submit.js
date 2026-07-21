import { createHash } from "node:crypto";

import {
  ACCOUNT_USAGE_CONTRACT_VERSION,
  normalizeAccountUsageDocument,
  projectAccountUsageReadResult
} from "../profile-card/account-usage.js";
import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError
} from "./errors.js";
import { assertNoForbiddenSecrets } from "./security.js";
import { createSubmittedDeviceService } from "./devices.js";
import { createCliTokenService } from "./tokens.js";

export const DEFAULT_ACCOUNT_USAGE_BURST_LIMIT = 5;
export const DEFAULT_ACCOUNT_USAGE_BURST_WINDOW_MS = 10_000;
export const DEFAULT_ACCOUNT_USAGE_SUSTAINED_LIMIT = 30;
export const DEFAULT_ACCOUNT_USAGE_SUSTAINED_WINDOW_MS = 60_000;

export function createAccountUsageSubmitService(options = {}) {
  const {
    store,
    now = () => new Date()
  } = options;

  if (!store) {
    throw new TypeError("store is required");
  }

  const tokenService = options.tokenService ?? createCliTokenService({ store, now });
  const deviceService = options.deviceService ?? createSubmittedDeviceService({
    store,
    now,
    createId: options.createId
  });
  const rateLimiter = options.rateLimiter ?? createAccountUsageRateLimiter({ now });

  return {
    async submitAccountUsage(submitOptions = {}) {
      const { owner, tokenRecord } = await tokenService.verifyCliToken(submitOptions.token);
      rateLimiter.consume(tokenRecord.id);

      assertNoForbiddenSecrets(submitOptions.document);
      const document = normalizeSubmittedDocument(submitOptions.document, { now });
      const contentDigest = createAccountUsageContentDigest(document);
      const uploadedAt = normalizeDate(now()).toISOString();

      // capturedAt and contentDigest decide stale/conflict/idempotent/new
      // atomically: the previous record is read under the owner row lock and
      // the usage save plus device touch commit together.
      return store.transaction(async (tx) => {
        const previous = await tx.getLatestUsageByOwnerId(owner.id);
        const comparison = compareUsageDocuments(previous, document, contentDigest);

        if (comparison === "stale") {
          throw conflictError("Account usage document is older than the stored revision");
        }
        if (comparison === "conflict") {
          throw conflictError("Account usage timestamp already has different content");
        }

        const device = await deviceService.upsertSubmittedDevice({
          ownerId: owner.id,
          device: submitOptions.device,
          submittedAt: uploadedAt,
          store: tx
        });

        if (comparison === "idempotent") {
          return {
            owner,
            tokenRecord,
            usageRecord: previous,
            device,
            idempotent: true,
            revision: createAccountUsageRevision(contentDigest)
          };
        }

        const usageRecord = await tx.saveLatestUsage({
          ownerId: owner.id,
          handle: owner.handle,
          visibility: owner.visibility,
          contractVersion: document.contractVersion,
          capturedAt: document.capturedAt,
          uploadedAt,
          contentDigest,
          usage: projectAccountUsageReadResult(document)
        });

        return {
          owner,
          tokenRecord,
          usageRecord,
          device,
          idempotent: false,
          revision: createAccountUsageRevision(contentDigest)
        };
      });
    },

    async getAccountUsageStatus(statusOptions = {}) {
      const { owner, tokenRecord } = await tokenService.verifyCliToken(statusOptions.token);
      const usageRecord = await store.getLatestUsageByOwnerId(owner.id);

      return {
        owner,
        tokenRecord,
        usageRecord,
        revision: usageRecord
          ? createAccountUsageRevision(resolveStoredContentDigest(usageRecord))
          : null
      };
    }
  };
}

export function createAccountUsageContentDigest(document) {
  return createHash("sha256")
    .update(JSON.stringify(document), "utf8")
    .digest("base64url");
}

export function createAccountUsageRevision(contentDigest) {
  if (typeof contentDigest !== "string" || contentDigest === "") {
    throw new TypeError("contentDigest is required");
  }

  return `usage_${contentDigest}`;
}

export function createAccountUsageRateLimiter(options = {}) {
  const now = options.now ?? (() => new Date());
  const burstLimit = requirePositiveInteger(
    options.burstLimit ?? DEFAULT_ACCOUNT_USAGE_BURST_LIMIT,
    "burstLimit"
  );
  const burstWindowMs = requirePositiveInteger(
    options.burstWindowMs ?? DEFAULT_ACCOUNT_USAGE_BURST_WINDOW_MS,
    "burstWindowMs"
  );
  const sustainedLimit = requirePositiveInteger(
    options.sustainedLimit ?? DEFAULT_ACCOUNT_USAGE_SUSTAINED_LIMIT,
    "sustainedLimit"
  );
  const sustainedWindowMs = requirePositiveInteger(
    options.sustainedWindowMs ?? DEFAULT_ACCOUNT_USAGE_SUSTAINED_WINDOW_MS,
    "sustainedWindowMs"
  );
  const timestampsByKey = new Map();

  if (sustainedWindowMs < burstWindowMs || sustainedLimit < burstLimit) {
    throw new TypeError("sustained rate limit must not be smaller than burst limit");
  }

  return {
    consume(value) {
      const key = requireNonEmptyString(value, "rate limit key");
      const nowMs = normalizeDate(now()).getTime();
      const timestamps = (timestampsByKey.get(key) ?? [])
        .filter((timestamp) => timestamp > nowMs - sustainedWindowMs);
      const burstTimestamps = timestamps
        .filter((timestamp) => timestamp > nowMs - burstWindowMs);

      if (burstTimestamps.length >= burstLimit) {
        throw rateLimitedError(burstTimestamps[0] + burstWindowMs - nowMs);
      }
      if (timestamps.length >= sustainedLimit) {
        throw rateLimitedError(timestamps[0] + sustainedWindowMs - nowMs);
      }

      timestamps.push(nowMs);
      timestampsByKey.set(key, timestamps);
    }
  };
}

function normalizeSubmittedDocument(value, options) {
  try {
    return normalizeAccountUsageDocument(value, options);
  } catch (error) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
      "Account usage document is invalid",
      {
        details: error instanceof Error ? error.message.split("\n").slice(1) : null
      }
    );
  }
}

function compareUsageDocuments(previous, document, contentDigest) {
  if (!previous) {
    return "new";
  }

  const previousTime = new Date(previous.capturedAt).getTime();
  const nextTime = new Date(document.capturedAt).getTime();
  if (nextTime < previousTime) {
    return "stale";
  }
  if (nextTime > previousTime) {
    return "new";
  }

  return resolveStoredContentDigest(previous) === contentDigest
    ? "idempotent"
    : "conflict";
}

function resolveStoredContentDigest(record) {
  if (typeof record.contentDigest === "string" && record.contentDigest !== "") {
    return record.contentDigest;
  }

  return createAccountUsageContentDigest({
    contractVersion: record.contractVersion ?? ACCOUNT_USAGE_CONTRACT_VERSION,
    capturedAt: new Date(record.capturedAt).toISOString(),
    summary: record.usage.summary,
    dailyUsageBuckets: record.usage.dailyUsageBuckets
  });
}

function conflictError(message) {
  return new ProfileBackendError(
    PROFILE_BACKEND_ERROR_CODES.CONFLICT,
    message
  );
}

function rateLimitedError(retryAfterMs) {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return new ProfileBackendError(
    PROFILE_BACKEND_ERROR_CODES.RATE_LIMITED,
    "Account usage submit rate limit exceeded",
    {
      headers: {
        "retry-after": String(retryAfterSeconds)
      }
    }
  );
}

function normalizeDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Expected a valid date");
  }
  return date;
}

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer`);
  }
  return value;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} is required`);
  }
  return value.trim();
}
