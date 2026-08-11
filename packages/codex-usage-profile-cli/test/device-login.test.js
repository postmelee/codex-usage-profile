import assert from "node:assert/strict";
import test from "node:test";

import {
  formatTerminalHyperlink,
  loginWithDeviceCode,
  resolveVerificationUrl,
  supportsTerminalHyperlinks
} from "../src/device-login.js";
import { ServiceClientError } from "../src/service-client.js";

test("polls through pending and rate limit states then stores the raw token once", async () => {
  let currentTime = new Date("2026-07-13T00:00:00.000Z");
  const sleeps = [];
  const output = createOutput();
  const saved = [];
  let startOptions;
  const client = createSequenceClient([
    { status: "pending" },
    new ServiceClientError("rate_limited", "limited", {
      retryAfterSeconds: 7,
      status: 429
    }),
    {
      status: "approved",
      token: "cup_secret_value",
      tokenRecord: { id: "cli_token_1", ownerId: "owner_1" }
    }
  ], {
    onStart(value) {
      startOptions = value;
    }
  });
  const credentialStore = {
    async load() { return null; },
    async save(value) {
      saved.push(value);
      return value;
    }
  };

  const result = await loginWithDeviceCode({
    client,
    credentialStore,
    serviceOrigin: "https://profiles.example.test",
    stdout: output,
    now: () => currentTime,
    sleep: async (milliseconds) => {
      sleeps.push(milliseconds);
      currentTime = new Date(currentTime.getTime() + milliseconds);
    },
    openBrowser: () => {},
    randomBytes: () => Buffer.alloc(18, 1),
    label: "MacBook",
    intent: "submit"
  });

  assert.deepEqual(startOptions, { label: "MacBook", intent: "submit" });
  assert.deepEqual(sleeps, [5000, 7000]);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].token, "cup_secret_value");
  assert.equal(saved[0].serviceOrigin, "https://profiles.example.test");
  assert.equal(saved[0].tokenRecordId, "cli_token_1");
  assert.match(saved[0].deviceId, /^device_/);
  assert.equal(result.credential.tokenRecordId, "cli_token_1");
  assert.match(output.value, /https:\/\/profiles\.example\.test\/device\?user_code=ABCD-1234/);
  assert.match(output.value, /Enter code ABCD-1234/);
  assert.equal(output.value.includes("cup_secret_value"), false);
});

test("preserves an existing device id on re-login", async () => {
  let saved;
  await loginWithDeviceCode({
    client: createSequenceClient([{
      status: "approved",
      token: "cup_new_secret",
      tokenRecord: { id: "cli_token_2" }
    }]),
    credentialStore: {
      async load() {
        return {
          token: "cup_old_secret",
          serviceOrigin: "https://profiles.example.test",
          tokenRecordId: "cli_token_1",
          deviceId: "device_existing"
        };
      },
      async save(value) {
        saved = value;
        return value;
      }
    },
    serviceOrigin: "https://profiles.example.test",
    stdout: createOutput(),
    now: () => new Date("2026-07-13T00:00:00.000Z"),
    openBrowser: () => {}
  });

  assert.equal(saved.deviceId, "device_existing");
});

test("rejects expired and cross-origin verification flows", async () => {
  await assert.rejects(
    () => loginWithDeviceCode({
      client: {
        async startDeviceLogin() {
          return {
            deviceCode: "cup_device_1",
            userCode: "ABCD-1234",
            verificationUri: "/device",
            expiresAt: "2026-07-13T00:00:00.000Z",
            intervalSeconds: 5
          };
        },
        async pollDeviceLogin() { return { status: "pending" }; }
      },
      credentialStore: {},
      serviceOrigin: "https://profiles.example.test",
      stdout: createOutput(),
      now: () => new Date("2026-07-13T00:00:00.000Z"),
      openBrowser: () => {}
    }),
    /expired/
  );
  assert.throws(
    () => resolveVerificationUrl("https://evil.example.test/device", "https://profiles.example.test"),
    /configured service origin/
  );
});

