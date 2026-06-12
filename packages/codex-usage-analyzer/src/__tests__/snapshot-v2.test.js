import assert from "node:assert/strict";
import test from "node:test";

import {
  USAGE_SNAPSHOT_V2_SCHEMA_VERSION,
  assertUsageSnapshotV2,
  isUsageSnapshotV2,
  sampleUsageSnapshotV2,
  validateUsageSnapshotV2
} from "../index.js";

test("exports the canonical UsageSnapshot v2 contract from analyzer", () => {
  assert.equal(USAGE_SNAPSHOT_V2_SCHEMA_VERSION, 2);
  assert.equal(isUsageSnapshotV2(sampleUsageSnapshotV2), true);
  assert.equal(assertUsageSnapshotV2(sampleUsageSnapshotV2), sampleUsageSnapshotV2);
});

test("rejects GitHub-facing fields through the analyzer canonical validator", () => {
  const candidate = structuredClone(sampleUsageSnapshotV2);
  candidate.extensions["tokenmon.cardHints"] = {
    githubAvatarUrl: "https://avatars.example.test/u/1"
  };

  const result = validateUsageSnapshotV2(candidate);

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /githubAvatarUrl: forbidden GitHub-facing field/);
});
