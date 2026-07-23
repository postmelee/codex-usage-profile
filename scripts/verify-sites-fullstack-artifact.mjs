import {
  access,
  readFile,
  readdir
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_OUTPUT_DIRECTORY = resolve("dist-sites-fullstack");
const FORBIDDEN_CLIENT_PATTERNS = Object.freeze([
  /GITHUB_CLIENT_SECRET/,
  /R2_SECRET_ACCESS_KEY/,
  /TEST_S3_SECRET_ACCESS_KEY/,
  /sites_backend_unavailable/,
  /profile-runtime\/sites/
]);
const FORBIDDEN_WORKER_PATTERNS = Object.freeze([
  /(?:from\s*|import\()["']node:(?:fs|http|path)/,
  /@napi-rs\/canvas/,
  /@aws-sdk\/client-s3/,
  /(?:from\s*|import\()["']pg["']/,
  /PROFILE_STORE_FILE/,
  /R2_SECRET_ACCESS_KEY/
]);

export async function verifySitesFullStackArtifact(options = {}) {
  const outputDirectory = resolve(
    options.outputDirectory ?? DEFAULT_OUTPUT_DIRECTORY
  );
  const clientDirectory = resolve(outputDirectory, "client");
  const hostingPath = resolve(outputDirectory, ".openai/hosting.json");
  const indexPath = resolve(clientDirectory, "index.html");

  await requireFile(indexPath, "Sites full-stack client index");
  await requireFile(hostingPath, "Sites hosting manifest");

  const hosting = JSON.parse(await readFile(hostingPath, "utf8"));
  if (hosting.d1 !== null || hosting.r2 !== null || "project_id" in hosting) {
    throw new Error(
      "Stage 1 Sites manifest must keep d1/r2 null and omit project_id"
    );
  }

  const clientFiles = await listFiles(clientDirectory);
  const clientText = await readTextFiles(clientFiles);
  assertPatternsAbsent(clientText, FORBIDDEN_CLIENT_PATTERNS, "client artifact");

  const workerConfigPath = await findWorkerConfig(outputDirectory);
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

  const workerMainPath = resolve(dirname(workerConfigPath), workerConfig.main);
  await requireFile(workerMainPath, "Sites Worker ESM entry");
  const workerFiles = (await listFiles(dirname(workerConfigPath)))
    .filter((path) => /\.(?:js|mjs)$/.test(path));
  const workerText = await readTextFiles(workerFiles);
  assertPatternsAbsent(workerText, FORBIDDEN_WORKER_PATTERNS, "Worker artifact");

  if (!/\bexport\s*\{[^}]*\bdefault\b[^}]*\}/s.test(workerText) &&
      !/\bexport\s+default\b/.test(workerText)) {
    throw new Error("Sites Worker artifact must expose an ESM default export");
  }

  return Object.freeze({
    clientFileCount: clientFiles.length,
    hostingPath,
    outputDirectory,
    workerConfigPath,
    workerFileCount: workerFiles.length,
    workerMainPath
  });
}

async function findWorkerConfig(outputDirectory) {
  const candidates = (await listFiles(outputDirectory))
    .filter((path) => path.endsWith("/wrangler.json") ||
      path === resolve(outputDirectory, "wrangler.json"));

  if (candidates.length !== 1) {
    throw new Error(
      `Expected one Sites Worker config, found ${candidates.length}`
    );
  }

  return candidates[0];
}

async function listFiles(directory) {
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

function assertPatternsAbsent(text, patterns, label) {
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
      ok: true,
      workerFileCount: result.workerFileCount
    }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
