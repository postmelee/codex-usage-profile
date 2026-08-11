import assert from "node:assert/strict";
import test from "node:test";

import { sampleProfileSnapshot } from "../../profile-snapshot/fixtures/sample-snapshot.js";
import {
  loadProfileRouteSnapshot,
  resolveProfileRoute
} from "../profileRoutes.js";

test("keeps the sample preview route ready without API lookup", () => {
  const route = resolveProfileRoute(
    new URL("http://localhost/u/meleeisdeveloping"),
    sampleProfileSnapshot
  );

  assert.equal(route.status, "ready");
  assert.equal(route.source, "sample");
  assert.equal(route.snapshot, sampleProfileSnapshot);
});

test("marks non-sample profile routes as API-backed loading states", () => {
  const route = resolveProfileRoute(
    new URL("http://localhost/u/someone"),
    sampleProfileSnapshot
  );

  assert.deepEqual(route, {
    handle: "someone",
    snapshot: null,
    source: "api",
    status: "loading"
  });
});

test("loads API-backed public snapshots", async () => {
  const route = await loadProfileRouteSnapshot(
    new URL("http://localhost/u/api-only"),
    {
      client: {
        async getPublicSnapshot(handle) {
          assert.equal(handle, "api-only");
          return {
            handle,
            snapshot: sampleProfileSnapshot
          };
        }
      },
      sampleSnapshot: {
        ...sampleProfileSnapshot,
        profile: {
          ...sampleProfileSnapshot.profile,
          displayName: "sample",
          username: "sample-only"
        }
      }
    }
  );

  assert.equal(route.status, "ready");
  assert.equal(route.source, "api");
  assert.equal(route.snapshot, sampleProfileSnapshot);
});

test("converts not found API snapshots into unavailable states", async () => {
  const route = await loadProfileRouteSnapshot(
    new URL("http://localhost/u/missing"),
    {
      client: {
        async getPublicSnapshot() {
          return null;
        }
      },
      sampleSnapshot: sampleProfileSnapshot
    }
  );

  assert.deepEqual(route, {
    handle: "missing",
    snapshot: null,
    source: "api",
    status: "unavailable"
  });
});
