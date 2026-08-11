import {
  PROFILE_SNAPSHOT_SCHEMA_VERSION,
  validateProfileSnapshot
} from "../profile-snapshot/index.js";
import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError
} from "./errors.js";
import {
  normalizeVisibility,
  slugifyHandleCandidate
} from "./accounts.js";
import { assertNoForbiddenSecrets } from "./security.js";
import { PROFILE_VISIBILITY } from "./store-values.js";
import { createCliTokenService } from "./tokens.js";
import {
  createSubmittedDeviceService,
  normalizeSubmitDeviceMetadata
} from "./devices.js";

const SUBMIT_PAYLOAD_KEYS = new Set([
  "capturedAt",
  "device",
  "handle",
  "snapshot",
  "visibility"
]);

export function createSnapshotSubmitService(options = {}) {
  const {
    store,
    now = () => new Date()
  } = options;

  if (!store) {
    throw new TypeError("store is required");
  }

  const tokenService = options.tokenService ?? createCliTokenService({ store, now });
  const deviceService = options.deviceService ?? createSubmittedDeviceService({
    store,
    now,
    createId: options.createId
  });

  return {
    async submitSnapshot(submitOptions = {}) {
      const { owner } = await tokenService.verifyCliToken(submitOptions.token);
      const payload = normalizeSnapshotSubmitPayload(submitOptions.payload);
      const uploadedAt = normalizeDate(now()).toISOString();

      // Owner handle update, device touch and snapshot save commit together.
      return store.transaction(async (tx) => {
        const ownerForSnapshot = await updateOwnerHandleIfRequested(tx, owner, {
          handle: payload.handle,
          uploadedAt
        });
        const visibility = normalizeVisibility(
          payload.visibility ?? ownerForSnapshot.visibility ?? PROFILE_VISIBILITY.PRIVATE
        );
        await deviceService.upsertSubmittedDevice({
          ownerId: ownerForSnapshot.id,
          device: payload.device,
          submittedAt: uploadedAt,
          store: tx
        });

        return tx.saveLatestSnapshot({
          ownerId: ownerForSnapshot.id,
          handle: ownerForSnapshot.handle,
          visibility,
          capturedAt: payload.capturedAt,
          uploadedAt,
          schemaVersion: payload.snapshot.schemaVersion,
          snapshot: payload.snapshot
        });
      });
    },

    getLatestSnapshotByOwnerId(ownerId) {
      return store.getLatestSnapshotByOwnerId(ownerId);
    },

    async getPublicSnapshotByHandle(handle) {
      const normalizedHandle = slugifyHandleCandidate(handle);
      const record = await store.getLatestSnapshotByHandle(normalizedHandle);

      if (!record || record.visibility !== PROFILE_VISIBILITY.PUBLIC) {
        return null;
      }

      return record;
    }
  };
}

export function normalizeSnapshotSubmitPayload(payload) {
  assertNoForbiddenSecrets(payload);

  if (!isRecord(payload)) {
    throw validationError("Snapshot submit payload must be an object");
  }

  for (const key of Object.keys(payload)) {
    if (!SUBMIT_PAYLOAD_KEYS.has(key)) {
      throw validationError(`Snapshot submit payload contains unknown field: ${key}`);
    }
  }

  if (!Object.hasOwn(payload, "snapshot")) {
    throw validationError("Snapshot submit payload is missing snapshot");
  }

  if (!Object.hasOwn(payload, "capturedAt")) {
    throw validationError("Snapshot submit payload is missing capturedAt");
  }

  const snapshotResult = validateProfileSnapshot(payload.snapshot);
  if (!snapshotResult.ok) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
      "Snapshot payload is invalid",
      { details: snapshotResult.errors }
    );
  }

  if (payload.snapshot.schemaVersion !== PROFILE_SNAPSHOT_SCHEMA_VERSION) {
    throw validationError("Unsupported snapshot schema version");
  }

  return {
    snapshot: payload.snapshot,
    capturedAt: normalizeDate(payload.capturedAt).toISOString(),
    visibility: payload.visibility === undefined
      ? undefined
      : normalizeVisibility(payload.visibility),
    handle: payload.handle === undefined
      ? undefined
      : slugifyHandleCandidate(payload.handle),
    device: normalizeSubmitDeviceMetadata(payload.device)
  };
}

async function updateOwnerHandleIfRequested(store, owner, options) {
  if (!options.handle || options.handle === owner.handle) {
    return owner;
  }

  return store.saveOwner({
    ...owner,
    handle: options.handle,
    updatedAt: options.uploadedAt
  });
}

function validationError(message) {
  return new ProfileBackendError(
    PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
    message
  );
}

function normalizeDate(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw validationError("Expected a valid date");
  }

  return date;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
