export const DEFAULT_PUBLIC_BASE_URL = "http://127.0.0.1:5173";
export const DEFAULT_PROFILE_STORE_FILE = ".data/profile-store.json";

export { loadProfileDeploymentConfig } from "./deployment-config.js";

export function loadProfileRuntimeConfig(options = {}) {
  const env = options.env ?? globalThis.process?.env ?? {};
  const requireGitHubOAuth = options.requireGitHubOAuth === true;
  const githubClientId = normalizeOptionalString(env.GITHUB_CLIENT_ID);
  const githubClientSecret = normalizeOptionalString(env.GITHUB_CLIENT_SECRET);

  if (requireGitHubOAuth) {
    requireConfigValue(githubClientId, "GITHUB_CLIENT_ID");
    requireConfigValue(githubClientSecret, "GITHUB_CLIENT_SECRET");
  }

  return {
    githubClientId,
    githubClientSecret,
    profileStoreFile: normalizeOptionalString(env.PROFILE_STORE_FILE) ??
      DEFAULT_PROFILE_STORE_FILE,
    publicBaseUrl: normalizePublicBaseUrl(
      normalizeOptionalString(env.PUBLIC_BASE_URL) ?? DEFAULT_PUBLIC_BASE_URL
    ),
    secureCookies: parseBooleanEnv(env.SESSION_SECURE_COOKIES, {
      defaultValue: false,
      name: "SESSION_SECURE_COOKIES"
    })
  };
}

export function hasGitHubOAuthCredentials(config = {}) {
  return Boolean(config.githubClientId && config.githubClientSecret);
}

export function parseBooleanEnv(value, options = {}) {
  const name = options.name ?? "value";

  if (value === undefined || value === null || value === "") {
    return options.defaultValue ?? false;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a boolean string`);
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new TypeError(`${name} must be true or false`);
}

export function normalizePublicBaseUrl(value) {
  const rawValue = requireConfigValue(value, "PUBLIC_BASE_URL");

  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(rawValue)) {
    throw new TypeError("PUBLIC_BASE_URL must be an absolute URL");
  }

  let url;
  try {
    url = new URL(rawValue);
  } catch {
    throw new TypeError("PUBLIC_BASE_URL must be an absolute URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new TypeError("PUBLIC_BASE_URL must use http or https");
  }

  return url.toString().replace(/\/$/, "");
}

function requireConfigValue(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} is required`);
  }

  return value.trim();
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }

  return value.trim() || null;
}
