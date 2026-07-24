import assert from "node:assert/strict";
import test from "node:test";

import {
  assertProfileMaintenanceBackup,
  createProfileMaintenanceBackup
} from "../maintenance-contract.js";
import {
  createD1TestFixture,
  ownerFixture,
  usageFixture
} from "./_d1-test-fixture.js";

test("D1 maintenance exports only durable owner data and restores idempotently", async (t) => {
  const fixture = await createD1TestFixture();
  t.after(() => fixture.dispose());
  await fixture.migrate();
  await seedCompleteOwner(fixture);

  const profile = await fixture.maintenance("exportOwner", OWNER_SCOPE);
  const serialized = JSON.stringify(profile);
  assert.equal(profile.owner.id, OWNER_SCOPE.ownerId);
  assert.equal(profile.latestUsage.contentDigest, "digest_1");
  assert.equal(profile.submittedDevices.length, 1);
  assert.doesNotMatch(
    serialized,
    /oauthStates|sessions|cliLoginChallenges|cliTokens|tokenDigest|deviceCodeDigest/
  );
  assert.doesNotMatch(serialized, /secret-token-digest|secret-device-digest/);

  const backup = await createProfileMaintenanceBackup({
    createdAt: NOW,
    profiles: [{ ...profile, publication: null }]
  });
  assert.deepEqual(
    await assertProfileMaintenanceBackup(structuredClone(backup)),
    backup
  );

  const target = await createD1TestFixture();
  t.after(() => target.dispose());
  await target.migrate();
  const first = await target.maintenance("restoreOwner", {
    profile: backup.profiles[0]
  });
  const second = await target.maintenance("restoreOwner", {
    profile: backup.profiles[0]
  });

  assert.equal(first.idempotent, false);
  assert.equal(first.profile.owner.visibility, "private");
  assert.equal(second.idempotent, true);
  await target.maintenance("quiesceOwner", OWNER_SCOPE);
  const afterQuiesce = await target.maintenance("restoreOwner", {
    profile: backup.profiles[0]
  });
  assert.equal(afterQuiesce.idempotent, true);
  assert.equal((await target.rpc("getSession", "session_1")), null);
  assert.equal((await target.rpc("getCliTokenById", "token_1")), null);
});

test("D1 account deletion requires an exact plan and removes owner-dependent rows atomically", async (t) => {
  const fixture = await createD1TestFixture();
  t.after(() => fixture.dispose());
  await fixture.migrate();
  await seedCompleteOwner(fixture);

  const initial = await fixture.maintenance("planOwnerDeletion", OWNER_SCOPE);
  assert.deepEqual(initial.counts, {
    cliLoginChallenges: 1,
    cliTokens: 1,
    latestSnapshots: 1,
    latestUsages: 1,
    oauthStates: 1,
    owners: 1,
    rateLimits: 2,
    sessions: 1,
    submittedDevices: 1
  });

  await fixture.rpc("saveLatestUsage", usageFixture({
    contentDigest: "digest_changed",
    uploadedAt: "2026-07-23T00:00:02.000Z"
  }));
  await assert.rejects(
    fixture.maintenance("deleteOwner", {
      ...OWNER_SCOPE,
      expectedContentDigest: initial.summary.contentDigest,
      expectedObjectCount: initial.summary.objectCount
    }),
    /plan no longer matches/
  );
  assert.equal((await fixture.rpc("getOwnerById", OWNER_SCOPE.ownerId)).id, OWNER_SCOPE.ownerId);

  const privateProfile = await fixture.maintenance("quiesceOwner", OWNER_SCOPE);
  assert.equal(privateProfile.owner.visibility, "private");
  assert.equal(privateProfile.latestUsage.visibility, "private");
  assert.equal(privateProfile.latestSnapshot.visibility, "private");
  const current = await fixture.maintenance("planOwnerDeletion", OWNER_SCOPE);
  await fixture.maintenance("deleteOwner", {
    ...OWNER_SCOPE,
    expectedContentDigest: current.summary.contentDigest,
    expectedObjectCount: current.summary.objectCount
  });

  assert.equal(await fixture.rpc("getOwnerById", OWNER_SCOPE.ownerId), null);
  assert.equal(await fixture.rpc("getLatestUsageByOwnerId", OWNER_SCOPE.ownerId), null);
  assert.equal(await fixture.rpc("getSession", "session_1"), null);
  assert.deepEqual(await fixture.inspect("rateLimits"), []);
});

