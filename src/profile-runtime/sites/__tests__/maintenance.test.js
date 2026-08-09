import assert from "node:assert/strict";
import test from "node:test";

import {
  createProfileMaintenanceSummary
} from "../../../profile-backend/maintenance-contract.js";
import {
  D1_MIGRATION_MANIFEST
} from "../../../profile-backend/d1/migration-manifest.js";
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
      body: JSON.stringify({ operation: "readiness" })
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
    body: JSON.stringify({ operation: "readiness" })
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

test("maintenance readiness returns only exact version state without mutations", async () => {
  const calls = [];
  const database = readinessDatabase([1, 2, 3, 4, 5]);
  const fixture = await createServiceFixture({ calls, database });
  const handler = createProfileSitesMaintenanceHandler({
    config: enabledConfig(),
    service: fixture.service
  });
  const response = await handler(new Request(MAINTENANCE_URL, {
    method: "POST",
    headers: authorizedHeaders(),
    body: JSON.stringify({ operation: "readiness" })
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    summary: {
      appliedVersions: [1, 2, 3, 4, 5],
      expectedVersions: [1, 2, 3, 4, 5],
      operation: "readiness",
      ready: true
    }
  });
  assert.equal(database.batchCalls, 0);
  assert.deepEqual(calls, []);

  const extraPayload = await handler(new Request(MAINTENANCE_URL, {
    method: "POST",
    headers: authorizedHeaders(),
    body: JSON.stringify({
      operation: "readiness",
      ownerId: "private-owner"
    })
  }));
  assert.equal(extraPayload.status, 400);
  assert.doesNotMatch(
    await extraPayload.text(),
    /private-owner|usage|token|session|credential|r2/i
  );
});

test("maintenance readiness fails closed without provider details", async () => {
  const mismatch = await createServiceFixture({
    database: readinessDatabase([1, 3, 4])
  });
  const mismatchResponse = await createProfileSitesMaintenanceHandler({
    config: enabledConfig(),
    service: mismatch.service
  })(new Request(MAINTENANCE_URL, {
    method: "POST",
    headers: authorizedHeaders(),
    body: JSON.stringify({ operation: "readiness" })
  }));
  assert.equal(mismatchResponse.status, 503);
  assert.deepEqual(await mismatchResponse.json(), {
    ok: false,
    error: {
      code: "migration_not_ready",
      message: "Maintenance readiness check failed"
    }
  });

  const unmigratedDatabase = readinessDatabase([], {
    hasMigrationTable: false
  });
  const unmigrated = await createServiceFixture({
    database: unmigratedDatabase
  });
  const unmigratedResponse = await createProfileSitesMaintenanceHandler({
    config: enabledConfig(),
    service: unmigrated.service
  })(new Request(MAINTENANCE_URL, {
    method: "POST",
    headers: authorizedHeaders(),
    body: JSON.stringify({ operation: "readiness" })
  }));
  assert.equal(unmigratedResponse.status, 503);
  assert.deepEqual(await unmigratedResponse.json(), {
    ok: false,
    error: {
      code: "migration_not_ready",
      message: "Maintenance readiness check failed"
    }
  });
  assert.equal(unmigratedDatabase.versionReadCalls, 0);
  assert.equal(unmigratedDatabase.batchCalls, 0);

  const providerResponse = await createProfileSitesMaintenanceHandler({
    config: enabledConfig(),
    service: {
      async readiness() {
        throw new Error(
          "SQL failed for owner private-owner with usage and token bytes"
        );
      }
    }
  })(new Request(MAINTENANCE_URL, {
    method: "POST",
    headers: authorizedHeaders(),
    body: JSON.stringify({ operation: "readiness" })
  }));
  assert.equal(providerResponse.status, 503);
  const providerBody = await providerResponse.text();
  assert.match(providerBody, /maintenance_unavailable/);
  assert.doesNotMatch(providerBody, /SQL|private-owner|usage|token/i);
});

test("maintenance migration applies only the exact manifest and is idempotent", async () => {
  const expectedVersions = D1_MIGRATION_MANIFEST.map(({ version }) => version);
  let appliedVersions = [1, 2];
  let applyCalls = 0;
  const fixture = await createServiceFixture({
    database: { batch() {}, prepare() {} },
    migrations: candidateMigrations(),
    inspectD1MigrationReadiness: async () => migrationState(
      appliedVersions,
      expectedVersions
    ),
    reconcileHostedD1Migrations: async (_database, migrations) => migrations,
    migrateD1Database: async (_database, options) => {
      applyCalls += 1;
      assert.deepEqual(
        options.migrations.map(({ version, name }) => ({ version, name })),
        D1_MIGRATION_MANIFEST.map(({ version, name }) => ({ version, name }))
      );
      const newlyApplied = expectedVersions.filter(
        (version) => !appliedVersions.includes(version)
      );
      appliedVersions = [...expectedVersions];
      return { appliedVersions, newlyApplied };
    }
  });
  const handler = createProfileSitesMaintenanceHandler({
    config: enabledConfig(),
    service: fixture.service
  });

  const first = await handler(maintenanceRequest({ operation: "migrate" }));
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), {
    ok: true,
    summary: {
      appliedVersions: expectedVersions,
      newlyAppliedVersions: [3, 4, 5],
      operation: "migrate"
    }
  });

  const repeated = await handler(maintenanceRequest({ operation: "migrate" }));
  assert.equal(repeated.status, 200);
  assert.deepEqual((await repeated.json()).summary.newlyAppliedVersions, []);
  assert.equal(applyCalls, 2);

  const extraPayload = await handler(maintenanceRequest({
    operation: "migrate",
    ownerId: "private-owner"
  }));
  assert.equal(extraPayload.status, 400);
  assert.doesNotMatch(await extraPayload.text(), /private-owner|sql|token/i);
});

