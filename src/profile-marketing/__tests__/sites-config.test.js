import assert from "node:assert/strict";
import test from "node:test";

import { buildMarketingOperatorCardUrl } from "../marketing-config.js";
import {
  createSitesMarketingConfig,
  validateSitesHostingManifest
} from "../sites-config.js";
import { handleSitesRequest } from "../sites-worker.js";

test("creates an operator-card Sites config with a static fallback and Cloud Run CTA", () => {
  const config = createSitesMarketingConfig({
    DEV: false,
    VITE_CANONICAL_APP_URL: "https://profiles.example.test/app"
  });

  assert.equal(config.canonicalAppUrl, "https://profiles.example.test/app");
  assert.equal(config.appHref, "https://profiles.example.test/");
  assert.deepEqual(config.copyOverrides, {});
  assert.equal(config.operatorCardHandle, "postmelee");
  assert.equal(
    buildMarketingOperatorCardUrl(config, "en"),
    "/u/postmelee/card.png?locale=en"
  );
  assert.equal(config.sampleCardUrl, "/assets/codex-card-sample.png");
});

test("uses the current loopback origin only for local Sites development", () => {
  const localConfig = createSitesMarketingConfig(
    { DEV: true },
    { currentOrigin: "http://127.0.0.1:5173" }
  );
  const productionConfig = createSitesMarketingConfig(
    { DEV: false },
    { currentOrigin: "http://127.0.0.1:5173" }
  );

  assert.equal(localConfig.appHref, "http://127.0.0.1:5173/");
  assert.equal(productionConfig.appHref, null);
});

test("rejects unexpected Vite-exposed environment values", () => {
  assert.throws(
    () => createSitesMarketingConfig({
      DEV: false,
      VITE_GITHUB_CLIENT_SECRET: "must-not-be-public"
    }),
    /unsupported public keys/
  );
});

test("keeps the marketing artifact manifest free of storage bindings and secrets", () => {
  assert.deepEqual(validateSitesHostingManifest({
    d1: null,
    r2: null
  }), { d1: null, r2: null });
  assert.throws(
    () => validateSitesHostingManifest({ d1: "database", r2: null }),
    /must not enable D1 or R2/
  );
  assert.throws(
    () => validateSitesHostingManifest({
      d1: null,
      githubClientSecret: "secret",
      r2: null
    }),
    /unsupported keys/
  );
});

test("serves static assets and falls back to the marketing index for GET routes", async () => {
  const requestedPaths = [];
  const environment = {
    ASSETS: {
      async fetch(request) {
        const path = new URL(request.url).pathname;
        requestedPaths.push(path);
        return path === "/index.html"
          ? new Response("marketing", { status: 200 })
          : new Response("missing", { status: 404 });
      }
    }
  };

  const response = await handleSitesRequest(
    new Request("https://marketing.example.test/quickstart"),
    environment
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "marketing");
  assert.deepEqual(requestedPaths, ["/quickstart", "/index.html"]);
});

test("does not turn missing non-GET routes into the marketing shell", async () => {
  const environment = {
    ASSETS: {
      async fetch() {
        return new Response("missing", { status: 404 });
      }
    }
  };

  const response = await handleSitesRequest(
    new Request("https://marketing.example.test/submit", { method: "POST" }),
    environment
  );

  assert.equal(response.status, 404);
});
