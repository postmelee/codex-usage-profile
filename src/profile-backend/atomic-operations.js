import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError
} from "./errors.js";

export const PROFILE_BACKEND_ATOMIC_OPERATION_NAMES = Object.freeze([
  "approveCliLogin",
  "completeOAuthCallback",
  "exchangeCliLogin",
  "submitAccountUsage",
  "updateVisibility"
]);

const REQUIRED_COMMAND_FIELDS = Object.freeze({
  approveCliLogin: ["challengeId", "ownerId", "now"],
  completeOAuthCallback: ["stateId", "now", "owner", "session"],
  exchangeCliLogin: [
    "challengeId",
    "now",
    "token",
    "tokenRecord",
    "maxActiveTokens"
  ],
  submitAccountUsage: [
    "ownerId",
    "document",
    "contentDigest",
    "uploadedAt",
    "device",
    "deviceId"
  ],
  updateVisibility: [
    "ownerId",
    "expectedOwnerUpdatedAt",
    "visibility",
    "updatedAt"
  ]
});

export function assertProfileBackendAtomicOperations(atomic) {
  if (!atomic || typeof atomic !== "object") {
    throw new TypeError("profile backend store.atomic must be an object");
  }

  const missing = PROFILE_BACKEND_ATOMIC_OPERATION_NAMES.filter(
    (name) => typeof atomic[name] !== "function"
  );
  if (missing.length > 0) {
    throw new TypeError(
      `profile backend store.atomic is missing operations: ${missing.join(", ")}`
    );
  }

  return atomic;
}

export function assertProfileBackendAtomicCommand(name, command) {
  if (!Object.hasOwn(REQUIRED_COMMAND_FIELDS, name)) {
    throw new TypeError(`Unknown profile backend atomic operation: ${name}`);
  }
  if (!command || typeof command !== "object" || Array.isArray(command)) {
    throw new TypeError(`${name} command must be an object`);
  }

  const missing = REQUIRED_COMMAND_FIELDS[name].filter(
    (field) => !Object.hasOwn(command, field) || command[field] === undefined
  );
  if (missing.length > 0) {
    throw new TypeError(`${name} command is missing fields: ${missing.join(", ")}`);
  }
  if (
    name === "updateVisibility" &&
    command.updatedAt === command.expectedOwnerUpdatedAt
  ) {
    throw new TypeError("updateVisibility must advance the owner revision");
  }

  return command;
}

export function assertProfileBackendAtomicResult(name, result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new TypeError(`${name} result must be an object`);
  }

  const required = {
    approveCliLogin: ["challenge"],
    completeOAuthCallback: ["oauthState", "owner", "session"],
    exchangeCliLogin: ["challenge", "token", "tokenRecord"],
    submitAccountUsage: ["device", "idempotent", "owner", "usageRecord"],
    updateVisibility: ["owner", "usageRecord", "visibility"]
  }[name];

  if (!required) {
    throw new TypeError(`Unknown profile backend atomic operation: ${name}`);
  }

  const missing = required.filter((field) => !Object.hasOwn(result, field));
  if (missing.length > 0) {
    throw new TypeError(`${name} result is missing fields: ${missing.join(", ")}`);
  }

  return result;
}

