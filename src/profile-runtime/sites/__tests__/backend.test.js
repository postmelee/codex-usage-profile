import assert from "node:assert/strict";
import test from "node:test";

import {
  PROFILE_SITES_BACKEND_UNAVAILABLE_CODE,
  PROFILE_SITES_MAINTENANCE_CODE,
  PROFILE_SITES_QUOTA_STOP_CODE,
  createProfileSitesBackendDependencies,
  createProfileSitesBackendHandler,
  createProfileSitesOperationalStopResponse
} from "../backend.js";

test("Sites backend injects one D1 store and shared rate limiter into the API seam", async () => {
  const database = {
    batch() {},
    prepare() {}
  };
  const store = { name: "d1-store" };
  const rateLimiter = { name: "d1-rate-limiter" };
  let received;
  const handler = createProfileSitesBackendHandler({
    database,
    store,
    rateLimiter,
    createBackendApiHandler(dependencies) {
      received = dependencies;
      return () => new Response("ready");
    }
  });

  assert.deepEqual(received, {
    database,
    rateLimiter,
    store
  });
  assert.equal(await (await handler(new Request("https://profile.test/api/me"))).text(), "ready");
});

test("Sites backend requires a real D1-shaped binding for dependency creation", () => {
  assert.throws(
    () => createProfileSitesBackendDependencies({
      database: {}
    }),
    /Sites D1 DB binding is required/
  );
});

test("Sites backend injects the native PROFILE_MEDIA binding adapter", () => {
  const database = {
    batch() {},
    prepare() {}
  };
  const media = {
    get() {},
    head() {},
    put() {}
  };
  const dependencies = createProfileSitesBackendDependencies({
    database,
    media,
    rateLimiter: { name: "rate-limiter" },
    store: { name: "store" }
  });

  assert.equal(dependencies.media, media);
  assert.equal(typeof dependencies.mediaStore.getPublishedCard, "function");
  assert.equal(typeof dependencies.mediaStore.inspectStableCard, "function");
  assert.equal(typeof dependencies.mediaStore.unpublishCard, "function");
});

test("Sites backend remains fail-closed without complete D1/R2 composition", async () => {
  const handler = createProfileSitesBackendHandler({
    database: {
      batch() {},
      prepare() {}
    }
  });
  const response = await handler(new Request("https://profile.test/api/me"));
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.error.code, PROFILE_SITES_BACKEND_UNAVAILABLE_CODE);
  assert.equal(response.headers.get("retry-after"), "5");
});

test("Sites backend fixes maintenance, owner-only, and quota stop semantics", async () => {
  const maintenance = createProfileSitesOperationalStopResponse(
    new Request("https://profile.test/api/auth/me"),
    {
      serviceMode: "maintenance",
      stopRetryAfterSeconds: 600
    }
  );
  assert.equal(maintenance.status, 503);
  assert.equal(maintenance.headers.get("retry-after"), "600");
  assert.equal(
    (await maintenance.json()).error.code,
    PROFILE_SITES_MAINTENANCE_CODE
  );

  const ownerOnly = createProfileSitesOperationalStopResponse(
    new Request("https://profile.test/u/private-owner/card.png"),
    {
      serviceMode: "owner-only",
      stopRetryAfterSeconds: 600
    }
  );
  assert.equal(ownerOnly.status, 404);
  assert.equal((await ownerOnly.json()).error.code, "not_found");

  // The public profile document and its social image close with the rest of
  // the public surface, otherwise owner-only would still expose Open Graph
  // thumbnails to external crawlers.
  for (const pathname of ["/u/private-owner", "/u/private-owner/social.png"]) {
    const stopped = createProfileSitesOperationalStopResponse(
      new Request(`https://profile.test${pathname}`),
      { serviceMode: "owner-only" }
    );
    assert.equal(stopped.status, 404, pathname);
    assert.equal((await stopped.json()).error.code, "not_found", pathname);
  }
  const queryDocument = createProfileSitesOperationalStopResponse(
    new Request("https://profile.test/?profile=private-owner"),
    { serviceMode: "owner-only" }
  );
  assert.equal(queryDocument.status, 404);
  assert.equal((await queryDocument.json()).error.code, "not_found");
  assert.equal(
    createProfileSitesOperationalStopResponse(
      new Request("https://profile.test/u/private-owner"),
      { serviceMode: "normal" }
    ),
    null
  );

  const quota = createProfileSitesOperationalStopResponse(
    new Request("https://profile.test/api/account-usage/submit", {
      method: "POST"
    }),
    {
      serviceMode: "quota-stop",
      stopRetryAfterSeconds: 900
    }
  );
  assert.equal(quota.status, 429);
  assert.equal(quota.headers.get("retry-after"), "900");
  assert.equal((await quota.json()).error.code, PROFILE_SITES_QUOTA_STOP_CODE);

  assert.equal(
    createProfileSitesOperationalStopResponse(
      new Request("https://profile.test/api/profile"),
      { serviceMode: "owner-only" }
    ),
    null
  );
});
