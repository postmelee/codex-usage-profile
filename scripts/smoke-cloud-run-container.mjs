import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  PROFILE_VISIBILITY,
  createMemoryProfileBackendStore,
  writeStoreState
} from "../src/profile-backend/index.js";
import {
  sampleAccountUsageReadResult
} from "../src/profile-card/fixtures/sample-account-usage.js";

const image = process.argv[2];
if (!image) {
  throw new Error("Usage: node scripts/smoke-cloud-run-container.mjs <image>");
}

const smokeId = `${process.pid}-${Date.now()}`;
const containerName = `cup-task37-${smokeId}`;
const directory = mkdtempSync(join(tmpdir(), "cup-cloud-run-smoke-"));
const fixturePath = join(directory, "profile-store.json");
const hostPort = 20_000 + Math.floor(Math.random() * 20_000);
const origin = `http://127.0.0.1:${hostPort}`;
let containerCreated = false;

try {
  writeFixtureStore(fixturePath);
  docker([
    "create",
    "--name", containerName,
    "--publish", `127.0.0.1:${hostPort}:8080`,
    "--env", "CANONICAL_APP_ORIGIN=http://127.0.0.1:8080",
    "--env", "HOST=0.0.0.0",
    "--env", "PORT=8080",
    "--env", "PROFILE_RUNTIME_MODE=spike",
    "--env", "PROFILE_STORE_MODE=file",
    "--env", "PROFILE_STORE_FILE=/tmp/profile-store.json",
    image
  ]);
  containerCreated = true;
  docker(["cp", fixturePath, `${containerName}:/tmp/profile-store.json`]);
  docker(["start", containerName]);

  await waitForHealth(`${origin}/healthz`);
  await verifyFrontend(origin);
  await verifyApi(origin);
  await verifyPng(origin);

  docker(["stop", "--time", "10", containerName]);
  const exitCode = docker([
    "inspect",
    "--format", "{{.State.ExitCode}}",
    containerName
  ]).trim();
  if (exitCode !== "0") {
    throw new Error(`Container exited with code ${exitCode}`);
  }

  const logs = docker(["logs", containerName]);
  for (const forbidden of ["github_client_secret", "cup_session=", fixturePath]) {
    if (logs.toLowerCase().includes(forbidden.toLowerCase())) {
      throw new Error(`Container logs exposed forbidden value: ${forbidden}`);
    }
  }

  verifyProductionFileStoreRejected(image);

  console.log(`Cloud Run container smoke passed at ${origin}`);
} finally {
  if (containerCreated) {
    try {
      docker(["rm", "--force", containerName]);
    } catch {
      // Preserve the original smoke failure.
    }
  }
  rmSync(directory, { recursive: true, force: true });
}

async function verifyFrontend(baseUrl) {
  const home = await fetch(`${baseUrl}/`);
  const html = await home.text();
  if (!home.ok || !html.includes('<div id="root"></div>')) {
    throw new Error("Container did not serve the product frontend");
  }

  const assetPath = html.match(/<script[^>]+src="(\/assets\/[^"]+)"/)?.[1];
  if (!assetPath) throw new Error("Frontend build did not reference a static asset");
  const asset = await fetch(`${baseUrl}${assetPath}`);
  if (!asset.ok || !(asset.headers.get("content-type") ?? "").includes("javascript")) {
    throw new Error("Container did not serve the frontend asset");
  }
}

async function verifyApi(baseUrl) {
  const anonymous = await fetch(`${baseUrl}/api/auth/me`);
  const missing = await fetch(`${baseUrl}/api/not-a-route`);
  if (anonymous.status !== 401) {
    throw new Error(`Expected anonymous account response 401, got ${anonymous.status}`);
  }
  if (missing.status !== 404) {
    throw new Error(`Expected missing API response 404, got ${missing.status}`);
  }
}

async function verifyPng(baseUrl) {
  const response = await fetch(`${baseUrl}/u/smoke-user/card.png`);
  const body = Buffer.from(await response.arrayBuffer());
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  if (!response.ok || response.headers.get("content-type") !== "image/png") {
    throw new Error(`Expected seeded PNG response, got ${response.status}`);
  }
  if (!body.subarray(0, signature.length).equals(signature)) {
    throw new Error("Seeded card response is not a valid PNG");
  }
}

async function waitForHealth(url) {
  let lastError;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok && (await response.json()).ok === true) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }

  throw new Error(`Container health check timed out: ${lastError?.message ?? "unavailable"}`);
}

function writeFixtureStore(filePath) {
  const store = createMemoryProfileBackendStore();
  const timestamp = "2026-06-11T00:00:00.000Z";
  store.saveOwner({
    id: "owner_smoke_1",
    authProvider: "github",
    providerUserId: "github_smoke_1",
    displayName: "Smoke User",
    githubLogin: "smoke-user",
    handle: "smoke-user",
    avatarUrl: null,
    visibility: PROFILE_VISIBILITY.PUBLIC,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  store.saveLatestUsage({
    ownerId: "owner_smoke_1",
    handle: "smoke-user",
    visibility: PROFILE_VISIBILITY.PUBLIC,
    capturedAt: timestamp,
    uploadedAt: timestamp,
    usage: sampleAccountUsageReadResult
  });
  writeStoreState(filePath, store.exportState());
}

function docker(args) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function verifyProductionFileStoreRejected(imageName) {
  const secret = `task37-secret-${smokeId}`;
  const rejectedStorePath = "/tmp/production-store-must-not-appear.json";
  const result = spawnSync("docker", [
    "run",
    "--rm",
    "--env", "CANONICAL_APP_ORIGIN=https://profiles.example.test",
    "--env", "GITHUB_CLIENT_ID=task37-client-id",
    "--env", `GITHUB_CLIENT_SECRET=${secret}`,
    "--env", "PROFILE_RUNTIME_MODE=production",
    "--env", "PROFILE_STORE_MODE=file",
    "--env", `PROFILE_STORE_FILE=${rejectedStorePath}`,
    imageName
  ], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.error) throw result.error;
  if (result.status === 0) {
    throw new Error("Production container accepted the file store");
  }

  const logs = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (!logs.includes("Production runtime failed to start.")) {
    throw new Error("Production startup failure did not use the generic error contract");
  }

  for (const forbidden of [secret, rejectedStorePath, "PROFILE_STORE_MODE=file"]) {
    if (logs.includes(forbidden)) {
      throw new Error(`Rejected production startup exposed forbidden value: ${forbidden}`);
    }
  }
}
