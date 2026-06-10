import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError
} from "./errors.js";
import { createCliTokenService, defaultCreateId } from "./tokens.js";

export const CLI_LOGIN_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  EXCHANGED: "exchanged",
  EXPIRED: "expired"
});

export const DEFAULT_CLI_LOGIN_TTL_MS = 1000 * 60 * 10;

export function createCliLoginService(options = {}) {
  const {
    store,
    now = () => new Date(),
    createId = defaultCreateId,
    challengeTtlMs = DEFAULT_CLI_LOGIN_TTL_MS,
    browserUrlBase = "/api/auth/github/login"
  } = options;

  if (!store) {
    throw new TypeError("store is required");
  }

  const tokenService = options.tokenService ?? createCliTokenService({
    store,
    now,
    createId
  });

  return {
    startCliLogin(startOptions = {}) {
      const createdAt = normalizeDate(now());
      const challenge = {
        id: createId("cli_login"),
        status: CLI_LOGIN_STATUS.PENDING,
        label: normalizeNullableString(startOptions.label),
        redirectUri: normalizeNullableString(startOptions.redirectUri),
        createdAt: createdAt.toISOString(),
        expiresAt: new Date(createdAt.getTime() + challengeTtlMs).toISOString(),
        approvedAt: null,
        exchangedAt: null,
        ownerId: null,
        cliTokenId: null
      };

      const savedChallenge = store.saveCliLoginChallenge(challenge);

      return {
        challenge: savedChallenge,
        browserUrl: buildBrowserUrl(browserUrlBase, savedChallenge.id)
      };
    },

    approveCliLogin(approveOptions = {}) {
      const nowDate = normalizeDate(now());
      const challenge = getChallenge(store, approveOptions.challengeId);
      assertChallengeCanBeApproved(store, challenge, nowDate);

      const ownerId = requireNonEmptyString(approveOptions.ownerId, "ownerId");
      const owner = store.getOwnerById(ownerId);
      if (!owner) {
        throw new ProfileBackendError(
          PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
          "Owner not found"
        );
      }

      return store.saveCliLoginChallenge({
        ...challenge,
        status: CLI_LOGIN_STATUS.APPROVED,
        approvedAt: nowDate.toISOString(),
        ownerId
      });
    },

    exchangeCliLogin(exchangeOptions = {}) {
      const nowDate = normalizeDate(now());
      const challenge = getChallenge(store, exchangeOptions.challengeId);
      assertChallengeCanBeExchanged(store, challenge, nowDate);

      const { token, tokenRecord } = tokenService.issueCliToken({
        ownerId: challenge.ownerId,
        label: exchangeOptions.label ?? challenge.label,
        sourceChallengeId: challenge.id
      });
      const exchangedChallenge = store.saveCliLoginChallenge({
        ...challenge,
        status: CLI_LOGIN_STATUS.EXCHANGED,
        exchangedAt: nowDate.toISOString(),
        cliTokenId: tokenRecord.id
      });

      return {
        token,
        tokenRecord,
        challenge: exchangedChallenge
      };
    }
  };
}

function getChallenge(store, challengeId) {
  const id = requireNonEmptyString(challengeId, "challengeId");
  const challenge = store.getCliLoginChallenge(id);

  if (!challenge) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
      "CLI login challenge not found"
    );
  }

  return challenge;
}

function assertChallengeCanBeApproved(store, challenge, nowDate) {
  assertChallengeNotExpired(store, challenge, nowDate);

  if (challenge.status !== CLI_LOGIN_STATUS.PENDING) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST,
      "CLI login challenge cannot be approved"
    );
  }
}

function assertChallengeCanBeExchanged(store, challenge, nowDate) {
  assertChallengeNotExpired(store, challenge, nowDate);

  if (challenge.status === CLI_LOGIN_STATUS.EXCHANGED) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.GONE,
      "CLI login challenge has already been exchanged"
    );
  }

  if (challenge.status !== CLI_LOGIN_STATUS.APPROVED) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST,
      "CLI login challenge has not been approved"
    );
  }
}

function assertChallengeNotExpired(store, challenge, nowDate) {
  if (new Date(challenge.expiresAt).getTime() > nowDate.getTime()) {
    return;
  }

  if (challenge.status !== CLI_LOGIN_STATUS.EXCHANGED) {
    store.saveCliLoginChallenge({
      ...challenge,
      status: CLI_LOGIN_STATUS.EXPIRED
    });
  }

  throw new ProfileBackendError(
    PROFILE_BACKEND_ERROR_CODES.EXPIRED,
    "CLI login challenge has expired"
  );
}

function buildBrowserUrl(browserUrlBase, challengeId) {
  const url = new URL(browserUrlBase, "http://localhost");
  url.searchParams.set("cli_login_challenge", challengeId);

  if (browserUrlBase.startsWith("http://") || browserUrlBase.startsWith("https://")) {
    return url.toString();
  }

  return `${url.pathname}${url.search}`;
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

