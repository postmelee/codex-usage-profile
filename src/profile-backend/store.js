import { AsyncLocalStorage } from "node:async_hooks";

import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError
} from "./errors.js";
import {
  createTransactionalProfileBackendAtomicOperations
} from "./atomic-operations.js";
import {
  PROFILE_BACKEND_STORE_SCHEMA_VERSION,
  PROFILE_VISIBILITY
} from "./store-values.js";

export {
  PROFILE_BACKEND_STORE_SCHEMA_VERSION,
  PROFILE_VISIBILITY
} from "./store-values.js";

export function createMemoryProfileBackendStore(initialState = {}) {
  const transactionContext = new AsyncLocalStorage();
  let transactionQueueTail = Promise.resolve();
  const ownersById = new Map();
  const ownerIdByProvider = new Map();
  const ownerIdByHandle = new Map();
  const oauthStatesById = new Map();
  const sessionsById = new Map();
  const loginChallengesById = new Map();
  const loginChallengeIdByDeviceCodeDigest = new Map();
  const loginChallengeIdByUserCode = new Map();
  const cliTokensById = new Map();
  const cliTokenIdByDigest = new Map();
  const latestSnapshotsByOwnerId = new Map();
  const ownerIdBySnapshotHandle = new Map();
  const latestUsagesByOwnerId = new Map();
  const ownerIdByUsageHandle = new Map();
  const submittedDevicesById = new Map();
  const submittedDeviceIdByOwnerAndKey = new Map();

  const store = {
    clear() {
      ownersById.clear();
      ownerIdByProvider.clear();
      ownerIdByHandle.clear();
      oauthStatesById.clear();
      sessionsById.clear();
      loginChallengesById.clear();
      loginChallengeIdByDeviceCodeDigest.clear();
      loginChallengeIdByUserCode.clear();
      cliTokensById.clear();
      cliTokenIdByDigest.clear();
      latestSnapshotsByOwnerId.clear();
      ownerIdBySnapshotHandle.clear();
      latestUsagesByOwnerId.clear();
      ownerIdByUsageHandle.clear();
      submittedDevicesById.clear();
      submittedDeviceIdByOwnerAndKey.clear();
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

    getCliLoginChallengeByDeviceCodeDigest(deviceCodeDigest) {
      const id = loginChallengeIdByDeviceCodeDigest.get(deviceCodeDigest);
      return id ? clone(loginChallengesById.get(id)) : null;
    },

    getCliLoginChallengeByUserCode(userCode) {
      const id = loginChallengeIdByUserCode.get(userCode);
      return id ? clone(loginChallengesById.get(id)) : null;
    },

    getCliTokenByDigest(tokenDigest) {
      const id = cliTokenIdByDigest.get(tokenDigest);
      return id ? clone(cliTokensById.get(id)) : null;
    },

    getCliTokenById(id) {
      return clone(cliTokensById.get(id)) ?? null;
    },

    listCliTokensByOwnerId(ownerId) {
      return Array.from(cliTokensById.values())
        .filter((token) => token.ownerId === ownerId)
        .sort((a, b) => compareIsoDesc(a.createdAt, b.createdAt))
        .map(clone);
    },

    getLatestSnapshotByHandle(handle) {
      const ownerId = ownerIdBySnapshotHandle.get(handle);
      return ownerId ? clone(latestSnapshotsByOwnerId.get(ownerId)) : null;
    },

    getLatestSnapshotByOwnerId(ownerId) {
      return clone(latestSnapshotsByOwnerId.get(ownerId)) ?? null;
    },

    getLatestUsageByHandle(handle) {
      const ownerId = ownerIdByUsageHandle.get(handle);
      return ownerId ? clone(latestUsagesByOwnerId.get(ownerId)) : null;
    },

    getLatestUsageByOwnerId(ownerId) {
      return clone(latestUsagesByOwnerId.get(ownerId)) ?? null;
    },

    getSubmittedDeviceById(id) {
      return clone(submittedDevicesById.get(id)) ?? null;
    },

    getSubmittedDeviceByOwnerAndKey(ownerId, deviceKey) {
      const id = submittedDeviceIdByOwnerAndKey.get(deviceKeyForOwner(ownerId, deviceKey));
      return id ? clone(submittedDevicesById.get(id)) : null;
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

    listSubmittedDevicesByOwnerId(ownerId) {
      return Array.from(submittedDevicesById.values())
        .filter((device) => device.ownerId === ownerId)
        .sort(compareSubmittedDevicesDesc)
        .map(clone);
    },

    getSession(id) {
      return clone(sessionsById.get(id)) ?? null;
    },

    saveCliLoginChallenge(challenge) {
      requireFields("CLI login challenge", challenge, ["id"]);
      const previous = loginChallengesById.get(challenge.id);
      const deviceCodeOwner = challenge.deviceCodeDigest
        ? loginChallengeIdByDeviceCodeDigest.get(challenge.deviceCodeDigest)
        : null;
      const userCodeOwner = challenge.userCode
        ? loginChallengeIdByUserCode.get(challenge.userCode)
        : null;

      if (deviceCodeOwner && deviceCodeOwner !== challenge.id) {
        throw new ProfileBackendError(
          PROFILE_BACKEND_ERROR_CODES.CONFLICT,
          "Device code digest already belongs to another CLI login challenge"
        );
      }
      if (userCodeOwner && userCodeOwner !== challenge.id) {
        throw new ProfileBackendError(
          PROFILE_BACKEND_ERROR_CODES.CONFLICT,
          "User code already belongs to another CLI login challenge"
        );
      }

      if (previous?.deviceCodeDigest) {
        loginChallengeIdByDeviceCodeDigest.delete(previous.deviceCodeDigest);
      }
      if (previous?.userCode) {
        loginChallengeIdByUserCode.delete(previous.userCode);
      }

      loginChallengesById.set(challenge.id, clone(challenge));
      if (challenge.deviceCodeDigest) {
        loginChallengeIdByDeviceCodeDigest.set(challenge.deviceCodeDigest, challenge.id);
      }
      if (challenge.userCode) {
        loginChallengeIdByUserCode.set(challenge.userCode, challenge.id);
      }
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

    saveLatestUsage(record) {
      requireFields("latest usage", record, [
        "ownerId",
        "handle",
        "visibility",
        "capturedAt",
        "uploadedAt",
        "usage"
      ]);

      const previous = latestUsagesByOwnerId.get(record.ownerId);
      const ownerIdForHandle = ownerIdByUsageHandle.get(record.handle);
      if (ownerIdForHandle && ownerIdForHandle !== record.ownerId) {
        throw new ProfileBackendError(
          PROFILE_BACKEND_ERROR_CODES.CONFLICT,
          "Usage handle already belongs to another owner"
        );
      }

      if (previous) {
        ownerIdByUsageHandle.delete(previous.handle);
      }

      latestUsagesByOwnerId.set(record.ownerId, clone(record));
      ownerIdByUsageHandle.set(record.handle, record.ownerId);

      return clone(record);
    },

    saveSubmittedDevice(device) {
      requireFields("submitted device", device, [
        "id",
        "ownerId",
        "deviceKey",
        "createdAt",
        "updatedAt",
        "lastSubmittedAt"
      ]);

      const previous = submittedDevicesById.get(device.id);
      const ownerKey = deviceKeyForOwner(device.ownerId, device.deviceKey);
      const idForOwnerKey = submittedDeviceIdByOwnerAndKey.get(ownerKey);

      if (idForOwnerKey && idForOwnerKey !== device.id) {
        throw new ProfileBackendError(
          PROFILE_BACKEND_ERROR_CODES.CONFLICT,
          "Submitted device key already belongs to another device"
        );
      }

      if (previous) {
        submittedDeviceIdByOwnerAndKey.delete(
          deviceKeyForOwner(previous.ownerId, previous.deviceKey)
        );
      }

      submittedDevicesById.set(device.id, clone(device));
      submittedDeviceIdByOwnerAndKey.set(ownerKey, device.id);

      return clone(device);
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
    },

    exportState() {
      return {
        schemaVersion: PROFILE_BACKEND_STORE_SCHEMA_VERSION,
        owners: Array.from(ownersById.values(), clone),
        oauthStates: Array.from(oauthStatesById.values(), clone),
        sessions: Array.from(sessionsById.values(), clone),
        cliLoginChallenges: Array.from(loginChallengesById.values(), clone),
        cliTokens: Array.from(cliTokensById.values(), clone),
        latestSnapshots: Array.from(latestSnapshotsByOwnerId.values(), clone),
        latestUsages: Array.from(latestUsagesByOwnerId.values(), clone),
        submittedDevices: Array.from(submittedDevicesById.values(), clone)
      };
    },

    transaction(runner) {
      if (typeof runner !== "function") {
        throw new TypeError("transaction runner must be a function");
      }

      // Nested transactions would deadlock on the FIFO queue below, so they
      // are rejected outright. The AsyncLocalStorage context follows the
      // runner's async flow, catching nesting through any handle.
      if (transactionContext.getStore()) {
        throw new Error(
          "Nested store transactions are not supported; reuse the active transaction handle"
        );
      }

      // Async runners yield between store calls, so overlapping transactions
      // must be serialized: without the FIFO queue a failing transaction
      // would restore a snapshot taken before a concurrent transaction
      // committed, silently erasing that commit. Inside the queue slot,
      // snapshot/restore gives all-or-nothing semantics. The runner receives
      // the store itself as its transactional handle.
      const run = async () => {
        const snapshot = store.exportState();
        try {
          return await transactionContext.run(true, () => runner(store));
        } catch (error) {
          store.clear();
          hydrateStore(store, snapshot);
          throw error;
        }
      };

      const result = transactionQueueTail.then(run);
      transactionQueueTail = result.then(noop, noop);
      return result;
    }
  };

  store.atomic = createTransactionalProfileBackendAtomicOperations(store);
  hydrateStore(store, initialState);

  return store;
}

function clone(value) {
  if (value === undefined) {
    return undefined;
  }

  return structuredClone(value);
}

function noop() {}

function providerKey(authProvider, providerUserId) {
  return `${authProvider}:${providerUserId}`;
}

function deviceKeyForOwner(ownerId, deviceKey) {
  return `${ownerId}:${deviceKey}`;
}

function compareIsoDesc(left, right) {
  return String(right ?? "").localeCompare(String(left ?? ""));
}

function compareSubmittedDevicesDesc(left, right) {
  const submittedCompare = compareIsoDesc(left.lastSubmittedAt, right.lastSubmittedAt);
  if (submittedCompare !== 0) {
    return submittedCompare;
  }

  return compareIsoDesc(left.createdAt, right.createdAt);
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

function hydrateStore(store, initialState) {
  const state = normalizeStoreState(initialState);

  for (const owner of state.owners) {
    store.saveOwner(owner);
  }
  for (const oauthState of state.oauthStates) {
    store.saveOAuthState(oauthState);
  }
  for (const session of state.sessions) {
    store.saveSession(session);
  }
  for (const challenge of state.cliLoginChallenges) {
    store.saveCliLoginChallenge(challenge);
  }
  for (const token of state.cliTokens) {
    store.saveCliToken(token);
  }
  for (const snapshot of state.latestSnapshots) {
    store.saveLatestSnapshot(snapshot);
  }
  for (const usage of state.latestUsages) {
    store.saveLatestUsage(usage);
  }
  for (const device of state.submittedDevices) {
    store.saveSubmittedDevice(device);
  }
}

function normalizeStoreState(value) {
  if (value === undefined || value === null) {
    return emptyStoreState();
  }

  if (!isRecord(value)) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
      "Store state must be an object"
    );
  }

  if (
    value.schemaVersion !== undefined &&
    value.schemaVersion !== PROFILE_BACKEND_STORE_SCHEMA_VERSION
  ) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
      "Store state schema version is unsupported"
    );
  }

  return {
    owners: normalizeRecordArray(value.owners, "owners"),
    oauthStates: normalizeRecordArray(value.oauthStates, "oauthStates"),
    sessions: normalizeRecordArray(value.sessions, "sessions"),
    cliLoginChallenges: normalizeRecordArray(
      value.cliLoginChallenges,
      "cliLoginChallenges"
    ),
    cliTokens: normalizeRecordArray(value.cliTokens, "cliTokens"),
    latestSnapshots: normalizeRecordArray(value.latestSnapshots, "latestSnapshots"),
    latestUsages: normalizeRecordArray(value.latestUsages, "latestUsages"),
    submittedDevices: normalizeRecordArray(value.submittedDevices, "submittedDevices")
  };
}

function emptyStoreState() {
  return {
    owners: [],
    oauthStates: [],
    sessions: [],
    cliLoginChallenges: [],
    cliTokens: [],
    latestSnapshots: [],
    latestUsages: [],
    submittedDevices: []
  };
}

function normalizeRecordArray(value, label) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.some((record) => !isRecord(record))) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
      `Store state ${label} must be an object array`
    );
  }

  return value;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
