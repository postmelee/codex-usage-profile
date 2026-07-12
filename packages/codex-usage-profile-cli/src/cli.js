import os from "node:os";

import {
  TOKEN_ENV,
  createCredentialStore,
  resolveCredentialSource
} from "./credentials.js";
import {
  normalizeRequestTimeout,
  resolveServiceOrigin
} from "./config.js";
import { loginWithDeviceCode } from "./device-login.js";
import { CliError } from "./errors.js";
import {
  createServiceClient
} from "./service-client.js";

export const CLI_VERSION = "0.1.0";
export const CLI_USAGE = `Usage: codex-usage-profile <command> [options]

Commands:
  login                 Sign in through GitHub device authorization
  status                Check the linked account and latest submit metadata
  logout                Remove locally stored credentials
  submit                Analyze and submit Codex usage

Options:
  --server <origin>      Service origin (or CODEX_USAGE_PROFILE_URL)
  --timeout <ms>        Request timeout in milliseconds
  --json                 Machine-readable status or submit output
  -h, --help             Show help
  -v, --version          Show version`;

const COMMANDS = new Set(["login", "status", "logout", "submit"]);

export async function runCli(argv, options = {}) {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;

  try {
    const parsed = parseCliArgs(argv);
    if (parsed.action === "help") {
      stdout.write(`${CLI_USAGE}\n`);
      return 0;
    }
    if (parsed.action === "version") {
      stdout.write(`${CLI_VERSION}\n`);
      return 0;
    }

    const env = options.env ?? process.env;
    const credentialStore = options.credentialStore ?? createCredentialStore({
      env,
      platform: options.platform,
      homeDirectory: options.homeDirectory
    });

    if (parsed.command === "logout") {
      return await runLogout({ credentialStore, env, stdout });
    }

    const storedCredential = await credentialStore.load();
    const credentialSource = resolveCredentialSource({ env, storedCredential });
    const serviceOrigin = resolveServiceOrigin({
      server: parsed.server,
      env,
      storedOrigin: credentialSource?.source === "file"
        ? credentialSource.serviceOrigin
        : null,
      defaultOrigin: options.defaultServiceOrigin
    });
    const timeoutMs = normalizeRequestTimeout(parsed.timeout);
    const activeCredential = bindCredentialToService({
      command: parsed.command,
      credentialSource,
      serviceOrigin
    });
    const client = (options.createClient ?? createServiceClient)({
      serviceOrigin,
      timeoutMs,
      fetchImpl: options.fetchImpl
    });

    if (parsed.command === "status") {
      return await runStatus({ client, credentialSource: activeCredential, json: parsed.json, stdout });
    }
    if (parsed.command === "login") {
      return await runLogin({
        client,
        credentialSource: activeCredential,
        credentialStore,
        env,
        serviceOrigin,
        stdout,
        login: options.loginWithDeviceCode ?? loginWithDeviceCode,
        loginOptions: {
          label: options.deviceName ?? os.hostname(),
          now: options.now,
          sleep: options.sleep,
          openBrowser: options.openBrowser,
          randomBytes: options.randomBytes
        }
      });
    }

    throw new CliError(
      "submit_not_available",
      "Submit will be enabled after analyzer integration is installed."
    );
  } catch (error) {
    stderr.write(`${formatCliError(error)}\n`);
    return error instanceof CliError ? error.exitCode : 1;
  }
}

export function parseCliArgs(argv) {
  if (!Array.isArray(argv)) {
    throw new TypeError("argv must be an array");
  }
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return { action: "help" };
  }
  if (argv.includes("--version") || argv.includes("-v")) {
    return { action: "version" };
  }

  const [command, ...args] = argv;
  if (!COMMANDS.has(command)) {
    throw new CliError("unknown_command", `Unknown command: ${safeArgument(command)}`);
  }

  const parsed = {
    action: "command",
    command,
    json: false,
    server: null,
    timeout: null
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--json") {
      parsed.json = true;
      continue;
    }
    if (argument === "--server" || argument === "--timeout") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new CliError("missing_option_value", `${argument} requires a value.`);
      }
      parsed[argument === "--server" ? "server" : "timeout"] = value;
      index += 1;
      continue;
    }
    throw new CliError("unknown_option", `Unknown option: ${safeArgument(argument)}`);
  }

  if (parsed.json && !["status", "submit"].includes(command)) {
    throw new CliError("unsupported_option", `--json is not supported by ${command}.`);
  }
  if (command === "logout" && (parsed.server || parsed.timeout)) {
    throw new CliError("unsupported_option", "logout does not use network options.");
  }

  return parsed;
}

