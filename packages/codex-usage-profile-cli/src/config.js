import { CliError } from "./errors.js";

export const SERVICE_URL_ENV = "CODEX_USAGE_PROFILE_URL";
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const MAX_REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

export function resolveServiceOrigin(options = {}) {
  const env = options.env ?? process.env;
  const candidates = [
    options.server,
    env[SERVICE_URL_ENV],
    options.storedOrigin,
    options.defaultOrigin
  ];
  const selected = candidates.find((value) => (
    typeof value === "string" && value.trim() !== ""
  ));

  if (!selected) {
    throw new CliError(
      "service_url_required",
      `Set --server or ${SERVICE_URL_ENV} before using the CLI.`
    );
  }

  return normalizeServiceOrigin(selected);
}

export function normalizeServiceOrigin(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    throw new CliError("invalid_service_url", "Service URL must be an absolute URL.");
  }

  if (url.username || url.password) {
    throw new CliError("invalid_service_url", "Service URL must not include credentials.");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new CliError(
      "invalid_service_url",
      "Service URL must contain only an origin without a path, query, or fragment."
    );
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopbackHost(url.hostname))) {
    throw new CliError(
      "invalid_service_url",
      "Service URL must use HTTPS, except for loopback development URLs."
    );
  }

  return url.origin;
}

export function normalizeRequestTimeout(value) {
  const timeout = value === undefined || value === null
    ? DEFAULT_REQUEST_TIMEOUT_MS
    : Number(value);

  if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > MAX_REQUEST_TIMEOUT_MS) {
    throw new CliError(
      "invalid_timeout",
      `Timeout must be an integer between 1 and ${MAX_REQUEST_TIMEOUT_MS} milliseconds.`
    );
  }

  return timeout;
}

function isLoopbackHost(hostname) {
  if (hostname === "localhost" || hostname === "[::1]") return true;
  const octets = hostname.split(".");
  return octets.length === 4 && octets[0] === "127" && octets.every((octet) => (
    /^\d{1,3}$/.test(octet) && Number(octet) <= 255
  ));
}
