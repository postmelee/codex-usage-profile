import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError
} from "./errors.js";
import { defaultCreateId } from "./tokens.js";

export const LEGACY_SUBMIT_DEVICE_KEY = "legacy-default";
export const LEGACY_SUBMIT_DEVICE_NAME = "Legacy submissions";
export const DEFAULT_SUBMIT_DEVICE_NAME = "Unnamed device";
export const MAX_DEVICE_DISPLAY_NAME_LENGTH = 120;
export const MAX_DEVICE_KEY_LENGTH = 200;

export function createSubmittedDeviceService(options = {}) {
  const {
    store,
    now = () => new Date(),
    createId = defaultCreateId
  } = options;

  if (!store) {
    throw new TypeError("store is required");
  }

  return {
    upsertSubmittedDevice(upsertOptions = {}) {
      const ownerId = requireNonEmptyString(upsertOptions.ownerId, "ownerId");
      const owner = store.getOwnerById(ownerId);
      if (!owner) {
        throw new ProfileBackendError(
          PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
          "Owner not found"
        );
      }

      const device = normalizeSubmitDeviceMetadata(upsertOptions.device);
      const existing = store.getSubmittedDeviceByOwnerAndKey(
        ownerId,
        device.deviceKey
      );
      const submittedAt = normalizeDate(
        upsertOptions.submittedAt ?? now()
      ).toISOString();
      const displayName = existing?.displayName
        ?? device.displayName
        ?? null;

      return store.saveSubmittedDevice({
        id: existing?.id ?? createId("submitted_device"),
        ownerId,
        deviceKey: device.deviceKey,
        displayName,
        createdAt: existing?.createdAt ?? submittedAt,
        updatedAt: submittedAt,
        lastSubmittedAt: submittedAt
      });
    },

    listSubmittedDevices(listOptions = {}) {
      const ownerId = requireNonEmptyString(listOptions.ownerId, "ownerId");
      const owner = store.getOwnerById(ownerId);
      if (!owner) {
        throw new ProfileBackendError(
          PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
          "Owner not found"
        );
      }

      return store.listSubmittedDevicesByOwnerId(ownerId);
    },

    renameSubmittedDevice(renameOptions = {}) {
      const ownerId = requireNonEmptyString(renameOptions.ownerId, "ownerId");
      const deviceId = requireNonEmptyString(renameOptions.deviceId, "deviceId");
      const existing = store.getSubmittedDeviceById(deviceId);

      if (!existing || existing.ownerId !== ownerId) {
        throw new ProfileBackendError(
          PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
          "Device not found"
        );
      }

      return store.saveSubmittedDevice({
        ...existing,
        displayName: normalizeDeviceDisplayName(renameOptions.displayName),
        updatedAt: normalizeDate(now()).toISOString()
      });
    }
  };
}

export function normalizeSubmitDeviceMetadata(value) {
  if (value === undefined || value === null) {
    return {
      deviceKey: LEGACY_SUBMIT_DEVICE_KEY,
      displayName: LEGACY_SUBMIT_DEVICE_NAME
    };
  }

  if (!isRecord(value)) {
    throw validationError("Submit device metadata must be an object");
  }

  return {
    deviceKey: normalizeDeviceKey(value.id ?? value.key ?? value.deviceKey),
    displayName: normalizeDeviceDisplayName(value.name ?? value.displayName)
  };
}

export function normalizeDeviceDisplayName(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw validationError("Device name must be a string or null");
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > MAX_DEVICE_DISPLAY_NAME_LENGTH) {
    throw validationError(
      `Device name must be ${MAX_DEVICE_DISPLAY_NAME_LENGTH} characters or fewer`
    );
  }

  if (hasControlCharacter(trimmed)) {
    throw validationError("Device name must not contain control characters");
  }

  return trimmed;
}

export function getSubmittedDeviceDisplayName(device) {
  if (device?.displayName) {
    return device.displayName;
  }

  if (device?.deviceKey === LEGACY_SUBMIT_DEVICE_KEY) {
    return LEGACY_SUBMIT_DEVICE_NAME;
  }

  return DEFAULT_SUBMIT_DEVICE_NAME;
}

function normalizeDeviceKey(value) {
  const deviceKey = requireNonEmptyString(value, "device id");

  if (deviceKey.length > MAX_DEVICE_KEY_LENGTH) {
    throw validationError(
      `Device id must be ${MAX_DEVICE_KEY_LENGTH} characters or fewer`
    );
  }

  if (hasControlCharacter(deviceKey)) {
    throw validationError("Device id must not contain control characters");
  }

  return deviceKey;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw validationError(`${label} is required`);
  }

  return value.trim();
}

function normalizeDate(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw validationError("Expected a valid date");
  }

  return date;
}

function validationError(message) {
  return new ProfileBackendError(
    PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
    message
  );
}

function hasControlCharacter(value) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
