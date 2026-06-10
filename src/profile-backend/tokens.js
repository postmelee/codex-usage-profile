import { createHash, randomBytes as nodeRandomBytes } from "node:crypto";

import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError
} from "./errors.js";

export const CLI_TOKEN_PREFIX = "cup_";
export const DEFAULT_CLI_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 365;
export const DEFAULT_CLI_TOKEN_SCOPES = Object.freeze(["snapshot:write"]);

export function createCliTokenService(options = {}) {
  const {
    store,
    now = () => new Date(),
    createId = defaultCreateId,
    createToken = defaultCreateToken,
    tokenTtlMs = DEFAULT_CLI_TOKEN_TTL_MS
  } = options;

  if (!store) {
    throw new TypeError("store is required");
  }

  return {
    issueCliToken(issueOptions = {}) {
      const ownerId = requireNonEmptyString(issueOptions.ownerId, "ownerId");
      const owner = store.getOwnerById(ownerId);

      if (!owner) {
        throw new ProfileBackendError(
          PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
          "Owner not found"
        );
      }

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
        tokenRecord: store.saveCliToken(tokenRecord)
      };
    },

    verifyCliToken(rawToken, verifyOptions = {}) {
      const tokenDigest = createCliTokenDigest(
        requireNonEmptyString(rawToken, "token")
      );
      const tokenRecord = store.getCliTokenByDigest(tokenDigest);

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

      const owner = store.getOwnerById(tokenRecord.ownerId);
      if (!owner) {
        throw new ProfileBackendError(
          PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED,
          "CLI token owner no longer exists"
        );
      }

      const updatedToken = store.saveCliToken({
        ...tokenRecord,
        lastUsedAt: normalizeDate(now()).toISOString()
      });

      return {
        owner,
        tokenRecord: updatedToken
      };
    },

    revokeCliToken(revokeOptions = {}) {
      const tokenId = requireNonEmptyString(revokeOptions.tokenId, "tokenId");
      const tokenRecord = store.getCliTokenById(tokenId);

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

