import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import {
  parseSitesProfileMaintenanceArgs,
  runSitesProfileMaintenanceCli,
  sitesProfileMaintenanceHelpText
} from "../sites-profile-maintenance.mjs";

test("operator CLI sends only a scoped plan and keeps the token in the header", async () => {
  const requests = [];
  const output = [];
  await runSitesProfileMaintenanceCli([
    "plan",
    "--origin", ORIGIN,
    "--owner-id", OWNER_ID,
    "--handle", HANDLE
  ], {
    environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      return jsonResponse({
        ok: true,
        summary: summary("plan")
      });
    },
    stdout: (line) => output.push(line)
  });

  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].url,
    `${ORIGIN}/__ops/profile-maintenance`
  );
  assert.equal(requests[0].init.headers.authorization, `Bearer ${SECRET}`);
  assert.equal(requests[0].init.headers.origin, ORIGIN);
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    operation: "plan",
    ownerId: OWNER_ID,
    handle: HANDLE
  });
  assert.doesNotMatch(requests[0].init.body, new RegExp(SECRET));
  assert.doesNotMatch(output.join("\n"), new RegExp(SECRET));
});

test("operator CLI readiness sends and prints only exact version state", async () => {
  const requests = [];
  const output = [];
  const result = await runSitesProfileMaintenanceCli([
    "readiness",
    "--origin", ORIGIN
  ], {
    environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      return jsonResponse({
        ok: true,
        summary: {
          appliedVersions: [1, 2, 3],
          expectedVersions: [1, 2, 3],
          operation: "readiness",
          ready: true
        }
      });
    },
    stdout: (line) => output.push(line)
  });

  assert.equal(requests.length, 1);
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    operation: "readiness"
  });
  assert.deepEqual(result.summary, {
    appliedVersions: [1, 2, 3],
    expectedVersions: [1, 2, 3],
    operation: "readiness",
    ready: true
  });
  assert.deepEqual(JSON.parse(output[0]), result.summary);
  assert.doesNotMatch(
    `${requests[0].init.body}\n${output.join("\n")}`,
    /owner|handle|usage|token|session|credential|r2/i
  );
});

test("operator CLI readiness rejects extra options and unsafe responses", async () => {
  let fetches = 0;
  const options = {
    environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
    fetchImpl: async () => {
      fetches += 1;
      return jsonResponse({ ok: true });
    },
    stdout: () => {}
  };
  for (const extra of [
    ["--apply"],
    ["--owner-id", OWNER_ID],
    ["--retention-days", "30"]
  ]) {
    await assert.rejects(
      runSitesProfileMaintenanceCli([
        "readiness",
        "--origin", ORIGIN,
        ...extra
      ], options),
      /readiness/
    );
  }
  assert.equal(fetches, 0);

  await assert.rejects(
    runSitesProfileMaintenanceCli([
      "readiness",
      "--origin", ORIGIN
    ], {
      environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
      fetchImpl: async () => jsonResponse({
        ok: true,
        summary: {
          appliedVersions: [1, 2, 3],
          expectedVersions: [1, 2, 3],
          operation: "readiness",
          ownerId: OWNER_ID,
          ready: true
        }
      }),
      stdout: () => {}
    }),
    (error) => error.code === "invalid_response"
  );

  await assert.rejects(
    runSitesProfileMaintenanceCli([
      "readiness",
      "--origin", ORIGIN
    ], {
      environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
      fetchImpl: async () => jsonResponse({
        ok: true,
        summary: {
          appliedVersions: [1, 3],
          expectedVersions: [1, 2, 3],
          operation: "readiness",
          ready: true
        }
      }),
      stdout: () => {}
    }),
    (error) => error.code === "invalid_response"
  );

  await assert.rejects(
    runSitesProfileMaintenanceCli([
      "readiness",
      "--origin", ORIGIN
    ], {
      environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
      fetchImpl: async () => jsonResponse({
        ok: false,
        error: { code: "migration_not_ready" }
      }, 503),
      stdout: () => {}
    }),
    (error) => error.code === "migration_not_ready"
  );
});

