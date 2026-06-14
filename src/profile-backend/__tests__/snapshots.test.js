import assert from "node:assert/strict";
import test from "node:test";

import {
  CLI_TOKEN_PREFIX,
  LEGACY_SUBMIT_DEVICE_KEY,
  PROFILE_BACKEND_ERROR_CODES,
  PROFILE_VISIBILITY,
  ProfileBackendError,
  createCliTokenService,
  createMemoryProfileBackendStore,
  createSnapshotSubmitService,
  normalizeSnapshotSubmitPayload
} from "../index.js";
import { sampleProfileSnapshot } from "../../profile-snapshot/fixtures/sample-snapshot.js";

test("submits a valid snapshot and writes latest metadata", () => {
  const fixture = createFixture();
  const result = fixture.snapshots.submitSnapshot({
    token: fixture.token,
    payload: {
      snapshot: sampleProfileSnapshot,
      capturedAt: sampleProfileSnapshot.capturedAt,
      visibility: PROFILE_VISIBILITY.PUBLIC
    }
  });
  const stored = fixture.store.getLatestSnapshotByOwnerId("owner_1");
  const tokenRecord = fixture.store.getCliTokenById(fixture.tokenRecord.id);

  assert.equal(result.ownerId, "owner_1");
  assert.equal(result.handle, "postmelee");
  assert.equal(result.visibility, PROFILE_VISIBILITY.PUBLIC);
  assert.equal(result.capturedAt, sampleProfileSnapshot.capturedAt);
  assert.equal(result.uploadedAt, "2026-06-10T00:00:00.000Z");
  assert.equal(result.schemaVersion, sampleProfileSnapshot.schemaVersion);
  assert.deepEqual(stored, result);
  assert.equal(tokenRecord.lastUsedAt, "2026-06-10T00:00:00.000Z");
});

test("submits snapshot device metadata as web service metadata", () => {
  const fixture = createFixture();
  const result = fixture.snapshots.submitSnapshot({
    token: fixture.token,
    payload: {
      snapshot: sampleProfileSnapshot,
      capturedAt: sampleProfileSnapshot.capturedAt,
      visibility: PROFILE_VISIBILITY.PUBLIC,
      device: {
        id: "pcui-macbookpro",
        name: "pcui-MacBookPro.local"
      }
    }
  });
  const device = fixture.store.getSubmittedDeviceByOwnerAndKey(
    "owner_1",
    "pcui-macbookpro"
  );

  assert.equal(result.ownerId, "owner_1");
  assert.equal(device.id, "submitted_device_1");
  assert.equal(device.displayName, "pcui-MacBookPro.local");
  assert.equal(device.lastSubmittedAt, "2026-06-10T00:00:00.000Z");
  assert.equal(Object.hasOwn(result.snapshot, "device"), false);
});

test("submits legacy device metadata when no device is provided", () => {
  const fixture = createFixture();

  fixture.snapshots.submitSnapshot({
    token: fixture.token,
    payload: createSubmitPayload()
  });

  const device = fixture.store.getSubmittedDeviceByOwnerAndKey(
    "owner_1",
    LEGACY_SUBMIT_DEVICE_KEY
  );
  assert.equal(device.displayName, "Legacy submissions");
});

test("updates the same owner's latest snapshot and optional handle", () => {
  const fixture = createFixture();

  fixture.snapshots.submitSnapshot({
    token: fixture.token,
    payload: {
      snapshot: sampleProfileSnapshot,
      capturedAt: sampleProfileSnapshot.capturedAt,
      visibility: PROFILE_VISIBILITY.PUBLIC
    }
  });
  const updated = fixture.snapshots.submitSnapshot({
    token: fixture.token,
    payload: {
      snapshot: sampleProfileSnapshot,
      capturedAt: sampleProfileSnapshot.capturedAt,
      visibility: PROFILE_VISIBILITY.PRIVATE,
      handle: "Melee Developing"
    }
  });

  assert.equal(updated.handle, "melee-developing");
  assert.equal(updated.visibility, PROFILE_VISIBILITY.PRIVATE);
  assert.equal(fixture.store.getOwnerById("owner_1").handle, "melee-developing");
  assert.equal(fixture.store.getLatestSnapshotByHandle("postmelee"), null);
  assert.equal(
    fixture.store.getLatestSnapshotByHandle("melee-developing").ownerId,
    "owner_1"
  );
});

test("returns only public snapshots from public handle lookup", () => {
  const fixture = createFixture();

  fixture.snapshots.submitSnapshot({
    token: fixture.token,
    payload: {
      snapshot: sampleProfileSnapshot,
      capturedAt: sampleProfileSnapshot.capturedAt,
      visibility: PROFILE_VISIBILITY.PRIVATE
    }
  });
  assert.equal(fixture.snapshots.getPublicSnapshotByHandle("postmelee"), null);

  fixture.snapshots.submitSnapshot({
    token: fixture.token,
    payload: {
      snapshot: sampleProfileSnapshot,
      capturedAt: sampleProfileSnapshot.capturedAt,
      visibility: PROFILE_VISIBILITY.PUBLIC
    }
  });

  assert.equal(
    fixture.snapshots.getPublicSnapshotByHandle("PostMelee").ownerId,
    "owner_1"
  );
});

