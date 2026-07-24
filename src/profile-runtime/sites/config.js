export const PROFILE_SITES_BINDINGS = Object.freeze({
  assets: "ASSETS",
  database: "DB",
  media: "PROFILE_MEDIA"
});

export const PROFILE_SITES_GITHUB_CALLBACK_PATH =
  "/api/auth/github/callback";
export const PROFILE_SITES_MAINTENANCE_MODE_ENABLED = "enabled";
export const PROFILE_SITES_SERVICE_MODES = Object.freeze({
  MAINTENANCE: "maintenance",
  NORMAL: "normal",
  OWNER_ONLY: "owner-only",
  QUOTA_STOP: "quota-stop"
});
export const PROFILE_SITES_DEFAULT_STOP_RETRY_AFTER_SECONDS = 300;
export const PROFILE_SITES_DEFAULT_RATE_LIMIT = Object.freeze({
  burstLimit: 5,
  burstWindowMs: 10_000,
  sustainedLimit: 30,
  sustainedWindowMs: 60_000
});

const RATE_LIMIT_BOUNDS = Object.freeze({
  limit: Object.freeze({ minimum: 1, maximum: 1_000 }),
  windowMs: Object.freeze({ minimum: 1_000, maximum: 3_600_000 })
});
const STOP_RETRY_AFTER_BOUNDS = Object.freeze({
  minimum: 1,
  maximum: 86_400
});

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
  const serviceMode = normalizeServiceMode(environment.PROFILE_SERVICE_MODE);
  const stopRetryAfterSeconds = normalizeBoundedInteger(
    environment.PROFILE_STOP_RETRY_AFTER_SECONDS,
    PROFILE_SITES_DEFAULT_STOP_RETRY_AFTER_SECONDS,
    STOP_RETRY_AFTER_BOUNDS
  );
  const accountUsageRateLimit = normalizeAccountUsageRateLimit(environment);
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
    secureCookies: publicBaseUrl.startsWith("https://"),
    serviceMode,
    stopRetryAfterSeconds,
    accountUsageRateLimit
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

function normalizeServiceMode(value) {
  const normalized = normalizeOptionalString(value);
  if (normalized === null) return PROFILE_SITES_SERVICE_MODES.NORMAL;
  if (Object.values(PROFILE_SITES_SERVICE_MODES).includes(normalized)) {
    return normalized;
  }
  return PROFILE_SITES_SERVICE_MODES.MAINTENANCE;
}

function normalizeAccountUsageRateLimit(environment) {
  const candidate = {
    burstLimit: normalizeBoundedInteger(
      environment.PROFILE_ACCOUNT_USAGE_BURST_LIMIT,
      PROFILE_SITES_DEFAULT_RATE_LIMIT.burstLimit,
      RATE_LIMIT_BOUNDS.limit
    ),
    burstWindowMs: normalizeBoundedInteger(
      environment.PROFILE_ACCOUNT_USAGE_BURST_WINDOW_MS,
      PROFILE_SITES_DEFAULT_RATE_LIMIT.burstWindowMs,
      RATE_LIMIT_BOUNDS.windowMs
    ),
    sustainedLimit: normalizeBoundedInteger(
      environment.PROFILE_ACCOUNT_USAGE_SUSTAINED_LIMIT,
      PROFILE_SITES_DEFAULT_RATE_LIMIT.sustainedLimit,
      RATE_LIMIT_BOUNDS.limit
    ),
    sustainedWindowMs: normalizeBoundedInteger(
      environment.PROFILE_ACCOUNT_USAGE_SUSTAINED_WINDOW_MS,
      PROFILE_SITES_DEFAULT_RATE_LIMIT.sustainedWindowMs,
      RATE_LIMIT_BOUNDS.windowMs
    )
  };

  if (
    candidate.sustainedLimit < candidate.burstLimit ||
    candidate.sustainedWindowMs < candidate.burstWindowMs
  ) {
    return PROFILE_SITES_DEFAULT_RATE_LIMIT;
  }
  return Object.freeze(candidate);
}

function normalizeBoundedInteger(value, fallback, bounds) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value.trim())) {
    return fallback;
  }
  const parsed = Number(value.trim());
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < bounds.minimum ||
    parsed > bounds.maximum
  ) {
    return fallback;
  }
  return parsed;
}
