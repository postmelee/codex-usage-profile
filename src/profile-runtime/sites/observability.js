import { parsePublicSharePath } from "../../profile-shared/public-share-url.js";

export const PROFILE_SITES_REQUEST_ID_HEADER = "x-request-id";
export const PROFILE_SITES_AVATAR_EVENT_TYPE = "profile_card_avatar";

export const PROFILE_SITES_ROUTE_CLASSES = Object.freeze({
  ACCOUNT_USAGE: "account_usage",
  API: "api",
  ASSET: "asset",
  AUTH: "auth",
  CLI_AUTH: "cli_auth",
  HEALTH: "health",
  MAINTENANCE: "maintenance",
  PRIVATE_PROFILE: "private_profile",
  PUBLIC_CARD: "public_card",
  PUBLIC_PROFILE: "public_profile"
});

const ALLOWED_METHODS = new Set([
  "DELETE",
  "GET",
  "HEAD",
  "OPTIONS",
  "PATCH",
  "POST",
  "PUT"
]);
const ERROR_CODE_BY_STATUS = Object.freeze({
  400: "invalid_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  405: "method_not_allowed",
  409: "conflict",
  410: "gone",
  413: "payload_too_large",
  415: "unsupported_media_type",
  429: "rate_limited",
  500: "internal_error",
  502: "provider_unavailable",
  503: "provider_unavailable",
  504: "provider_unavailable"
});

export async function observeProfileSitesRequest(request, handler, options = {}) {
  if (!(request instanceof Request)) {
    throw new TypeError("Sites observability requires a Request");
  }
  if (typeof handler !== "function") {
    throw new TypeError("Sites observability requires a request handler");
  }

  const now = options.now ?? defaultNow;
  const startedAt = normalizeTimestamp(now());
  const requestId = createCorrelationId(options.createRequestId);
  let response;
  let errorCode = null;

  try {
    response = await handler();
    if (!(response instanceof Response)) {
      throw new TypeError("Sites request handler must return a Response");
    }
  } catch {
    response = serviceUnavailableResponse();
    errorCode = "unhandled_error";
  }

  const durationMs = Math.max(0, normalizeTimestamp(now()) - startedAt);
  const event = createProfileSitesRequestEvent({
    durationBucket: bucketDuration(durationMs),
    errorCode: errorCode ?? errorCodeForStatus(response.status),
    method: normalizeMethod(request.method),
    requestId,
    retryable: isRetryableStatus(response.status),
    routeClass: classifyProfileSitesRoute(request),
    status: response.status
  });
  writeEventSafely(options.writeEvent, event);

  const headers = new Headers(response.headers);
  headers.set(PROFILE_SITES_REQUEST_ID_HEADER, requestId);
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText
  });
}

export function createProfileSitesRequestEvent(value = {}) {
  const event = {
    requestId: requireCorrelationId(value.requestId),
    routeClass: requireRouteClass(value.routeClass),
    method: normalizeMethod(value.method),
    status: normalizeStatus(value.status),
    durationBucket: requireDurationBucket(value.durationBucket),
    errorCode: normalizeErrorCode(value.errorCode),
    retryable: value.retryable === true
  };

  return Object.freeze(event);
}

export function observeProfileCardAvatarLoadFailure(value, options = {}) {
  const event = createProfileCardAvatarLoadEvent(value);
  writeEventSafely(options.writeEvent, event);
  return event;
}

export function createProfileCardAvatarLoadEvent(value = {}) {
  if (
    typeof value.errorCode !== "string" ||
    !/^avatar_[a-z0-9_]{1,55}$/.test(value.errorCode)
  ) {
    throw new TypeError("Profile card avatar error code is invalid");
  }
  if (
    !Number.isSafeInteger(value.attempt) ||
    value.attempt < 1 || value.attempt > 2
  ) {
    throw new TypeError("Profile card avatar attempt is invalid");
  }

  return Object.freeze({
    eventType: PROFILE_SITES_AVATAR_EVENT_TYPE,
    errorCode: value.errorCode,
    attempt: value.attempt,
    retrying: value.retrying === true
  });
}

