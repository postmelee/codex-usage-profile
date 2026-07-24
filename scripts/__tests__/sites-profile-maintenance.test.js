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

const DIGEST = "A".repeat(43);
const HANDLE = "postmelee";
const NOW = "2026-07-24T00:00:00.000Z";
const ORIGIN = "https://profile.example";
const OWNER_ID = "owner_1";
const SECRET = "maintenance-secret-value";
