import assert from "node:assert/strict";
import test from "node:test";

import {
  CLI_VERSION,
  parseCliArgs,
  runCli
} from "../src/cli.js";
import { DEFAULT_SERVICE_ORIGIN } from "../src/config.js";
import { ServiceClientError } from "../src/service-client.js";

test("prints help and version without loading credentials", async () => {
  const help = createIo();
  const version = createIo();

  assert.equal(CLI_VERSION, "0.1.1");
  assert.equal(await runCli([], help), 0);
  assert.equal(await runCli(["--version"], version), 0);
  assert.match(help.stdout.value, /login/);
  assert.match(help.stdout.value, /submit/);
  assert.match(help.stdout.value, new RegExp(DEFAULT_SERVICE_ORIGIN));
  assert.equal(version.stdout.value, `${CLI_VERSION}\n`);
});

test("uses the production service by default without weakening overrides", async () => {
  const observedOrigins = [];
  const createClient = ({ serviceOrigin }) => {
    observedOrigins.push(serviceOrigin);
    return {};
  };
  const loginWithDeviceCode = async ({ serviceOrigin }) => {
    observedOrigins.push(serviceOrigin);
  };
  const defaultIo = createIo({
    env: {},
    credentialStore: createMemoryCredentialStore(),
    createClient,
    loginWithDeviceCode
  });
  const environmentIo = createIo({
    env: {
      CODEX_USAGE_PROFILE_URL: "https://environment.example.test"
    },
    credentialStore: createMemoryCredentialStore(),
    createClient,
    loginWithDeviceCode
  });
  const cliIo = createIo({
    env: {
      CODEX_USAGE_PROFILE_URL: "https://environment.example.test"
    },
    credentialStore: createMemoryCredentialStore(),
    createClient,
    loginWithDeviceCode
  });

  assert.equal(await runCli(["login"], defaultIo), 0);
  assert.equal(await runCli(["login"], environmentIo), 0);
  assert.equal(await runCli([
    "login",
    "--server",
    "https://cli.example.test"
  ], cliIo), 0);
  assert.deepEqual(observedOrigins, [
    DEFAULT_SERVICE_ORIGIN,
    DEFAULT_SERVICE_ORIGIN,
    "https://environment.example.test",
    "https://environment.example.test",
    "https://cli.example.test",
    "https://cli.example.test"
  ]);
});

test("parses supported commands and rejects unknown or misplaced options", () => {
  assert.deepEqual(parseCliArgs([
    "status",
    "--server",
    "https://profiles.example.test",
    "--timeout",
    "5000",
    "--json"
  ]), {
    action: "command",
    command: "status",
    json: true,
    server: "https://profiles.example.test",
    timeout: "5000"
  });
  assert.throws(() => parseCliArgs(["unknown"]), /Unknown command/);
  assert.throws(() => parseCliArgs(["login", "--json"]), /not supported/);
  assert.throws(() => parseCliArgs(["logout", "--server", "https://example.test"]), /does not use/);
});

test("prints metadata-only status using an environment token", async () => {
  const io = createIo({
    env: {
      CODEX_USAGE_PROFILE_TOKEN: "cup_secret_value",
      CODEX_USAGE_PROFILE_URL: "https://profiles.example.test"
    },
    credentialStore: createMemoryCredentialStore(),
    createClient: ({ serviceOrigin }) => ({
      async getStatus({ token }) {
        assert.equal(serviceOrigin, "https://profiles.example.test");
        assert.equal(token, "cup_secret_value");
        return {
          account: { handle: "postmelee" },
          token: { label: "cup_secret_value" },
          latestUsage: {
            capturedAt: "2026-07-13T00:00:00.000Z",
            revision: "usage_private_revision"
          },
          profile: { profileUrl: "https://profiles.example.test/profile" },
          accessToken: "cup_response_secret",
          usage: { lifetimeTokens: 999 }
        };
      }
    })
  });

  const exitCode = await runCli(["status", "--json"], io);

  assert.equal(exitCode, 0);
  assert.match(io.stdout.value, /"postmelee"/);
  assert.equal(io.stdout.value.includes("cup_secret_value"), false);
  assert.equal(io.stdout.value.includes("cup_response_secret"), false);
  assert.equal(io.stdout.value.includes("usage_private_revision"), false);
  assert.equal(io.stdout.value.includes("lifetimeTokens"), false);
  assert.equal(io.stderr.value, "");
});

