import { createHash, randomBytes as nodeRandomBytes } from "node:crypto";

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
export const DEFAULT_CLI_LOGIN_POLL_INTERVAL_SECONDS = 5;
export const DEFAULT_CLI_LOGIN_VERIFICATION_URI = "/device";
export const CLI_DEVICE_CODE_PREFIX = "cup_device_";

export function createCliLoginService(options = {}) {
  const {
    store,
    now = () => new Date(),
    createId = defaultCreateId,
    createDeviceCode = defaultCreateDeviceCode,
    createUserCode = defaultCreateUserCode,
    challengeTtlMs = DEFAULT_CLI_LOGIN_TTL_MS,
    browserUrlBase = "/api/auth/github/login",
    verificationUri = DEFAULT_CLI_LOGIN_VERIFICATION_URI,
    pollIntervalSeconds = DEFAULT_CLI_LOGIN_POLL_INTERVAL_SECONDS
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
      const deviceCode = requireNonEmptyString(
        createDeviceCode(),
        "deviceCode"
      );
      const userCode = normalizeUserCode(createUserCode());
      const intervalSeconds = normalizePositiveInteger(
        startOptions.intervalSeconds ?? pollIntervalSeconds,
        "intervalSeconds"
      );
      const resolvedVerificationUri = normalizeNullableString(
        startOptions.verificationUri
      ) ?? verificationUri;
      const verificationUriComplete = buildVerificationUriComplete(
        resolvedVerificationUri,
        userCode
      );
      const challenge = {
        id: createId("cli_login"),
        status: CLI_LOGIN_STATUS.PENDING,
        label: normalizeNullableString(startOptions.label),
        redirectUri: normalizeNullableString(startOptions.redirectUri),
        deviceCodeDigest: createDeviceCodeDigest(deviceCode),
        userCode,
        verificationUri: resolvedVerificationUri,
        verificationUriComplete,
        intervalSeconds,
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
        browserUrl: buildBrowserUrl(browserUrlBase, savedChallenge.id),
        deviceCode,
        userCode,
        verificationUri: resolvedVerificationUri,
        verificationUriComplete,
        expiresAt: savedChallenge.expiresAt,
        intervalSeconds
      };
    },

    approveCliLogin(approveOptions = {}) {
      const nowDate = normalizeDate(now());
      const challenge = getChallengeForApproval(store, approveOptions);
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

      return exchangeChallenge({
        store,
        tokenService,
        challenge,
        label: exchangeOptions.label,
        nowDate
      });
    },

    pollCliLogin(pollOptions = {}) {
      const nowDate = normalizeDate(now());
      const challenge = getChallengeByDeviceCode(store, pollOptions.deviceCode);

      if (challenge.status === CLI_LOGIN_STATUS.EXCHANGED) {
        return {
          status: CLI_LOGIN_STATUS.EXCHANGED,
          challenge
        };
      }

      try {
        assertChallengeNotExpired(store, challenge, nowDate);
      } catch (error) {
        if (
          error instanceof ProfileBackendError &&
          error.code === PROFILE_BACKEND_ERROR_CODES.EXPIRED
        ) {
          return {
            status: CLI_LOGIN_STATUS.EXPIRED,
            challenge: store.getCliLoginChallenge(challenge.id)
          };
        }

        throw error;
      }

      if (challenge.status === CLI_LOGIN_STATUS.PENDING) {
        return {
          status: CLI_LOGIN_STATUS.PENDING,
          challenge
        };
      }

      if (challenge.status === CLI_LOGIN_STATUS.APPROVED) {
        return {
          status: CLI_LOGIN_STATUS.APPROVED,
          ...exchangeChallenge({
            store,
            tokenService,
            challenge,
            label: pollOptions.label,
            nowDate
          })
        };
      }

      return {
        status: challenge.status,
        challenge
      };
    }
  };
}

export function createDeviceCodeDigest(rawDeviceCode) {
  return createHash("sha256")
    .update(requireNonEmptyString(rawDeviceCode, "deviceCode"), "utf8")
    .digest("hex");
}

export function defaultCreateDeviceCode() {
  return `${CLI_DEVICE_CODE_PREFIX}${nodeRandomBytes(32).toString("base64url")}`;
}

export function defaultCreateUserCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = nodeRandomBytes(8);

  for (const byte of bytes) {
    code += alphabet[byte % alphabet.length];
  }

  return `${code.slice(0, 4)}-${code.slice(4, 8)}`;
}

export function normalizeUserCode(value) {
  const normalized = requireNonEmptyString(value, "userCode")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");

  if (normalized.length < 6) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
      "userCode is invalid"
    );
  }

  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
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

function getChallengeForApproval(store, approveOptions) {
  if (approveOptions.challengeId) {
    return getChallenge(store, approveOptions.challengeId);
  }

  const userCode = normalizeUserCode(approveOptions.userCode);
  const challenge = store.getCliLoginChallengeByUserCode(userCode);

  if (!challenge) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
      "CLI login challenge not found"
    );
  }

  return challenge;
}

function getChallengeByDeviceCode(store, rawDeviceCode) {
  const deviceCodeDigest = createDeviceCodeDigest(rawDeviceCode);
  const challenge = store.getCliLoginChallengeByDeviceCodeDigest(deviceCodeDigest);

  if (!challenge) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
      "CLI login challenge not found"
    );
  }

  return challenge;
}

function exchangeChallenge({ store, tokenService, challenge, label, nowDate }) {
  const { token, tokenRecord } = tokenService.issueCliToken({
    ownerId: challenge.ownerId,
    label: label ?? challenge.label,
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

function buildVerificationUriComplete(verificationUri, userCode) {
  const url = new URL(
    requireNonEmptyString(verificationUri, "verificationUri"),
    "http://localhost"
  );
  url.searchParams.set("user_code", userCode);

  if (
    verificationUri.startsWith("http://") ||
    verificationUri.startsWith("https://")
  ) {
    return url.toString();
  }

  return `${url.pathname}${url.search}`;
}

function normalizePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
      `${label} must be a positive integer`
    );
  }

  return value;
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
