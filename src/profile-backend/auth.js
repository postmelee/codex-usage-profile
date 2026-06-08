import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError
} from "./errors.js";

export const AUTH_PROVIDERS = Object.freeze({
  GITHUB: "github"
});

export async function resolveGitHubIdentityFromCode(options = {}) {
  const { code, githubClient } = options;

  if (!isNonEmptyString(code)) {
    throw invalidRequest("GitHub authorization code is required");
  }

  if (
    !githubClient ||
    typeof githubClient.exchangeCodeForToken !== "function" ||
    typeof githubClient.getAuthenticatedUser !== "function"
  ) {
    throw invalidRequest("GitHub client must provide token exchange and user lookup");
  }

  const tokenResponse = await githubClient.exchangeCodeForToken(code);
  const accessToken = tokenResponse?.accessToken ?? tokenResponse?.access_token;

  if (!isNonEmptyString(accessToken)) {
    throw invalidRequest("GitHub token exchange did not return an access token");
  }

  const user = await githubClient.getAuthenticatedUser(accessToken);
  return normalizeGitHubIdentity(user);
}

export function normalizeGitHubIdentity(payload) {
  if (!isRecord(payload)) {
    throw invalidRequest("GitHub identity payload must be an object");
  }

  const providerUserId = normalizeProviderUserId(payload.id);
  const githubLogin = normalizeString(payload.login);

  if (!providerUserId) {
    throw invalidRequest("GitHub identity id is required");
  }

  if (!githubLogin) {
    throw invalidRequest("GitHub identity login is required");
  }

  return {
    authProvider: AUTH_PROVIDERS.GITHUB,
    providerUserId,
    githubLogin,
    displayName: normalizeString(payload.name) || githubLogin,
    avatarUrl: normalizeNullableUrl(payload.avatar_url),
    profileUrl: normalizeNullableUrl(payload.html_url)
  };
}

function normalizeProviderUserId(value) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }

  return normalizeString(value);
}

function normalizeNullableUrl(value) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizeString(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function invalidRequest(message) {
  return new ProfileBackendError(
    PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST,
    message
  );
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

