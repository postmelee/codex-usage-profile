import {
  access,
  readFile,
  stat
} from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  listSitesArtifactFiles,
  verifySitesFullStackArtifact
} from "./verify-sites-fullstack-artifact.mjs";

export const MAX_SITES_PRODUCTION_ARTIFACT_BYTES = 12_000_000;

const EXPECTED_MIGRATIONS = Object.freeze([
  "0001_profile_backend.sql",
  "0002_account_usage_rate_limits.sql"
]);
const FORBIDDEN_ARTIFACT_PATTERNS = Object.freeze([
  Object.freeze({
    label: "credential",
    pattern: /(?:github_pat_|gh[opusr]_|cup_)[A-Za-z0-9_]{16,}/
  }),
  Object.freeze({
    label: "AWS access key",
    pattern: /\bAKIA[0-9A-Z]{16}\b/
  }),
  Object.freeze({
    label: "private key",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/
  }),
  Object.freeze({
    label: "environment secret literal",
    pattern:
      /(?:GITHUB_CLIENT_SECRET|PROFILE_MAINTENANCE_TOKEN|R2_SECRET_ACCESS_KEY)\s*[:=]\s*["'][^"']{8,}["']/
  }),
  Object.freeze({
    label: "local test credential",
    pattern:
      /(?:local-maintenance-secret|local-github-access-token|local-oauth-code|do-not-print-this-secret)/
  }),
  Object.freeze({
    label: "absolute local path",
    pattern: /(?:\/Users\/|\/home\/[^/\s]+\/|[A-Za-z]:\\\\Users\\\\)/
  })
]);
const FORBIDDEN_WORKER_IMPORT_PATTERNS = Object.freeze([
  Object.freeze({
    label: "Node-only runtime import",
    pattern:
      /(?:from\s*|import\()\s*["']node:(?:fs|http|https|net|path|tls|worker_threads)/
  }),
  Object.freeze({
    label: "native renderer import",
    pattern: /@napi-rs\/canvas/
  }),
  Object.freeze({
    label: "Postgres import",
    pattern: /(?:from\s*|import\()\s*["'](?:pg|postgres)["']/
  }),
  Object.freeze({
    label: "S3 client import",
    pattern: /(?:@aws-sdk\/client-s3|aws4fetch)/
  })
]);

export async function verifySitesProductionArtifact(options = {}) {
  const outputDirectory = resolve(options.outputDirectory ?? "dist");
  const fullStack = await verifySitesFullStackArtifact({ outputDirectory });
  if (fullStack.hostingMode !== "hosted") {
    throw new Error("Production Sites artifact requires the hosted linkage");
  }

  const hostingPath = resolve(outputDirectory, ".openai/hosting.json");
  const hosting = JSON.parse(await readFile(hostingPath, "utf8"));
  assertExactProductionBindings(hosting);

  const clientDirectory = resolve(outputDirectory, "client");
  const clientFiles = await listSitesArtifactFiles(clientDirectory);
  if (!clientFiles.some((path) => path.endsWith(".js"))) {
    throw new Error("Production Sites artifact requires a static JavaScript asset");
  }
  if (!clientFiles.some((path) => path.endsWith(".css"))) {
    throw new Error("Production Sites artifact requires a static CSS asset");
  }

  const migrationDirectory = resolve(outputDirectory, ".openai/drizzle");
  const migrationFiles = (await listSitesArtifactFiles(migrationDirectory))
    .filter((path) => path.endsWith(".sql"));
  const migrationNames = migrationFiles.map((path) => basename(path)).sort();
  if (JSON.stringify(migrationNames) !== JSON.stringify(EXPECTED_MIGRATIONS)) {
    throw new Error("Production Sites artifact has unexpected D1 migrations");
  }

  const allFiles = await listSitesArtifactFiles(outputDirectory);
  const artifactBytes = await sumFileSizes(allFiles);
  if (artifactBytes > MAX_SITES_PRODUCTION_ARTIFACT_BYTES) {
    throw new Error(
      `Production Sites artifact size ${artifactBytes} exceeds ` +
      `${MAX_SITES_PRODUCTION_ARTIFACT_BYTES}`
    );
  }

  const artifactText = await readArtifactText(allFiles);
  assertForbiddenPatternsAbsent(
    artifactText,
    FORBIDDEN_ARTIFACT_PATTERNS,
    "Production Sites artifact"
  );

  const workerFiles = await listSitesArtifactFiles(
    resolve(outputDirectory, "server")
  );
  const workerText = await readArtifactText(workerFiles);
  assertForbiddenPatternsAbsent(
    workerText,
    FORBIDDEN_WORKER_IMPORT_PATTERNS,
    "Production Sites Worker"
  );

  await requireFile(
    resolve(outputDirectory, "server/index.js"),
    "Production Sites Worker entry"
  );

  return Object.freeze({
    artifactBytes,
    clientFileCount: clientFiles.length,
    expectedBindingCount: 3,
    migrationFileCount: migrationFiles.length,
    outputDirectory,
    workerCompressedBytes: fullStack.workerCompressedBytes,
    workerFileCount: fullStack.workerFileCount,
    workerRawBytes: fullStack.workerRawBytes
  });
}

function assertExactProductionBindings(hosting) {
  if (
    typeof hosting.project_id !== "string" ||
    hosting.project_id.trim() === "" ||
    hosting.d1 !== "DB" ||
    hosting.r2 !== "PROFILE_MEDIA" ||
    Object.keys(hosting).sort().join(",") !== "d1,project_id,r2"
  ) {
    throw new Error(
      "Production Sites artifact requires project_id, DB, and PROFILE_MEDIA"
    );
  }
}

async function readArtifactText(files) {
  const textFiles = files.filter((path) =>
    /\.(?:css|html|js|json|map|mjs|sql|txt)$/.test(path)
  );
  const contents = await Promise.all(
    textFiles.map((path) => readFile(path, "utf8"))
  );
  return contents.join("\n");
}

async function sumFileSizes(files) {
  const sizes = await Promise.all(files.map(async (path) => (
    (await stat(path)).size
  )));
  return sizes.reduce((total, size) => total + size, 0);
}

function assertForbiddenPatternsAbsent(text, patterns, label) {
  for (const forbidden of patterns) {
    if (forbidden.pattern.test(text)) {
      throw new Error(`${label} contains forbidden ${forbidden.label}`);
    }
  }
}

async function requireFile(path, label) {
  try {
    await access(path);
  } catch {
    throw new Error(`${label} is missing`);
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;

if (invokedPath === import.meta.url) {
  try {
    const result = await verifySitesProductionArtifact({
      outputDirectory: process.argv[2]
    });
    console.log(JSON.stringify({
      artifactBytes: result.artifactBytes,
      clientFileCount: result.clientFileCount,
      expectedBindingCount: result.expectedBindingCount,
      migrationFileCount: result.migrationFileCount,
      ok: true,
      workerCompressedBytes: result.workerCompressedBytes,
      workerFileCount: result.workerFileCount,
      workerRawBytes: result.workerRawBytes
    }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
