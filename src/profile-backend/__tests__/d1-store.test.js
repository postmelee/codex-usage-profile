import assert from "node:assert/strict";
import test from "node:test";

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

test("D1 store round-trips structured records and JSON fields", async (t) => {
  const fixture = await createD1TestFixture();
  t.after(() => fixture.dispose());
  await fixture.migrate();

  const owner = ownerFixture();
  const usage = usageFixture();
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
  assert.deepEqual(await fixture.rpc("saveLatestUsage", usage), usage);
  assert.deepEqual(await fixture.rpc("saveCliToken", token), token);
  assert.deepEqual(await fixture.rpc("getOwnerByProviderIdentity", "github", "1"), owner);
  assert.deepEqual(await fixture.rpc("getLatestUsageByHandle", owner.handle), usage);
  assert.deepEqual(await fixture.rpc("getCliTokenByDigest", token.tokenDigest), token);

  const exported = await fixture.rpc("exportState");
  assert.equal(exported.schemaVersion, 1);
  assert.deepEqual(exported.owners, [owner]);
  assert.deepEqual(exported.latestUsages, [usage]);
  assert.deepEqual(exported.cliTokens, [token]);
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