test("maintenance migration rejects unexpected versions before mutation", async () => {
  let applyCalls = 0;
  const expectedVersions = D1_MIGRATION_MANIFEST.map(({ version }) => version);
  const fixture = await createServiceFixture({
    database: { batch() {}, prepare() {} },
    migrations: candidateMigrations(),
    inspectD1MigrationReadiness: async () => migrationState(
      [...expectedVersions, 99],
      expectedVersions
    ),
    migrateD1Database: async () => {
      applyCalls += 1;
      throw new Error("must not run");
    }
  });
  const response = await createProfileSitesMaintenanceHandler({
    config: enabledConfig(),
    service: fixture.service
  })(maintenanceRequest({ operation: "migrate" }));

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: "maintenance_conflict",
      message: "Maintenance plan is stale or conflicts"
    }
  });
  assert.equal(applyCalls, 0);
});

test("maintenance migration reports only bounded stage failures", async () => {
  const expectedVersions = D1_MIGRATION_MANIFEST.map(({ version }) => version);
  const providerDetail =
    "SQL failed for private-owner with usage, token, and schema bytes";
  const cases = [
    {
      code: "migration_inspection_unavailable",
      message: "Maintenance migration inspection failed",
      options: {
        inspectD1MigrationReadiness: async () => {
          throw new Error(providerDetail);
        }
      }
    },
    {
      code: "migration_reconciliation_unavailable",
      message: "Maintenance migration reconciliation failed",
      options: {
        inspectD1MigrationReadiness: async () => migrationState(
          [1, 2],
          expectedVersions
        ),
        reconcileHostedD1Migrations: async () => {
          throw new Error(providerDetail);
        }
      }
    },
    {
      code: "migration_apply_unavailable",
      message: "Maintenance migration apply failed",
      options: {
        inspectD1MigrationReadiness: async () => migrationState(
          [1, 2],
          expectedVersions
        ),
        reconcileHostedD1Migrations: async (_database, migrations) =>
          migrations,
        migrateD1Database: async () => {
          throw new Error(providerDetail);
        }
      }
    },
    {
      code: "migration_verification_unavailable",
      message: "Maintenance migration verification failed",
      options: {
        inspectD1MigrationReadiness: (() => {
          let calls = 0;
          return async () => {
            calls += 1;
            if (calls === 1) {
              return migrationState([1, 2], expectedVersions);
            }
            throw new Error(providerDetail);
          };
        })(),
        reconcileHostedD1Migrations: async (_database, migrations) =>
          migrations,
        migrateD1Database: async () => ({
          newlyApplied: [3, 4, 5]
        })
      }
    }
  ];

  for (const item of cases) {
    const fixture = await createServiceFixture({
      database: { batch() {}, prepare() {} },
      migrations: candidateMigrations(),
      ...item.options
    });
    const response = await createProfileSitesMaintenanceHandler({
      config: enabledConfig(),
      service: fixture.service
    })(maintenanceRequest({ operation: "migrate" }));
    const body = await response.text();

    assert.equal(response.status, 503);
    assert.deepEqual(JSON.parse(body), {
      ok: false,
      error: { code: item.code, message: item.message }
    });
    assert.doesNotMatch(
      body,
      /SQL|private-owner|usage|token|schema bytes/i
    );
  }
});

