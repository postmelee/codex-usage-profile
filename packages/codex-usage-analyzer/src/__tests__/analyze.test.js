import assert from "node:assert/strict";
import test from "node:test";

import {
  ANALYZER_NAME,
  ANALYZER_VERSION,
  analyzeUsage,
  createSampleUsageSnapshotV2,
  validateUsageSnapshotV2
} from "../index.js";

test("analyzes usage into a UsageSnapshot v2 shaped object", async () => {
  const snapshot = await analyzeUsage();
  const result = validateUsageSnapshotV2(snapshot);

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(snapshot.producer.name, ANALYZER_NAME);
  assert.equal(snapshot.producer.version, ANALYZER_VERSION);
});

test("creates a sample UsageSnapshot v2 with safe overrides", () => {
  const snapshot = createSampleUsageSnapshotV2({
    capturedAt: "2026-06-13T00:00:00.000Z",
    usage: {
      totalTokens: 42
    }
  });
  const result = validateUsageSnapshotV2(snapshot);

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(snapshot.capturedAt, "2026-06-13T00:00:00.000Z");
  assert.equal(snapshot.usage.totalTokens, 42);
  assert.equal(snapshot.usage.tokenBreakdown.inputTokens, 646900000);
});
