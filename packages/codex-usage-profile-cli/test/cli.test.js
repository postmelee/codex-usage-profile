import assert from "node:assert/strict";
import test from "node:test";

import {
  CLI_VERSION,
  parseCliArgs,
  runCli
} from "../src/cli.js";
import { ServiceClientError } from "../src/service-client.js";

test("prints help and version without loading credentials", async () => {
  const help = createIo();
  const version = createIo();

  assert.equal(await runCli([], help), 0);
  assert.equal(await runCli(["--version"], version), 0);
  assert.match(help.stdout.value, /login/);
  assert.match(help.stdout.value, /submit/);
  assert.equal(version.stdout.value, `${CLI_VERSION}\n`);
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
          latestUsage: { capturedAt: "2026-07-13T00:00:00.000Z" },
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
  assert.equal(io.stdout.value.includes("lifetimeTokens"), false);
  assert.equal(io.stderr.value, "");
});

test("skips device login when the stored credential is still valid", async () => {
  let loginCalls = 0;
  const io = createIo({
    env: {},
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
    loginWithDeviceCode: async () => { loginCalls += 1; }
  });

  assert.equal(await runCli(["login"], io), 0);
  assert.equal(loginCalls, 0);
  assert.match(io.stdout.value, /Already signed in as @postmelee/);
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
  assert.match(io.stdout.value, /Login complete/);
  assert.equal(io.stdout.value.includes("cup_revoked_secret"), false);
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

test("keeps submit disabled until analyzer orchestration is added", async () => {
  const io = createIo({
    env: { CODEX_USAGE_PROFILE_URL: "https://profiles.example.test" },
    credentialStore: createMemoryCredentialStore()
  });

  assert.equal(await runCli(["submit"], io), 1);
  assert.match(io.stderr.value, /analyzer integration/);
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

function createIo(overrides = {}) {
  return {
    stdout: createOutput(),
    stderr: createOutput(),
    ...overrides
  };
}

function createOutput() {
  return {
    value: "",
    write(value) {
      this.value += value;
    }
  };
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
