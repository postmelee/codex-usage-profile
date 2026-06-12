import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validateUsageSnapshotV2 } from "../index.js";

const binPath = fileURLToPath(new URL("../../bin/codex-usage-analyzer.js", import.meta.url));

test("prints UsageSnapshot v2 JSON for analyze --json", () => {
  const result = spawnSync(process.execPath, [binPath, "analyze", "--json"], {
    encoding: "utf8"
  });

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");

  const snapshot = JSON.parse(result.stdout);
  const validation = validateUsageSnapshotV2(snapshot);

  assert.equal(validation.ok, true, validation.errors.join("\n"));
});

test("rejects analyze without --json", () => {
  const result = spawnSync(process.execPath, [binPath, "analyze"], {
    encoding: "utf8"
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Usage: codex-usage-analyzer analyze --json/);
});
