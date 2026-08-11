import assert from "node:assert/strict";
import test from "node:test";

import {
  createD1TestFixture,
  ownerFixture,
  usageFixture
} from "./_d1-test-fixture.js";
import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError,
  createCliLoginService
} from "../index.js";

const NOW = "2026-07-23T00:00:10.000Z";
const EXPIRES = "2026-07-23T00:10:00.000Z";

test("D1 named operations preserve all five invariants under concurrency", async (t) => {
  const fixture = await createD1TestFixture();
  t.after(() => fixture.dispose());
  await fixture.migrate();

  await t.test("completeOAuthCallback consumes one state and commits one session", async () => {
    await fixture.rpc("clear");
    await fixture.rpc("saveOAuthState", oauthState());
    const owner = ownerFixture();
    const results = await settle([
      fixture.atomic("completeOAuthCallback", {
        stateId: "oauth_state_1",
        now: NOW,
        owner,
        session: session("session_a")
      }),
      fixture.atomic("completeOAuthCallback", {
        stateId: "oauth_state_1",
        now: NOW,
        owner,
        session: session("session_b")
      })
    ]);

    assertOneWinner(results, "gone");
    const state = await fixture.rpc("getOAuthState", "oauth_state_1");
    assert.equal(state.status, "consumed");
    assert.equal(
      [await fixture.rpc("getSession", "session_a"),
        await fixture.rpc("getSession", "session_b")]
        .filter(Boolean).length,
      1
    );
  });

  await t.test("approveCliLogin chooses one owner for a pending challenge", async () => {
    await fixture.rpc("clear");
    await fixture.rpc("saveOwner", ownerFixture({
      id: "owner_a",
      providerUserId: "a",
      handle: "owner-a"
    }));
    await fixture.rpc("saveOwner", ownerFixture({
      id: "owner_b",
      providerUserId: "b",
      handle: "owner-b"
    }));
    await fixture.rpc("saveCliLoginChallenge", challenge());

    const results = await settle([
      fixture.atomic("approveCliLogin", {
        challengeId: "challenge_1",
        ownerId: "owner_a",
        now: NOW
      }),
      fixture.atomic("approveCliLogin", {
        challengeId: "challenge_1",
        ownerId: "owner_b",
        now: NOW
      })
    ]);
    assertOneWinner(results, "invalid_request");
    const stored = await fixture.rpc("getCliLoginChallenge", "challenge_1");
    assert.equal(stored.status, "approved");
    assert.equal(["owner_a", "owner_b"].includes(stored.ownerId), true);
  });

  await t.test("approveCliLogin recovers fast same-owner replay without a token", async () => {
    await fixture.rpc("clear");
    await fixture.rpc("saveOwner", ownerFixture({
      id: "owner_a",
      providerUserId: "a",
      handle: "owner-a"
    }));
    await fixture.rpc("saveOwner", ownerFixture({
      id: "owner_b",
      providerUserId: "b",
      handle: "owner-b"
    }));
    await fixture.rpc("saveCliLoginChallenge", challenge());
    const service = createCliLoginService({
      store: createD1CliLoginStore(fixture),
      now: () => new Date(NOW),
      tokenService: {}
    });

    const approved = await Promise.all([
      service.approveCliLogin({
        challengeId: "challenge_1",
        ownerId: "owner_a"
      }),
      service.approveCliLogin({
        challengeId: "challenge_1",
        ownerId: "owner_a"
      })
    ]);

    assert.deepEqual(approved[1], approved[0]);
    assert.equal(approved[0].status, "approved");
    assert.equal(
      (await fixture.rpc("listCliTokensByOwnerId", "owner_a")).length,
      0
    );
    await assert.rejects(
      () => service.approveCliLogin({
        challengeId: "challenge_1",
        ownerId: "owner_b"
      }),
      (error) => error.code === PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST
    );
  });

  await t.test("exchangeCliLogin issues one token and rolls back the loser", async () => {
    await fixture.rpc("clear");
    await fixture.rpc("saveOwner", ownerFixture());
    await fixture.rpc("saveCliLoginChallenge", challenge({
      status: "approved",
      ownerId: "owner_1",
      approvedAt: NOW
    }));

    const results = await settle([
      fixture.atomic("exchangeCliLogin", exchangeCommand("token_a")),
      fixture.atomic("exchangeCliLogin", exchangeCommand("token_b"))
    ]);
    assertOneWinner(results, "gone");
    assert.equal(
      (await fixture.rpc("listCliTokensByOwnerId", "owner_1")).length,
      1
    );
    const stored = await fixture.rpc("getCliLoginChallenge", "challenge_1");
    assert.equal(stored.status, "exchanged");
    assert.equal(["token_a", "token_b"].includes(stored.cliTokenId), true);
  });

  await t.test("submitAccountUsage commits one same-time content and one device", async () => {
    await fixture.rpc("clear");
    await fixture.rpc("saveOwner", ownerFixture());
    const results = await settle([
      fixture.atomic("submitAccountUsage", usageCommand("digest_a", "device_a")),
      fixture.atomic("submitAccountUsage", usageCommand("digest_b", "device_b"))
    ]);

    assertOneWinner(results, "conflict");
    const stored = await fixture.rpc("getLatestUsageByOwnerId", "owner_1");
    assert.equal(["digest_a", "digest_b"].includes(stored.contentDigest), true);
    assert.equal(
      (await fixture.rpc("listSubmittedDevicesByOwnerId", "owner_1")).length,
      1
    );
  });

  await t.test("updateVisibility rejects a lost update and keeps all records aligned", async () => {
    await fixture.rpc("clear");
    await fixture.rpc("saveOwner", ownerFixture());
    await fixture.rpc("saveLatestUsage", usageFixture());
    await fixture.rpc("saveLatestSnapshot", {
      ownerId: "owner_1",
      handle: "postmelee",
      visibility: "private",
      capturedAt: "2026-07-23T00:00:00.000Z",
      uploadedAt: "2026-07-23T00:00:01.000Z",
      schemaVersion: 1,
      snapshot: { schemaVersion: 1 }
    });

    const base = {
      ownerId: "owner_1",
      expectedOwnerUpdatedAt: "2026-07-23T00:00:00.000Z",
      updatedAt: NOW
    };
    const results = await settle([
      fixture.atomic("updateVisibility", { ...base, visibility: "public" }),
      fixture.atomic("updateVisibility", { ...base, visibility: "private" })
    ]);
    assertOneWinner(results, "conflict");

    const owner = await fixture.rpc("getOwnerById", "owner_1");
    const usage = await fixture.rpc("getLatestUsageByOwnerId", "owner_1");
    const snapshot = await fixture.rpc("getLatestSnapshotByOwnerId", "owner_1");
    assert.equal(usage.visibility, owner.visibility);
    assert.equal(snapshot.visibility, owner.visibility);
  });

  assert.deepEqual(await fixture.inspect("atomicClaims"), {
    assertions: [],
    claims: []
  });
});

