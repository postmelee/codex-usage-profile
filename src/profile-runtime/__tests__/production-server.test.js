import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  assertProfileBackendStoreContract,
  createMemoryProfileBackendStore
} from "../../profile-backend/index.js";
import {
  assertProfileMediaStoreContract,
  createMemoryProfileMediaStore
} from "../../profile-media/index.js";
import {
  createProductionMediaStore,
  createProductionNodeHandler,
  createProductionStore,
  startProfileProductionServer
} from "../production-server.js";
import {
  assertStaticAssetRoot,
  createStaticAssetHandler
} from "../static-assets.js";

test("serves built assets with SPA fallback without shadowing missing assets", async () => {
  const fixture = createStaticFixture();

  try {
    const handler = createStaticAssetHandler({ rootDirectory: fixture.root });
    const home = await handler(new Request("https://profiles.example.test/"));
    const profile = await handler(new Request("https://profiles.example.test/profile"));
    const asset = await handler(new Request(
      "https://profiles.example.test/assets/app-12345678.js"
    ));
    const missing = await handler(new Request(
      "https://profiles.example.test/assets/missing.js"
    ));
    const head = await handler(new Request(
      "https://profiles.example.test/assets/app-12345678.js",
      { method: "HEAD" }
    ));

    assert.equal(await home.text(), fixture.indexHtml);
    assert.equal(await profile.text(), fixture.indexHtml);
    assert.equal(home.headers.get("cache-control"), "no-cache");
    assert.equal(await asset.text(), fixture.javascript);
    assert.equal(asset.headers.get("content-type"), "text/javascript; charset=utf-8");
    assert.equal(asset.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.equal(asset.headers.get("x-content-type-options"), "nosniff");
    assert.equal(missing.status, 404);
    assert.equal(head.status, 200);
    assert.equal((await head.arrayBuffer()).byteLength, 0);
    assert.equal(
      head.headers.get("content-length"),
      String(Buffer.byteLength(fixture.javascript))
    );
  } finally {
    fixture.cleanup();
  }
});

test("rejects invalid static roots, paths, and unsupported methods", async () => {
  const fixture = createStaticFixture();

  try {
    await assert.rejects(
      assertStaticAssetRoot({ rootDirectory: join(fixture.root, "missing") }),
      /missing index\.html/
    );

    const handler = createStaticAssetHandler({ rootDirectory: fixture.root });
    await assert.rejects(
      handler(new Request("https://profiles.example.test/%5C..%5Csecret")),
      /Invalid asset path/
    );
    const post = await handler(new Request("https://profiles.example.test/", {
      method: "POST"
    }));

    assert.equal(post.status, 405);
    assert.equal(post.headers.get("allow"), "GET, HEAD");
  } finally {
    fixture.cleanup();
  }
});

test("routes health, API, public card, and frontend without leaking health details", async () => {
  const calls = [];
  const frontendHandler = async (request) => {
    calls.push(["frontend", new URL(request.url).pathname]);
    return new Response("<html>app</html>", {
      headers: { "content-type": "text/html; charset=utf-8" }
    });
  };
  const apiHandler = async (request) => {
    const pathname = new URL(request.url).pathname;
    calls.push(["api", pathname]);
    if (pathname.endsWith("card.png")) {
      return new Response(Buffer.from([137, 80, 78, 71]), {
        headers: { "content-type": "image/png" }
      });
    }
    return new Response(JSON.stringify({ ok: false }), {
      status: 401,
      headers: { "content-type": "application/json" }
    });
  };
  const server = await startTestServer({ apiHandler, frontendHandler });

  try {
    const health = await fetch(`${server.url}/healthz`);
    const healthBody = await health.json();
    const healthPost = await fetch(`${server.url}/healthz`, { method: "POST" });
    const account = await fetch(`${server.url}/api/auth/me`);
    const card = await fetch(`${server.url}/u/postmelee/card.png`);
    const frontend = await fetch(`${server.url}/profile`);

    assert.deepEqual(healthBody, { ok: true });
    assert.equal(JSON.stringify(healthBody).includes("store"), false);
    assert.equal(JSON.stringify(healthBody).includes("secret"), false);
    assert.equal(health.headers.get("cache-control"), "no-store");
    assert.equal(healthPost.status, 405);
    assert.equal(account.status, 401);
    assert.equal(card.headers.get("content-type"), "image/png");
    assert.equal(await frontend.text(), "<html>app</html>");
    assert.deepEqual(calls, [
      ["api", "/api/auth/me"],
      ["api", "/u/postmelee/card.png"],
      ["frontend", "/profile"]
    ]);
  } finally {
    await server.close();
  }
});

test("starts the production host on an arbitrary port and closes idempotently", async () => {
  const fixture = createStaticFixture();
  const store = createMemoryProfileBackendStore();
  const mediaStore = createMemoryProfileMediaStore();
  let mediaReadinessCalls = 0;
  let mediaCloseCalls = 0;
  mediaStore.verifyReadiness = async () => {
    mediaReadinessCalls += 1;
  };
  mediaStore.close = async () => {
    mediaCloseCalls += 1;
  };

  try {
    const runtime = await startProfileProductionServer({
      apiHandler: async () => new Response("Not found", { status: 404 }),
      deploymentConfig: {
        bindHost: "127.0.0.1",
        canonicalAppOrigin: "https://profiles.example.test",
        mediaMode: "external",
        port: 0,
        runtimeMode: "production",
        storeMode: "external"
      },
      mediaStore,
      rootDirectory: fixture.root,
      runtimeConfig: {
        githubClientId: null,
        githubClientSecret: null,
        profileStoreFile: "/unused/profile-store.json",
        publicBaseUrl: "https://profiles.example.test",
        secureCookies: true
      },
      store
    });

    assert.match(runtime.url, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.equal((await fetch(`${runtime.url}/healthz`)).status, 200);
    await Promise.all([runtime.close(), runtime.close()]);
    assert.equal(runtime.server.listening, false);
    assert.equal(mediaReadinessCalls, 0);
    assert.equal(mediaCloseCalls, 0);
  } finally {
    fixture.cleanup();
  }
});

test("verifies and closes a runtime-owned media store", async () => {
  const fixture = createStaticFixture();
  const store = createMemoryProfileBackendStore();
  const mediaStore = createMemoryProfileMediaStore();
  const calls = [];
  mediaStore.verifyReadiness = async () => {
    calls.push("ready");
    return { ready: true };
  };
  mediaStore.close = async () => {
    calls.push("close");
  };

  try {
    const runtime = await startProfileProductionServer({
      apiHandler: async () => new Response("Not found", { status: 404 }),
      createMediaStore: () => mediaStore,
      deploymentConfig: {
        bindHost: "127.0.0.1",
        canonicalAppOrigin: "https://profiles.example.test",
        mediaMode: "external",
        port: 0,
        runtimeMode: "production",
        storeMode: "external"
      },
      rootDirectory: fixture.root,
      runtimeConfig: {
        githubClientId: null,
        githubClientSecret: null,
        profileStoreFile: "/unused/profile-store.json",
        publicBaseUrl: "https://profiles.example.test",
        secureCookies: true
      },
      store
    });

    assert.deepEqual(calls, ["ready"]);
    await runtime.close();
    assert.deepEqual(calls, ["ready", "close"]);
  } finally {
    fixture.cleanup();
  }
});

test("fails closed when external storage lacks its connection secret", () => {
  assert.throws(
    () => createProductionStore({
      deploymentConfig: { storeMode: "external" },
      env: {}
    }),
    /NEON_DATABASE_URL is required/
  );
});

test("creates a contract-satisfying Postgres store for external storage", async () => {
  const store = createProductionStore({
    deploymentConfig: { storeMode: "external" },
    env: {
      NEON_DATABASE_URL: "postgres://user:secret@127.0.0.1:5432/profiles"
    }
  });

  try {
    assert.equal(assertProfileBackendStoreContract(store), store);
    assert.equal(typeof store.verifyReadiness, "function");
  } finally {
    await store.close();
  }
});

test("fails closed when external media lacks complete R2 settings", () => {
  assert.throws(
    () => createProductionMediaStore({
      deploymentConfig: {
        mediaMode: "external",
        runtimeMode: "production"
      },
      env: {
        R2_ACCESS_KEY_ID: "r2_access_key",
        R2_BUCKET: "profile-cards",
        R2_ENDPOINT: "https://account.r2.cloudflarestorage.com"
      }
    }),
    /R2_SECRET_ACCESS_KEY is required/
  );
});

test("creates a contract-satisfying external media store without exposing secrets", async () => {
  const mediaStore = createProductionMediaStore({
    deploymentConfig: {
      mediaMode: "external",
      runtimeMode: "production"
    },
    env: {
      R2_ACCESS_KEY_ID: "r2_access_key",
      R2_BUCKET: "profile-cards",
      R2_ENDPOINT: "https://account.r2.cloudflarestorage.com",
      R2_REGION: "auto",
      R2_SECRET_ACCESS_KEY: "r2_secret_value"
    }
  });

  try {
    assert.equal(assertProfileMediaStoreContract(mediaStore), mediaStore);
    assert.equal(typeof mediaStore.verifyReadiness, "function");
    assert.equal(JSON.stringify(mediaStore).includes("r2_secret_value"), false);
  } finally {
    await mediaStore.close();
  }
});

async function startTestServer(options) {
  const { createServer } = await import("node:http");
  const { listen, closeServer, createServerUrl } = await import("../node-http.js");
  const server = createServer(createProductionNodeHandler({
    ...options,
    publicBaseUrl: "http://127.0.0.1"
  }));
  await listen(server, { host: "127.0.0.1", port: 0 });

  return {
    close: () => closeServer(server),
    url: createServerUrl(server, "127.0.0.1")
  };
}

function createStaticFixture() {
  const root = mkdtempSync(join(tmpdir(), "cup-static-"));
  const assets = join(root, "assets");
  const indexHtml = '<!doctype html><div id="root"></div><script src="/assets/app-12345678.js"></script>';
  const javascript = "console.log('app');";
  mkdirSync(assets);
  writeFileSync(join(root, "index.html"), indexHtml);
  writeFileSync(join(assets, "app-12345678.js"), javascript);

  return {
    cleanup: () => rmSync(root, { recursive: true, force: true }),
    indexHtml,
    javascript,
    root
  };
}