test("operator CLI migrate sends no identity or SQL and validates bounded output", async () => {
  const requests = [];
  const output = [];
  const result = await runSitesProfileMaintenanceCli([
    "migrate",
    "--origin", ORIGIN
  ], {
    environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
    fetchImpl: async (_url, init) => {
      requests.push(init);
      return jsonResponse({
        ok: true,
        summary: {
          appliedVersions: [1, 2, 3, 4, 5],
          newlyAppliedVersions: [3, 4, 5],
          operation: "migrate"
        }
      });
    },
    stdout: (line) => output.push(line)
  });

  assert.deepEqual(JSON.parse(requests[0].body), { operation: "migrate" });
  assert.deepEqual(result.summary, {
    appliedVersions: [1, 2, 3, 4, 5],
    newlyAppliedVersions: [3, 4, 5],
    operation: "migrate"
  });
  assert.deepEqual(JSON.parse(output[0]), result.summary);
  assert.doesNotMatch(
    `${requests[0].body}\n${output.join("\n")}`,
    /owner|handle|usage|token|session|credential|sql|r2/i
  );
});

test("operator CLI migrate rejects extra options and unsafe output", async () => {
  let fetches = 0;
  for (const extra of [
    ["--apply"],
    ["--owner-id", OWNER_ID],
    ["--retention-days", "30"]
  ]) {
    await assert.rejects(
      runSitesProfileMaintenanceCli([
        "migrate",
        "--origin", ORIGIN,
        ...extra
      ], {
        environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
        fetchImpl: async () => {
          fetches += 1;
          return jsonResponse({ ok: true });
        },
        stdout: () => {}
      }),
      /migrate/
    );
  }
  assert.equal(fetches, 0);

  await assert.rejects(
    runSitesProfileMaintenanceCli(["migrate", "--origin", ORIGIN], {
      environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
      fetchImpl: async () => jsonResponse({
        ok: true,
        summary: {
          appliedVersions: [1, 2, 3],
          newlyAppliedVersions: [3],
          operation: "migrate",
          ownerId: OWNER_ID
        }
      }),
      stdout: () => {}
    }),
    (error) => error.code === "invalid_response"
  );

  await assert.rejects(
    runSitesProfileMaintenanceCli(["migrate", "--origin", ORIGIN], {
      environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
      fetchImpl: async () => jsonResponse({
        ok: false,
        error: {
          code: "migration_apply_unavailable",
          message: "provider SQL failed for a private owner"
        }
      }, 503),
      stdout: () => {}
    }),
    (error) =>
      error.code === "migration_apply_unavailable" &&
      !error.message.includes("provider")
  );
});

test("operator CLI bounds an unresponsive request without leaking context", async () => {
  const output = [];
  let signal;

  await assert.rejects(
    runSitesProfileMaintenanceCli([
      "plan",
      "--origin", ORIGIN,
      "--owner-id", OWNER_ID,
      "--handle", HANDLE
    ], {
      environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
      fetchImpl: async (_url, init) => {
        signal = init.signal;
        return new Promise((resolve, reject) => {
          signal.addEventListener("abort", () => {
            reject(new Error("request aborted"));
          }, { once: true });
        });
      },
      requestTimeoutMs: 10,
      stdout: (line) => output.push(line)
    }),
    (error) => {
      assert.equal(error.code, "network_unavailable");
      assert.doesNotMatch(error.message, new RegExp(SECRET));
      assert.doesNotMatch(error.message, /profile\.example|owner_1|postmelee/);
      return true;
    }
  );

  assert.equal(signal.aborted, true);
  assert.deepEqual(output, []);
});

test("mutations require apply, digest, count, and exact owner options before fetch", async () => {
  let fetches = 0;
  const common = {
    environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
    fetchImpl: async () => {
      fetches += 1;
      return jsonResponse({ ok: true, summary: summary("delete-account") });
    }
  };
  await assert.rejects(
    runSitesProfileMaintenanceCli([
      "delete-account",
      "--origin", ORIGIN,
      "--owner-id", OWNER_ID,
      "--handle", HANDLE
    ], common),
    /requires --apply/
  );
  await assert.rejects(
    runSitesProfileMaintenanceCli([
      "delete-account",
      "--origin", ORIGIN,
      "--owner-id", OWNER_ID,
      "--handle", HANDLE,
      "--apply"
    ], common),
    /expected-digest/
  );
  assert.equal(fetches, 0);
});