function oauthState() {
  return {
    id: "oauth_state_1",
    provider: "github",
    status: "pending",
    cliLoginChallengeId: null,
    redirectTo: null,
    createdAt: "2026-07-23T00:00:00.000Z",
    expiresAt: EXPIRES,
    consumedAt: null,
    ownerId: null,
    sessionId: null
  };
}

function session(id) {
  return {
    id,
    ownerId: "owner_1",
    createdAt: NOW,
    expiresAt: "2026-08-23T00:00:00.000Z",
    revokedAt: null
  };
}

function challenge(overrides = {}) {
  return {
    id: "challenge_1",
    status: "pending",
    label: null,
    intent: null,
    redirectUri: null,
    deviceCodeDigest: "device_digest_1",
    userCode: "ABCD-1234",
    verificationUri: "/device",
    verificationUriComplete: "/device?user_code=ABCD-1234",
    intervalSeconds: 5,
    createdAt: "2026-07-23T00:00:00.000Z",
    expiresAt: EXPIRES,
    approvedAt: null,
    exchangedAt: null,
    ownerId: null,
    cliTokenId: null,
    ...overrides
  };
}

function createD1CliLoginStore(fixture) {
  return {
    getCliLoginChallenge(challengeId) {
      return fixture.rpc("getCliLoginChallenge", challengeId);
    },
    saveCliLoginChallenge(challenge) {
      return fixture.rpc("saveCliLoginChallenge", challenge);
    },
    atomic: {
      async approveCliLogin(command) {
        try {
          return await fixture.atomic("approveCliLogin", command);
        } catch (error) {
          if (error?.code) {
            throw new ProfileBackendError(error.code, error.message, {
              status: error.status
            });
          }
          throw error;
        }
      }
    }
  };
}

function exchangeCommand(id) {
  return {
    challengeId: "challenge_1",
    now: NOW,
    token: `raw_${id}`,
    tokenRecord: {
      id,
      ownerId: "owner_1",
      tokenDigest: `${id}_digest`,
      label: null,
      scopes: ["snapshot:write"],
      sourceChallengeId: "challenge_1",
      createdAt: NOW,
      expiresAt: "2027-07-23T00:00:00.000Z",
      revokedAt: null,
      lastUsedAt: null
    },
    maxActiveTokens: 10
  };
}

function usageCommand(contentDigest, deviceKey) {
  return {
    ownerId: "owner_1",
    tokenRecord: null,
    document: {
      contractVersion: 1,
      capturedAt: "2026-07-23T00:00:00.000Z"
    },
    usage: {
      summary: { lifetimeTokens: contentDigest === "digest_a" ? 1 : 2 },
      dailyUsageBuckets: []
    },
    contentDigest,
    expectedLegacyContentDigest: null,
    uploadedAt: NOW,
    device: {
      deviceKey,
      displayName: deviceKey
    },
    deviceId: `submitted_${deviceKey}`
  };
}

async function settle(promises) {
  return Promise.allSettled(promises);
}

function assertOneWinner(results, losingCode) {
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.code, losingCode);
}
