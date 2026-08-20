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

test("0.1.2 candidate uses canonical while published CLI guidance remains on stage5", () => {
  assert.equal(DEFAULT_SERVICE_ORIGIN, EXPECTED_PRODUCTION_ORIGIN);
  assert.equal(DEVICE_APPROVAL_PUBLISHED_CLI_ORIGIN, STAGE5_ORIGIN);

  const url = new URL(DEFAULT_SERVICE_ORIGIN);
  assert.equal(url.protocol, "https:");
  assert.equal(url.origin, DEFAULT_SERVICE_ORIGIN);
  assert.equal(url.pathname, "/");
  assert.equal(url.username, "");
  assert.equal(url.password, "");
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
});

test("canonical stays an explicit override until npm latest moves to 0.1.2", () => {
  assert.equal(
    buildDeviceSubmitCommand(EXPECTED_PRODUCTION_ORIGIN),
    `npx codex-usage-profile@latest submit --server ${EXPECTED_PRODUCTION_ORIGIN}`
  );
  assert.equal(
    buildDeviceSubmitCommand(STAGE5_ORIGIN),
    "npx codex-usage-profile@latest submit"
  );
});