async function runStatus({ client, credentialSource, json, stdout }) {
  if (!credentialSource) {
    throw new CliError("login_required", "No credential found. Run login first.");
  }

  const status = projectStatusMetadata(
    await client.getStatus({ token: credentialSource.token })
  );
  if (json) {
    stdout.write(`${JSON.stringify(status, null, 2)}\n`);
  } else {
    stdout.write(`Signed in as @${status.account?.handle ?? "unknown"}\n`);
    stdout.write(status.latestUsage
      ? `Latest usage: ${status.latestUsage.capturedAt}\n`
      : "No usage has been submitted yet.\n");
    if (status.profile?.profileUrl) stdout.write(`Profile: ${status.profile.profileUrl}\n`);
  }

  return 0;
}

function projectStatusMetadata(value) {
  return {
    account: value?.account
      ? {
          handle: value.account.handle ?? null,
          visibility: value.account.visibility ?? null
        }
      : null,
    token: value?.token
      ? {
          id: value.token.id ?? null,
          label: value.token.label ?? null,
          createdAt: value.token.createdAt ?? null,
          expiresAt: value.token.expiresAt ?? null,
          lastUsedAt: value.token.lastUsedAt ?? null
        }
      : null,
    latestUsage: value?.latestUsage
      ? {
          contractVersion: value.latestUsage.contractVersion ?? null,
          capturedAt: value.latestUsage.capturedAt ?? null,
          uploadedAt: value.latestUsage.uploadedAt ?? null,
          revision: value.latestUsage.revision ?? null
        }
      : null,
    profile: value?.profile
      ? {
          handle: value.profile.handle ?? null,
          visibility: value.profile.visibility ?? null,
          profileUrl: value.profile.profileUrl ?? null,
          imageUrl: value.profile.imageUrl ?? null,
          readmeMarkdown: value.profile.readmeMarkdown ?? null
        }
      : null
  };
}

async function runLogin(options) {
  if (options.credentialSource) {
    try {
      const status = await options.client.getStatus({
        token: options.credentialSource.token
      });
      options.stdout.write(`Already signed in as @${status.account?.handle ?? "unknown"}.\n`);
      return 0;
    } catch (error) {
      if (![401, 410].includes(error?.status)) throw error;
      if (options.credentialSource.source === "environment") {
        throw new CliError(
          "environment_token_invalid",
          `The ${TOKEN_ENV} credential is invalid. Unset it before logging in again.`
        );
      }
    }
  }

  await options.login({
    client: options.client,
    credentialStore: options.credentialStore,
    serviceOrigin: options.serviceOrigin,
    stdout: options.stdout,
    ...withoutUndefined(options.loginOptions)
  });
  options.stdout.write("Login complete.\n");
  return 0;
}

async function runLogout({ credentialStore, env, stdout }) {
  const removed = await credentialStore.remove();
  if (removed) stdout.write("Removed locally stored credentials.\n");
  else stdout.write("No locally stored credentials found.\n");

  if (typeof env[TOKEN_ENV] === "string" && env[TOKEN_ENV].trim() !== "") {
    stdout.write(`${TOKEN_ENV} is still active and must be unset in your shell.\n`);
  }
  return 0;
}

function formatCliError(error) {
  if (error instanceof CliError) return error.message;
  return "The command failed unexpectedly.";
}

function safeArgument(value) {
  const text = String(value ?? "");
  return text.startsWith("cup_") ? "[redacted]" : text.slice(0, 120);
}

function bindCredentialToService({ command, credentialSource, serviceOrigin }) {
  if (
    !credentialSource ||
    credentialSource.source !== "file" ||
    credentialSource.serviceOrigin === serviceOrigin
  ) {
    return credentialSource;
  }

  if (command === "login") return null;

  throw new CliError(
    "credential_origin_mismatch",
    "Stored credentials belong to a different service. Run login for this service first."
  );
}

function withoutUndefined(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  );
}