test("maintenance migration bounds the exact failed apply kind and version", async () => {
  const expectedVersions = D1_MIGRATION_MANIFEST.map(({ version }) => version);
  for (const item of [
    {
      code: "migration_apply_sql_v3_unavailable",
      reconcile: async (_database, migrations) => migrations
    },
    {
      code: "migration_apply_metadata_v3_unavailable",
      reconcile: async (_database, migrations) => migrations.map(
        (migration) => migration.version === 3
          ? { ...migration, sql: "" }
          : migration
      )
    }
  ]) {
    const fixture = await createServiceFixture({
      database: { batch() {}, prepare() {} },
      migrations: candidateMigrations(),
      inspectD1MigrationReadiness: async () => migrationState(
        [1, 2],
        expectedVersions
      ),
      reconcileHostedD1Migrations: item.reconcile,
      migrateD1Database: async (_database, options) => {
        options.onProgress({ phase: "batch", version: 3 });
        throw new Error("provider SQL includes private-owner token bytes");
      }
    });
    const response = await createProfileSitesMaintenanceHandler({
      config: enabledConfig(),
      service: fixture.service
    })(maintenanceRequest({ operation: "migrate" }));
    const body = await response.text();

    assert.equal(response.status, 503);
    assert.deepEqual(JSON.parse(body), {
      ok: false,
      error: {
        code: item.code,
        message: "Maintenance migration apply failed"
      }
    });
    assert.doesNotMatch(body, /provider|private-owner|token|includes|bytes/i);
  }
});

test("maintenance migration rejects a partially hosted base schema", async () => {
  let applyCalls = 0;
  const expectedVersions = D1_MIGRATION_MANIFEST.map(({ version }) => version);
  const migrations = candidateMigrations();
  migrations[0].sql =
    "CREATE TABLE owners (id TEXT); CREATE TABLE sessions (id TEXT)";
  const database = {
    batch() {},
    prepare(sql) {
      assert.match(sql, /^SELECT type, name, sql FROM sqlite_master/u);
      return {
        bind(type, name) {
          return {
            async all() {
              return {
                results: name === "owners"
                  ? [{ type, name, sql: "CREATE TABLE owners (id TEXT)" }]
                  : []
              };
            }
          };
        }
      };
    }
  };
  const fixture = await createServiceFixture({
    database,
    migrations,
    inspectD1MigrationReadiness: async () => migrationState(
      [],
      expectedVersions
    ),
    migrateD1Database: async () => {
      applyCalls += 1;
    }
  });
  const response = await createProfileSitesMaintenanceHandler({
    config: enabledConfig(),
    service: fixture.service
  })(maintenanceRequest({ operation: "migrate" }));

  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "maintenance_conflict");
  assert.equal(applyCalls, 0);
});

