import assert from "node:assert/strict";
import test from "node:test";

import {
  createD1AccountUsageRateLimiter
} from "../d1/rate-limiter.js";
import { createD1TestFixture } from "./_d1-test-fixture.js";

test("D1 rate limiter shares burst counters and returns retry-after", async (t) => {
  const fixture = await createD1TestFixture();
  t.after(() => fixture.dispose());
  await fixture.migrate();
  const options = {
    burstLimit: 2,
    burstWindowMs: 10_000,
    sustainedLimit: 10,
    sustainedWindowMs: 60_000
  };
  const now = "2026-07-23T00:00:01.000Z";

  const results = await Promise.allSettled([
    fixture.rate("token_record_1", now, options),
    fixture.rate("token_record_1", now, options),
    fixture.rate("token_record_1", now, options)
  ]);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");
  assert.equal(fulfilled.length, 2);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.code, "rate_limited");
  assert.equal(rejected[0].reason.status, 429);
  assert.equal(rejected[0].reason.headers["retry-after"], "9");

  const rows = await fixture.inspect("rateLimits");
  assert.equal(
    rows.find((row) => row.window_kind === "burst").request_count,
    2
  );
});

test("D1 rate limiter rolls burst increment back when sustained window rejects", async (t) => {
  const fixture = await createD1TestFixture();
  t.after(() => fixture.dispose());
  await fixture.migrate();
  const options = {
    burstLimit: 2,
    burstWindowMs: 10_000,
    sustainedLimit: 3,
    sustainedWindowMs: 60_000
  };

  await fixture.rate("token_record_2", "2026-07-23T00:00:01.000Z", options);
  await fixture.rate("token_record_2", "2026-07-23T00:00:11.000Z", options);
  await fixture.rate("token_record_2", "2026-07-23T00:00:21.000Z", options);
  await assert.rejects(
    () => fixture.rate("token_record_2", "2026-07-23T00:00:22.000Z", options),
    (error) => error.code === "rate_limited"
  );

  const rows = await fixture.inspect("rateLimits");
  const sustained = rows.find((row) => row.window_kind === "sustained");
  const currentBurst = rows.find((row) =>
    row.window_kind === "burst" &&
    row.window_start_ms === Date.parse("2026-07-23T00:00:20.000Z")
  );
  assert.equal(sustained.request_count, 3);
  assert.equal(currentBurst.request_count, 1);

  await fixture.rate("token_record_2", "2026-07-23T00:01:01.000Z", options);
  const freshRows = await fixture.inspect("rateLimits");
  assert.deepEqual(
    Object.fromEntries(freshRows.map((row) => [row.window_kind, row.request_count])),
    { burst: 1, sustained: 1 }
  );
});

test("D1 rate limiter never stores the raw CLI token", async (t) => {
  const fixture = await createD1TestFixture();
  t.after(() => fixture.dispose());
  await fixture.migrate();
  await fixture.rate(
    "cli_token_record_id",
    "2026-07-23T00:00:01.000Z",
    {
      burstLimit: 2,
      burstWindowMs: 10_000,
      sustainedLimit: 3,
      sustainedWindowMs: 60_000
    }
  );

  const serialized = JSON.stringify(await fixture.inspect("rateLimits"));
  assert.equal(serialized.includes("cup_raw_secret_token"), false);
  assert.equal(serialized.includes("cli_token_record_id"), true);
});

test("D1 rate limiter rejects unbounded direct overrides", () => {
  const database = {
    batch() {},
    prepare() {}
  };

  assert.throws(
    () => createD1AccountUsageRateLimiter({
      database,
      burstLimit: 1_001
    }),
    /burst limit must be between/
  );
  assert.throws(
    () => createD1AccountUsageRateLimiter({
      database,
      sustainedWindowMs: 3_600_001
    }),
    /sustained window must be between/
  );
});
