import { spawn } from "node:child_process";
import os from "node:os";

import { createDeviceId } from "./credentials.js";
import { CliError, requireNonEmptyString } from "./errors.js";
import { ServiceClientError } from "./service-client.js";

const RETRYABLE_ERROR_CODES = new Set([
  "network_error",
  "request_timeout",
  "rate_limited"
]);

export async function loginWithDeviceCode(options = {}) {
  const {
    client,
    credentialStore,
    serviceOrigin,
    stdout,
    now = () => new Date(),
    sleep = defaultSleep,
    openBrowser = openUrl,
    randomBytes,
    label = os.hostname()
  } = options;

  if (!client || !credentialStore || !stdout) {
    throw new TypeError("client, credentialStore, and stdout are required");
  }

  const started = await client.startDeviceLogin({ label });
  const deviceCode = requireNonEmptyString(started.deviceCode, "deviceCode");
  const userCode = normalizeUserCode(started.userCode);
  const expiresAt = normalizeDate(started.expiresAt, "expiresAt");
  const intervalMs = normalizeInterval(started.intervalSeconds);
  const verificationUrl = resolveVerificationUrl(
    started.verificationUriComplete ?? started.verificationUri,
    serviceOrigin
  );

  stdout.write(`Open ${verificationUrl}\n`);
  stdout.write(`Enter code ${userCode}\n`);
  try {
    await openBrowser(verificationUrl);
  } catch {
    // The URL and code above remain available when automatic opening fails.
  }

  while (normalizeDate(now(), "now").getTime() < expiresAt.getTime()) {
    let result;
    try {
      result = await client.pollDeviceLogin({ deviceCode, label });
    } catch (error) {
      if (!isRetryableError(error)) throw error;
      await sleepWithinExpiry(
        error.retryAfterSeconds ? error.retryAfterSeconds * 1000 : intervalMs,
        expiresAt,
        now,
        sleep
      );
      continue;
    }

    if (result.status === "pending") {
      await sleepWithinExpiry(intervalMs, expiresAt, now, sleep);
      continue;
    }

    if (result.status === "approved" && result.token) {
      const previous = await credentialStore.load();
      const credential = await credentialStore.save({
        token: result.token,
        serviceOrigin,
        tokenRecordId: result.tokenRecord?.id ?? null,
        deviceId: previous?.deviceId ?? createDeviceId(randomBytes)
      });

      return {
        account: result.tokenRecord?.ownerId ?? null,
        credential: {
          serviceOrigin: credential.serviceOrigin,
          tokenRecordId: credential.tokenRecordId,
          deviceId: credential.deviceId
        }
      };
    }

    if (result.status === "expired" || result.status === "exchanged") {
      throw new CliError(
        "device_login_expired",
        "Device login expired. Run login again."
      );
    }

    throw new CliError("device_login_invalid", "The service returned an invalid login state.");
  }

  throw new CliError("device_login_expired", "Device login expired. Run login again.");
}

export function resolveVerificationUrl(value, serviceOrigin) {
  const rawValue = requireNonEmptyString(value, "verification URL");
  const origin = new URL(serviceOrigin).origin;
  const resolved = new URL(rawValue, `${origin}/`);

  if (resolved.origin !== origin || !["http:", "https:"].includes(resolved.protocol)) {
    throw new CliError(
      "device_login_invalid",
      "Device verification URL must use the configured service origin."
    );
  }

  return resolved.toString();
}

export function openUrl(url, options = {}) {
  const platform = options.platform ?? process.platform;
  const spawnImpl = options.spawnImpl ?? spawn;
  const command = platform === "darwin"
    ? "open"
    : platform === "win32"
      ? "rundll32"
      : "xdg-open";
  const args = platform === "win32"
    ? ["url.dll,FileProtocolHandler", url]
    : [url];
  const child = spawnImpl(command, args, {
    detached: true,
    stdio: "ignore"
  });
  child.once("error", () => {});
  child.unref();
}

function normalizeInterval(value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new CliError("device_login_invalid", "Device login interval is invalid.");
  }
  return value * 1000;
}

function normalizeUserCode(value) {
  const userCode = requireNonEmptyString(value, "userCode");
  if (!/^[A-Z0-9-]{6,32}$/i.test(userCode)) {
    throw new CliError("device_login_invalid", "Device user code is invalid.");
  }
  return userCode.toUpperCase();
}

function normalizeDate(value, label) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new CliError("device_login_invalid", `${label} is invalid.`);
  }
  return date;
}

function isRetryableError(error) {
  return error instanceof ServiceClientError && RETRYABLE_ERROR_CODES.has(error.code);
}

async function sleepWithinExpiry(delayMs, expiresAt, now, sleep) {
  const remainingMs = expiresAt.getTime() - normalizeDate(now(), "now").getTime();
  if (remainingMs <= 0) return;
  await sleep(Math.min(Math.max(1, delayMs), remainingMs));
}

function defaultSleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
