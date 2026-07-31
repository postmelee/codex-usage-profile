import {
  access,
  readFile,
  readdir
} from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { gzip } from "node:zlib";

const DEFAULT_OUTPUT_DIRECTORY = resolve("dist");
export const MAX_FREE_WORKER_COMPRESSED_BYTES = 3_000_000;
const gzipAsync = promisify(gzip);
const FORBIDDEN_CLIENT_PATTERNS = Object.freeze([
  /GITHUB_CLIENT_SECRET/,
  /R2_SECRET_ACCESS_KEY/,
  /TEST_S3_SECRET_ACCESS_KEY/,
  /sites_backend_unavailable/,
  /profile-runtime\/sites/,
  /\/(?:Users|home)\/[^/\s]+/
]);
const FORBIDDEN_WORKER_PATTERNS = Object.freeze([
  /(?:from\s*|import\()["']node:(?:fs|http|path)/,
  /@napi-rs\/canvas/,
  /@aws-sdk\/client-s3/,
  /(?:from\s*|import\()["']pg["']/,
  /PROFILE_STORE_FILE/,
  /R2_SECRET_ACCESS_KEY/,
  /LOCAL_FULL_STACK_TEST/,
  /SITES_FULLSTACK_LOCAL_SMOKE/,
  /local-(?:maintenance-secret|github-access-token|oauth-code)/,
  /\/(?:Users|home)\/[^/\s]+/
]);

export async function verifySitesFullStackArtifact(options = {}) {
  const outputDirectory = resolve(
    options.outputDirectory ?? DEFAULT_OUTPUT_DIRECTORY
  );
  const clientDirectory = resolve(outputDirectory, "client");
  const hostingPath = resolve(outputDirectory, ".openai/hosting.json");
  const migrationsDirectory = resolve(outputDirectory, ".openai/drizzle");
  const indexPath = resolve(clientDirectory, "index.html");

  await requireFile(indexPath, "Sites full-stack client index");
  await requireFile(hostingPath, "Sites hosting manifest");

  const hosting = JSON.parse(await readFile(hostingPath, "utf8"));
  const hostingMode = validateSitesHostingManifest(hosting);

  const migrationFiles = (await listSitesArtifactFiles(migrationsDirectory))
    .filter((path) => path.endsWith(".sql"));
  if (migrationFiles.length !== 3) {
    throw new Error(
      `Expected three packaged D1 migrations, found ${migrationFiles.length}`
    );
  }

  const clientFiles = await listSitesArtifactFiles(clientDirectory);
  const clientText = await readTextFiles(clientFiles);
  assertSitesArtifactPatternsAbsent(
    clientText,
    FORBIDDEN_CLIENT_PATTERNS,
    "client artifact"
  );

  const serverDirectory = resolve(outputDirectory, "server");
  const workerConfigPath = resolve(serverDirectory, "wrangler.json");
  const packagedWorkerEntry = resolve(serverDirectory, "index.js");
  await requireFile(workerConfigPath, "Sites Worker config");
  await requireFile(packagedWorkerEntry, "Sites packaged Worker entry");
  const workerConfig = JSON.parse(await readFile(workerConfigPath, "utf8"));
  if (workerConfig.main === undefined) {
    throw new Error("Sites Worker config must declare main");
  }
  if (workerConfig.assets?.binding !== "ASSETS") {
    throw new Error("Sites Worker config must declare the ASSETS binding");
  }
  if (workerConfig.assets?.run_worker_first !== true) {
    throw new Error("Sites Worker must run before static assets");
  }

  const workerMainPath = resolve(serverDirectory, workerConfig.main);
  if (workerMainPath !== packagedWorkerEntry) {
    throw new Error("Sites Worker config main must resolve to server/index.js");
  }
  await requireFile(workerMainPath, "Sites Worker ESM entry");
  const allWorkerFiles = await listSitesArtifactFiles(serverDirectory);
  const workerFiles = allWorkerFiles
    .filter((path) => /\.(?:js|mjs)$/.test(path));
  const workerText = await readTextFiles(workerFiles);
  assertSitesArtifactPatternsAbsent(
    workerText,
    FORBIDDEN_WORKER_PATTERNS,
    "Worker artifact"
  );

  if (!/\bexport\s*\{[^}]*\bdefault\b[^}]*\}/s.test(workerText) &&
      !/\bexport\s+default\b/.test(workerText)) {
    throw new Error("Sites Worker artifact must expose an ESM default export");
  }

  const wasmFiles = allWorkerFiles.filter((path) => path.endsWith(".wasm"));
  const fontFiles = allWorkerFiles.filter((path) => path.endsWith(".bin"));
  if (wasmFiles.length !== 1) {
    throw new Error(`Expected one bundled renderer Wasm, found ${wasmFiles.length}`);
  }
  if (fontFiles.length !== 4) {
    throw new Error(`Expected four bundled renderer fonts, found ${fontFiles.length}`);
  }

  const deployableWorkerFiles = [
    ...workerFiles,
    ...wasmFiles,
    ...fontFiles
  ];
  const workerRawBytes = await sumFileBytes(deployableWorkerFiles);
  const workerCompressedBytes = await sumGzipBytes(deployableWorkerFiles);
  if (workerCompressedBytes > MAX_FREE_WORKER_COMPRESSED_BYTES) {
    throw new Error(
      `Worker artifact compressed size ${workerCompressedBytes} exceeds ` +
      `${MAX_FREE_WORKER_COMPRESSED_BYTES}`
    );
  }

  return Object.freeze({
    clientFileCount: clientFiles.length,
    fontFileCount: fontFiles.length,
    hostingPath,
    hostingMode,
    migrationFileCount: migrationFiles.length,
    outputDirectory,
    wasmFileCount: wasmFiles.length,
    workerCompressedBytes,
    workerConfigPath,
    workerFileCount: workerFiles.length,
    workerMainPath,
    workerRawBytes
  });
}

export async function listSitesArtifactFiles(directory) {
  const files = [];

  async function visit(currentDirectory) {
    for (const entry of await readdir(currentDirectory, {
      withFileTypes: true
    })) {
      const path = resolve(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile()) {
        files.push(path);
      }
    }
  }

  await visit(directory);
  return files.sort();
}

async function readTextFiles(files) {
  const textFiles = files.filter((path) =>
    /\.(?:css|html|js|json|map|mjs|txt)$/.test(path)
  );
  const contents = await Promise.all(
    textFiles.map((path) => readFile(path, "utf8"))
  );
  return contents.join("\n");
}

async function sumFileBytes(files) {
  const contents = await Promise.all(files.map((path) => readFile(path)));
  return contents.reduce((total, body) => total + body.byteLength, 0);
}

async function sumGzipBytes(files) {
  const contents = await Promise.all(files.map(async (path) => (
    gzipAsync(await readFile(path), { level: 9 })
  )));
  return contents.reduce((total, body) => total + body.byteLength, 0);
}

export function assertSitesArtifactPatternsAbsent(text, patterns, label) {
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      throw new Error(`${label} contains forbidden pattern ${pattern}`);
    }
  }
}

async function requireFile(path, label) {
  try {
    await access(path);
  } catch {
    throw new Error(`${label} is missing: ${path}`);
  }
}

export function validateSitesHostingManifest(hosting) {
  const keys = Object.keys(hosting).sort();
  if (
    keys.length === 2 &&
    keys[0] === "d1" &&
    keys[1] === "r2" &&
    hosting.d1 === null &&
    hosting.r2 === null
  ) {
    return "pre-hosted";
  }

  if (
    keys.length === 3 &&
    keys[0] === "d1" &&
    keys[1] === "project_id" &&
    keys[2] === "r2" &&
    typeof hosting.project_id === "string" &&
    hosting.project_id.trim() !== "" &&
    hosting.d1 === "DB" &&
    hosting.r2 === "PROFILE_MEDIA"
  ) {
    return "hosted";
  }

  throw new Error(
    "Sites manifest must be either unprovisioned or use the approved " +
    "project_id/DB/PROFILE_MEDIA linkage"
  );
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;

if (invokedPath === import.meta.url) {
  try {
    const result = await verifySitesFullStackArtifact({
      outputDirectory: process.argv[2]
    });
    console.log(JSON.stringify({
      clientFileCount: result.clientFileCount,
      hostingMode: result.hostingMode,
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
