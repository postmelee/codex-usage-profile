import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError
} from "../errors.js";

const DEFAULT_ACCOUNT_USAGE_BURST_LIMIT = 5;
const DEFAULT_ACCOUNT_USAGE_BURST_WINDOW_MS = 10_000;
const DEFAULT_ACCOUNT_USAGE_SUSTAINED_LIMIT = 30;
const DEFAULT_ACCOUNT_USAGE_SUSTAINED_WINDOW_MS = 60_000;

export function createD1AccountUsageRateLimiter(options = {}) {
  const database = requireD1Database(options.database ?? options.db);
  const now = options.now ?? (() => new Date());
  const burst = normalizeWindow(
    "burst",
    options.burstLimit ?? DEFAULT_ACCOUNT_USAGE_BURST_LIMIT,
    options.burstWindowMs ?? DEFAULT_ACCOUNT_USAGE_BURST_WINDOW_MS
  );
  const sustained = normalizeWindow(
    "sustained",
    options.sustainedLimit ?? DEFAULT_ACCOUNT_USAGE_SUSTAINED_LIMIT,
    options.sustainedWindowMs ?? DEFAULT_ACCOUNT_USAGE_SUSTAINED_WINDOW_MS
  );

  if (sustained.windowMs < burst.windowMs || sustained.limit < burst.limit) {
    throw new TypeError("sustained rate limit must not be smaller than burst limit");
  }

  return {
    async consume(value) {
      const rateKey = requireNonEmptyString(value, "rate limit key");
      const nowMs = normalizeDate(now()).getTime();
      const windows = [burst, sustained].map((window) => ({
        ...window,
        startMs: Math.floor(nowMs / window.windowMs) * window.windowMs
      }));

      await database.prepare(
        "DELETE FROM account_usage_rate_limits WHERE window_end_ms <= ?"
      ).bind(nowMs).run();

      try {
        await database.batch(
          windows.map((window) => database.prepare(
            "INSERT INTO account_usage_rate_limits (" +
              "rate_key, window_kind, window_start_ms, window_end_ms, request_count" +
            ") VALUES (?, ?, ?, ?, 1) " +
            "ON CONFLICT (rate_key, window_kind, window_start_ms) DO UPDATE SET " +
              "request_count = CASE " +
                "WHEN account_usage_rate_limits.request_count < ? " +
                "THEN account_usage_rate_limits.request_count + 1 " +
                "ELSE 0 END"
          ).bind(
            rateKey,
            window.kind,
            window.startMs,
            window.startMs + window.windowMs,
            window.limit
          ))
        );
      } catch (error) {
        const rows = await database.prepare(
          "SELECT window_kind, window_end_ms, request_count " +
          "FROM account_usage_rate_limits " +
          "WHERE rate_key = ? AND window_end_ms > ?"
        ).bind(rateKey, nowMs).all();
        const blocked = (rows.results ?? [])
          .map((row) => ({
            ...row,
            limit: row.window_kind === burst.kind ? burst.limit : sustained.limit
          }))
          .filter((row) => Number(row.request_count) >= row.limit)
          .sort((left, right) => left.window_end_ms - right.window_end_ms);

        if (blocked.length > 0 || String(error?.message).includes("CHECK constraint")) {
          const retryAfterMs = Math.max(
            1,
            Number(blocked[0]?.window_end_ms ?? nowMs + burst.windowMs) - nowMs
          );
          throw new ProfileBackendError(
            PROFILE_BACKEND_ERROR_CODES.RATE_LIMITED,
            "Account usage submit rate limit exceeded",
            {
              headers: {
                "retry-after": String(Math.max(1, Math.ceil(retryAfterMs / 1000)))
              }
            }
          );
        }

        throw error;
      }
    }
  };
}

function normalizeWindow(kind, limit, windowMs) {
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new TypeError(`${kind} limit must be a positive safe integer`);
  }
  if (!Number.isSafeInteger(windowMs) || windowMs <= 0) {
    throw new TypeError(`${kind} window must be a positive safe integer`);
  }
  return { kind, limit, windowMs };
}

function requireD1Database(database) {
  if (
    !database ||
    typeof database.prepare !== "function" ||
    typeof database.batch !== "function"
  ) {
    throw new TypeError("D1 database binding is required");
  }
  return database;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} is required`);
  }
  return value.trim();
}

function normalizeDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Expected a valid date");
  }
  return date;
}