test("D1 retention deletes only exact expired or revoked transient rows", async (t) => {
  const fixture = await createD1TestFixture();
  t.after(() => fixture.dispose());
  await fixture.migrate();
  await seedCompleteOwner(fixture);
  await fixture.rpc("saveSession", {
    id: "session_fresh",
    ownerId: OWNER_SCOPE.ownerId,
    createdAt: NOW,
    expiresAt: "2026-09-01T00:00:00.000Z",
    revokedAt: null
  });
  await fixture.rpc("saveCliToken", {
    id: "token_fresh",
    ownerId: OWNER_SCOPE.ownerId,
    tokenDigest: "fresh-token-digest",
    label: "fresh",
    scopes: ["profile:submit"],
    sourceChallengeId: null,
    createdAt: NOW,
    expiresAt: "2026-09-01T00:00:00.000Z",
    revokedAt: null,
    lastUsedAt: null
  });

  const plan = await fixture.maintenance("planRetention", {
    now: "2026-07-23T00:00:00.000Z",
    retentionDays: 30
  });
  assert.equal(plan.summary.objectCount, 6);
  assert.deepEqual(plan.candidates.sessions, ["session_1"]);
  assert.deepEqual(plan.candidates.cliTokens, ["token_1"]);

  await assert.rejects(
    fixture.maintenance("applyRetention", {
      now: "2026-07-23T00:00:00.000Z",
      retentionDays: 30,
      expectedContentDigest: plan.summary.contentDigest,
      expectedObjectCount: plan.summary.objectCount + 1
    }),
    /plan no longer matches/
  );
  assert.notEqual(await fixture.rpc("getSession", "session_1"), null);

  await fixture.maintenance("applyRetention", {
    now: "2026-07-23T00:00:00.000Z",
    retentionDays: 30,
    expectedContentDigest: plan.summary.contentDigest,
    expectedObjectCount: plan.summary.objectCount
  });
  assert.equal(await fixture.rpc("getSession", "session_1"), null);
  assert.equal(await fixture.rpc("getCliTokenById", "token_1"), null);
  assert.notEqual(await fixture.rpc("getSession", "session_fresh"), null);
  assert.notEqual(await fixture.rpc("getCliTokenById", "token_fresh"), null);
});

test("maintenance backup rejects schema changes and forbidden authentication state", async () => {
  const profile = {
    latestSnapshot: null,
    latestUsage: null,
    owner: ownerFixture(),
    publication: null,
    submittedDevices: []
  };
  const backup = await createProfileMaintenanceBackup({
    createdAt: NOW,
    profiles: [profile]
  });

  await assert.rejects(
    assertProfileMaintenanceBackup({ ...backup, schemaVersion: 2 }),
    /schema version is unsupported/
  );
  await assert.rejects(
    createProfileMaintenanceBackup({
      createdAt: NOW,
      profiles: [{
        ...profile,
        submittedDevices: [{ id: "device_1", tokenDigest: "forbidden" }]
      }]
    }),
    /forbidden field/
  );
});

async function seedCompleteOwner(fixture) {
  await fixture.rpc("saveOwner", ownerFixture({ visibility: "public" }));
  await fixture.rpc("saveLatestUsage", usageFixture({ visibility: "public" }));
  await fixture.rpc("saveLatestSnapshot", {
    ownerId: OWNER_SCOPE.ownerId,
    handle: OWNER_SCOPE.handle,
    visibility: "public",
    capturedAt: NOW,
    uploadedAt: "2026-07-23T00:00:01.000Z",
    schemaVersion: 1,
    snapshot: { schemaVersion: 1, profile: { handle: OWNER_SCOPE.handle } }
  });
  await fixture.rpc("saveSubmittedDevice", {
    id: "device_1",
    ownerId: OWNER_SCOPE.ownerId,
    deviceKey: "device-key",
    displayName: "Mac",
    createdAt: NOW,
    updatedAt: NOW,
    lastSubmittedAt: NOW
  });
  await fixture.rpc("saveOAuthState", {
    id: "oauth_state_1",
    provider: "github",
    status: "consumed",
    cliLoginChallengeId: null,
    redirectTo: "/settings",
    createdAt: "2026-05-01T00:00:00.000Z",
    expiresAt: "2026-05-01T00:10:00.000Z",
    consumedAt: "2026-05-01T00:01:00.000Z",
    ownerId: OWNER_SCOPE.ownerId,
    sessionId: "session_1"
  });
  await fixture.rpc("saveSession", {
    id: "session_1",
    ownerId: OWNER_SCOPE.ownerId,
    createdAt: "2026-05-01T00:00:00.000Z",
    expiresAt: "2026-05-02T00:00:00.000Z",
    revokedAt: null
  });
  await fixture.rpc("saveCliLoginChallenge", {
    id: "challenge_1",
    status: "exchanged",
    label: "CLI",
    redirectUri: null,
    deviceCodeDigest: "secret-device-digest",
    userCode: "ABCD-EFGH",
    verificationUri: "https://profile.example/device",
    verificationUriComplete: "https://profile.example/device?code=ABCD-EFGH",
    intervalSeconds: 5,
    createdAt: "2026-05-01T00:00:00.000Z",
    expiresAt: "2026-05-01T00:10:00.000Z",
    approvedAt: "2026-05-01T00:01:00.000Z",
    exchangedAt: "2026-05-01T00:02:00.000Z",
    ownerId: OWNER_SCOPE.ownerId,
    cliTokenId: "token_1"
  });
  await fixture.rpc("saveCliToken", {
    id: "token_1",
    ownerId: OWNER_SCOPE.ownerId,
    tokenDigest: "secret-token-digest",
    label: "CLI",
    scopes: ["profile:submit"],
    sourceChallengeId: "challenge_1",
    createdAt: "2026-05-01T00:00:00.000Z",
    expiresAt: "2026-05-03T00:00:00.000Z",
    revokedAt: "2026-05-02T00:00:00.000Z",
    lastUsedAt: null
  });
  await fixture.rate("token_1", "2026-05-01T00:00:00.000Z", {
    burstLimit: 10,
    burstWindowMs: 60_000,
    sustainedLimit: 10,
    sustainedWindowMs: 3_600_000
  });
}

const OWNER_SCOPE = Object.freeze({
  ownerId: "owner_1",
  handle: "postmelee"
});
const NOW = "2026-07-23T00:00:00.000Z";
