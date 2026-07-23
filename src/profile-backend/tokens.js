import { createHash, randomBytes as nodeRandomBytes } from "node:crypto";

import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError
} from "./errors.js";
import {
  DEFAULT_MAX_ACTIVE_CLI_TOKENS
} from "../profile-shared/tokenLimits.js";

export const CLI_TOKEN_PREFIX = "cup_";
export const DEFAULT_CLI_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 365;
export const DEFAULT_CLI_TOKEN_SCOPES = Object.freeze(["snapshot:write"]);
export { DEFAULT_MAX_ACTIVE_CLI_TOKENS };

export function createCliTokenService(options = {}) {
  const {
    store,
    now = () => new Date(),
    createId = defaultCreateId,
    createToken = defaultCreateToken,
    tokenTtlMs = DEFAULT_CLI_TOKEN_TTL_MS,
    maxActiveTokens = DEFAULT_MAX_ACTIVE_CLI_TOKENS
  } = options;

  if (!store) {
    throw new TypeError("store is required");
  }

  const prepareCliToken = (issueOptions = {}) => {
    const ownerId = requireNonEmptyString(issueOptions.ownerId, "ownerId");
    const issuedAt = normalizeDate(now());
    const expiresAt = issueOptions.expiresAt
      ? normalizeDate(issueOptions.expiresAt)
      : new Date(issuedAt.getTime() + (issueOptions.expiresInMs ?? tokenTtlMs));
    const rawToken = createToken();
    const tokenRecord = {
      id: createId("cli_token"),
      ownerId,
      tokenDigest: createCliTokenDigest(rawToken),
      label: normalizeNullableString(issueOptions.label),
      scopes: normalizeScopes(issueOptions.scopes),
      sourceChallengeId: normalizeNullableString(issueOptions.sourceChallengeId),
      createdAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      revokedAt: null,
      lastUsedAt: null
    };

    return {
      token: rawToken,
      tokenRecord,
      maxActiveTokens
    };
  };

  return {
    prepareCliToken,

    async issueCliToken(issueOptions = {}) {
      // `store` override lets a caller run this write inside an open
      // transaction (tx handle) while keeping this service's configuration.
      const activeStore = issueOptions.store ?? store;
      const ownerId = requireNonEmptyString(issueOptions.ownerId, "ownerId");
      const owner = await activeStore.getOwnerById(ownerId);

      if (!owner) {
        throw new ProfileBackendError(
          PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
          "Owner not found"
        );
      }

      await assertActiveCliTokenLimitAvailable(activeStore, ownerId, maxActiveTokens);

      const prepared = prepareCliToken({
        ...issueOptions,
        ownerId
      });
      return {
        token: prepared.token,
        tokenRecord: await activeStore.saveCliToken(prepared.tokenRecord)
      };
    },

    async listCliTokens(listOptions = {}) {
      const ownerId = requireNonEmptyString(listOptions.ownerId, "ownerId");
      const owner = await store.getOwnerById(ownerId);

      if (!owner) {
        throw new ProfileBackendError(
          PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
          "Owner not found"
        );
      }

      const includeRevoked = Boolean(listOptions.includeRevoked);
      return (await store.listCliTokensByOwnerId(ownerId))
        .filter((tokenRecord) => includeRevoked || !tokenRecord.revokedAt);
    },

    async verifyCliToken(rawToken, verifyOptions = {}) {
      const tokenDigest = createCliTokenDigest(
        requireNonEmptyString(rawToken, "token")
      );
      const tokenRecord = await store.getCliTokenByDigest(tokenDigest);

      if (!tokenRecord) {
        throw new ProfileBackendError(
          PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED,
          "CLI token is invalid"
        );
      }

      assertTokenUsable(tokenRecord, normalizeDate(now()));

      if (verifyOptions.ownerId && tokenRecord.ownerId !== verifyOptions.ownerId) {
        throw new ProfileBackendError(
          PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED,
          "CLI token does not belong to the requested owner"
        );
      }

      const owner = await store.getOwnerById(tokenRecord.ownerId);
      if (!owner) {
        throw new ProfileBackendError(
          PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED,
          "CLI token owner no longer exists"
        );
      }

      const updatedToken = await store.saveCliToken({
        ...tokenRecord,
        lastUsedAt: normalizeDate(now()).toISOString()
      });

      return {
        owner,
        tokenRecord: updatedToken
      };
    },

    async revokeCliToken(revokeOptions = {}) {
      const tokenId = requireNonEmptyString(revokeOptions.tokenId, "tokenId");
      const tokenRecord = await store.getCliTokenById(tokenId);

      if (!tokenRecord) {
        throw new ProfileBackendError(
          PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
          "CLI token not found"
        );
      }

      if (revokeOptions.ownerId && tokenRecord.ownerId !== revokeOptions.ownerId) {
        throw new ProfileBackendError(
          PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED,
          "CLI token does not belong to the requested owner"
        );
      }

      if (tokenRecord.revokedAt) {
        return tokenRecord;
      }

      return store.saveCliToken({
        ...tokenRecord,
        revokedAt: normalizeDate(now()).toISOString()
      });
    }
  };
}

export function createCliTokenDigest(rawToken) {
  return createHash("sha256").update(String(rawToken), "utf8").digest("hex");
}

export function defaultCreateToken() {
  return `${CLI_TOKEN_PREFIX}${nodeRandomBytes(32).toString("base64url")}`;
}

export function defaultCreateId(prefix) {
  return `${prefix}_${nodeRandomBytes(12).toString("base64url")}`;
}

function assertTokenUsable(tokenRecord, nowDate) {
  if (tokenRecord.revokedAt) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.GONE,
      "CLI token has been revoked"
    );
  }

  if (new Date(tokenRecord.expiresAt).getTime() <= nowDate.getTime()) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.EXPIRED,
      "CLI token has expired"
    );
  }
}

async function assertActiveCliTokenLimitAvailable(store, ownerId, maxActiveTokens) {
  const activeTokenCount = (await store.listCliTokensByOwnerId(ownerId))
    .filter((tokenRecord) => !tokenRecord.revokedAt)
    .length;

  if (activeTokenCount >= maxActiveTokens) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.CONFLICT,
      "Active CLI token limit reached"
    );
  }
}

function normalizeScopes(scopes) {
  if (scopes === undefined) {
    return [...DEFAULT_CLI_TOKEN_SCOPES];
  }

  if (!Array.isArray(scopes) || scopes.some((scope) => !isNonEmptyString(scope))) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
      "CLI token scopes must be a string array"
    );
  }

  return [...scopes];
}

function normalizeNullableString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  return requireNonEmptyString(value, "value");
}

function requireNonEmptyString(value, label) {
  if (!isNonEmptyString(value)) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
      `${label} is required`
    );
  }

  return value.trim();
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
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
