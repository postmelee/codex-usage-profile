import assert from "node:assert/strict";
import test from "node:test";

import {
  createProfileMaintenanceSummary
} from "../../../profile-backend/maintenance-contract.js";
import {
  createProfileSitesMaintenanceHandler,
  createProfileSitesMaintenanceService
} from "../maintenance.js";

test("maintenance route is a generic 404 unless every security gate passes", async () => {
  let serviceCreations = 0;
  const createService = () => {
    serviceCreations += 1;
    return createStubService();
  };
  const cases = [
    {
      config: {},
      headers: authorizedHeaders()
    },
    {
      config: { maintenanceEnabled: true, maintenanceToken: null },
      headers: authorizedHeaders()
    },
    {
      config: enabledConfig(),
      headers: authorizedHeaders({ authorization: "Bearer wrong" })
    },
    {
      config: enabledConfig(),
      headers: authorizedHeaders({ origin: "https://other.example" })
    }
  ];

  for (const item of cases) {
    const response = await createProfileSitesMaintenanceHandler({
      config: item.config,
      createService
    })(new Request(MAINTENANCE_URL, {
      method: "POST",
      headers: item.headers,
      body: JSON.stringify({ operation: "plan" })
    }));
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: { code: "not_found", message: "Not found" }
    });
  }

  const insecure = await createProfileSitesMaintenanceHandler({
    config: enabledConfig(),
    createService
  })(new Request("http://profile.example/__ops/profile-maintenance", {
    method: "POST",
    headers: authorizedHeaders({ origin: "http://profile.example" }),
    body: JSON.stringify({ operation: "plan" })
  }));
  assert.equal(insecure.status, 404);
  assert.equal(serviceCreations, 0);
});

test("maintenance route accepts only same-origin bounded JSON after authentication", async () => {
  const service = createStubService();
  const handler = createProfileSitesMaintenanceHandler({
    bodyMaxBytes: 80,
    config: enabledConfig(),
    service
  });
  const valid = await handler(new Request(MAINTENANCE_URL, {
    method: "POST",
    headers: authorizedHeaders(),
    body: JSON.stringify({
      operation: "plan",
      ownerId: "owner_1",
      handle: "postmelee"
    })
  }));
  assert.equal(valid.status, 200);
  assert.equal((await valid.json()).summary.operation, "plan");

  const unsupported = await handler(new Request(MAINTENANCE_URL, {
    method: "POST",
    headers: authorizedHeaders({ "content-type": "text/plain" }),
    body: "{}"
  }));
  assert.equal(unsupported.status, 415);

  const oversized = await handler(new Request(MAINTENANCE_URL, {
    method: "POST",
    headers: authorizedHeaders(),
    body: JSON.stringify({ operation: "plan", padding: "x".repeat(100) })
  }));
  assert.equal(oversized.status, 400);
});

test("bad maintenance tokens of different lengths produce the same safe response", async () => {
  const handler = createProfileSitesMaintenanceHandler({
    config: enabledConfig(),
    service: createStubService()
  });
  const responses = await Promise.all(["x", "x".repeat(200)].map(async (token) => {
    const response = await handler(new Request(MAINTENANCE_URL, {
      method: "POST",
      headers: authorizedHeaders({ authorization: `Bearer ${token}` }),
      body: JSON.stringify({ operation: "plan" })
    }));
    return {
      body: await response.text(),
      status: response.status
    };
  }));
  assert.deepEqual(responses[0], responses[1]);
  assert.doesNotMatch(responses[0].body, /maintenance-secret|Bearer/);
});

test("account deletion fails closed after tombstone and private transition", async () => {
  const calls = [];
  const fixture = await createServiceFixture({
    calls,
    failRevisionDelete: true
  });
  const plan = await fixture.service.planOwner(OWNER_SCOPE);

  await assert.rejects(
    fixture.service.deleteAccount({
      ...OWNER_SCOPE,
      apply: true,
      confirmOwner: OWNER_SCOPE,
      expectedContentDigest: plan.summary.contentDigest,
      expectedObjectCount: plan.summary.objectCount
    }),
    /injected media delete failure/
  );

  assert.equal(calls.includes("r2.tombstone"), true);
  assert.equal(calls.includes("d1.quiesce"), true);
  assert.equal(calls.includes("d1.delete"), false);
  assert.equal(
    calls.indexOf("r2.tombstone") < calls.indexOf("d1.quiesce"),
    true
  );
});

