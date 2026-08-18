import assert from "node:assert/strict";
import test from "node:test";

import {
  runSitesFullStackLocalSmoke
} from "../../../../scripts/smoke-sites-fullstack-local.mjs";

test("runs browser session, real CLI, D1, R2, renderer and publication in one local Worker", async () => {
  const result = await runSitesFullStackLocalSmoke();

  assert.equal(result.canonicalUpdatesVerified, 2);
  assert.equal(result.routesVerified, 67);
  assert.ok(result.publicPngBytes > 10_000);
  assert.ok(result.coldRenderMs > 0);
  assert.ok(result.warmRenderMs > 0);
});
