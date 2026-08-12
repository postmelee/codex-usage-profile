import os from "node:os";
import { readAccountUsage as defaultReadAccountUsage } from "codex-usage-analyzer";

import {
  TOKEN_ENV,
  createCredentialStore,
  createDeviceId,
  resolveCredentialSource
} from "./credentials.js";
import {
  DEFAULT_SERVICE_ORIGIN,
  normalizeRequestTimeout,
  resolveServiceOrigin
} from "./config.js";
import { loginWithDeviceCode } from "./device-login.js";
import { CliError } from "./errors.js";
import { maybePromptGithubStar as defaultMaybePromptGithubStar } from "./github-star.js";
import { writeSubmitOutput } from "./output.js";
import {
  createServiceClient
} from "./service-client.js";
import { submitAccountUsage } from "./submit.js";

export const CLI_VERSION = "0.1.1";
export const CLI_USAGE = `Usage: codex-usage-profile <command> [options]

Commands:
  login                 Sign in through GitHub device authorization
  status                Check the linked account and latest submit metadata
  logout                Remove locally stored credentials
  submit                Analyze and submit Codex usage

Options:
  --server <origin>      Override service origin (or CODEX_USAGE_PROFILE_URL)
  --timeout <ms>        Request timeout in milliseconds
  --json                 Machine-readable status or submit output
  -h, --help             Show help
  -v, --version          Show version

Default service: ${DEFAULT_SERVICE_ORIGIN}`;

const COMMANDS = new Set(["login", "status", "logout", "submit"]);

export async function runCli(argv, options = {}) {
  const stdin = options.stdin ?? process.stdin;
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
      defaultOrigin: options.defaultServiceOrigin ?? DEFAULT_SERVICE_ORIGIN
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
        stdin,
        stdout,
        login: options.loginWithDeviceCode ?? loginWithDeviceCode,
        maybePromptGithubStar: options.maybePromptGithubStar ?? defaultMaybePromptGithubStar,
        loginOptions: {
          label: options.deviceName ?? os.hostname(),
          now: options.now,
          sleep: options.sleep,
          openBrowser: options.openBrowser,
          randomBytes: options.randomBytes,
          env,
          hyperlinks: parsed.json ? false : undefined
        }
      });
    }
    return await runSubmit({
      client,
      credentialSource: activeCredential,
      credentialStore,
      env,
      serviceOrigin,
      stdin,
      stdout,
      json: parsed.json,
      timeoutMs,
      readAccountUsage: options.readAccountUsage ?? defaultReadAccountUsage,
      login: options.loginWithDeviceCode ?? loginWithDeviceCode,
      maybePromptGithubStar: options.maybePromptGithubStar ?? defaultMaybePromptGithubStar,
      deviceName: options.deviceName ?? os.hostname(),
      now: options.now,
      sleep: options.sleep,
      openBrowser: options.openBrowser,
      randomBytes: options.randomBytes,
      hyperlinks: parsed.json ? false : undefined
    });
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
    await client.getStatus({ token: credentialSource.token }),
    { forbiddenValues: [credentialSource.token] }
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

function projectStatusMetadata(value, options = {}) {
  const sanitize = (item) => sanitizeOutputString(item, options.forbiddenValues);
  return {
    account: value?.account
      ? {
          handle: sanitize(value.account.handle),
          visibility: sanitize(value.account.visibility)
        }
      : null,
    token: value?.token
      ? {
          id: sanitize(value.token.id),
          label: sanitize(value.token.label),
          createdAt: sanitize(value.token.createdAt),
          expiresAt: sanitize(value.token.expiresAt),
          lastUsedAt: sanitize(value.token.lastUsedAt)
        }
      : null,
    latestUsage: value?.latestUsage
      ? {
          contractVersion: Number.isSafeInteger(value.latestUsage.contractVersion)
            ? value.latestUsage.contractVersion
            : null,
          capturedAt: sanitize(value.latestUsage.capturedAt),
          uploadedAt: sanitize(value.latestUsage.uploadedAt)
        }
      : null,
    profile: value?.profile
      ? {
          handle: sanitize(value.profile.handle),
          visibility: sanitize(value.profile.visibility),
          profileUrl: sanitize(value.profile.profileUrl),
          imageUrl: sanitize(value.profile.imageUrl),
          readmeMarkdown: sanitize(value.profile.readmeMarkdown)
        }
      : null
  };
}

function sanitizeOutputString(value, forbiddenValues = []) {
  if (typeof value !== "string") return null;
  return forbiddenValues.some((secret) => (
    typeof secret === "string" && secret !== "" && value.includes(secret)
  )) ? null : value;
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
    ...withoutUndefined(options.loginOptions),
    intent: "login"
  });
  await runGithubStarPrompt({ ...options, json: false });
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

async function runSubmit(options) {
  let credentialSource = options.credentialSource;
  if (!credentialSource) {
    await options.login({
      client: options.client,
      credentialStore: options.credentialStore,
      serviceOrigin: options.serviceOrigin,
      stdout: options.stdout,
      ...withoutUndefined({
        label: options.deviceName,
        now: options.now,
        sleep: options.sleep,
        openBrowser: options.openBrowser,
        randomBytes: options.randomBytes,
        env: options.env,
        hyperlinks: options.json ? false : options.hyperlinks,
        intent: "submit"
      })
    });
    credentialSource = resolveCredentialSource({
      env: options.env,
      storedCredential: await options.credentialStore.load()
    });
  }

  if (!credentialSource) {
    throw new CliError("login_required", "Login did not create a usable credential.");
  }

  const deviceId = await ensureDeviceId({
    credentialSource,
    credentialStore: options.credentialStore,
    serviceOrigin: options.serviceOrigin,
    randomBytes: options.randomBytes
  });
  const result = await submitAccountUsage({
    readAccountUsage: options.readAccountUsage,
    client: options.client,
    token: credentialSource.token,
    timeoutMs: options.timeoutMs,
    deviceId,
    deviceName: options.deviceName,
    sleep: options.sleep
  });
  await runGithubStarPrompt(options);
  writeSubmitOutput(result, {
    forbiddenValues: [credentialSource.token],
    json: options.json,
    stdout: options.stdout
  });
  return 0;
}

async function runGithubStarPrompt(options) {
  if (!isGithubStarPromptEligible(options)) return;
  try {
    await options.maybePromptGithubStar({
      env: options.env,
      json: options.json === true,
      stdin: options.stdin,
      stdout: options.stdout
    });
  } catch {
    // GitHub starring is optional and must not replace a successful command result.
  }
}

function isGithubStarPromptEligible({ env, json, stdin, stdout }) {
  if (json === true || stdin?.isTTY !== true || stdout?.isTTY !== true) {
    return false;
  }
  if (!env || typeof env.CI !== "string") return true;
  const ci = env.CI.trim().toLowerCase();
  return ci === "" || ci === "0" || ci === "false";
}

async function ensureDeviceId(options) {
  if (options.credentialSource.deviceId) {
    return options.credentialSource.deviceId;
  }

  const deviceId = createDeviceId(options.randomBytes);
  await options.credentialStore.save({
    token: null,
    serviceOrigin: options.serviceOrigin,
    tokenRecordId: null,
    deviceId
  });
  return deviceId;
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
