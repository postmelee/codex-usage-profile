import assert from "node:assert/strict";
import test from "node:test";

import {
  assertProfileSnapshot,
  isProfileSnapshot,
  validateProfileSnapshot
} from "../schema.js";
import { sampleProfileSnapshot } from "../fixtures/sample-snapshot.js";

test("validates the sample profile snapshot", () => {
  const result = validateProfileSnapshot(sampleProfileSnapshot);

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(isProfileSnapshot(sampleProfileSnapshot), true);
  assert.equal(assertProfileSnapshot(sampleProfileSnapshot), sampleProfileSnapshot);
});

test("rejects a snapshot without the schema version", () => {
  const candidate = structuredClone(sampleProfileSnapshot);
  delete candidate.schemaVersion;

  const result = validateProfileSnapshot(candidate);

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /\$\.schemaVersion: missing field/);
});

test("rejects invalid usage bucket dates and credits", () => {
  const candidate = structuredClone(sampleProfileSnapshot);
  candidate.dailyUsage[0] = { date: "2026-02-31", credits: -1 };

  const result = validateProfileSnapshot(candidate);

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /\$\.dailyUsage\[0\]\.date: expected valid UTC date/);
  assert.match(result.errors.join("\n"), /\$\.dailyUsage\[0\]\.credits: expected non-negative integer/);
});

test("rejects unknown top-level fields", () => {
  const candidate = structuredClone(sampleProfileSnapshot);
  candidate.access_token = "secret";

  const result = validateProfileSnapshot(candidate);

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /\$\.access_token: unknown field/);
});

test("throws a useful error for invalid snapshots", () => {
  assert.throws(
    () => assertProfileSnapshot({}),
    /Invalid profile snapshot:\n\$\.schemaVersion/
  );
});