test("account deletion uses exact confirmation and completes in safe order", async () => {
  const calls = [];
  const fixture = await createServiceFixture({ calls });
  const plan = await fixture.service.planOwner(OWNER_SCOPE);
  await assert.rejects(
    fixture.service.deleteAccount({
      ...OWNER_SCOPE,
      apply: true,
      confirmOwner: { ...OWNER_SCOPE, handle: "another" },
      expectedContentDigest: plan.summary.contentDigest,
      expectedObjectCount: plan.summary.objectCount
    }),
    /exact owner confirmation/
  );
  assert.equal(calls.includes("r2.tombstone"), false);

  const deleted = await fixture.service.deleteAccount({
    ...OWNER_SCOPE,
    apply: true,
    confirmOwner: OWNER_SCOPE,
    expectedContentDigest: plan.summary.contentDigest,
    expectedObjectCount: plan.summary.objectCount
  });
  assert.deepEqual(
    calls.filter((call) => [
      "r2.tombstone",
      "d1.quiesce",
      "r2.delete",
      "d1.delete"
    ].includes(call)),
    ["r2.tombstone", "d1.quiesce", "r2.delete", "d1.delete"]
  );
  assert.equal(deleted.summary.operation, "delete-account");
});

test("public restore stages D1 privately before publication", async () => {
  const calls = [];
  const fixture = await createServiceFixture({ calls });
  const exported = await fixture.service.exportOwner(OWNER_SCOPE);

  await fixture.service.restoreOwner({
    ...OWNER_SCOPE,
    apply: true,
    backup: exported.backup,
    confirmOwner: OWNER_SCOPE,
    expectedContentDigest: exported.summary.contentDigest,
    expectedObjectCount: exported.summary.objectCount
  });

  assert.deepEqual(
    calls.filter((call) => ["d1.restore", "publication.publish"].includes(call)),
    ["d1.restore", "publication.publish"]
  );
});

async function createServiceFixture(options = {}) {
  const digestA = "A".repeat(43);
  const digestB = "B".repeat(43);
  const calls = options.calls ?? [];
  const structuredPlan = {
    profile: durableProfile(),
    summary: createProfileMaintenanceSummary({
      contentDigest: digestA,
      createdAt: NOW,
      objectCount: 4,
      operation: "delete-account",
      ownerCount: 1
    })
  };
  const mediaPlan = {
    manifest: mediaManifest(),
    summary: createProfileMaintenanceSummary({
      contentDigest: digestB,
      createdAt: NOW,
      objectCount: 3,
      operation: "delete-account",
      ownerCount: 1
    })
  };
  const d1Maintenance = {
    async exportOwner() {
      calls.push("d1.export");
      return durableProfile();
    },
    async planOwnerDeletion() {
      calls.push("d1.plan");
      return structuredPlan;
    },
    async quiesceOwner() {
      calls.push("d1.quiesce");
      return { ...durableProfile(), owner: { ...OWNER, visibility: "private" } };
    },
    async deleteOwner() {
      calls.push("d1.delete");
      return structuredPlan;
    },
    async restoreOwner() {
      calls.push("d1.restore");
      return {
        desiredVisibility: "public",
        idempotent: false,
        profile: durableProfile()
      };
    },
    async planRetention() {
      return {
        summary: createProfileMaintenanceSummary({
          contentDigest: digestA,
          createdAt: NOW,
          objectCount: 0,
          operation: "retention",
          ownerCount: 0
        })
      };
    },
    async applyRetention() {}
  };
  const r2Maintenance = {
    async listOwnerManifest() {
      calls.push("r2.manifest");
      return mediaManifest();
    },
    async planOwnerDeletion() {
      calls.push("r2.plan");
      return mediaPlan;
    },
    async tombstoneOwnerPublication() {
      calls.push("r2.tombstone");
      return {
        stable: {
          kind: "unpublished",
          stableKey: "cards/v2/public/postmelee/card.png",
          storageEtag: "tombstone-etag"
        }
      };
    },
    async deleteOwnerRevisions() {
      calls.push("r2.delete");
      if (options.failRevisionDelete) {
        throw new Error("injected media delete failure");
      }
      return mediaPlan;
    },
    async planRetention() {
      return {
        summary: createProfileMaintenanceSummary({
          contentDigest: digestB,
          createdAt: NOW,
          objectCount: 0,
          operation: "retention",
          ownerCount: 0
        })
      };
    },
    async applyRetention() {}
  };
  const store = {
    atomic: {
      async updateVisibility() {}
    },
    async getOwnerById() {
      return OWNER;
    }
  };
  const mediaStore = {
    async putRevision() {},
    async unpublishCard() {}
  };
  const service = createProfileSitesMaintenanceService({
    database: { batch() {}, prepare() {} },
    media: { delete() {}, head() {}, list() {} },
    mediaStore,
    store,
    d1Maintenance,
    r2Maintenance,
    cardService: {
      async renderOwnerCard() {
        return {
          body: Buffer.from("card"),
          etag: `"${"C".repeat(43)}"`,
          revision: "C".repeat(43)
        };
      }
    },
    publicationService: {
      async publishOwnerCard() {
        calls.push("publication.publish");
      }
    },
    now: () => new Date(NOW)
  });
  return { service };
}