test("skips device login when the stored credential is still valid", async () => {
  let loginCalls = 0;
  let starPromptCalls = 0;
  const io = createIo({
    env: {},
    stdin: createInput({ isTTY: true }),
    stdout: createOutput({ isTTY: true }),
    credentialStore: createMemoryCredentialStore({
      token: "cup_file_secret",
      serviceOrigin: "https://profiles.example.test",
      tokenRecordId: "cli_token_1",
      deviceId: "device_1"
    }),
    createClient: () => ({
      async getStatus() {
        return { account: { handle: "postmelee" } };
      }
    }),
    loginWithDeviceCode: async () => { loginCalls += 1; },
    maybePromptGithubStar: async () => { starPromptCalls += 1; }
  });

  assert.equal(await runCli(["login"], io), 0);
  assert.equal(loginCalls, 0);
  assert.equal(starPromptCalls, 0);
  assert.match(io.stdout.value, /Already signed in as @postmelee/);
});

test("never offers the star prompt for status, logout, help, or version", async () => {
  let starPromptCalls = 0;
  const interactive = {
    stdin: createInput({ isTTY: true }),
    stdout: createOutput({ isTTY: true }),
    maybePromptGithubStar: async () => { starPromptCalls += 1; }
  };
  const statusIo = createIo({
    ...interactive,
    env: { CODEX_USAGE_PROFILE_TOKEN: "cup_environment_secret" },
    credentialStore: createMemoryCredentialStore(),
    createClient: () => ({
      async getStatus() { return { account: { handle: "postmelee" } }; }
    })
  });
  const logoutIo = createIo({
    ...interactive,
    env: {},
    credentialStore: createMemoryCredentialStore()
  });
  const helpIo = createIo({ ...interactive });
  const versionIo = createIo({ ...interactive });

  assert.equal(await runCli(["status"], statusIo), 0);
  assert.equal(await runCli(["logout"], logoutIo), 0);
  assert.equal(await runCli([], helpIo), 0);
  assert.equal(await runCli(["--version"], versionIo), 0);
  assert.equal(starPromptCalls, 0);
});

test("restarts device login for a revoked file credential", async () => {
  let loginOptions;
  const store = createMemoryCredentialStore({
    token: "cup_revoked_secret",
    serviceOrigin: "https://profiles.example.test",
    tokenRecordId: "cli_token_1",
    deviceId: "device_1"
  });
  const io = createIo({
    env: {},
    credentialStore: store,
    createClient: () => ({
      async getStatus() {
        throw new ServiceClientError("gone", "revoked", { status: 410 });
      }
    }),
    loginWithDeviceCode: async (options) => {
      loginOptions = options;
    },
    openBrowser: () => {}
  });

  assert.equal(await runCli(["login"], io), 0);
  assert.equal(loginOptions.credentialStore, store);
  assert.equal(loginOptions.serviceOrigin, "https://profiles.example.test");
  assert.equal(loginOptions.intent, "login");
  assert.match(io.stdout.value, /Login complete/);
  assert.equal(io.stdout.value.includes("cup_revoked_secret"), false);
});

test("waits for the star prompt before printing fresh login completion", async () => {
  const enteredPrompt = createDeferred();
  const releasePrompt = createDeferred();
  const events = [];
  let promptOptions;
  const env = {};
  const stdin = createInput({ isTTY: true });
  const stdout = createOutput({ isTTY: true });
  const io = createIo({
    env,
    stdin,
    stdout,
    credentialStore: createMemoryCredentialStore(),
    createClient: () => ({}),
    loginWithDeviceCode: async () => {
      events.push("login");
    },
    maybePromptGithubStar: async (options) => {
      promptOptions = options;
      events.push("prompt");
      enteredPrompt.resolve();
      await releasePrompt.promise;
    }
  });

  const command = runCli(["login"], io);
  await enteredPrompt.promise;

  assert.deepEqual(events, ["login", "prompt"]);
  assert.equal(stdout.value.includes("Login complete."), false);
  assert.deepEqual(promptOptions, {
    env,
    json: false,
    stdin,
    stdout
  });

  releasePrompt.resolve();
  assert.equal(await command, 0);
  assert.equal(stdout.value, "Login complete.\n");
  assert.equal(io.stderr.value, "");
});

