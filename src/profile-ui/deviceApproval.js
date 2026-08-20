import { formatMessage } from "./i18n.js";

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
// Keep this aligned with the public npm `latest` default. Alternative
// deployments, including stage5 and local development, must stay explicit.
export const DEVICE_APPROVAL_PUBLISHED_CLI_ORIGIN =
  "https://codex-usage-profile.meleeisdeveloping.chatgpt.site";

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

export function getDeviceApprovalErrorMessage(error, kind, locale = "en") {
  return formatMessage(locale, getDeviceApprovalErrorMessageId(error, kind));
}

export function getDeviceApprovalErrorMessageId(error, kind) {
  const status = Number.isInteger(error?.status) ? error.status : 0;

  if (
    kind === DEVICE_APPROVAL_ERROR_KIND.TERMINAL &&
    [400, 404, 409, 410].includes(status)
  ) {
    return "device.error.invalidCode";
  }

  return kind === DEVICE_APPROVAL_ERROR_KIND.RETRYABLE
    ? "device.error.temporary"
    : "device.error.failed";
}

export function createDeviceApprovalGuidance(intent, currentOrigin, locale = "en") {
  const normalizedIntent = normalizeDeviceApprovalIntent(intent);

  if (normalizedIntent === DEVICE_APPROVAL_INTENT.SUBMIT) {
    return {
      command: null,
      message: formatMessage(locale, "device.guidance.submit")
    };
  }

  if (normalizedIntent === DEVICE_APPROVAL_INTENT.LOGIN) {
    let command;
    try {
      command = buildDeviceSubmitCommand(currentOrigin);
    } catch {
      return {
        command: null,
        message: formatMessage(locale, "device.guidance.default")
      };
    }

    return {
      command,
      message: formatMessage(locale, "device.guidance.login")
    };
  }

  return {
    command: null,
    message: formatMessage(locale, "device.guidance.default")
  };
}

export function buildDeviceSubmitCommand(
  currentOrigin = DEVICE_APPROVAL_PUBLISHED_CLI_ORIGIN,
  publishedCliOrigin = DEVICE_APPROVAL_PUBLISHED_CLI_ORIGIN
) {
  const normalizedCurrentOrigin = normalizeHttpOrigin(currentOrigin);
  const normalizedPublishedCliOrigin = normalizeHttpOrigin(publishedCliOrigin);

  if (normalizedCurrentOrigin === normalizedPublishedCliOrigin) {
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
