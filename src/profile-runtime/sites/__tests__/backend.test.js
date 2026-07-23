import assert from "node:assert/strict";
import test from "node:test";

import {
  PROFILE_SITES_BACKEND_UNAVAILABLE_CODE,
  createProfileSitesBackendDependencies,
  createProfileSitesBackendHandler
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

test("Sites backend remains fail-closed until the Stage 4 API factory is present", async () => {
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
});