test("never sends file credentials to a different service origin", async () => {
  let statusCalls = 0;
  let loginCalls = 0;
  const credentialStore = createMemoryCredentialStore({
    token: "cup_bound_secret",
    serviceOrigin: "https://stored.example.test",
    tokenRecordId: "cli_token_1",
    deviceId: "device_1"
  });
  const statusIo = createIo({
    env: { CODEX_USAGE_PROFILE_URL: "https://other.example.test" },
    credentialStore,
    createClient: () => ({
      async getStatus() { statusCalls += 1; }
    })
  });
  const loginIo = createIo({
    env: { CODEX_USAGE_PROFILE_URL: "https://other.example.test" },
    credentialStore,
    createClient: () => ({
      async getStatus() { statusCalls += 1; }
    }),
    loginWithDeviceCode: async () => { loginCalls += 1; }
  });

  assert.equal(await runCli(["status"], statusIo), 1);
  assert.equal(await runCli(["login"], loginIo), 0);
  assert.equal(statusCalls, 0);
  assert.equal(loginCalls, 1);
  assert.match(statusIo.stderr.value, /different service/);
});

test("logout removes only file credentials and reports active environment token", async () => {
  const store = createMemoryCredentialStore({
    token: "cup_file_secret",
    serviceOrigin: "https://profiles.example.test",
    tokenRecordId: null,
    deviceId: "device_1"
  });
  const io = createIo({
    env: { CODEX_USAGE_PROFILE_TOKEN: "cup_environment_secret" },
    credentialStore: store
  });

  assert.equal(await runCli(["logout"], io), 0);
  assert.equal(await store.load(), null);
  assert.match(io.stdout.value, /Removed locally stored credentials/);
  assert.match(io.stdout.value, /must be unset/);
  assert.equal(io.stdout.value.includes("cup_environment_secret"), false);
});

test("runs analyzer submit with the bound credential and device", async () => {
  const document = createAccountUsageDocument();
  const store = createMemoryCredentialStore({
    token: "cup_file_secret",
    serviceOrigin: "https://profiles.example.test",
    tokenRecordId: "cli_token_1",
    deviceId: "device_1"
  });
  let request;
  const io = createIo({
    env: {},
    credentialStore: store,
    readAccountUsage: async ({ timeoutMs }) => {
      assert.equal(timeoutMs, 30_000);
      return document;
    },
    createClient: () => ({
      async submitAccountUsage(value) {
        request = value;
        return createSubmitResponse();
      }
    }),
    deviceName: "MacBook"
  });

  assert.equal(await runCli(["submit", "--json"], io), 0);
  assert.equal(request.token, "cup_file_secret");
  assert.equal(request.document, document);
  assert.equal(request.deviceId, "device_1");
  assert.equal(request.deviceName, "MacBook");
  assert.match(io.stdout.value, /"accepted"/);
  assert.equal(io.stdout.value.includes("cup_file_secret"), false);
  assert.equal(io.stdout.value.includes("usage_private_revision"), false);
});

