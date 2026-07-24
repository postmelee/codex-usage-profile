import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  readFile
} from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { Miniflare } from "miniflare";

import {
  loginWithDeviceCode
} from "../packages/codex-usage-profile-cli/src/device-login.js";
import {
  createServiceClient
} from "../packages/codex-usage-profile-cli/src/service-client.js";
import {
  submitAccountUsage
} from "../packages/codex-usage-profile-cli/src/submit.js";

const execFileAsync = promisify(execFile);
const REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  ".."
);
const OUTPUT_ROOT = resolve(
  REPOSITORY_ROOT,
  "dist-sites-fullstack-local-smoke"
);
const WORKER_ROOT = resolve(
  OUTPUT_ROOT,
  "server"
);
const CLIENT_ROOT = resolve(OUTPUT_ROOT, "client");

export async function runSitesFullStackLocalSmoke(options = {}) {
  if (options.skipBuild !== true) {
    await buildLocalSmokeArtifact();
  }

  const workerConfig = JSON.parse(await readFile(
    resolve(WORKER_ROOT, "wrangler.json"),
    "utf8"
  ));
  const workerMain = resolve(WORKER_ROOT, workerConfig.main);
  const miniflare = new Miniflare({
    bindings: {
      GITHUB_CLIENT_ID: "local-smoke-client",
      LOCAL_FULL_STACK_TEST: "1"
    },
    compatibilityDate: "2026-05-15",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: {
      DB: `profile-sites-smoke-${crypto.randomUUID()}`
    },
    host: "127.0.0.1",
    modules: true,
    modulesRoot: dirname(workerMain),
    modulesRules: [
      {
        type: "ESModule",
        include: ["**/*.js", "**/*.mjs"],
        fallthrough: true
      },
      {
        type: "CompiledWasm",
        include: ["**/*.wasm"],
        fallthrough: true
      },
      {
        type: "Data",
        include: ["**/*.bin"],
        fallthrough: true
      },
      {
        type: "Text",
        include: ["**/*.sql"],
        fallthrough: true
      }
    ],
    port: 0,
    r2Buckets: ["PROFILE_MEDIA"],
    scriptPath: workerMain,
    serviceBindings: {
      ASSETS: createAssetServiceBinding(CLIENT_ROOT)
    }
  });

  try {
    const ready = await miniflare.ready;
    const origin = ready.origin;
    const migrated = await requestJson(origin, "POST", "/__local/migrate");
    assert.equal(migrated.response.status, 200);
    assert.deepEqual(migrated.body.result.appliedVersions, [1, 2]);

    const spa = await fetch(new URL("/settings", origin));
    assert.equal(spa.status, 200);
    assert.match(await spa.text(), /<div id="root"><\/div>/);

    let sessionCookie = null;
    const serviceClient = createServiceClient({
      serviceOrigin: origin,
      timeoutMs: 15_000
    });
    const credentialStore = createMemoryCredentialStore();
    const cliOutput = [];

    await loginWithDeviceCode({
      client: serviceClient,
      credentialStore,
      env: { FORCE_HYPERLINK: "0" },
      hyperlinks: false,
      label: "Local smoke CLI",
      openBrowser: async (verificationUrl) => {
        const verification = new URL(verificationUrl);
        const userCode = verification.searchParams.get("user_code");
        assert.ok(userCode);

        const login = await fetch(new URL(
          `/api/auth/github/login?redirect_to=${encodeURIComponent(
            `${verification.pathname}${verification.search}`
          )}`,
          origin
        ), {
          headers: { accept: "application/json" },
          redirect: "manual"
        });
        assert.equal(login.status, 302);
        const state = new URL(login.headers.get("location")).searchParams.get("state");
        assert.ok(state);

        const callback = await fetch(new URL(
          `/api/auth/github/callback?code=local-oauth-code&state=${encodeURIComponent(state)}`,
          origin
        ), {
          headers: { accept: "application/json" },
          redirect: "manual"
        });
        assert.equal(callback.status, 200);
        sessionCookie = readCookie(callback);
        assert.ok(sessionCookie);

        const approved = await requestJson(
          origin,
          "POST",
          "/api/auth/device/authorize",
          { userCode },
          sessionHeaders(origin, sessionCookie)
        );
        assert.equal(approved.response.status, 200);
        assert.equal(approved.body.data.status, "approved");
      },
      randomBytes: (size) => Buffer.alloc(size, 7),
      serviceOrigin: origin,
      stdout: {
        isTTY: false,
        write(value) {
          cliOutput.push(String(value));
        }
      }
    });

    assert.ok(sessionCookie);
    assert.match(cliOutput.join(""), /Enter code/);
    const credential = await credentialStore.load();
    assert.match(credential.token, /^cup_/);

    const usageDocument = createUsageDocument();
    const submitted = await submitAccountUsage({
      client: serviceClient,
      deviceId: credential.deviceId,
      deviceName: "Local smoke CLI",
      readAccountUsage: async () => usageDocument,
      token: credential.token
    });
    assert.equal(submitted.profile.handle, "local-owner");
    assert.equal(submitted.profile.visibility, "private");

    const privateProfile = await requestJson(
      origin,
      "GET",
      "/api/profile",
      undefined,
      { cookie: sessionCookie }
    );
    assert.equal(privateProfile.body.data.visibility, "private");

    const coldStartedAt = performance.now();
    const privateCard = await fetch(new URL(
      "/api/profile/card.png?locale=ko",
      origin
    ), {
      headers: { cookie: sessionCookie }
    });
    const privatePng = new Uint8Array(await privateCard.arrayBuffer());
    const coldRenderMs = performance.now() - coldStartedAt;
    assert.equal(privateCard.status, 200);
    assert.deepEqual(readPngDimensions(privatePng), {
      height: 918,
      width: 1497
    });

    const missingBeforePublish = await fetch(new URL(
      "/u/local-owner/card.png",
      origin
    ));
    assert.equal(missingBeforePublish.status, 404);

    const publishStartedAt = performance.now();
    const published = await requestJson(
      origin,
      "PATCH",
      "/api/profile",
      { visibility: "public" },
      sessionHeaders(origin, sessionCookie)
    );
    const publishRenderMs = performance.now() - publishStartedAt;
    assert.equal(published.response.status, 200);
    assert.equal(published.body.data.visibility, "public");

    const publicProfile = await requestJson(
      origin,
      "GET",
      "/api/profiles/public/local-owner"
    );
    assert.equal(publicProfile.response.status, 200);
    assert.equal(publicProfile.body.data.owner.handle, "local-owner");

    const publicCard = await fetch(new URL(
      "/u/local-owner/card.png?locale=ko",
      origin
    ));
    const publicPng = new Uint8Array(await publicCard.arrayBuffer());
    assert.equal(publicCard.status, 200);
    assert.deepEqual(readPngDimensions(publicPng), {
      height: 918,
      width: 1497
    });
    const etag = publicCard.headers.get("etag");
    assert.match(etag, /^"[A-Za-z0-9_-]{43}"$/);

    const head = await fetch(new URL(
      "/u/local-owner/card.png?locale=ko",
      origin
    ), { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal((await head.arrayBuffer()).byteLength, 0);
    assert.equal(head.headers.get("etag"), etag);

    const notModified = await fetch(new URL(
      "/u/local-owner/card.png?locale=ko",
      origin
    ), {
      headers: { "if-none-match": etag }
    });
    assert.equal(notModified.status, 304);

    const warmStartedAt = performance.now();
    const warmPrivateCard = await fetch(new URL(
      "/api/profile/card.png?locale=ko",
      origin
    ), {
      headers: { cookie: sessionCookie }
    });
    await warmPrivateCard.arrayBuffer();
    const warmRenderMs = performance.now() - warmStartedAt;
    assert.equal(warmPrivateCard.status, 200);

    const unpublished = await requestJson(
      origin,
      "PATCH",
      "/api/profile",
      { visibility: "private" },
      sessionHeaders(origin, sessionCookie)
    );
    assert.equal(unpublished.response.status, 200);
    assert.equal(unpublished.body.data.visibility, "private");

    const missingAfterUnpublish = await fetch(new URL(
      "/u/local-owner/card.png",
      origin
    ));
    assert.equal(missingAfterUnpublish.status, 404);
    const privatePublicProfile = await fetch(new URL(
      "/api/profiles/public/local-owner",
      origin
    ));
    assert.equal(privatePublicProfile.status, 404);

    return Object.freeze({
      coldRenderMs: roundMilliseconds(coldRenderMs),
      publicPngBytes: publicPng.byteLength,
      publishRenderMs: roundMilliseconds(publishRenderMs),
      routesVerified: 15,
      warmRenderMs: roundMilliseconds(warmRenderMs)
    });
  } finally {
    await miniflare.dispose();
  }
}

async function buildLocalSmokeArtifact() {
  const executable = process.platform === "win32" ? "npm.cmd" : "npm";
  await execFileAsync(executable, ["run", "build:sites-fullstack"], {
    cwd: REPOSITORY_ROOT,
    env: {
      ...process.env,
      SITES_FULLSTACK_LOCAL_SMOKE: "1"
    },
    maxBuffer: 10 * 1024 * 1024
  });
}

function createAssetServiceBinding(rootDirectory) {
  return async function serveAsset(request) {
    const url = new URL(request.url);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const relativePath = decodeURIComponent(pathname).replace(/^\/+/, "");
    const candidate = resolve(rootDirectory, relativePath);
    if (
      candidate !== rootDirectory &&
      !candidate.startsWith(`${rootDirectory}/`)
    ) {
      return new Response("Not found", { status: 404 });
    }

    try {
      await access(candidate);
      const body = await readFile(candidate);
      return new Response(body, {
        headers: {
          "content-type": contentTypeFor(candidate)
        }
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  };
}

function createMemoryCredentialStore() {
  let credential = null;
  return {
    async load() {
      return credential ? { ...credential } : null;
    },
    async save(value) {
      credential = { ...value };
      return { ...credential };
    }
  };
}

function createUsageDocument() {
  const capturedAt = new Date().toISOString();
  return {
    contractVersion: 1,
    capturedAt,
    summary: {
      lifetimeTokens: 14_350_000_000,
      peakDailyTokens: 700_000_000,
      longestRunningTurnSec: 6_780,
      currentStreakDays: 7,
      longestStreakDays: 49
    },
    dailyUsageBuckets: [
      {
        startDate: capturedAt.slice(0, 10),
        tokens: 700_000_000
      }
    ]
  };
}

async function requestJson(origin, method, pathname, body, headers = {}) {
  const requestHeaders = new Headers(headers);
  const init = {
    headers: requestHeaders,
    method
  };
  if (body !== undefined) {
    requestHeaders.set("content-type", "application/json");
    init.body = JSON.stringify(body);
  }
  const response = await fetch(new URL(pathname, origin), init);
  return {
    body: await response.json(),
    response
  };
}

function sessionHeaders(origin, cookie) {
  return {
    cookie,
    origin,
    "sec-fetch-site": "same-origin"
  };
}

function readCookie(response) {
  return response.headers.get("set-cookie")?.split(";", 1)[0] ?? null;
}

function readPngDimensions(bytes) {
  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength
  );
  return {
    height: view.getUint32(20),
    width: view.getUint32(16)
  };
}

function contentTypeFor(path) {
  return {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".png": "image/png"
  }[extname(path)] ?? "application/octet-stream";
}

function roundMilliseconds(value) {
  return Number(value.toFixed(2));
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;

if (invokedPath === import.meta.url) {
  try {
    const result = await runSitesFullStackLocalSmoke();
    console.log(JSON.stringify({ ok: true, ...result }));
  } catch (error) {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  }
}
