import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SUBMIT_DEVICE_NAME,
  LEGACY_SUBMIT_DEVICE_KEY,
  LEGACY_SUBMIT_DEVICE_NAME,
  PROFILE_BACKEND_ERROR_CODES,
  PROFILE_VISIBILITY,
  ProfileBackendError,
  createMemoryProfileBackendStore,
  createSubmittedDeviceService,
  getSubmittedDeviceDisplayName,
  normalizeSubmitDeviceMetadata
} from "../index.js";

test("upserts legacy and named submitted devices for an owner", () => {
  const fixture = createFixture();
  const legacy = fixture.devices.upsertSubmittedDevice({
    ownerId: "owner_1"
  });
  fixture.setNow(new Date("2026-06-10T00:01:00.000Z"));
  const named = fixture.devices.upsertSubmittedDevice({
    ownerId: "owner_1",
    device: {
      id: "macbook-pro",
      name: "pcui-MacBookPro.local"
    }
  });

  const list = fixture.devices.listSubmittedDevices({ ownerId: "owner_1" });

  assert.equal(legacy.id, "submitted_device_1");
  assert.equal(legacy.deviceKey, LEGACY_SUBMIT_DEVICE_KEY);
  assert.equal(legacy.displayName, LEGACY_SUBMIT_DEVICE_NAME);
  assert.equal(named.id, "submitted_device_2");
  assert.equal(named.displayName, "pcui-MacBookPro.local");
  assert.deepEqual(
    list.map((device) => device.id),
    ["submitted_device_2", "submitted_device_1"]
  );
});

test("preserves renamed display names on later submit", () => {
  const fixture = createFixture();
  const submitted = fixture.devices.upsertSubmittedDevice({
    ownerId: "owner_1",
    device: {
      id: "machine-1",
      name: "Original machine"
    }
  });
  fixture.devices.renameSubmittedDevice({
    ownerId: "owner_1",
    deviceId: submitted.id,
    displayName: "Desk setup"
  });
  fixture.setNow(new Date("2026-06-10T00:02:00.000Z"));
  const nextSubmit = fixture.devices.upsertSubmittedDevice({
    ownerId: "owner_1",
    device: {
      id: "machine-1",
      name: "Original machine"
    }
  });

  assert.equal(nextSubmit.id, submitted.id);
  assert.equal(nextSubmit.displayName, "Desk setup");
  assert.equal(nextSubmit.lastSubmittedAt, "2026-06-10T00:02:00.000Z");
});

test("renames and resets submitted device display names", () => {
  const fixture = createFixture();
  const submitted = fixture.devices.upsertSubmittedDevice({
    ownerId: "owner_1",
    device: {
      id: "machine-1"
    }
  });
  const renamed = fixture.devices.renameSubmittedDevice({
    ownerId: "owner_1",
    deviceId: submitted.id,
    displayName: "  Desktop  "
  });
  const reset = fixture.devices.renameSubmittedDevice({
    ownerId: "owner_1",
    deviceId: submitted.id,
    displayName: ""
  });

  assert.equal(renamed.displayName, "Desktop");
  assert.equal(reset.displayName, null);
  assert.equal(getSubmittedDeviceDisplayName(reset), DEFAULT_SUBMIT_DEVICE_NAME);
});

test("rejects invalid device metadata and unauthorized renames", () => {
  const fixture = createFixture();
  fixture.saveOwner({
    id: "owner_2",
    authProvider: "github",
    providerUserId: "2",
    githubLogin: "other",
    handle: "other",
    visibility: PROFILE_VISIBILITY.PRIVATE
  });
  const submitted = fixture.devices.upsertSubmittedDevice({
    ownerId: "owner_1",
    device: {
      id: "machine-1"
    }
  });

  assertBackendError(
    () => normalizeSubmitDeviceMetadata({ name: "Missing id" }),
    PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED
  );
  assertBackendError(
    () => normalizeSubmitDeviceMetadata({ id: "bad\nid" }),
    PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED
  );
  assertBackendError(
    () => fixture.devices.renameSubmittedDevice({
      ownerId: "owner_1",
      deviceId: submitted.id,
      displayName: "a".repeat(121)
    }),
    PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED
  );
  assertBackendError(
    () => fixture.devices.renameSubmittedDevice({
      ownerId: "owner_1",
      deviceId: submitted.id,
      displayName: "bad\nname"
    }),
    PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED
  );
  assertBackendError(
    () => fixture.devices.renameSubmittedDevice({
      ownerId: "owner_2",
      deviceId: submitted.id,
      displayName: "Other"
    }),
    PROFILE_BACKEND_ERROR_CODES.NOT_FOUND
  );
});

function createFixture() {
  const store = createMemoryProfileBackendStore();
  let current = new Date("2026-06-10T00:00:00.000Z");
  store.saveOwner({
    id: "owner_1",
    authProvider: "github",
    providerUserId: "1",
    githubLogin: "postmelee",
    handle: "postmelee",
    visibility: PROFILE_VISIBILITY.PRIVATE
  });
  const devices = createSubmittedDeviceService({
    store,
    now: () => current,
    createId: createIdFactory()
  });

  return {
    devices,
    saveOwner(owner) {
      store.saveOwner(owner);
    },
    setNow(value) {
      current = value;
    }
  };
}

function createIdFactory() {
  let nextId = 1;
  return (prefix) => {
    const id = `${prefix}_${nextId}`;
    nextId += 1;
    return id;
  };
}

function assertBackendError(callback, code) {
  assert.throws(callback, (error) => {
    assert.equal(error instanceof ProfileBackendError, true);
    assert.equal(error.code, code);
    return true;
  });
}