test("delete-account applies serial batches with one stable operation ID", async () => {
  const payloads = [];
  const output = [];
  let active = 0;
  let maximumActive = 0;
  const responses = [
    { ok: true, summary: summary("plan", 10) },
    {
      ok: true,
      progress: deletionProgress({
        deletedRevisionCount: 8,
        remainingRevisionCount: 2
      }),
      summary: summary("delete-account", 10)
    },
    {
      ok: true,
      progress: deletionProgress({
        deletedRevisionCount: 2,
        phase: "completed",
        remainingRevisionCount: 0,
        status: "completed"
      }),
      summary: summary("delete-account", 10)
    }
  ];

  const result = await runSitesProfileMaintenanceCli(
    [...deleteAccountArgs("10"), "--operation-id", OPERATION_ID],
    {
      createOperationId: () => {
        throw new Error("explicit operation ID must be preserved");
      },
      environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
      fetchImpl: async (_url, init) => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        payloads.push(JSON.parse(init.body));
        await Promise.resolve();
        active -= 1;
        return jsonResponse(responses.shift());
      },
      stdout: (line) => output.push(JSON.parse(line))
    }
  );

  assert.equal(maximumActive, 1);
  assert.deepEqual(payloads[0], {
    operation: "plan",
    ownerId: OWNER_ID,
    handle: HANDLE
  });
  assert.equal(payloads[1].operationId, OPERATION_ID);
  assert.deepEqual(payloads[2], payloads[1]);
  assert.equal(result.progress.status, "completed");
  assert.deepEqual(output, [
    deletionProgress({
      deletedRevisionCount: 8,
      remainingRevisionCount: 2
    }),
    deletionProgress({
      deletedRevisionCount: 2,
      phase: "completed",
      remainingRevisionCount: 0,
      status: "completed"
    }),
    summary("delete-account", 10)
  ]);
});

test("delete-account adopts an active operation and rejects an explicit mismatch", async () => {
  const active = deletionProgress({ remainingRevisionCount: 3 });
  const payloads = [];
  await runSitesProfileMaintenanceCli(deleteAccountArgs("10"), {
    createOperationId: () => "must_not_be_used",
    environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
    fetchImpl: async (_url, init) => {
      const payload = JSON.parse(init.body);
      payloads.push(payload);
      return payload.operation === "plan"
        ? jsonResponse({ ok: true, progress: active, summary: summary("plan", 10) })
        : jsonResponse({
            ok: true,
            progress: deletionProgress({
              phase: "completed",
              remainingRevisionCount: 0,
              status: "completed"
            }),
            summary: summary("delete-account", 10)
          });
    },
    stdout: () => {}
  });
  assert.equal(payloads[1].operationId, OPERATION_ID);

  let fetches = 0;
  await assert.rejects(
    runSitesProfileMaintenanceCli([
      ...deleteAccountArgs("10"),
      "--operation-id", "different_operation"
    ], {
      environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
      fetchImpl: async () => {
        fetches += 1;
        return jsonResponse({
          ok: true,
          progress: active,
          summary: summary("plan", 10)
        });
      },
      stdout: () => {}
    }),
    (error) => error.code === "maintenance_conflict"
  );
  assert.equal(fetches, 1);
});

test("delete-account reconciles network-unknown state before another apply", async () => {
  const payloads = [];
  let requestNumber = 0;
  const result = await runSitesProfileMaintenanceCli(deleteAccountArgs("10"), {
    createOperationId: () => OPERATION_ID,
    environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
    fetchImpl: async (_url, init) => {
      requestNumber += 1;
      const payload = JSON.parse(init.body);
      payloads.push(payload);
      if (requestNumber === 1) {
        return jsonResponse({ ok: true, summary: summary("plan", 10) });
      }
      if (requestNumber === 2) throw new Error("connection reset");
      if (requestNumber === 3) {
        return jsonResponse({
          ok: true,
          progress: deletionProgress({ remainingRevisionCount: 2 }),
          summary: summary("plan", 10)
        });
      }
      return jsonResponse({
        ok: true,
        progress: deletionProgress({
          phase: "completed",
          remainingRevisionCount: 0,
          status: "completed"
        }),
        summary: summary("delete-account", 10)
      });
    },
    stdout: () => {}
  });

  assert.deepEqual(
    payloads.map((payload) => payload.operation),
    ["plan", "delete-account", "plan", "delete-account"]
  );
  assert.equal(payloads[1].operationId, payloads[3].operationId);
  assert.equal(result.progress.status, "completed");
});

