export const PROFILE_SITES_BINDINGS = Object.freeze({
  assets: "ASSETS",
  database: "DB",
  media: "PROFILE_MEDIA"
});

export const PROFILE_SITES_GITHUB_CALLBACK_PATH =
  "/api/auth/github/callback";
export const PROFILE_SITES_MAINTENANCE_MODE_ENABLED = "enabled";

export function loadProfileSitesConfig(options = {}) {
  const environment = options.environment ?? {};
  const requestOrigin = normalizeRequestOrigin(options.requestUrl);
  const configuredOrigin = normalizeOptionalOrigin(environment.PUBLIC_BASE_URL);
  if (configuredOrigin && configuredOrigin !== requestOrigin) {
    throw new TypeError("Sites request origin does not match PUBLIC_BASE_URL");
  }
  const publicBaseUrl = configuredOrigin ?? requestOrigin;
  const githubClientId = normalizeOptionalString(environment.GITHUB_CLIENT_ID);
  const githubClientSecret = normalizeOptionalString(
    environment.GITHUB_CLIENT_SECRET
  );
  const maintenanceEnabled =
    normalizeOptionalString(environment.PROFILE_MAINTENANCE_MODE) ===
    PROFILE_SITES_MAINTENANCE_MODE_ENABLED;
  const maintenanceToken = normalizeOptionalString(
    environment.PROFILE_MAINTENANCE_TOKEN
  );
  const requireGitHubOAuth = options.requireGitHubOAuth === true;
  const requireDatabase = options.requireDatabase === true;
  const requireDataBindings = options.requireDataBindings === true;

  if (requireGitHubOAuth) {
    requireValue(githubClientId, "GITHUB_CLIENT_ID");
    requireValue(githubClientSecret, "GITHUB_CLIENT_SECRET");
  }
  if (requireDataBindings) {
    requireBinding(environment.DB, PROFILE_SITES_BINDINGS.database);
    requireBinding(environment.PROFILE_MEDIA, PROFILE_SITES_BINDINGS.media);
  }
  if (requireDatabase) {
    requireBinding(environment.DB, PROFILE_SITES_BINDINGS.database);
  }

  const callbackUrl = new URL(
    PROFILE_SITES_GITHUB_CALLBACK_PATH,
    `${publicBaseUrl}/`
  ).toString();

  return Object.freeze({
    assets: environment.ASSETS ?? null,
    database: environment.DB ?? null,
    githubCallbackPath: PROFILE_SITES_GITHUB_CALLBACK_PATH,
    githubCallbackUrl: callbackUrl,
    githubClientId,
    githubClientSecret,
    maintenanceEnabled,
    maintenanceToken,
    media: environment.PROFILE_MEDIA ?? null,
    publicBaseUrl,
    secureCookies: publicBaseUrl.startsWith("https://")
  });
}

export function hasProfileSitesGitHubOAuthCredentials(config = {}) {
  return Boolean(config.githubClientId && config.githubClientSecret);
}

export function normalizeRequestOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("Sites request URL must be an absolute URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new TypeError("Sites request URL must use http or https");
  }

  return url.origin;
}

function normalizeOptionalOrigin(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new TypeError("PUBLIC_BASE_URL must be an absolute URL");
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new TypeError("PUBLIC_BASE_URL must be an absolute URL");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new TypeError("PUBLIC_BASE_URL must contain only an HTTP origin");
  }

  return url.origin;
}

function requireBinding(value, name) {
  if (!value || (typeof value !== "object" && typeof value !== "function")) {
    throw new TypeError(`Sites binding ${name} is required`);
  }
}

function requireValue(value, name) {
  if (!value) {
    throw new TypeError(`${name} is required`);
  }
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") return null;
  return value.trim() || null;
}
