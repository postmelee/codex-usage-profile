import assert from "node:assert/strict";
import test from "node:test";

import {
  createProfileSitesWorker,
  createSitesAssetHandler
} from "../worker.js";

test("Sites Worker routes API and public card requests to the injected backend", async () => {
  const seen = [];
  const worker = createProfileSitesWorker({
    createBackendHandler({ config, environment, executionContext }) {
      assert.equal(config.publicBaseUrl, "https://profile.example");
      assert.equal(environment.marker, "environment");
      assert.equal(executionContext.marker, "context");

      return (request) => {
        seen.push(new URL(request.url).pathname);
        return new Response("backend", { status: 202 });
      };
    }
  });
  const environment = {
    ASSETS: createAssetBinding(),
    marker: "environment"
  };
  const context = { marker: "context" };

  const apiResponse = await worker.fetch(
    new Request("https://profile.example/api/auth/github/callback"),
    environment,
    context
  );
  const cardResponse = await worker.fetch(
    new Request("https://profile.example/u/codex-user/card.png"),
    environment,
    context
  );

  assert.equal(apiResponse.status, 202);
  assert.equal(cardResponse.status, 202);
  assert.deepEqual(seen, [
    "/api/auth/github/callback",
    "/u/codex-user/card.png"
  ]);
});

test("Sites Worker serves direct assets and SPA fallback from ASSETS", async () => {
  const requests = [];
  const environment = {
    ASSETS: createAssetBinding((request) => {
      const pathname = new URL(request.url).pathname;
      requests.push(pathname);
      if (pathname === "/index.html") {
        return new Response("<main>profile app</main>", {
          headers: { "content-type": "text/html" }
        });
      }
      if (pathname === "/assets/app.js") {
        return new Response("export {}", {
          headers: { "content-type": "text/javascript" }
        });
      }
      return new Response("missing", { status: 404 });
    })
  };
  const worker = createProfileSitesWorker();

  const assetResponse = await worker.fetch(
    new Request("https://profile.example/assets/app.js"),
    environment
  );
  const spaResponse = await worker.fetch(
    new Request("https://profile.example/settings"),
    environment
  );
  const missingAssetResponse = await worker.fetch(
    new Request("https://profile.example/assets/missing.css"),
    environment
  );

  assert.equal(assetResponse.status, 200);
  assert.equal(await assetResponse.text(), "export {}");
  assert.equal(spaResponse.status, 200);
  assert.equal(await spaResponse.text(), "<main>profile app</main>");
  assert.equal(missingAssetResponse.status, 404);
  assert.deepEqual(requests, [
    "/assets/app.js",
    "/index.html",
    "/assets/missing.css"
  ]);
});

test("Sites Worker bypasses provider redirects for SPA deep links", async () => {
  const requests = [];
  const environment = {
    ASSETS: createAssetBinding((request) => {
      const pathname = new URL(request.url).pathname;
      requests.push(pathname);
      if (pathname === "/index.html") {
        return new Response("<main>profile app</main>", {
          headers: { "content-type": "text/html" }
        });
      }
      return Response.redirect("https://profile.example/", 302);
    })
  };
  const worker = createProfileSitesWorker();

  for (const pathname of ["/device?user_code=ABCD-1234", "/profile", "/settings"]) {
    const response = await worker.fetch(
      new Request(`https://profile.example${pathname}`),
      environment
    );
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "<main>profile app</main>");
  }
  assert.deepEqual(requests, [
    "/index.html",
    "/index.html",
    "/index.html"
  ]);
});

test("Sites Worker fails closed for backend routes until Stage 2 bindings exist", async () => {
  const worker = createProfileSitesWorker();
  const response = await worker.fetch(
    new Request("https://profile.example/api/auth/me"),
    { ASSETS: createAssetBinding() }
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: {
      code: "sites_backend_unavailable",
      message: "Sites full-stack backend bindings are not configured"
    }
  });
});

test("Sites asset handler reports a missing binding without leaking configuration", async () => {
  const response = await createSitesAssetHandler({})(
    new Request("https://profile.example/")
  );

  assert.equal(response.status, 503);
  assert.equal(await response.text(), "Static asset binding unavailable");
});

