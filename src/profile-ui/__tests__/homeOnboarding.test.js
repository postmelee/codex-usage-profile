import assert from "node:assert/strict";
import test from "node:test";

import {
  HOME_QUICKSTART_STEPS,
  HOME_SUBMIT_COMMAND
} from "../homeOnboarding.js";

test("defines the canonical interactive submit command", () => {
  assert.equal(
    HOME_SUBMIT_COMMAND,
    "npx codex-usage-profile@latest submit"
  );
  assert.doesNotMatch(HOME_SUBMIT_COMMAND, /(?:^|\s)(?:--yes|-y)(?:\s|$)/);
  assert.doesNotMatch(
    HOME_SUBMIT_COMMAND,
    /credential|secret|token(?:=|\s)/i
  );
});

test("keeps the Quickstart flow ordered and immutable", () => {
  assert.deepEqual(
    HOME_QUICKSTART_STEPS.map(({ id }) => id),
    [
      "approve-device",
      "submit-usage",
      "review-profile",
      "publish-card",
      "copy-readme"
    ]
  );
  assert.equal(Object.isFrozen(HOME_QUICKSTART_STEPS), true);
  assert.equal(HOME_QUICKSTART_STEPS.every(Object.isFrozen), true);
  assert.equal(
    HOME_QUICKSTART_STEPS.every(({ description, title }) => (
      description.trim() !== "" && title.trim() !== ""
    )),
    true
  );
});
