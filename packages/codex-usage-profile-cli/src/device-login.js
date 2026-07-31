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
const HYPERLINK_TERM_PROGRAMS = new Set([
  "Hyper",
  "WezTerm",
  "WarpTerminal",
  "iTerm.app",
  "vscode"
]);
const ANSI_CYAN = "\u001B[36m";
const ANSI_DEFAULT_FOREGROUND = "\u001B[39m";

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
    label = os.hostname(),
    intent,
    env = process.env,
    hyperlinks
  } = options;

  if (!client || !credentialStore || !stdout) {
    throw new TypeError("client, credentialStore, and stdout are required");
  }

  const started = await client.startDeviceLogin({
    label,
    ...(intent === undefined ? {} : { intent })
  });
  const deviceCode = requireNonEmptyString(started.deviceCode, "deviceCode");
  const userCode = normalizeUserCode(started.userCode);
  const expiresAt = normalizeDate(started.expiresAt, "expiresAt");
  const intervalMs = normalizeInterval(started.intervalSeconds);
  const verificationUrl = resolveVerificationUrl(
    started.verificationUriComplete ?? started.verificationUri,
    serviceOrigin
  );

  const hyperlinkEnabled = hyperlinks !== false && supportsTerminalHyperlinks({
    env,
    stdout
  });
  stdout.write(`Open ${formatTerminalHyperlink(verificationUrl, {
    enabled: hyperlinkEnabled
  })}\n`);
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

export function formatTerminalHyperlink(url, options = {}) {
  const value = requireNonEmptyString(url, "terminal URL");
  if (options.enabled !== true) return value;
  return `${ANSI_CYAN}\u001B]8;;${value}\u001B\\${value}\u001B]8;;\u001B\\${ANSI_DEFAULT_FOREGROUND}`;
}

export function supportsTerminalHyperlinks(options = {}) {
  const stdout = options.stdout;
  const env = options.env ?? process.env;

  if (stdout?.isTTY !== true || env.TERM === "dumb" || env.FORCE_HYPERLINK === "0") {
    return false;
  }
  if (env.FORCE_HYPERLINK === "1") return true;
  if (HYPERLINK_TERM_PROGRAMS.has(env.TERM_PROGRAM)) return true;
  if (typeof env.WT_SESSION === "string" && env.WT_SESSION !== "") return true;
  if (/kitty/i.test(env.TERM ?? "")) return true;

  const vteVersion = Number.parseInt(env.VTE_VERSION ?? "", 10);
  return Number.isSafeInteger(vteVersion) && vteVersion >= 5000;
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
