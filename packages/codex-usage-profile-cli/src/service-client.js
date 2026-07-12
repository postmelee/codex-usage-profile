import { normalizeRequestTimeout, normalizeServiceOrigin } from "./config.js";
import { CliError, requireNonEmptyString } from "./errors.js";

export const ACCOUNT_USAGE_DEVICE_ID_HEADER = "x-codex-usage-profile-device-id";
export const ACCOUNT_USAGE_DEVICE_NAME_HEADER = "x-codex-usage-profile-device-name";

export class ServiceClientError extends CliError {
  constructor(code, message, options = {}) {
    super(code, message, options);

    this.name = "ServiceClientError";
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
    this.status = options.status ?? 0;
  }
}

export function createServiceClient(options = {}) {
  const serviceOrigin = normalizeServiceOrigin(options.serviceOrigin);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = normalizeRequestTimeout(options.timeoutMs);
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;

  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetch implementation is required");
  }

  const request = (path, requestOptions = {}) => requestServiceJson({
    serviceOrigin,
    fetchImpl,
    timeoutMs,
    setTimeoutImpl,
    clearTimeoutImpl,
    path,
    ...requestOptions
  });

  return {
    serviceOrigin,

    startDeviceLogin(startOptions = {}) {
      return request("/api/auth/device", {
        body: {
          label: normalizeOptionalString(startOptions.label)
        },
        method: "POST"
      });
    },

    pollDeviceLogin(pollOptions = {}) {
      return request("/api/auth/device/poll", {
        body: {
          deviceCode: requireNonEmptyString(pollOptions.deviceCode, "deviceCode"),
          label: normalizeOptionalString(pollOptions.label)
        },
        method: "POST"
      });
    },

    getStatus(statusOptions = {}) {
      return request("/api/account-usage/status", {
        token: requireNonEmptyString(statusOptions.token, "token")
      });
    },

    submitAccountUsage(submitOptions = {}) {
      const headers = {
        [ACCOUNT_USAGE_DEVICE_ID_HEADER]: requireNonEmptyString(
          submitOptions.deviceId,
          "deviceId"
        )
      };
      const deviceName = normalizeOptionalString(submitOptions.deviceName);
      if (deviceName) headers[ACCOUNT_USAGE_DEVICE_NAME_HEADER] = deviceName;

      return request("/api/account-usage/submit", {
        body: submitOptions.document,
        headers,
        method: "POST",
        token: requireNonEmptyString(submitOptions.token, "token")
      });
    }
  };
}

async function requestServiceJson(options) {
  const controller = new AbortController();
  const timeoutId = options.setTimeoutImpl(() => controller.abort(), options.timeoutMs);
  const headers = {
    accept: "application/json",
    ...options.headers
  };
  const init = {
    headers,
    method: options.method ?? "GET",
    redirect: "error",
    signal: controller.signal
  };

  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  let response;
  try {
    response = await options.fetchImpl(
      new URL(options.path, options.serviceOrigin).toString(),
      init
    );
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ServiceClientError(
        "request_timeout",
        "The service request timed out."
      );
    }
    throw new ServiceClientError(
      "network_error",
      "Could not connect to the service."
    );
  } finally {
    options.clearTimeoutImpl(timeoutId);
  }

  const body = await readJsonBody(response);
  if (!response.ok) {
    throw new ServiceClientError(
      body?.error?.code ?? "request_failed",
      safeServiceErrorMessage(response.status, body?.error?.code),
      {
        retryAfterSeconds: readRetryAfterSeconds(response),
        status: response.status
      }
    );
  }

  if (!body || body.ok !== true || !body.data || typeof body.data !== "object") {
    throw new ServiceClientError(
      "invalid_response",
      "The service returned an invalid response.",
      { status: response.status }
    );
  }

  return body.data;
}

async function readJsonBody(response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) return null;

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function safeServiceErrorMessage(status, code) {
  if (status === 401) return "Authentication is required. Run login again.";
  if (status === 410) return "The stored login has expired or was revoked.";
  if (status === 429) return "The service rate limit was exceeded.";
  if (status >= 500) return "The service is temporarily unavailable.";
  if (code === "conflict") return "The request conflicts with the stored state.";
  return `The service rejected the request with status ${status}.`;
}

function readRetryAfterSeconds(response) {
  const value = Number(response.headers.get("retry-after"));
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : null;
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new CliError("invalid_input", "Expected a string value.");
  }
  const trimmed = value.trim();
  return trimmed || null;
}
