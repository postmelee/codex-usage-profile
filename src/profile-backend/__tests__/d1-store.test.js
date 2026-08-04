import assert from "node:assert/strict";
import test from "node:test";

import { loadD1Migrations } from "../d1/migrate.js";
import {
  createD1TestFixture,
  ownerFixture,
  usageFixture
} from "./_d1-test-fixture.js";

test("D1 store satisfies contract v2 without a generic transaction", async (t) => {
  const fixture = await createD1TestFixture();
  t.after(() => fixture.dispose());
  await fixture.migrate();

  assert.deepEqual(await fixture.call("/contract"), {
    hasAtomic: true,
    hasTransaction: false
  });
});

test("D1 store readiness rejects missing versions but permits higher versions", async (t) => {
  const fixture = await createD1TestFixture();
  t.after(() => fixture.dispose());
  const migrations = await loadD1Migrations();

  await fixture.call("/migrate", {
    migrations: migrations.filter(({ version }) => version !== 2),
    now: "2026-07-23T00:00:00.000Z"
  });
  await assert.rejects(
    () => fixture.rpc("verifyReadiness"),
    /D1 store is missing migrations: 2/
  );

  await fixture.call("/migrate", {
    migrations,
    now: "2026-07-23T00:01:00.000Z"
  });
  await fixture.call("/migrate", {
    migrations: [
      ...migrations,
      {
        version: 5,
        name: "future_rollback_compatibility",
        sql: "CREATE TABLE future_rollback_compatibility (id TEXT PRIMARY KEY)"
      }
    ],
    now: "2026-07-23T00:02:00.000Z"
  });
  assert.deepEqual(await fixture.rpc("verifyReadiness"), {
    appliedVersions: [1, 2, 3, 4, 5]
  });
});

test("D1 store round-trips structured records and JSON fields", async (t) => {
  const fixture = await createD1TestFixture();
  t.after(() => fixture.dispose());
  await fixture.migrate();

  const owner = ownerFixture();
  const usage = usageFixture();
  const challenge = {
    id: "challenge_1",
    status: "pending",
    label: "MacBook",
    intent: "submit",
    redirectUri: null,
    deviceCodeDigest: "device_digest_1",
    userCode: "ABCD-1234",
    verificationUri: "/device",
    verificationUriComplete: "/device?user_code=ABCD-1234",
    intervalSeconds: 5,
    createdAt: "2026-07-23T00:00:00.000Z",
    expiresAt: "2026-07-23T00:10:00.000Z",
    approvedAt: null,
    exchangedAt: null,
    ownerId: null,
    cliTokenId: null
  };
  const token = {
    id: "token_1",
    ownerId: owner.id,
    tokenDigest: "token_digest_1",
    label: "MacBook",
    scopes: ["snapshot:write"],
    sourceChallengeId: null,
    createdAt: "2026-07-23T00:00:00.000Z",
    expiresAt: "2027-07-23T00:00:00.000Z",
    revokedAt: null,
    lastUsedAt: null
  };

  assert.deepEqual(await fixture.rpc("saveOwner", owner), owner);
  assert.deepEqual(
    await fixture.rpc("saveCliLoginChallenge", challenge),
    challenge
  );
  assert.deepEqual(await fixture.rpc("saveLatestUsage", usage), usage);
  assert.deepEqual(await fixture.rpc("saveCliToken", token), token);
  assert.deepEqual(await fixture.rpc("getOwnerByProviderIdentity", "github", "1"), owner);
  assert.deepEqual(
    await fixture.rpc("getCliLoginChallenge", challenge.id),
    challenge
  );
  assert.deepEqual(await fixture.rpc("getLatestUsageByHandle", owner.handle), usage);
  assert.deepEqual(await fixture.rpc("getCliTokenByDigest", token.tokenDigest), token);

  const exported = await fixture.rpc("exportState");
  assert.equal(exported.schemaVersion, 1);
  assert.deepEqual(exported.owners, [owner]);
  assert.deepEqual(exported.cliLoginChallenges, [challenge]);
  assert.deepEqual(exported.latestUsages, [usage]);
  assert.deepEqual(exported.cliTokens, [token]);
});

test("D1 challenge intent constraint rejects unknown values", async (t) => {
  const fixture = await createD1TestFixture();
  t.after(() => fixture.dispose());
  await fixture.migrate();

  await assert.rejects(
    () => fixture.rpc("saveCliLoginChallenge", {
      id: "challenge_invalid",
      intent: "publish"
    }),
    /CHECK constraint failed/
  );
});

test("D1 atomically updates normalized owner card settings", async (t) => {
  const fixture = await createD1TestFixture();
  t.after(() => fixture.dispose());
  await fixture.migrate();
  await fixture.rpc("saveOwner", ownerFixture());
  const cardStyle = {
    schemaVersion: 1,
    theme: "light",
    effect: { preset: "none", version: 1 }
  };

  const result = await fixture.atomic("updateCardSettings", {
    ownerId: "owner_1",
    expectedOwnerUpdatedAt: "2026-07-23T00:00:00.000Z",
    cardStyle,
    updatedAt: "2026-07-23T00:00:01.000Z"
  });

  assert.deepEqual(result.cardStyle, cardStyle);
  assert.deepEqual(
    (await fixture.rpc("getOwnerById", "owner_1")).cardStyle,
    cardStyle
  );
  await assert.rejects(
    () => fixture.atomic("updateCardSettings", {
      ownerId: "owner_1",
      expectedOwnerUpdatedAt: "2026-07-23T00:00:00.000Z",
      cardStyle: { ...cardStyle, theme: "dark" },
      updatedAt: "2026-07-23T00:00:02.000Z"
    }),
    (error) => error.code === "conflict"
  );
});

test("D1 unique conflicts fail closed with the provider-neutral code", async (t) => {
  const fixture = await createD1TestFixture();
  t.after(() => fixture.dispose());
  await fixture.migrate();
  await fixture.rpc("saveOwner", ownerFixture());

  await assert.rejects(
    () => fixture.rpc("saveOwner", ownerFixture({
      id: "owner_2",
      providerUserId: "2"
    })),
    (error) => error.code === "conflict" && /Handle/.test(error.message)
  );
});
