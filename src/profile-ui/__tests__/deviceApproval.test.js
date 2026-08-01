import assert from "node:assert/strict";
import test from "node:test";

import {
  DEVICE_APPROVAL_ERROR_KIND,
  DEVICE_APPROVAL_PRODUCTION_ORIGIN,
  DEVICE_APPROVAL_SUBMIT_COMMAND,
  buildDeviceSubmitCommand,
  classifyDeviceApprovalError,
  createDeviceApprovalGuidance,
  getDeviceApprovalErrorMessage,
  isTerminalDeviceApprovalStatus,
  normalizeDeviceApprovalIntent,
  normalizeDeviceApprovalResult
} from "../deviceApproval.js";

test("normalizes approved and exchanged terminal results", () => {
  assert.deepEqual(normalizeDeviceApprovalResult({
    approvedAt: "2026-07-31T00:00:00.000Z",
    exchangedAt: null,
    intent: "submit",
    status: "approved"
  }), {
    approvedAt: "2026-07-31T00:00:00.000Z",
    exchangedAt: null,
    intent: "submit",
    status: "approved"
  });
  assert.deepEqual(normalizeDeviceApprovalResult({
    approvedAt: "2026-07-31T00:00:00.000Z",
    exchangedAt: "2026-07-31T00:00:01.000Z",
    intent: null,
    status: "exchanged"
  }), {
    approvedAt: "2026-07-31T00:00:00.000Z",
    exchangedAt: "2026-07-31T00:00:01.000Z",
    intent: null,
    status: "exchanged"
  });
  assert.equal(isTerminalDeviceApprovalStatus("approved"), true);
  assert.equal(isTerminalDeviceApprovalStatus("exchanged"), true);
  assert.equal(isTerminalDeviceApprovalStatus("pending"), false);
  assert.throws(
    () => normalizeDeviceApprovalResult({ status: "pending" }),
    /response is invalid/
  );
});

test("keeps only login and submit intents", () => {
  assert.equal(normalizeDeviceApprovalIntent("login"), "login");
  assert.equal(normalizeDeviceApprovalIntent("submit"), "submit");
  assert.equal(normalizeDeviceApprovalIntent(null), null);
  assert.equal(normalizeDeviceApprovalIntent("publish"), null);
});

test("classifies only network, rate-limit, and server errors as retryable", () => {
  for (const status of [0, 429, 500, 503, 599]) {
    assert.deepEqual(classifyDeviceApprovalError({ status }), {
      kind: DEVICE_APPROVAL_ERROR_KIND.RETRYABLE,
      status
    });
  }
  assert.deepEqual(classifyDeviceApprovalError(new TypeError("offline")), {
    kind: DEVICE_APPROVAL_ERROR_KIND.RETRYABLE,
    status: 0
  });
  for (const status of [400, 401, 403, 404, 409, 410, 600]) {
    assert.deepEqual(classifyDeviceApprovalError({ status }), {
      kind: DEVICE_APPROVAL_ERROR_KIND.TERMINAL,
      status
    });
  }
});

test("turns invalid or expired challenges into actionable guidance", () => {
  for (const status of [400, 404, 409, 410]) {
    const error = new Error("CLI login challenge not found");
    error.status = status;
    assert.equal(
      getDeviceApprovalErrorMessage(error, DEVICE_APPROVAL_ERROR_KIND.TERMINAL),
      "This code is invalid or expired. Run the command again in your terminal and enter the new code."
    );
  }

  const retryable = new Error("Approval temporarily unavailable");
  retryable.status = 503;
  assert.equal(
    getDeviceApprovalErrorMessage(retryable, DEVICE_APPROVAL_ERROR_KIND.RETRYABLE),
    "Approval temporarily unavailable"
  );
});

test("builds intent-specific guidance without embedding response metadata", () => {
  const submit = createDeviceApprovalGuidance(
    "submit",
    "http://127.0.0.1:5177"
  );
  const login = createDeviceApprovalGuidance(
    "login",
    "http://127.0.0.1:5177/path?user_code=SECRET#fragment"
  );
  const legacy = createDeviceApprovalGuidance(null, DEVICE_APPROVAL_PRODUCTION_ORIGIN);

  assert.equal(submit.command, null);
  assert.equal(
    submit.message,
    "Authorization is complete. Return to your terminal to continue, and check the terminal for the final submission result."
  );
  assert.equal(
    login.command,
    `${DEVICE_APPROVAL_SUBMIT_COMMAND} --server http://127.0.0.1:5177`
  );
  assert.equal(login.command.includes("SECRET"), false);
  assert.equal(
    login.message,
    "Authorization is complete. Return to your terminal. Run this command when you are ready to submit usage."
  );
  assert.equal(legacy.command, null);
  assert.equal(
    legacy.message,
    "Authorization is complete. Return to your terminal to continue."
  );

  for (const invalidOrigin of ["null", "javascript:alert(1)"]) {
    const fallback = createDeviceApprovalGuidance("login", invalidOrigin);
    assert.equal(fallback.command, null);
    assert.equal(
      fallback.message,
      "Authorization is complete. Return to your terminal to continue."
    );
  }
});

test("uses the default command on production and a normalized local origin elsewhere", () => {
  assert.equal(
    buildDeviceSubmitCommand(DEVICE_APPROVAL_PRODUCTION_ORIGIN),
    DEVICE_APPROVAL_SUBMIT_COMMAND
  );
  assert.equal(
    buildDeviceSubmitCommand("http://localhost:5173/path?query=1#hash"),
    `${DEVICE_APPROVAL_SUBMIT_COMMAND} --server http://localhost:5173`
  );
  assert.throws(
    () => buildDeviceSubmitCommand("https://user:secret@example.com"),
    /absolute HTTP URL/
  );
  assert.throws(
    () => buildDeviceSubmitCommand("javascript:alert(1)"),
    /absolute HTTP URL/
  );
});