test("rejects invalid snapshots with validation details", () => {
  const fixture = createFixture();
  const invalidSnapshot = structuredClone(sampleProfileSnapshot);
  delete invalidSnapshot.schemaVersion;

  assertBackendError(
    () => fixture.snapshots.submitSnapshot({
      token: fixture.token,
      payload: {
        snapshot: invalidSnapshot,
        capturedAt: sampleProfileSnapshot.capturedAt
      }
    }),
    PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
    (error) => {
      assert.match(error.details.join("\n"), /\$\.schemaVersion: missing field/);
    }
  );
});

test("rejects token-like wrapper and nested snapshot payload fields", () => {
  const fixture = createFixture();
  const snapshotWithSecret = structuredClone(sampleProfileSnapshot);
  snapshotWithSecret.access_token = "gho_1234567890abcdefghijklmnopqrstuv";

  assertBackendError(
    () => normalizeSnapshotSubmitPayload({
      snapshot: sampleProfileSnapshot,
      capturedAt: sampleProfileSnapshot.capturedAt,
      access_token: "redacted"
    }),
    PROFILE_BACKEND_ERROR_CODES.FORBIDDEN_SECRET
  );
  assertBackendError(
    () => fixture.snapshots.submitSnapshot({
      token: fixture.token,
      payload: {
        snapshot: snapshotWithSecret,
        capturedAt: sampleProfileSnapshot.capturedAt
      }
    }),
    PROFILE_BACKEND_ERROR_CODES.FORBIDDEN_SECRET
  );
});

test("rejects expired and revoked submit tokens", () => {
  const fixture = createFixture({ expiresInMs: 1000 });
  fixture.setNow(new Date("2026-06-10T00:00:01.000Z"));

  assertBackendError(
    () => fixture.snapshots.submitSnapshot({
      token: fixture.token,
      payload: createSubmitPayload()
    }),
    PROFILE_BACKEND_ERROR_CODES.EXPIRED
  );

  const revokedFixture = createFixture();
  revokedFixture.tokenService.revokeCliToken({
    tokenId: revokedFixture.tokenRecord.id,
    ownerId: "owner_1"
  });

  assertBackendError(
    () => revokedFixture.snapshots.submitSnapshot({
      token: revokedFixture.token,
      payload: createSubmitPayload()
    }),
    PROFILE_BACKEND_ERROR_CODES.GONE
  );
});

test("rejects handle conflicts during submit", () => {
  const fixture = createFixture();
  fixture.store.saveOwner({
    id: "owner_2",
    authProvider: "github",
    providerUserId: "2",
    githubLogin: "taken",
    handle: "taken",
    visibility: PROFILE_VISIBILITY.PRIVATE
  });

  assertBackendError(
    () => fixture.snapshots.submitSnapshot({
      token: fixture.token,
      payload: {
        ...createSubmitPayload(),
        handle: "taken"
      }
    }),
    PROFILE_BACKEND_ERROR_CODES.CONFLICT
  );
});

test("normalizes submit payload metadata", () => {
  const normalized = normalizeSnapshotSubmitPayload({
    snapshot: sampleProfileSnapshot,
    capturedAt: "2026-06-06T17:22:18+09:00",
    visibility: PROFILE_VISIBILITY.PUBLIC,
    handle: "Post Melee",
    device: {
      id: " machine-1 ",
      name: " Work laptop "
    }
  });

  assert.equal(normalized.capturedAt, sampleProfileSnapshot.capturedAt);
  assert.equal(normalized.visibility, PROFILE_VISIBILITY.PUBLIC);
  assert.equal(normalized.handle, "post-melee");
  assert.deepEqual(normalized.device, {
    deviceKey: "machine-1",
    displayName: "Work laptop"
  });
});

function createFixture(options = {}) {
  const store = createMemoryProfileBackendStore();
  store.saveOwner({
    id: "owner_1",
    authProvider: "github",
    providerUserId: "1",
    githubLogin: "postmelee",
    handle: "postmelee",
    visibility: PROFILE_VISIBILITY.PRIVATE
  });

  let current = new Date("2026-06-10T00:00:00.000Z");
  const tokenService = createCliTokenService({
    store,
    now: () => current,
    createId: createIdFactory(),
    createToken: createTokenFactory()
  });
  const { token, tokenRecord } = tokenService.issueCliToken({
    ownerId: "owner_1",
    expiresInMs: options.expiresInMs
  });
  const snapshots = createSnapshotSubmitService({
    store,
    tokenService,
    now: () => current,
    createId: createIdFactory("submitted_device")
  });

  return {
    store,
    token,
    tokenRecord,
    tokenService,
    snapshots,
    setNow(value) {
      current = value;
    }
  };
}

function createSubmitPayload() {
  return {
    snapshot: sampleProfileSnapshot,
    capturedAt: sampleProfileSnapshot.capturedAt,
    visibility: PROFILE_VISIBILITY.PUBLIC
  };
}

function createIdFactory(label = null) {
  return createLabeledIdFactory(label);
}

function createLabeledIdFactory(label = null) {
  let nextId = 1;
  return (prefix) => {
    const id = label ? `${label}_${nextId}` : `${prefix}_${nextId}`;
    nextId += 1;
    return id;
  };
}

function createTokenFactory() {
  let nextToken = 1;
  return () => {
    const token = `${CLI_TOKEN_PREFIX}test_${nextToken}`;
    nextToken += 1;
    return token;
  };
}

function assertBackendError(callback, code, inspect = () => {}) {
  assert.throws(callback, (error) => {
    assert.equal(error instanceof ProfileBackendError, true);
    assert.equal(error.code, code);
    inspect(error);
    return true;
  });
}