test("Sites Worker hides canonical-origin configuration failures", async () => {
  const worker = createProfileSitesWorker();
  const response = await worker.fetch(
    new Request("https://unexpected.example/settings"),
    {
      ASSETS: createAssetBinding(),
      PUBLIC_BASE_URL: "https://profile.example"
    }
  );

  assert.equal(response.status, 503);
  assert.equal(
    await response.text(),
    "Sites runtime configuration is invalid"
  );
  assert.doesNotMatch(
    response.headers.get("content-type") ?? "",
    /application\/json/
  );
});

test("Sites Worker keeps the maintenance route hidden before explicit enablement", async () => {
  let assetRequests = 0;
  const worker = createProfileSitesWorker();
  const response = await worker.fetch(
    new Request("https://profile.example/__ops/profile-maintenance", {
      method: "POST",
      headers: {
        authorization: "Bearer guessed",
        "content-type": "application/json",
        origin: "https://profile.example"
      },
      body: JSON.stringify({ operation: "plan" })
    }),
    {
      ASSETS: createAssetBinding(() => {
        assetRequests += 1;
        return new Response("asset");
      })
    }
  );

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, "not_found");
  assert.equal(assetRequests, 0);
});

test("Sites Worker health reports only generic Worker and binding readiness", async () => {
  const worker = createProfileSitesWorker({ writeEvent: null });
  const healthy = await worker.fetch(
    new Request("https://profile.example/healthz"),
    createRequiredBindingEnvironment()
  );
  assert.equal(healthy.status, 200);
  assert.deepEqual(await healthy.json(), {
    status: "ok",
    worker: "ok",
    bindings: "ok"
  });

  const unavailable = await worker.fetch(
    new Request("https://profile.example/healthz"),
    { ASSETS: createAssetBinding(), privateMetadata: "must-not-leak" }
  );
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get("retry-after"), "5");
  const serialized = JSON.stringify(await unavailable.json());
  assert.equal(serialized, JSON.stringify({
    status: "unavailable",
    worker: "ok",
    bindings: "unavailable"
  }));
  assert.doesNotMatch(serialized, /DB|PROFILE_MEDIA|privateMetadata|must-not-leak/);

  const rejectedMethod = await worker.fetch(
    new Request("https://profile.example/healthz", { method: "POST" }),
    createRequiredBindingEnvironment()
  );
  assert.equal(rejectedMethod.status, 405);
  assert.equal(rejectedMethod.headers.get("allow"), "GET, HEAD");
});

test("Sites Worker applies operational stops before backend execution", async () => {
  let backendCalls = 0;
  const worker = createProfileSitesWorker({
    writeEvent: null,
    createBackendHandler() {
      backendCalls += 1;
      return () => new Response("backend");
    }
  });
  const environment = createRequiredBindingEnvironment({
    PROFILE_STOP_RETRY_AFTER_SECONDS: "720"
  });

  const maintenance = await worker.fetch(
    new Request("https://profile.example/api/profile"),
    { ...environment, PROFILE_SERVICE_MODE: "maintenance" }
  );
  assert.equal(maintenance.status, 503);
  assert.equal(maintenance.headers.get("retry-after"), "720");

  const ownerOnly = await worker.fetch(
    new Request("https://profile.example/u/private-owner/card.png"),
    { ...environment, PROFILE_SERVICE_MODE: "owner-only" }
  );
  assert.equal(ownerOnly.status, 404);

  const quota = await worker.fetch(
    new Request("https://profile.example/api/account-usage/submit", {
      method: "POST"
    }),
    { ...environment, PROFILE_SERVICE_MODE: "quota-stop" }
  );
  assert.equal(quota.status, 429);
  assert.equal(quota.headers.get("retry-after"), "720");
  assert.equal(backendCalls, 0);
});

function createAssetBinding(handler = () => new Response("missing", { status: 404 })) {
  return {
    fetch(request) {
      return handler(request);
    }
  };
}

function createRequiredBindingEnvironment(extra = {}) {
  return {
    ASSETS: createAssetBinding(),
    DB: {
      batch() {},
      prepare() {}
    },
    PROFILE_MEDIA: {
      get() {},
      head() {},
      put() {}
    },
    ...extra
  };
}
