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
    "/settings",
    "/index.html",
    "/assets/missing.css"
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

function createAssetBinding(handler = () => new Response("missing", { status: 404 })) {
  return {
    fetch(request) {
      return handler(request);
    }
  };
}
