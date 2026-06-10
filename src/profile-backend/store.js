import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError
} from "./errors.js";

export const PROFILE_VISIBILITY = Object.freeze({
  PRIVATE: "private",
  PUBLIC: "public"
});

export function createMemoryProfileBackendStore() {
  const ownersById = new Map();
  const ownerIdByProvider = new Map();
  const ownerIdByHandle = new Map();
  const oauthStatesById = new Map();
  const sessionsById = new Map();
  const loginChallengesById = new Map();
  const cliTokensById = new Map();
  const cliTokenIdByDigest = new Map();
  const latestSnapshotsByOwnerId = new Map();
  const ownerIdBySnapshotHandle = new Map();

  return {
    clear() {
      ownersById.clear();
      ownerIdByProvider.clear();
      ownerIdByHandle.clear();
      oauthStatesById.clear();
      sessionsById.clear();
      loginChallengesById.clear();
      cliTokensById.clear();
      cliTokenIdByDigest.clear();
      latestSnapshotsByOwnerId.clear();
      ownerIdBySnapshotHandle.clear();
    },

    deleteCliToken(id) {
      const current = cliTokensById.get(id);
      if (!current) {
        return false;
      }

      cliTokensById.delete(id);
      cliTokenIdByDigest.delete(current.tokenDigest);
      return true;
    },

    getCliLoginChallenge(id) {
      return clone(loginChallengesById.get(id)) ?? null;
    },

    getCliTokenByDigest(tokenDigest) {
      const id = cliTokenIdByDigest.get(tokenDigest);
      return id ? clone(cliTokensById.get(id)) : null;
    },

    getCliTokenById(id) {
      return clone(cliTokensById.get(id)) ?? null;
    },

    getLatestSnapshotByHandle(handle) {
      const ownerId = ownerIdBySnapshotHandle.get(handle);
      return ownerId ? clone(latestSnapshotsByOwnerId.get(ownerId)) : null;
    },

    getLatestSnapshotByOwnerId(ownerId) {
      return clone(latestSnapshotsByOwnerId.get(ownerId)) ?? null;
    },

    getOAuthState(id) {
      return clone(oauthStatesById.get(id)) ?? null;
    },

    getOwnerByHandle(handle) {
      const id = ownerIdByHandle.get(handle);
      return id ? clone(ownersById.get(id)) : null;
    },

    getOwnerById(id) {
      return clone(ownersById.get(id)) ?? null;
    },

    getOwnerByProviderIdentity(authProvider, providerUserId) {
      const id = ownerIdByProvider.get(providerKey(authProvider, providerUserId));
      return id ? clone(ownersById.get(id)) : null;
    },

    listOwners() {
      return Array.from(ownersById.values(), clone);
    },

    getSession(id) {
      return clone(sessionsById.get(id)) ?? null;
    },

    saveCliLoginChallenge(challenge) {
      requireFields("CLI login challenge", challenge, ["id"]);
      loginChallengesById.set(challenge.id, clone(challenge));
      return clone(challenge);
    },

    saveCliToken(token) {
      requireFields("CLI token", token, ["id", "ownerId", "tokenDigest"]);

      const previous = cliTokensById.get(token.id);
      const tokenIdForDigest = cliTokenIdByDigest.get(token.tokenDigest);
      if (tokenIdForDigest && tokenIdForDigest !== token.id) {
        throw new ProfileBackendError(
          PROFILE_BACKEND_ERROR_CODES.CONFLICT,
          "Token digest already belongs to another CLI token"
        );
      }

      if (previous) {
        cliTokenIdByDigest.delete(previous.tokenDigest);
      }

      cliTokensById.set(token.id, clone(token));
      cliTokenIdByDigest.set(token.tokenDigest, token.id);

      return clone(token);
    },

    saveOAuthState(state) {
      requireFields("OAuth state", state, ["id", "status", "expiresAt"]);
      oauthStatesById.set(state.id, clone(state));
      return clone(state);
    },

    saveSession(session) {
      requireFields("session", session, ["id", "ownerId", "expiresAt"]);
      sessionsById.set(session.id, clone(session));
      return clone(session);
    },

    saveLatestSnapshot(record) {
      requireFields("latest snapshot", record, [
        "ownerId",
        "handle",
        "visibility",
        "capturedAt",
        "uploadedAt",
        "schemaVersion",
        "snapshot"
      ]);

      const previous = latestSnapshotsByOwnerId.get(record.ownerId);
      const ownerIdForHandle = ownerIdBySnapshotHandle.get(record.handle);
      if (ownerIdForHandle && ownerIdForHandle !== record.ownerId) {
        throw new ProfileBackendError(
          PROFILE_BACKEND_ERROR_CODES.CONFLICT,
          "Snapshot handle already belongs to another owner"
        );
      }

      if (previous) {
        ownerIdBySnapshotHandle.delete(previous.handle);
      }

      latestSnapshotsByOwnerId.set(record.ownerId, clone(record));
      ownerIdBySnapshotHandle.set(record.handle, record.ownerId);

      return clone(record);
    },

    saveOwner(owner) {
      requireFields("owner", owner, [
        "id",
        "authProvider",
        "providerUserId",
        "handle"
      ]);

      const previousOwner = ownersById.get(owner.id);
      const providerIdentity = providerKey(owner.authProvider, owner.providerUserId);
      const ownerIdForProvider = ownerIdByProvider.get(providerIdentity);
      const ownerIdForHandle = ownerIdByHandle.get(owner.handle);

      if (ownerIdForProvider && ownerIdForProvider !== owner.id) {
        throw new ProfileBackendError(
          PROFILE_BACKEND_ERROR_CODES.CONFLICT,
          "Provider identity already belongs to another owner"
        );
      }

      if (ownerIdForHandle && ownerIdForHandle !== owner.id) {
        throw new ProfileBackendError(
          PROFILE_BACKEND_ERROR_CODES.CONFLICT,
          "Handle already belongs to another owner"
        );
      }

      if (previousOwner) {
        ownerIdByProvider.delete(providerKey(previousOwner.authProvider, previousOwner.providerUserId));
        ownerIdByHandle.delete(previousOwner.handle);
      }

      ownersById.set(owner.id, clone(owner));
      ownerIdByProvider.set(providerIdentity, owner.id);
      ownerIdByHandle.set(owner.handle, owner.id);

      return clone(owner);
    }
  };
}

function clone(value) {
  if (value === undefined) {
    return undefined;
  }

  return structuredClone(value);
}

function providerKey(authProvider, providerUserId) {
  return `${authProvider}:${providerUserId}`;
}

function requireFields(label, record, fields) {
  if (!isRecord(record)) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
      `${label} must be an object`
    );
  }

  for (const field of fields) {
    if (!Object.hasOwn(record, field) || record[field] === null || record[field] === "") {
      throw new ProfileBackendError(
        PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
        `${label} is missing ${field}`
      );
    }
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
