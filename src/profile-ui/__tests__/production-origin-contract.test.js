import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SERVICE_ORIGIN
} from "../../../packages/codex-usage-profile-cli/src/config.js";
import {
  DEVICE_APPROVAL_PUBLISHED_CLI_ORIGIN,
  buildDeviceSubmitCommand
} from "../deviceApproval.js";

const EXPECTED_PRODUCTION_ORIGIN =
  "https://codex-usage-profile.meleeisdeveloping.chatgpt.site";
const STAGE5_ORIGIN =
  "https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site";

test("published CLI and device guidance use the canonical production origin", () => {
  assert.equal(DEFAULT_SERVICE_ORIGIN, EXPECTED_PRODUCTION_ORIGIN);
  assert.equal(DEVICE_APPROVAL_PUBLISHED_CLI_ORIGIN, EXPECTED_PRODUCTION_ORIGIN);

  const url = new URL(DEFAULT_SERVICE_ORIGIN);
  assert.equal(url.protocol, "https:");
  assert.equal(url.origin, DEFAULT_SERVICE_ORIGIN);
  assert.equal(url.pathname, "/");
  assert.equal(url.username, "");
  assert.equal(url.password, "");
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
});

test("production uses the default command and stage5 stays an explicit override", () => {
  assert.equal(
    buildDeviceSubmitCommand(EXPECTED_PRODUCTION_ORIGIN),
    "npx codex-usage-profile@latest submit"
  );
  assert.equal(
    buildDeviceSubmitCommand(STAGE5_ORIGIN),
    `npx codex-usage-profile@latest submit --server ${STAGE5_ORIGIN}`
  );
});