test("maintenance migration rejects hosted schema drift before mutation", async () => {
  let applyCalls = 0;
  const expectedVersions = D1_MIGRATION_MANIFEST.map(({ version }) => version);
  const database = {
    batch() {},
    prepare(sql) {
      assert.match(sql, /^SELECT sql FROM sqlite_master/u);
      return {
        bind(table) {
          assert.equal(table, "cli_login_challenges");
          return {
            async all() {
              return {
                results: [{
                  sql: "CREATE TABLE cli_login_challenges (intent INTEGER)"
                }]
              };
            }
          };
        }
      };
    }
  };
  const fixture = await createServiceFixture({
    database,
    migrations: candidateMigrations(),
    inspectD1MigrationReadiness: async () => migrationState(
      [1, 2],
      expectedVersions
    ),
    migrateD1Database: async () => {
      applyCalls += 1;
      throw new Error("must not run");
    }
  });
  const response = await createProfileSitesMaintenanceHandler({
    config: enabledConfig(),
    service: fixture.service
  })(maintenanceRequest({ operation: "migrate" }));

  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "maintenance_conflict");
  assert.equal(applyCalls, 0);
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

test("publication repair stages every v4 variant before replacing authority", async () => {
  const calls = [];
  const fixture = await createServiceFixture({ calls });
  const plan = await fixture.service.planOwner(OWNER_SCOPE);
  const applicationEtag = `"${"C".repeat(43)}"`;

  const repaired = await fixture.service.repairPublication({
    ...OWNER_SCOPE,
    apply: true,
    confirmOwner: OWNER_SCOPE,
    expectedApplicationEtags: {
      dark: { en: applicationEtag, ko: applicationEtag },
      light: { en: applicationEtag, ko: applicationEtag }
    },
    expectedContentDigest: plan.summary.contentDigest,
    expectedObjectCount: plan.summary.objectCount,
    expectedStorageEtag: "legacy-storage-etag"
  });

  assert.deepEqual(
    calls.filter((call) => call.startsWith("media.put") || call === "r2.repair"),
    [
      "media.put.light.en",
      "media.put.light.ko",
      "media.put.dark.en",
      "media.put.dark.ko",
      "r2.repair"
    ]
  );
  assert.equal(repaired.summary.objectCount, 6);
  assert.equal(repaired.summary.operation, "repair-publication");
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
    async applyRetention() {},
    async repairPublication() {
      calls.push("r2.repair");
      return {
        stable: {
          kind: "publication",
          stableKey: "cards/v2/public/postmelee/card.png",
          storageEtag: "repaired-storage-etag"
        }
      };
    }
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
    async putRevision(revision) {
      calls.push(`media.put.${revision.theme}.${revision.locale}`);
    },
    async unpublishCard() {}
  };
  const service = createProfileSitesMaintenanceService({
    database: options.database ?? { batch() {}, prepare() {} },
    media: { delete() {}, head() {}, list() {} },
    mediaStore,
    migrations: options.migrations,
    inspectD1MigrationReadiness: options.inspectD1MigrationReadiness,
    migrateD1Database: options.migrateD1Database,
    reconcileHostedD1Migrations: options.reconcileHostedD1Migrations,
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
    async migrate() {
      return {
        summary: {
          appliedVersions: [1, 2, 3],
          newlyAppliedVersions: [],
          operation: "migrate"
        }
      };
    },
    async readiness() {
      return {
        summary: {
          appliedVersions: [1, 2, 3],
          expectedVersions: [1, 2, 3],
          operation: "readiness",
          ready: true
        }
      };
    },
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

function candidateMigrations() {
  return D1_MIGRATION_MANIFEST.map(({ version, name }) => ({
    version,
    name,
    sql: `SELECT ${version}`
  }));
}

function migrationState(appliedVersions, expectedVersions) {
  const expected = new Set(expectedVersions);
  const applied = new Set(appliedVersions);
  return {
    appliedVersions: [...appliedVersions],
    expectedVersions: [...expectedVersions],
    missingVersions: expectedVersions.filter((version) => !applied.has(version)),
    unexpectedVersions: appliedVersions.filter((version) => !expected.has(version)),
    readyExact:
      appliedVersions.length === expectedVersions.length &&
      appliedVersions.every((version, index) => version === expectedVersions[index])
  };
}

function maintenanceRequest(payload) {
  return new Request(MAINTENANCE_URL, {
    method: "POST",
    headers: authorizedHeaders(),
    body: JSON.stringify(payload)
  });
}

function readinessDatabase(versions, options = {}) {
  const database = {
    batchCalls: 0,
    versionReadCalls: 0,
    batch() {
      database.batchCalls += 1;
      throw new Error("readiness must not mutate D1");
    },
    prepare(sql) {
      if (
        sql ===
        "SELECT name FROM sqlite_master " +
          "WHERE type = 'table' AND name = 'schema_migrations' LIMIT 1"
      ) {
        return {
          async all() {
            return {
              results: options.hasMigrationTable === false
                ? []
                : [{ name: "schema_migrations" }]
            };
          }
        };
      }
      assert.equal(
        sql,
        "SELECT version FROM schema_migrations ORDER BY version"
      );
      return {
        async all() {
          database.versionReadCalls += 1;
          return {
            results: versions.map((version) => ({ version }))
          };
        }
      };
    }
  };
  return database;
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
