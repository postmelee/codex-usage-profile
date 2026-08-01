import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SERVICE_ORIGIN
} from "../../../packages/codex-usage-profile-cli/src/config.js";
import {
  DEVICE_APPROVAL_PRODUCTION_ORIGIN
} from "../deviceApproval.js";

const EXPECTED_PRODUCTION_ORIGIN =
  "https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site";

test("CLI and device approval use the same canonical production origin", () => {
  assert.equal(DEFAULT_SERVICE_ORIGIN, DEVICE_APPROVAL_PRODUCTION_ORIGIN);
  assert.equal(DEFAULT_SERVICE_ORIGIN, EXPECTED_PRODUCTION_ORIGIN);

  const url = new URL(DEFAULT_SERVICE_ORIGIN);
  assert.equal(url.protocol, "https:");
  assert.equal(url.origin, DEFAULT_SERVICE_ORIGIN);
  assert.equal(url.pathname, "/");
  assert.equal(url.username, "");
  assert.equal(url.password, "");
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
});