// Memory/file and Postgres keep their existing callback transaction primitive
// as an adapter-local implementation detail. Services only call this named
// surface, so D1 never needs to emulate a callback transaction.
export function createTransactionalProfileBackendAtomicOperations(store) {
  if (!store || typeof store.transaction !== "function") {
    throw new TypeError("transactional store is required");
  }

  const atomic = {
    approveCliLogin(command) {
      assertProfileBackendAtomicCommand("approveCliLogin", command);
      return store.transaction(async (tx) => {
        const challenge = await requireChallenge(tx, command.challengeId);
        assertChallengeApprovable(challenge, command.now);
        await requireOwner(tx, command.ownerId);

        const saved = await tx.saveCliLoginChallenge({
          ...challenge,
          status: "approved",
          approvedAt: command.now,
          ownerId: command.ownerId
        });
        return assertProfileBackendAtomicResult("approveCliLogin", {
          challenge: saved
        });
      });
    },

    completeOAuthCallback(command) {
      assertProfileBackendAtomicCommand("completeOAuthCallback", command);
      return store.transaction(async (tx) => {
        const state = await requireOAuthState(tx, command.stateId);
        assertOAuthStateConsumable(state, command.now);

        const owner = await tx.saveOwner(command.owner);
        const session = await tx.saveSession(command.session);
        const oauthState = await tx.saveOAuthState({
          ...state,
          status: "consumed",
          consumedAt: command.now,
          ownerId: owner.id,
          sessionId: session.id
        });

        return assertProfileBackendAtomicResult("completeOAuthCallback", {
          oauthState,
          owner,
          session
        });
      });
    },

    exchangeCliLogin(command) {
      assertProfileBackendAtomicCommand("exchangeCliLogin", command);
      return store.transaction(async (tx) => {
        const challenge = await requireChallenge(tx, command.challengeId);
        assertChallengeExchangeable(challenge, command.now);
        await requireOwner(tx, challenge.ownerId);

        const activeTokens = (await tx.listCliTokensByOwnerId(challenge.ownerId))
          .filter((record) => !record.revokedAt);
        if (activeTokens.length >= command.maxActiveTokens) {
          throw conflict("Active CLI token limit reached");
        }

        const tokenRecord = await tx.saveCliToken(command.tokenRecord);
        const savedChallenge = await tx.saveCliLoginChallenge({
          ...challenge,
          status: "exchanged",
          exchangedAt: command.now,
          cliTokenId: tokenRecord.id
        });

        return assertProfileBackendAtomicResult("exchangeCliLogin", {
          token: command.token,
          tokenRecord,
          challenge: savedChallenge
        });
      });
    },

    submitAccountUsage(command) {
      assertProfileBackendAtomicCommand("submitAccountUsage", command);
      return store.transaction(async (tx) => {
        const owner = await requireOwner(tx, command.ownerId);
        const previous = await tx.getLatestUsageByOwnerId(owner.id);
        const outcome = classifyUsageSubmission(previous, command);
        if (outcome === "stale") {
          throw conflict("Account usage document is older than the stored revision");
        }
        if (outcome === "conflict") {
          throw conflict("Account usage timestamp already has different content");
        }

        const existingDevice = await tx.getSubmittedDeviceByOwnerAndKey(
          owner.id,
          command.device.deviceKey
        );
        const device = await tx.saveSubmittedDevice({
          id: existingDevice?.id ?? command.deviceId,
          ownerId: owner.id,
          deviceKey: command.device.deviceKey,
          displayName: existingDevice?.displayName
            ?? command.device.displayName
            ?? null,
          createdAt: existingDevice?.createdAt ?? command.uploadedAt,
          updatedAt: command.uploadedAt,
          lastSubmittedAt: command.uploadedAt
        });

        const usageRecord = outcome === "idempotent"
          ? previous
          : await tx.saveLatestUsage({
            ownerId: owner.id,
            handle: owner.handle,
            visibility: owner.visibility,
            contractVersion: command.document.contractVersion,
            capturedAt: command.document.capturedAt,
            uploadedAt: command.uploadedAt,
            contentDigest: command.contentDigest,
            usage: command.usage
          });

        return assertProfileBackendAtomicResult("submitAccountUsage", {
          owner,
          tokenRecord: command.tokenRecord ?? null,
          usageRecord,
          device,
          idempotent: outcome === "idempotent"
        });
      });
    },

    updateVisibility(command) {
      assertProfileBackendAtomicCommand("updateVisibility", command);
      return store.transaction(async (tx) => {
        const current = await requireOwner(tx, command.ownerId);
        if ((current.updatedAt ?? null) !== command.expectedOwnerUpdatedAt) {
          throw conflict("Owner visibility revision changed; retry the update");
        }

        const owner = await tx.saveOwner({
          ...current,
          visibility: command.visibility,
          updatedAt: command.updatedAt
        });
        const usageRecord = await tx.getLatestUsageByOwnerId(owner.id);
        const updatedUsageRecord = usageRecord
          ? await tx.saveLatestUsage({
            ...usageRecord,
            handle: owner.handle,
            visibility: owner.visibility
          })
          : null;
        const snapshotRecord = await tx.getLatestSnapshotByOwnerId(owner.id);
        if (snapshotRecord) {
          await tx.saveLatestSnapshot({
            ...snapshotRecord,
            handle: owner.handle,
            visibility: owner.visibility
          });
        }

        return assertProfileBackendAtomicResult("updateVisibility", {
          owner,
          usageRecord: updatedUsageRecord,
          visibility: owner.visibility
        });
      });
    }
  };

  return assertProfileBackendAtomicOperations(atomic);
}

export function classifyUsageSubmission(previous, command) {
  if (!previous) return "new";

  const previousTime = new Date(previous.capturedAt).getTime();
  const nextTime = new Date(command.document.capturedAt).getTime();
  if (nextTime < previousTime) return "stale";
  if (nextTime > previousTime) return "new";

  const previousDigest = previous.contentDigest
    ?? command.expectedLegacyContentDigest
    ?? null;
  return previousDigest === command.contentDigest ? "idempotent" : "conflict";
}

export function assertOAuthStateConsumable(state, now) {
  if (new Date(state.expiresAt).getTime() <= new Date(now).getTime()) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.EXPIRED,
      "OAuth state has expired"
    );
  }
  if (state.status === "consumed") {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.GONE,
      "OAuth state has already been consumed"
    );
  }
  if (state.status !== "pending") {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST,
      "OAuth state cannot be consumed"
    );
  }
}

export function assertChallengeApprovable(challenge, now) {
  assertChallengeNotExpired(challenge, now);
  if (challenge.status !== "pending") {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST,
      "CLI login challenge cannot be approved"
    );
  }
}

export function assertChallengeExchangeable(challenge, now) {
  assertChallengeNotExpired(challenge, now);
  if (challenge.status === "exchanged") {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.GONE,
      "CLI login challenge has already been exchanged"
    );
  }
  if (challenge.status !== "approved") {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST,
      "CLI login challenge has not been approved"
    );
  }
}

function assertChallengeNotExpired(challenge, now) {
  if (new Date(challenge.expiresAt).getTime() <= new Date(now).getTime()) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.EXPIRED,
      "CLI login challenge has expired"
    );
  }
}

async function requireOAuthState(store, id) {
  const state = await store.getOAuthState(id);
  if (!state) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED,
      "OAuth state is invalid"
    );
  }
  return state;
}

async function requireChallenge(store, id) {
  const challenge = await store.getCliLoginChallenge(id);
  if (!challenge) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
      "CLI login challenge not found"
    );
  }
  return challenge;
}

async function requireOwner(store, id) {
  const owner = await store.getOwnerById(id);
  if (!owner) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
      "Owner not found"
    );
  }
  return owner;
}

function conflict(message) {
  return new ProfileBackendError(PROFILE_BACKEND_ERROR_CODES.CONFLICT, message);
}