test("delete-account retries an unchanged original plan only once", async () => {
  const operations = [];
  let requestNumber = 0;
  await assert.rejects(
    runSitesProfileMaintenanceCli(deleteAccountArgs("10"), {
      createOperationId: () => OPERATION_ID,
      environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
      fetchImpl: async (_url, init) => {
        requestNumber += 1;
        const operation = JSON.parse(init.body).operation;
        operations.push(operation);
        if (operation === "plan") {
          return jsonResponse({ ok: true, summary: summary("plan", 10) });
        }
        throw new Error(`unknown apply ${requestNumber}`);
      },
      stdout: () => {}
    }),
    (error) => error.code === "maintenance_conflict"
  );
  assert.deepEqual(operations, [
    "plan",
    "delete-account",
    "plan",
    "delete-account",
    "plan"
  ]);
});

test("delete-account treats not-found after an unknown apply as completed", async () => {
  const output = [];
  let requestNumber = 0;
  const result = await runSitesProfileMaintenanceCli(deleteAccountArgs("10"), {
    createOperationId: () => OPERATION_ID,
    environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
    fetchImpl: async () => {
      requestNumber += 1;
      if (requestNumber === 1) {
        return jsonResponse({ ok: true, summary: summary("plan", 10) });
      }
      if (requestNumber === 2) throw new Error("response lost");
      return jsonResponse({ ok: false, error: { code: "not_found" } }, 404);
    },
    stdout: (line) => output.push(JSON.parse(line))
  });

  assert.equal(requestNumber, 3);
  assert.equal(result.progress.status, "completed");
  assert.deepEqual(output, [result.progress, result.summary]);
});

test("delete-account waits for a live lease and re-plans before retry", async () => {
  const payloads = [];
  const sleeps = [];
  let requestNumber = 0;
  const withRetry = deletionProgress({
    phase: "prepare",
    remainingRevisionCount: 10,
    retryAfterSeconds: 60
  });
  await runSitesProfileMaintenanceCli(deleteAccountArgs("10"), {
    createOperationId: () => OPERATION_ID,
    environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
    fetchImpl: async (_url, init) => {
      requestNumber += 1;
      const payload = JSON.parse(init.body);
      payloads.push(payload);
      if (requestNumber === 1) {
        return jsonResponse({ ok: true, summary: summary("plan", 10) });
      }
      if (requestNumber === 2) {
        return jsonResponse({
          ok: true,
          progress: withRetry,
          summary: summary("delete-account", 10)
        });
      }
      if (requestNumber === 3) {
        return jsonResponse({
          ok: true,
          progress: deletionProgress({
            phase: "prepare",
            remainingRevisionCount: 10
          }),
          summary: summary("plan", 10)
        });
      }
      return jsonResponse({
        ok: true,
        progress: deletionProgress({
          phase: "completed",
          remainingRevisionCount: 0,
          status: "completed"
        }),
        summary: summary("delete-account", 10)
      });
    },
    sleep: async (milliseconds) => sleeps.push(milliseconds),
    stdout: () => {}
  });

  assert.deepEqual(sleeps, [60_000]);
  assert.deepEqual(
    payloads.map((payload) => payload.operation),
    ["plan", "delete-account", "plan", "delete-account"]
  );
});

test("delete-account rejects unsafe or stalled progress without leaking it", async () => {
  const output = [];
  let requestNumber = 0;
  await assert.rejects(
    runSitesProfileMaintenanceCli(deleteAccountArgs("10"), {
      createOperationId: () => OPERATION_ID,
      environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
      fetchImpl: async () => {
        requestNumber += 1;
        if (requestNumber === 1) {
          return jsonResponse({ ok: true, summary: summary("plan", 10) });
        }
        return jsonResponse({
          ok: true,
          progress: {
            ...deletionProgress({ remainingRevisionCount: 2 }),
            leaseNonce: SECRET
          },
          summary: summary("delete-account", 10)
        });
      },
      stdout: (line) => output.push(line)
    }),
    (error) => error.code === "invalid_response"
  );
  assert.deepEqual(output, []);
});