function createStubService() {
  return {
    async planOwner() {
      return {
        summary: {
          contentDigest: "A".repeat(43),
          contractVersion: 1,
          createdAt: NOW,
          objectCount: 0,
          operation: "plan",
          ownerCount: 0,
          schemaVersion: 1
        }
      };
    }
  };
}

function durableProfile() {
  return {
    latestSnapshot: null,
    latestUsage: {
      ownerId: OWNER.id,
      handle: OWNER.handle,
      visibility: "public",
      contractVersion: 1,
      capturedAt: NOW,
      uploadedAt: NOW,
      contentDigest: "usage-digest",
      usage: { summary: { lifetimeTokens: 1 } }
    },
    owner: { ...OWNER },
    publication: null,
    submittedDevices: []
  };
}

function mediaManifest() {
  const revision = "C".repeat(43);
  return {
    ownerId: OWNER.id,
    handle: OWNER.handle,
    revisions: [
      { key: `cards/v2/owners/${OWNER.id}/revisions/en/${revision}.png` },
      { key: `cards/v2/owners/${OWNER.id}/revisions/ko/${revision}.png` }
    ],
    stable: {
      kind: "publication",
      publication: {
        handle: OWNER.handle,
        ownerId: OWNER.id,
        publicationId: "publication_1",
        publishedAt: NOW,
        representations: {
          en: { etag: `"${revision}"`, revision },
          ko: { etag: `"${revision}"`, revision }
        }
      },
      stableKey: "cards/v2/public/postmelee/card.png",
      storageEtag: "stable-etag"
    }
  };
}

function authorizedHeaders(overrides = {}) {
  return {
    authorization: "Bearer maintenance-secret",
    "content-type": "application/json",
    origin: "https://profile.example",
    ...overrides
  };
}

function enabledConfig() {
  return {
    maintenanceEnabled: true,
    maintenanceToken: "maintenance-secret"
  };
}

const OWNER_SCOPE = Object.freeze({
  ownerId: "owner_1",
  handle: "postmelee"
});
const NOW = "2026-07-24T00:00:00.000Z";
const OWNER = Object.freeze({
  id: OWNER_SCOPE.ownerId,
  authProvider: "github",
  providerUserId: "1",
  githubLogin: "postmelee",
  displayName: "Post Melee",
  avatarUrl: null,
  profileUrl: "https://github.com/postmelee",
  handle: OWNER_SCOPE.handle,
  visibility: "public",
  createdAt: NOW,
  updatedAt: NOW
});
const MAINTENANCE_URL =
  "https://profile.example/__ops/profile-maintenance";
