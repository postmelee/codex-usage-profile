import { createAccountService } from "./accounts.js";
import { resolveGitHubIdentityFromCode } from "./auth.js";
import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError
} from "./errors.js";
import { createSessionService } from "./session.js";
import { defaultCreateId } from "./tokens.js";

export const OAUTH_STATE_STATUS = Object.freeze({
  PENDING: "pending",
  CONSUMED: "consumed",
  EXPIRED: "expired"
});

export const DEFAULT_OAUTH_STATE_TTL_MS = 1000 * 60 * 10;
export const DEFAULT_GITHUB_AUTHORIZATION_URL = "https://github.com/login/oauth/authorize";
export const DEFAULT_GITHUB_OAUTH_SCOPE = "read:user";
export const DEFAULT_GITHUB_CALLBACK_PATH = "/api/auth/github/callback";

export function createOAuthRuntimeService(options = {}) {
  const {
    store,
    githubClient,
    now = () => new Date(),
    createId = defaultCreateId,
    oauthStateTtlMs = DEFAULT_OAUTH_STATE_TTL_MS,
    githubAuthorizationUrl = DEFAULT_GITHUB_AUTHORIZATION_URL,
    githubClientId,
    publicBaseUrl = "http://localhost",
    callbackPath = DEFAULT_GITHUB_CALLBACK_PATH
  } = options;

  if (!store) {
    throw new TypeError("store is required");
  }

  const accountService = options.accountService ?? createAccountService({
    store,
    now
  });
  const sessionService = options.sessionService ?? createSessionService({
    store,
    now,
    createId
  });

  return {
    async startGitHubLogin(startOptions = {}) {
      const clientId = requireNonEmptyString(
        startOptions.githubClientId ?? githubClientId,
        "githubClientId"
      );
      const createdAt = normalizeDate(now());
      const oauthState = await store.saveOAuthState({
        id: createId("oauth_state"),
        provider: "github",
        status: OAUTH_STATE_STATUS.PENDING,
        cliLoginChallengeId: normalizeNullableString(
          startOptions.cliLoginChallengeId
        ),
        redirectTo: normalizeNullableString(startOptions.redirectTo),
        createdAt: createdAt.toISOString(),
        expiresAt: new Date(createdAt.getTime() + oauthStateTtlMs).toISOString(),
        consumedAt: null,
        ownerId: null,
        sessionId: null
      });

      return {
        oauthState,
        authorizationUrl: buildGitHubAuthorizationUrl({
          githubAuthorizationUrl,
          clientId,
          state: oauthState.id,
          redirectUri: resolveCallbackUrl(
            startOptions.publicBaseUrl ?? publicBaseUrl,
            startOptions.callbackPath ?? callbackPath
          ),
          scope: startOptions.scope ?? DEFAULT_GITHUB_OAUTH_SCOPE
        })
      };
    },

    async completeGitHubCallback(callbackOptions = {}) {
      const state = await getOAuthState(store, callbackOptions.state);
      await assertOAuthStateCanBeConsumed(store, state, normalizeDate(now()));

      // The GitHub token exchange is a network call, so it stays outside the
      // transaction. Consuming the state and committing the owner/session are
      // done atomically so exactly one callback can consume a pending state.
      const identity = await resolveGitHubIdentityFromCode({
        code: callbackOptions.code,
        githubClient: callbackOptions.githubClient ?? githubClient
      });

      const operationNow = normalizeDate(now()).toISOString();
      const owner = await accountService.prepareGitHubOwner(identity, {
        handle: callbackOptions.handle,
        visibility: callbackOptions.visibility
      });
      const preparedSession = sessionService.prepareSession({
        ownerId: owner.id
      });
      const result = await store.atomic.completeOAuthCallback({
        stateId: state.id,
        now: operationNow,
        owner,
        session: preparedSession.session
      });

      return {
        ...result,
        sessionCookie: sessionService.serializeSessionCookie(result.session)
      };
    },

    logout(logoutOptions = {}) {
      return sessionService.logoutFromCookie(logoutOptions.cookieHeader);
    }
  };
}

export function buildGitHubAuthorizationUrl(options = {}) {
  const url = new URL(
    options.githubAuthorizationUrl ?? DEFAULT_GITHUB_AUTHORIZATION_URL
  );

  url.searchParams.set("client_id", requireNonEmptyString(options.clientId, "clientId"));
  url.searchParams.set("redirect_uri", requireNonEmptyString(options.redirectUri, "redirectUri"));
  url.searchParams.set("state", requireNonEmptyString(options.state, "state"));

  if (options.scope !== null) {
    url.searchParams.set("scope", options.scope ?? DEFAULT_GITHUB_OAUTH_SCOPE);
  }

  return url.toString();
}

export function resolveCallbackUrl(publicBaseUrl, callbackPath = DEFAULT_GITHUB_CALLBACK_PATH) {
  return new URL(callbackPath, ensureTrailingSlash(
    requireNonEmptyString(publicBaseUrl, "publicBaseUrl")
  )).toString();
}

async function getOAuthState(store, stateId) {
  const id = requireNonEmptyString(stateId, "state");
  const state = await store.getOAuthState(id);

  if (!state) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED,
      "OAuth state is invalid"
    );
  }

  return state;
}

// Marks an expired pending state EXPIRED (a housekeeping write) and then throws
// if the state cannot be consumed. Runs before the transaction.
async function assertOAuthStateCanBeConsumed(store, state, nowDate) {
  if (
    new Date(state.expiresAt).getTime() <= nowDate.getTime() &&
    state.status !== OAUTH_STATE_STATUS.CONSUMED
  ) {
    await store.saveOAuthState({
      ...state,
      status: OAUTH_STATE_STATUS.EXPIRED
    });
  }

  checkOAuthStateConsumable(state, nowDate);
}

// Pure re-validation used inside the transaction under the row lock so a racing
// callback that already consumed the state is rejected. Performs no writes.
function checkOAuthStateConsumable(state, nowDate) {
  if (new Date(state.expiresAt).getTime() <= nowDate.getTime()) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.EXPIRED,
      "OAuth state has expired"
    );
  }

  if (state.status === OAUTH_STATE_STATUS.CONSUMED) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.GONE,
      "OAuth state has already been consumed"
    );
  }

  if (state.status !== OAUTH_STATE_STATUS.PENDING) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST,
      "OAuth state cannot be consumed"
    );
  }
}

function normalizeNullableString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  return requireNonEmptyString(value, "value");
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
      `${label} is required`
    );
  }

  return value.trim();
}

function normalizeDate(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
      "Expected a valid date"
    );
  }

  return date;
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