test("delete-account stops at its bounded iteration limit", async () => {
  let remaining = 4;
  let fetches = 0;
  await assert.rejects(
    runSitesProfileMaintenanceCli(deleteAccountArgs("10"), {
      createOperationId: () => OPERATION_ID,
      deleteAccountMaxIterations: 2,
      environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
      fetchImpl: async (_url, init) => {
        fetches += 1;
        const payload = JSON.parse(init.body);
        if (payload.operation === "plan") {
          return jsonResponse({ ok: true, summary: summary("plan", 10) });
        }
        remaining -= 1;
        return jsonResponse({
          ok: true,
          progress: deletionProgress({ remainingRevisionCount: remaining }),
          summary: summary("delete-account", 10)
        });
      },
      stdout: () => {}
    }),
    (error) => error.code === "delete_account_iteration_limit"
  );
  assert.equal(fetches, 3);
});

test("retention defaults to dry-run and requires confirmation only for apply", async () => {
  const payloads = [];
  const fetchImpl = async (_url, init) => {
    payloads.push(JSON.parse(init.body));
    return jsonResponse({ ok: true, summary: summary("retention") });
  };
  await runSitesProfileMaintenanceCli([
    "retention",
    "--origin", ORIGIN,
    "--retention-days", "30",
    "--recent-revisions", "5"
  ], {
    environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
    fetchImpl,
    stdout: () => {}
  });
  assert.deepEqual(payloads[0], {
    operation: "retention",
    recentRevisions: 5,
    retentionDays: 30
  });

  await assert.rejects(
    runSitesProfileMaintenanceCli([
      "retention",
      "--origin", ORIGIN,
      "--apply"
    ], {
      environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
      fetchImpl,
      stdout: () => {}
    }),
    /expected-digest/
  );
  assert.equal(payloads.length, 1);
});

test("repair CLI requires and sends all four application ETags", async () => {
  const payloads = [];
  const applicationEtag = `"${"C".repeat(43)}"`;
  await runSitesProfileMaintenanceCli([
    "repair-publication",
    "--origin", ORIGIN,
    "--owner-id", OWNER_ID,
    "--handle", HANDLE,
    "--expected-digest", DIGEST,
    "--expected-count", "7",
    "--expected-storage-etag", "legacy-storage-etag",
    "--expected-dark-en-etag", applicationEtag,
    "--expected-dark-ko-etag", applicationEtag,
    "--expected-light-en-etag", applicationEtag,
    "--expected-light-ko-etag", applicationEtag,
    "--apply"
  ], {
    environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
    fetchImpl: async (_url, init) => {
      payloads.push(JSON.parse(init.body));
      return jsonResponse({
        ok: true,
        summary: summary("repair-publication", 6)
      });
    },
    stdout: () => {}
  });

  assert.deepEqual(payloads[0].expectedApplicationEtags, {
    dark: { en: applicationEtag, ko: applicationEtag },
    light: { en: applicationEtag, ko: applicationEtag }
  });
  assert.equal(payloads[0].expectedStorageEtag, "legacy-storage-etag");
});

test("export writes a new atomic 0600 backup outside the repository", async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), "profile-maintenance-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const outputPath = resolve(directory, "owner-backup.json");
  const backup = {
    contractVersion: 1,
    schemaVersion: 1,
    operation: "export",
    createdAt: NOW,
    profiles: [{ owner: { id: OWNER_ID, handle: HANDLE } }],
    contentDigest: DIGEST
  };
  const logs = [];

  await runSitesProfileMaintenanceCli([
    "export",
    "--origin", ORIGIN,
    "--owner-id", OWNER_ID,
    "--handle", HANDLE,
    "--output", outputPath
  ], {
    environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
    fetchImpl: async () => jsonResponse({
      ok: true,
      backup,
      summary: summary("export")
    }),
    repositoryRoot: resolve("."),
    stdout: (line) => logs.push(line)
  });

  assert.deepEqual(JSON.parse(await readFile(outputPath, "utf8")), backup);
  assert.equal((await stat(outputPath)).mode & 0o777, 0o600);
  assert.doesNotMatch(logs.join("\n"), /profiles|postmelee|owner_1/);
  await assert.rejects(
    runSitesProfileMaintenanceCli([
      "export",
      "--origin", ORIGIN,
      "--owner-id", OWNER_ID,
      "--handle", HANDLE,
      "--output", resolve("owner-backup.json")
    ], {
      environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
      fetchImpl: async () => {
        throw new Error("must not fetch");
      }
    }),
    /outside the repository/
  );
});

