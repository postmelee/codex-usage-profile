import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createMemoryProfileBackendStore } from "../src/profile-backend/index.js";
import { createSitesMarketingConfig } from "../src/profile-marketing/sites-config.js";
import { startProfileProductionServer } from "../src/profile-runtime/production-server.js";

const projectRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const secretSentinel = `matrix-secret-${process.pid}-${Date.now()}`;
const privateOwnerSentinel = "owner_matrix_private";
let cloudRunRuntime = null;
let sitesProcess = null;

try {
  assertCloudRunBuildExists();

  const cloudRunPort = await reservePort();
  const cloudRunOrigin = `http://127.0.0.1:${cloudRunPort}`;
  cloudRunRuntime = await startProfileProductionServer({
    deploymentConfig: Object.freeze({
      bindHost: "127.0.0.1",
      canonicalAppOrigin: cloudRunOrigin,
      port: cloudRunPort,
      runtimeMode: "spike",
      storeMode: "file"
    }),
    env: {
      GITHUB_CLIENT_ID: "matrix-client-id",
      GITHUB_CLIENT_SECRET: secretSentinel,
      PROFILE_STORE_FILE: "matrix-store-is-injected.json"
    },
    rootDirectory: join(projectRoot, "dist"),
    store: createMemoryProfileBackendStore()
  });

  await verifyCloudRun(cloudRunOrigin);
  buildConfiguredSites(cloudRunOrigin);

  const sitesPort = await reservePort();
  const sitesOrigin = `http://127.0.0.1:${sitesPort}`;
  sitesProcess = startSitesPreview(sitesPort);
  await waitForHttp(`${sitesOrigin}/`, { child: sitesProcess });
  await verifySitesMirror(sitesOrigin, cloudRunOrigin);
  await verifyCloudRun(cloudRunOrigin);

  await stopChild(sitesProcess);
  sitesProcess = null;
  await verifyCloudRun(cloudRunOrigin);

  console.log("Hosting matrix smoke passed:");
  console.log(`- Cloud Run canonical app: ${cloudRunOrigin}`);
  console.log(`- Sites sample-only mirror: ${sitesOrigin}`);
  console.log("- Cloud Run remained healthy after the Sites mirror stopped");
} finally {
  if (sitesProcess) await stopChild(sitesProcess);
  if (cloudRunRuntime) await cloudRunRuntime.close();
}

function assertCloudRunBuildExists() {
  const indexPath = join(projectRoot, "dist", "index.html");
  if (!existsSync(indexPath)) {
    throw new Error("Cloud Run frontend build is missing. Run npm run build:cloud-run first.");
  }
}

function buildConfiguredSites(cloudRunOrigin) {
  execFileSync(npmCommand, ["run", "build:sites"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      GITHUB_CLIENT_SECRET: secretSentinel,
      MATRIX_PRIVATE_OWNER: privateOwnerSentinel,
      VITE_CANONICAL_APP_URL: cloudRunOrigin
    },
    stdio: "inherit"
  });
}

function startSitesPreview(port) {
  const viteBin = join(projectRoot, "node_modules", "vite", "bin", "vite.js");
  const child = spawn(process.execPath, [
    viteBin,
    "preview",
    "--config", "vite.sites.config.js",
    "--configLoader", "runner",
    "--host", "127.0.0.1",
    "--port", String(port),
    "--strictPort"
  ], {
    cwd: projectRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.output = [];
  child.stdout.on("data", (chunk) => child.output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => child.output.push(chunk.toString()));
  return child;
}

async function verifyCloudRun(origin) {
  const health = await fetch(`${origin}/healthz`);
  const healthBody = await health.text();
  if (!health.ok || JSON.parse(healthBody).ok !== true) {
    throw new Error(`Cloud Run health failed with ${health.status}`);
  }

  const home = await fetch(`${origin}/`);
  const html = await home.text();
  if (!home.ok || !html.includes('<div id="root"></div>')) {
    throw new Error("Cloud Run did not serve the product frontend");
  }

  const anonymous = await fetch(`${origin}/api/auth/me`);
  if (anonymous.status !== 401) {
    throw new Error(`Cloud Run anonymous API returned ${anonymous.status}`);
  }

  assertDoesNotContain(
    `${healthBody}\n${html}`,
    [secretSentinel, privateOwnerSentinel, "matrix-store-is-injected.json"],
    "Cloud Run public response"
  );
}

async function verifySitesMirror(sitesOrigin, cloudRunOrigin) {
  const home = await fetch(`${sitesOrigin}/`);
  const html = await home.text();
  if (!home.ok || !html.includes('<div id="root"></div>')) {
    throw new Error("Sites mirror did not serve the marketing frontend");
  }

  const scriptPaths = Array.from(
    html.matchAll(/<script[^>]+src="([^"]+)"/g),
    (match) => match[1]
  );
  if (scriptPaths.length === 0) {
    throw new Error("Sites mirror did not reference a client script");
  }

  const scripts = await Promise.all(scriptPaths.map(async (path) => {
    const response = await fetch(new URL(path, sitesOrigin));
    if (!response.ok) throw new Error(`Sites client asset failed: ${path}`);
    return response.text();
  }));
  const clientSource = scripts.join("\n");
  if (!clientSource.includes(cloudRunOrigin)) {
    throw new Error("Sites client does not contain the configured Cloud Run origin");
  }
  const sitesConfig = createSitesMarketingConfig({
    VITE_CANONICAL_APP_URL: cloudRunOrigin
  });
  if (sitesConfig.appHref !== `${cloudRunOrigin}/`) {
    throw new Error("Sites CTA does not resolve to the configured Cloud Run root");
  }

  const fakeApi = await fetch(`${sitesOrigin}/api/auth/me`);
  const fakeApiBody = await fakeApi.text();
  if (!fakeApi.headers.get("content-type")?.includes("text/html")) {
    throw new Error("Sites unexpectedly exposed an API response");
  }

  assertDoesNotContain(
    `${html}\n${clientSource}\n${fakeApiBody}`,
    [
      secretSentinel,
      privateOwnerSentinel,
      "cup_session=",
      "github_client_secret"
    ],
    "Sites public artifact"
  );
}

function assertDoesNotContain(value, forbiddenValues, label) {
  for (const forbidden of forbiddenValues) {
    if (value.toLowerCase().includes(forbidden.toLowerCase())) {
      throw new Error(`${label} exposed forbidden value: ${forbidden}`);
    }
  }
}

async function waitForHttp(url, options = {}) {
  let lastError;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (options.child?.exitCode !== null) {
      throw new Error(
        `Sites preview exited before readiness:\n${options.child.output.join("")}`
      );
    }

    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? "unavailable"}`);
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    once(child, "exit"),
    new Promise((_, reject) => setTimeout(
      () => reject(new Error("Sites preview did not stop after SIGTERM")),
      5_000
    ))
  ]);
}

function reservePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => {
        if (error) reject(error);
        else if (!port) reject(new Error("Failed to reserve a local port"));
        else resolvePort(port);
      });
    });
  });
}
