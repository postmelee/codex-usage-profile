import { assertProfileBackendAtomicOperations } from "./atomic-operations.js";

export const PROFILE_BACKEND_STORE_CONTRACT_VERSION = 2;

// Store methods may return a value or a Promise. Callers must `await` every
// method so the same service code works against the synchronous memory/file
// store, asynchronous Postgres adapter, and D1 adapter. Multi-record writes
// are exposed only through store.atomic named operations. Memory/file and
// Postgres may retain transaction(runner) as an adapter-local compatibility
// primitive; D1 intentionally does not implement it.
export const PROFILE_BACKEND_STORE_METHODS = Object.freeze([
  "clear",
  "deleteCliToken",
  "exportState",
  "getCliLoginChallenge",
  "getCliLoginChallengeByDeviceCodeDigest",
  "getCliLoginChallengeByUserCode",
  "getCliTokenByDigest",
  "getCliTokenById",
  "getLatestSnapshotByHandle",
  "getLatestSnapshotByOwnerId",
  "getLatestUsageByHandle",
  "getLatestUsageByOwnerId",
  "getOAuthState",
  "getOwnerByHandle",
  "getOwnerById",
  "getOwnerByProviderIdentity",
  "getSession",
  "getSubmittedDeviceById",
  "getSubmittedDeviceByOwnerAndKey",
  "listCliTokensByOwnerId",
  "listOwners",
  "listSubmittedDevicesByOwnerId",
  "saveCliLoginChallenge",
  "saveCliToken",
  "saveLatestSnapshot",
  "saveLatestUsage",
  "saveOAuthState",
  "saveOwner",
  "saveSession",
  "saveSubmittedDevice"
]);

export const PROFILE_BACKEND_STORE_RECORDS = deepFreeze({
  cliLoginChallenge: {
    ownerKey: "ownerId",
    secretFields: ["deviceCodeDigest"],
    uniqueKeys: ["id", "deviceCodeDigest", "userCode"]
  },
  cliToken: {
    ownerKey: "ownerId",
    secretFields: ["tokenDigest"],
    uniqueKeys: ["id", "tokenDigest"]
  },
  latestSnapshot: {
    ownerKey: "ownerId",
    secretFields: [],
    uniqueKeys: ["ownerId", "handle"]
  },
  latestUsage: {
    ownerKey: "ownerId",
    secretFields: [],
    uniqueKeys: ["ownerId", "handle"]
  },
  oauthState: {
    ownerKey: "ownerId",
    secretFields: ["id"],
    uniqueKeys: ["id"]
  },
  owner: {
    ownerKey: "id",
    secretFields: [],
    uniqueKeys: ["id", "authProvider+providerUserId", "handle"]
  },
  session: {
    ownerKey: "ownerId",
    secretFields: ["id"],
    uniqueKeys: ["id"]
  },
  submittedDevice: {
    ownerKey: "ownerId",
    secretFields: [],
    uniqueKeys: ["id", "ownerId+deviceKey"]
  }
});

export const PROFILE_BACKEND_STORE_ATOMIC_OPERATIONS = deepFreeze({
  approveCliLogin: {
    records: ["cliLoginChallenge", "owner"],
    serializationKey: "cliLoginChallenge.id",
    invariant:
      "a pending, unexpired challenge transitions atomically once; " +
      "same-owner completed approval replay performs no token issuance",
    failurePolicy: "rollback"
  },
  completeOAuthCallback: {
    records: ["oauthState", "owner", "session"],
    serializationKey: "oauthState.id",
    invariant: "exactly one callback consumes a pending OAuth state",
    failurePolicy: "rollback"
  },
  exchangeCliLogin: {
    records: ["cliLoginChallenge", "cliToken"],
    serializationKey: "cliLoginChallenge.id",
    invariant: "exactly one token is issued for an approved challenge",
    failurePolicy: "rollback"
  },
  // The CLI token verification (including its lastUsedAt touch) runs before
  // this transaction on purpose: it preserves the long-standing behavior that
  // a rejected submit still records the token use, and it keeps the token row
  // out of the submit serialization scope.
  submitAccountUsage: {
    records: ["latestUsage", "submittedDevice"],
    serializationKey: "owner.id",
    invariant: "capturedAt and contentDigest provide stale, conflict, and idempotent outcomes",
    failurePolicy: "rollback"
  },
  updateCardSettings: {
    records: ["owner"],
    serializationKey: "owner.id",
    invariant: "one normalized card presentation replaces one owner revision",
    failurePolicy: "rollback"
  },
  updateVisibility: {
    records: ["owner", "latestUsage", "latestSnapshot"],
    serializationKey: "owner.id",
    invariant: "owner and latest records expose one visibility revision",
    failurePolicy: "rollback"
  }
});

export function assertProfileBackendStoreContract(store) {
  if (!store || (typeof store !== "object" && typeof store !== "function")) {
    throw new TypeError("profile backend store must be an object");
  }

  const missingMethods = PROFILE_BACKEND_STORE_METHODS.filter(
    (method) => typeof store[method] !== "function"
  );

  if (missingMethods.length > 0) {
    throw new TypeError(
      `profile backend store is missing methods: ${missingMethods.join(", ")}`
    );
  }

  assertProfileBackendAtomicOperations(store.atomic);
  return store;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  for (const item of Object.values(value)) {
    deepFreeze(item);
  }

  return Object.freeze(value);
}