test("keeps login usable when automatic browser opening fails", async () => {
  let saved = false;
  const output = createOutput();
  await loginWithDeviceCode({
    client: createSequenceClient([{
      status: "approved",
      token: "cup_secret_value",
      tokenRecord: { id: "cli_token_1" }
    }]),
    credentialStore: {
      async load() { return null; },
      async save(value) {
        saved = true;
        return value;
      }
    },
    serviceOrigin: "https://profiles.example.test",
    stdout: output,
    now: () => new Date("2026-07-13T00:00:00.000Z"),
    openBrowser: () => { throw new Error("unavailable"); },
    randomBytes: () => Buffer.alloc(18, 1)
  });

  assert.equal(saved, true);
  assert.match(output.value, /Open https:/);
  assert.match(output.value, /Enter code/);
});

test("renders a terminal hyperlink only for supported interactive terminals", async () => {
  const interactive = createOutput({ isTTY: true });
  await loginWithDeviceCode({
    client: createSequenceClient([{
      status: "approved",
      token: "cup_secret_value",
      tokenRecord: { id: "cli_token_1" }
    }]),
    credentialStore: createCredentialStore(),
    serviceOrigin: "https://profiles.example.test",
    stdout: interactive,
    env: { TERM_PROGRAM: "iTerm.app" },
    now: () => new Date("2026-07-13T00:00:00.000Z"),
    openBrowser: () => {},
    randomBytes: () => Buffer.alloc(18, 1)
  });

  assert.match(interactive.value, /Open \u001B\[36m\u001B\]8;;https:\/\/profiles\.example\.test/);
  assert.match(interactive.value, /\u001B\]8;;\u001B\\/);
  assert.match(interactive.value, /\u001B\]8;;\u001B\\\u001B\[39m\nEnter code/);

  const plainUrl = "https://profiles.example.test/device?user_code=ABCD-1234";
  assert.equal(formatTerminalHyperlink(plainUrl), plainUrl);
  assert.equal(supportsTerminalHyperlinks({
    env: { TERM_PROGRAM: "iTerm.app" },
    stdout: createOutput()
  }), false);
  assert.equal(supportsTerminalHyperlinks({
    env: { TERM: "dumb", TERM_PROGRAM: "iTerm.app" },
    stdout: createOutput({ isTTY: true })
  }), false);
});

test("keeps JSON and explicitly disabled login output free of ANSI escapes", async () => {
  const output = createOutput({ isTTY: true });
  await loginWithDeviceCode({
    client: createSequenceClient([{
      status: "approved",
      token: "cup_secret_value",
      tokenRecord: { id: "cli_token_1" }
    }]),
    credentialStore: createCredentialStore(),
    serviceOrigin: "https://profiles.example.test",
    stdout: output,
    env: { TERM_PROGRAM: "iTerm.app" },
    hyperlinks: false,
    now: () => new Date("2026-07-13T00:00:00.000Z"),
    openBrowser: () => {},
    randomBytes: () => Buffer.alloc(18, 1)
  });

  assert.equal(output.value.includes("\u001B"), false);
  assert.match(output.value, /Open https:\/\/profiles\.example\.test/);
});

function createSequenceClient(sequence, options = {}) {
  let next = 0;
  return {
    async startDeviceLogin(startOptions) {
      options.onStart?.(startOptions);
      return {
        deviceCode: "cup_device_1",
        userCode: "ABCD-1234",
        verificationUriComplete: "/device?user_code=ABCD-1234",
        expiresAt: "2026-07-13T00:10:00.000Z",
        intervalSeconds: 5
      };
    },
    async pollDeviceLogin() {
      const value = sequence[next];
      next += 1;
      if (value instanceof Error) throw value;
      return value;
    }
  };
}

function createCredentialStore() {
  return {
    async load() { return null; },
    async save(value) { return value; }
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