export function classifyProfileSitesRoute(request) {
  const pathname = new URL(request.url).pathname;

  if (pathname === "/healthz") return PROFILE_SITES_ROUTE_CLASSES.HEALTH;
  if (pathname === "/__ops/profile-maintenance") {
    return PROFILE_SITES_ROUTE_CLASSES.MAINTENANCE;
  }
  if (
    pathname.startsWith("/api/auth/device") ||
    pathname.startsWith("/api/cli/")
  ) {
    return PROFILE_SITES_ROUTE_CLASSES.CLI_AUTH;
  }
  if (pathname.startsWith("/api/auth/")) {
    return PROFILE_SITES_ROUTE_CLASSES.AUTH;
  }
  if (pathname.startsWith("/api/account-usage/")) {
    return PROFILE_SITES_ROUTE_CLASSES.ACCOUNT_USAGE;
  }
  if (parsePublicSharePath(pathname)) {
    return PROFILE_SITES_ROUTE_CLASSES.PUBLIC_PROFILE;
  }
  if (
    pathname.startsWith("/api/profiles/public/") ||
    pathname.startsWith("/api/snapshots/public/")
  ) {
    return PROFILE_SITES_ROUTE_CLASSES.PUBLIC_PROFILE;
  }
  if (/^\/u\/[^/]+\/(?:card|social)\.png$/.test(pathname)) {
    return PROFILE_SITES_ROUTE_CLASSES.PUBLIC_CARD;
  }
  if (pathname === "/api/profile" || pathname.startsWith("/api/profile/")) {
    return PROFILE_SITES_ROUTE_CLASSES.PRIVATE_PROFILE;
  }
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return PROFILE_SITES_ROUTE_CLASSES.API;
  }
  return PROFILE_SITES_ROUTE_CLASSES.ASSET;
}

export function bucketDuration(value) {
  const durationMs = Number.isFinite(value) && value > 0 ? value : 0;
  if (durationMs < 10) return "under_10ms";
  if (durationMs < 100) return "under_100ms";
  if (durationMs < 1_000) return "under_1s";
  if (durationMs < 5_000) return "under_5s";
  return "over_5s";
}

function writeEventSafely(writeEvent, event) {
  try {
    if (writeEvent === null) return;
    if (writeEvent !== undefined) {
      if (typeof writeEvent !== "function") {
        throw new TypeError("Sites observability writer must be a function");
      }
      writeEvent(event);
      return;
    }
    console.log(JSON.stringify(event));
  } catch {
    // Logging must never change the request result or expose the logging error.
  }
}

function createCorrelationId(factory) {
  const value = typeof factory === "function"
    ? factory()
    : globalThis.crypto.randomUUID();
  return requireCorrelationId(value);
}

function requireCorrelationId(value) {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_-]{8,80}$/.test(value)
  ) {
    throw new TypeError("Sites request correlation id is invalid");
  }
  return value;
}

function requireRouteClass(value) {
  if (!Object.values(PROFILE_SITES_ROUTE_CLASSES).includes(value)) {
    throw new TypeError("Sites request route class is invalid");
  }
  return value;
}

function normalizeMethod(value) {
  const method = typeof value === "string" ? value.toUpperCase() : "";
  return ALLOWED_METHODS.has(method) ? method : "OTHER";
}

function normalizeStatus(value) {
  if (!Number.isSafeInteger(value) || value < 100 || value > 599) {
    throw new TypeError("Sites request status is invalid");
  }
  return value;
}

function requireDurationBucket(value) {
  if (![
    "under_10ms",
    "under_100ms",
    "under_1s",
    "under_5s",
    "over_5s"
  ].includes(value)) {
    throw new TypeError("Sites request duration bucket is invalid");
  }
  return value;
}

function normalizeErrorCode(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !/^[a-z][a-z0-9_]{0,63}$/.test(value)) {
    return "internal_error";
  }
  return value;
}

function errorCodeForStatus(status) {
  if (status < 400) return null;
  return ERROR_CODE_BY_STATUS[status] ?? (
    status >= 500 ? "internal_error" : "request_failed"
  );
}

function isRetryableStatus(status) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function normalizeTimestamp(value) {
  if (!Number.isFinite(value)) {
    throw new TypeError("Sites observability clock is invalid");
  }
  return value;
}

function defaultNow() {
  return globalThis.performance.now();
}

function serviceUnavailableResponse() {
  return new Response("Service temporarily unavailable", {
    status: 503,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
      "retry-after": "5"
    }
  });
}
