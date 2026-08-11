export const DEFAULT_CANONICAL_APP_ORIGIN = "http://127.0.0.1:5173";
export const DEFAULT_DEVELOPMENT_HOST = "127.0.0.1";
export const DEFAULT_DEVELOPMENT_PORT = 5173;
export const DEFAULT_PRODUCTION_HOST = "0.0.0.0";
export const DEFAULT_PRODUCTION_PORT = 8080;

export const PROFILE_RUNTIME_MODES = Object.freeze([
  "development",
  "production",
  "spike"
]);

export const PROFILE_STORE_MODES = Object.freeze([
  "external",
  "file"
]);

export const PROFILE_MEDIA_MODES = Object.freeze([
  "external",
  "memory"
]);

export function loadProfileDeploymentConfig(options = {}) {
  const env = options.env ?? globalThis.process?.env ?? {};
  const runtimeMode = normalizeRuntimeMode(
    env.PROFILE_RUNTIME_MODE,
    env.NODE_ENV
  );
  const storeMode = normalizeEnum(
    env.PROFILE_STORE_MODE ?? "file",
    PROFILE_STORE_MODES,
    "PROFILE_STORE_MODE"
  );
  const mediaMode = normalizeEnum(
    env.PROFILE_MEDIA_MODE ?? (
      runtimeMode === "production" ? "external" : "memory"
    ),
    PROFILE_MEDIA_MODES,
    "PROFILE_MEDIA_MODE"
  );
  const canonicalAppOrigin = normalizeCanonicalAppOrigin(
    env.CANONICAL_APP_ORIGIN ?? env.PUBLIC_BASE_URL ?? (
      runtimeMode === "production" ? null : DEFAULT_CANONICAL_APP_ORIGIN
    ),
    { runtimeMode }
  );
  const defaultPort = runtimeMode === "production"
    ? DEFAULT_PRODUCTION_PORT
    : inferDevelopmentPort(canonicalAppOrigin);
  const bindHost = normalizeBindHost(
    env.HOST ?? (
      runtimeMode === "production"
        ? DEFAULT_PRODUCTION_HOST
        : DEFAULT_DEVELOPMENT_HOST
    )
  );
  const port = normalizeDeploymentPort(env.PORT ?? defaultPort);

  if (runtimeMode === "production" && storeMode === "file") {
    throw new TypeError(
      "PROFILE_STORE_MODE=file is not allowed in production"
    );
  }
  if (runtimeMode === "production" && mediaMode === "memory") {
    throw new TypeError(
      "PROFILE_MEDIA_MODE=memory is not allowed in production"
    );
  }

  return Object.freeze({
    bindHost,
    canonicalAppOrigin,
    mediaMode,
    port,
    runtimeMode,
    storeMode
  });
}

export function normalizeCanonicalAppOrigin(value, options = {}) {
  const runtimeMode = options.runtimeMode ?? "development";

  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError("CANONICAL_APP_ORIGIN is required");
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new TypeError("CANONICAL_APP_ORIGIN must be an absolute URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new TypeError("CANONICAL_APP_ORIGIN must use http or https");
  }

  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new TypeError("CANONICAL_APP_ORIGIN must contain only an origin");
  }

  if (url.protocol === "http:") {
    if (runtimeMode === "production") {
      throw new TypeError("CANONICAL_APP_ORIGIN must use https in production");
    }

    if (!isLoopbackHostname(url.hostname)) {
      throw new TypeError(
        "CANONICAL_APP_ORIGIN may use http only for a loopback host"
      );
    }
  }

  return url.origin;
}

export function normalizeDeploymentPort(value) {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    (typeof value === "string" && !/^\d+$/.test(value.trim()))
  ) {
    throw new TypeError("PORT must be an integer between 1 and 65535");
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new TypeError("PORT must be an integer between 1 and 65535");
  }

  return port;
}

export function normalizeBindHost(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError("HOST must be a non-empty hostname");
  }

  const host = value.trim();
  if (/\s|:\/\/|\//.test(host)) {
    throw new TypeError("HOST must be a hostname, not a URL");
  }

  return host;
}

function normalizeRuntimeMode(value, nodeEnv) {
  const inferredValue = value ?? (
    nodeEnv === "production" ? "production" : "development"
  );

  return normalizeEnum(
    inferredValue,
    PROFILE_RUNTIME_MODES,
    "PROFILE_RUNTIME_MODE"
  );
}

function normalizeEnum(value, allowedValues, label) {
  if (typeof value !== "string") {
    throw new TypeError(`${label} must be one of: ${allowedValues.join(", ")}`);
  }

  const normalized = value.trim().toLowerCase();
  if (!allowedValues.includes(normalized)) {
    throw new TypeError(`${label} must be one of: ${allowedValues.join(", ")}`);
  }

  return normalized;
}

function inferDevelopmentPort(origin) {
  const url = new URL(origin);
  if (url.port) return Number(url.port);
  return url.protocol === "https:" ? 443 : DEFAULT_DEVELOPMENT_PORT;
}

function isLoopbackHostname(hostname) {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" ||
    normalized === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/.test(normalized);
}