test("waits for the star prompt before printing a human submit result", async () => {
  const enteredPrompt = createDeferred();
  const releasePrompt = createDeferred();
  const events = [];
  let promptOptions;
  const env = { TERM_PROGRAM: "iTerm.app" };
  const stdin = createInput({ isTTY: true });
  const stdout = createOutput({ isTTY: true });
  const io = createIo({
    env,
    stdin,
    stdout,
    credentialStore: createMemoryCredentialStore({
      token: "cup_file_secret",
      serviceOrigin: DEFAULT_SERVICE_ORIGIN,
      tokenRecordId: "cli_token_1",
      deviceId: "device_1"
    }),
    readAccountUsage: async () => createAccountUsageDocument(),
    createClient: () => ({
      async submitAccountUsage() {
        events.push("submit");
        return createSubmitResponse();
      }
    }),
    maybePromptGithubStar: async (options) => {
      promptOptions = options;
      events.push("prompt");
      enteredPrompt.resolve();
      await releasePrompt.promise;
    }
  });

  const command = runCli(["submit"], io);
  await enteredPrompt.promise;

  assert.deepEqual(events, ["submit", "prompt"]);
  assert.equal(stdout.value, "");
  assert.deepEqual(promptOptions, {
    env,
    json: false,
    stdin,
    stdout
  });

  releasePrompt.resolve();
  assert.equal(await command, 0);
  assert.match(stdout.value, /^✓ Usage submitted successfully\.\n/);
  assert.match(stdout.value, /\n\n\u001B\[90mLinks\u001B\[0m\n/);
  assert.match(stdout.value, /  Profile: \u001B\[36m\u001B\]8;;https:/);
  assert.equal(
    stdout.value.split("\n").find((line) => line.startsWith("  README:")),
    "  README:  ![Codex usage profile](https://profiles.example.test/u/postmelee/card.png)"
  );
  assert.equal(io.stderr.value, "");
});

test("does not invoke the star helper for JSON, CI, or non-TTY submit", async () => {
  const cases = [
    { argv: ["submit", "--json"], env: {}, stdinTty: true, stdoutTty: true },
    { argv: ["submit"], env: { CI: "true" }, stdinTty: true, stdoutTty: true },
    { argv: ["submit"], env: {}, stdinTty: false, stdoutTty: true },
    { argv: ["submit"], env: {}, stdinTty: true, stdoutTty: false }
  ];

  for (const scenario of cases) {
    let starPromptCalls = 0;
    const io = createIo({
      env: scenario.env,
      stdin: createInput({ isTTY: scenario.stdinTty }),
      stdout: createOutput({ isTTY: scenario.stdoutTty }),
      credentialStore: createMemoryCredentialStore({
        token: "cup_file_secret",
        serviceOrigin: DEFAULT_SERVICE_ORIGIN,
        tokenRecordId: "cli_token_1",
        deviceId: "device_1"
      }),
      readAccountUsage: async () => createAccountUsageDocument(),
      createClient: () => ({
        async submitAccountUsage() { return createSubmitResponse(); }
      }),
      maybePromptGithubStar: async () => { starPromptCalls += 1; }
    });

    assert.equal(await runCli(scenario.argv, io), 0);
    assert.equal(starPromptCalls, 0);
    if (scenario.argv.includes("--json")) {
      assert.equal(JSON.parse(io.stdout.value).submission.status, "accepted");
    }
  }
});

test("handles asynchronous command failures without stack traces or credentials", async () => {
  const missing = createIo({
    env: { CODEX_USAGE_PROFILE_URL: "https://profiles.example.test" },
    credentialStore: createMemoryCredentialStore()
  });
  const network = createIo({
    env: {
      CODEX_USAGE_PROFILE_TOKEN: "cup_secret_value",
      CODEX_USAGE_PROFILE_URL: "https://profiles.example.test"
    },
    credentialStore: createMemoryCredentialStore(),
    createClient: () => ({
      async getStatus() {
        throw new ServiceClientError("network_error", "Could not connect.");
      }
    })
  });

  assert.equal(await runCli(["status"], missing), 1);
  assert.equal(await runCli(["status"], network), 1);
  assert.match(missing.stderr.value, /Run login first/);
  assert.match(network.stderr.value, /Could not connect/);
  assert.equal(missing.stderr.value.includes("at runStatus"), false);
  assert.equal(network.stderr.value.includes("cup_secret_value"), false);
});

test("does not invoke the star helper after login or submit failure", async () => {
  let loginStarPromptCalls = 0;
  const loginIo = createIo({
    env: {},
    stdin: createInput({ isTTY: true }),
    stdout: createOutput({ isTTY: true }),
    credentialStore: createMemoryCredentialStore(),
    createClient: () => ({}),
    loginWithDeviceCode: async () => {
      throw new Error("cup_login_failure");
    },
    maybePromptGithubStar: async () => { loginStarPromptCalls += 1; }
  });

  assert.equal(await runCli(["login"], loginIo), 1);
  assert.equal(loginStarPromptCalls, 0);
  assert.equal(loginIo.stdout.value, "");
  assert.equal(loginIo.stderr.value.includes("cup_login_failure"), false);

  let submitStarPromptCalls = 0;
  const submitIo = createIo({
    env: {},
    stdin: createInput({ isTTY: true }),
    stdout: createOutput({ isTTY: true }),
    credentialStore: createMemoryCredentialStore({
      token: "cup_file_secret",
      serviceOrigin: DEFAULT_SERVICE_ORIGIN,
      tokenRecordId: "cli_token_1",
      deviceId: "device_1"
    }),
    readAccountUsage: async () => createAccountUsageDocument(),
    createClient: () => ({
      async submitAccountUsage() {
        throw new ServiceClientError("rejected", "cup_submit_failure", { status: 400 });
      }
    }),
    maybePromptGithubStar: async () => { submitStarPromptCalls += 1; }
  });

  assert.equal(await runCli(["submit"], submitIo), 1);
  assert.equal(submitStarPromptCalls, 0);
  assert.equal(submitIo.stdout.value, "");
  assert.equal(submitIo.stderr.value.includes("cup_submit_failure"), false);
});

test("preserves successful login and submit results when the star helper rejects", async () => {
  const rejectStarPrompt = async () => {
    throw new Error("cup_star_prompt_secret");
  };
  const loginIo = createIo({
    env: {},
    stdin: createInput({ isTTY: true }),
    stdout: createOutput({ isTTY: true }),
    credentialStore: createMemoryCredentialStore(),
    createClient: () => ({}),
    loginWithDeviceCode: async () => {},
    maybePromptGithubStar: rejectStarPrompt
  });

  assert.equal(await runCli(["login"], loginIo), 0);
  assert.equal(loginIo.stdout.value, "Login complete.\n");
  assert.equal(loginIo.stderr.value, "");

  const submitIo = createIo({
    env: {},
    stdin: createInput({ isTTY: true }),
    stdout: createOutput({ isTTY: true }),
    credentialStore: createMemoryCredentialStore({
      token: "cup_file_secret",
      serviceOrigin: DEFAULT_SERVICE_ORIGIN,
      tokenRecordId: "cli_token_1",
      deviceId: "device_1"
    }),
    readAccountUsage: async () => createAccountUsageDocument(),
    createClient: () => ({
      async submitAccountUsage() { return createSubmitResponse(); }
    }),
    maybePromptGithubStar: rejectStarPrompt
  });

  assert.equal(await runCli(["submit"], submitIo), 0);
  assert.match(submitIo.stdout.value, /^✓ Usage submitted successfully\.\n/);
  assert.equal(submitIo.stdout.value.includes("cup_star_prompt_secret"), false);
  assert.equal(submitIo.stderr.value, "");
});

test("logs in automatically before submit and never persists an environment token", async () => {
  const store = createMemoryCredentialStore();
  let loginCalls = 0;
  let loginIntent;
  let submittedToken;
  let starPromptCalls = 0;
  const io = createIo({
    env: { CODEX_USAGE_PROFILE_URL: "https://profiles.example.test" },
    stdin: createInput({ isTTY: true }),
    stdout: createOutput({ isTTY: true }),
    credentialStore: store,
    loginWithDeviceCode: async ({ credentialStore, intent, serviceOrigin }) => {
      loginCalls += 1;
      loginIntent = intent;
      await credentialStore.save({
        token: "cup_login_secret",
        serviceOrigin,
        tokenRecordId: "cli_token_1",
        deviceId: "device_login"
      });
    },
    readAccountUsage: async () => createAccountUsageDocument(),
    createClient: () => ({
      async submitAccountUsage({ token }) {
        submittedToken = token;
        return createSubmitResponse();
      }
    }),
    maybePromptGithubStar: async () => { starPromptCalls += 1; }
  });

  assert.equal(await runCli(["submit"], io), 0);
  assert.equal(loginCalls, 1);
  assert.equal(loginIntent, "submit");
  assert.equal(submittedToken, "cup_login_secret");
  assert.equal(starPromptCalls, 1);
  assert.equal(io.stdout.value.includes("cup_login_secret"), false);

  const environmentStore = createMemoryCredentialStore();
  const environmentIo = createIo({
    env: {
      CODEX_USAGE_PROFILE_URL: "https://profiles.example.test",
      CODEX_USAGE_PROFILE_TOKEN: "cup_environment_secret"
    },
    credentialStore: environmentStore,
    randomBytes: () => Buffer.alloc(18, 2),
    readAccountUsage: async () => createAccountUsageDocument(),
    createClient: () => ({
      async submitAccountUsage() { return createSubmitResponse(); }
    })
  });

  assert.equal(await runCli(["submit"], environmentIo), 0);
  const metadata = await environmentStore.load();
  assert.equal(metadata.token, null);
  assert.match(metadata.deviceId, /^device_/);
});

test("disables terminal hyperlinks while JSON submit performs automatic login", async () => {
  const store = createMemoryCredentialStore();
  const env = {
    CODEX_USAGE_PROFILE_URL: "https://profiles.example.test",
    TERM_PROGRAM: "iTerm.app"
  };
  let loginOptions;
  const io = createIo({
    env,
    stdout: createOutput({ isTTY: true }),
    credentialStore: store,
    loginWithDeviceCode: async (options) => {
      loginOptions = options;
      await options.credentialStore.save({
        token: "cup_login_secret",
        serviceOrigin: options.serviceOrigin,
        tokenRecordId: "cli_token_1",
        deviceId: "device_login"
      });
    },
    readAccountUsage: async () => createAccountUsageDocument(),
    createClient: () => ({
      async submitAccountUsage() { return createSubmitResponse(); }
    })
  });

  assert.equal(await runCli(["submit", "--json"], io), 0);
  assert.equal(loginOptions.hyperlinks, false);
  assert.equal(loginOptions.env, env);
  assert.equal(loginOptions.intent, "submit");
  assert.equal(io.stdout.value.includes("\u001B"), false);
  assert.equal(JSON.parse(io.stdout.value).submission.status, "accepted");
});

function createIo(overrides = {}) {
  return {
    stdin: createInput(),
    stdout: createOutput(),
    stderr: createOutput(),
    ...overrides
  };
}

function createInput(options = {}) {
  return {
    isTTY: options.isTTY === true
  };
}

function createOutput(options = {}) {
  return {
    isTTY: options.isTTY === true,
    value: "",
    write(value) {
      this.value += value;
    }
  };
}

function createDeferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createMemoryCredentialStore(initial = null) {
  let credential = initial;
  return {
    async load() { return credential; },
    async save(value) {
      credential = value;
      return credential;
    },
    async remove() {
      const existed = credential !== null;
      credential = null;
      return existed;
    }
  };
}

function createAccountUsageDocument() {
  return {
    contractVersion: 1,
    capturedAt: "2026-07-13T00:00:00.000Z",
    summary: {
      lifetimeTokens: 100,
      peakDailyTokens: 50,
      longestRunningTurnSec: 10,
      currentStreakDays: 2,
      longestStreakDays: 3
    },
    dailyUsageBuckets: [
      { startDate: "2026-07-13", tokens: 100 }
    ]
  };
}

function createSubmitResponse() {
  return {
    submission: {
      status: "accepted",
      idempotent: false,
      contractVersion: 1,
      capturedAt: "2026-07-13T00:00:00.000Z",
      uploadedAt: "2026-07-13T00:01:00.000Z",
      revision: "usage_private_revision"
    },
    profile: {
      handle: "postmelee",
      visibility: "public",
      profileUrl: "https://profiles.example.test/profile",
      imageUrl: "https://profiles.example.test/u/postmelee/card.png",
      readmeMarkdown: "![Codex usage profile](https://profiles.example.test/u/postmelee/card.png)"
    }
  };
}
