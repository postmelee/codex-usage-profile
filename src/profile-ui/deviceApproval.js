export const DEVICE_APPROVAL_UI_STATUS = Object.freeze({
  IDLE: "idle",
  APPROVING: "approving",
  APPROVED: "approved",
  RETRYABLE_ERROR: "retryable-error",
  TERMINAL_ERROR: "terminal-error"
});

export const DEVICE_APPROVAL_ERROR_KIND = Object.freeze({
  RETRYABLE: "retryable",
  TERMINAL: "terminal"
});

export const DEVICE_APPROVAL_INTENT = Object.freeze({
  LOGIN: "login",
  SUBMIT: "submit"
});

export const DEVICE_APPROVAL_SUBMIT_COMMAND =
  "npx codex-usage-profile@latest submit";
export const DEVICE_APPROVAL_PRODUCTION_ORIGIN =
  "https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site";

export function normalizeDeviceApprovalResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw invalidApprovalResult();
  }
  if (!isTerminalDeviceApprovalStatus(result.status)) {
    throw invalidApprovalResult();
  }

  return {
    status: result.status,
    intent: normalizeDeviceApprovalIntent(result.intent),
    approvedAt: normalizeNullableString(result.approvedAt),
    exchangedAt: normalizeNullableString(result.exchangedAt)
  };
}

export function isTerminalDeviceApprovalStatus(status) {
  return status === "approved" || status === "exchanged";
}

export function normalizeDeviceApprovalIntent(intent) {
  if (
    intent === DEVICE_APPROVAL_INTENT.LOGIN ||
    intent === DEVICE_APPROVAL_INTENT.SUBMIT
  ) {
    return intent;
  }
  return null;
}

export function classifyDeviceApprovalError(error) {
  const status = Number.isInteger(error?.status) ? error.status : 0;
  const retryable = (
    status === 0 ||
    status === 429 ||
    (status >= 500 && status <= 599)
  );

  return {
    kind: retryable
      ? DEVICE_APPROVAL_ERROR_KIND.RETRYABLE
      : DEVICE_APPROVAL_ERROR_KIND.TERMINAL,
    status
  };
}

export function createDeviceApprovalGuidance(intent, currentOrigin) {
  const normalizedIntent = normalizeDeviceApprovalIntent(intent);

  if (normalizedIntent === DEVICE_APPROVAL_INTENT.SUBMIT) {
    return {
      command: null,
      message:
        "Authorization is complete. Return to your terminal to continue, and check the terminal for the final submission result."
    };
  }

  if (normalizedIntent === DEVICE_APPROVAL_INTENT.LOGIN) {
    let command;
    try {
      command = buildDeviceSubmitCommand(currentOrigin);
    } catch {
      return {
        command: null,
        message: "Authorization is complete. Return to your terminal to continue."
      };
    }

    return {
      command,
      message:
        "Authorization is complete. Return to your terminal. Run this command when you are ready to submit usage."
    };
  }

  return {
    command: null,
    message: "Authorization is complete. Return to your terminal to continue."
  };
}

export function buildDeviceSubmitCommand(
  currentOrigin = DEVICE_APPROVAL_PRODUCTION_ORIGIN,
  productionOrigin = DEVICE_APPROVAL_PRODUCTION_ORIGIN
) {
  const normalizedCurrentOrigin = normalizeHttpOrigin(currentOrigin);
  const normalizedProductionOrigin = normalizeHttpOrigin(productionOrigin);

  if (normalizedCurrentOrigin === normalizedProductionOrigin) {
    return DEVICE_APPROVAL_SUBMIT_COMMAND;
  }

  return `${DEVICE_APPROVAL_SUBMIT_COMMAND} --server ${normalizedCurrentOrigin}`;
}

function normalizeHttpOrigin(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    throw new TypeError("Device approval origin must be an absolute HTTP URL");
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.origin === "null"
  ) {
    throw new TypeError("Device approval origin must be an absolute HTTP URL");
  }

  return url.origin;
}

function normalizeNullableString(value) {
  return typeof value === "string" && value.trim() !== ""
    ? value
    : null;
}

function invalidApprovalResult() {
  const error = new Error("Device approval response is invalid.");
  error.status = 400;
  return error;
}
