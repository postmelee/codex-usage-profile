import assert from "node:assert/strict";
import test from "node:test";

import { deriveWorkspacePort, resolveE2eOrigin } from "./e2eOrigin.js";

test("normalizes an explicit loopback E2E origin", () => {
  assert.deepEqual(
    resolveE2eOrigin("http://127.0.0.1:5300/", "/repo/task102"),
    { origin: "http://127.0.0.1:5300", port: "5300" }
  );
});

test("uses one deterministic origin for missing and empty environment values", () => {
  const expected = resolveE2eOrigin(undefined, "/repo/.worktrees/task102");

  assert.deepEqual(resolveE2eOrigin("", "/repo/.worktrees/task102"), expected);
  assert.deepEqual(resolveE2eOrigin("   ", "/repo/.worktrees/task102"), expected);
  assert.equal(expected.origin, `http://127.0.0.1:${expected.port}`);
  assert.notEqual(
    expected.port,
    deriveWorkspacePort("/repo/.worktrees/task101")
  );
});

test("rejects unsafe or non-origin E2E values with one actionable error", () => {
  const invalidValues = [
    "https://127.0.0.1:5300",
    "http://localhost:5300",
    "http://127.0.0.1",
    "http://127.0.0.1:5300/path",
    "not-a-url"
  ];

  for (const value of invalidValues) {
    assert.throws(
      () => resolveE2eOrigin(value, "/repo/task102"),
      {
        message:
          "PROFILE_E2E_ORIGIN must be an HTTP 127.0.0.1 origin with an explicit port",
        name: "TypeError"
      },
      value
    );
  }
});