test("restore reads a backup without logging its payload or path", async () => {
  const backup = { marker: "private-backup-payload" };
  const payloads = [];
  const logs = [];
  await runSitesProfileMaintenanceCli([
    "restore",
    "--origin", ORIGIN,
    "--owner-id", OWNER_ID,
    "--handle", HANDLE,
    "--input", "/private/tmp/private-profile-backup.json",
    "--expected-digest", DIGEST,
    "--expected-count", "5",
    "--apply"
  ], {
    environment: { PROFILE_MAINTENANCE_TOKEN: SECRET },
    fetchImpl: async (_url, init) => {
      payloads.push(JSON.parse(init.body));
      return jsonResponse({ ok: true, summary: summary("restore", 5) });
    },
    readBackup: async () => backup,
    stdout: (line) => logs.push(line)
  });

  assert.deepEqual(payloads[0], {
    operation: "restore",
    ownerId: OWNER_ID,
    handle: HANDLE,
    backup,
    apply: true,
    expectedContentDigest: DIGEST,
    expectedObjectCount: 5,
    confirmOwner: {
      ownerId: OWNER_ID,
      handle: HANDLE
    }
  });
  assert.doesNotMatch(logs.join("\n"), /private-backup-payload|private-profile/);
});

test("CLI rejects token arguments, wildcards, insecure origins, and unknown options", () => {
  assert.throws(
    () => parseSitesProfileMaintenanceArgs(["plan", "--token", SECRET]),
    /Unsupported Sites maintenance option/
  );
  assert.throws(
    () => parseSitesProfileMaintenanceArgs(["plan", "*"]),
    /must be named/
  );
  assert.throws(
    () => parseSitesProfileMaintenanceArgs(["plan", "--origin"]),
    /value is missing/
  );
  assert.match(sitesProfileMaintenanceHelpText(), /PROFILE_MAINTENANCE_TOKEN/);
  assert.match(sitesProfileMaintenanceHelpText(), /readiness/);
  assert.match(sitesProfileMaintenanceHelpText(), /--operation-id/);
  assert.doesNotMatch(sitesProfileMaintenanceHelpText(), /--token/);
});

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function summary(operation, objectCount = 0) {
  return {
    contentDigest: DIGEST,
    contractVersion: 1,
    createdAt: NOW,
    objectCount,
    operation,
    ownerCount: operation === "retention" ? 0 : 1,
    schemaVersion: 1
  };
}

function deletionProgress(options = {}) {
  const status = options.status ?? "in_progress";
  if (status === "completed") {
    return {
      contractVersion: 1,
      status,
      phase: "completed",
      operationId: OPERATION_ID,
      deletedRevisionCount: options.deletedRevisionCount ?? 0,
      remainingRevisionCount: 0
    };
  }
  return {
    contractVersion: 1,
    status,
    phase: options.phase ?? "media",
    operationId: OPERATION_ID,
    deletedRevisionCount: options.deletedRevisionCount ?? 0,
    remainingRevisionCount: options.remainingRevisionCount ?? 0,
    expectedContentDigest: DIGEST,
    expectedObjectCount: 10,
    ...(options.retryAfterSeconds === undefined
      ? {}
      : { retryAfterSeconds: options.retryAfterSeconds })
  };
}

function deleteAccountArgs(expectedCount) {
  return [
    "delete-account",
    "--origin", ORIGIN,
    "--owner-id", OWNER_ID,
    "--handle", HANDLE,
    "--expected-digest", DIGEST,
    "--expected-count", expectedCount,
    "--apply"
  ];
}

const DIGEST = "A".repeat(43);
const HANDLE = "postmelee";
const NOW = "2026-07-24T00:00:00.000Z";
const ORIGIN = "https://profile.example";
const OWNER_ID = "owner_1";
const OPERATION_ID = "profile_account_delete_1";
const SECRET = "maintenance-secret-value";
