import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  TOKEN_ENV,
  createCredentialStore,
  resolveConfigDirectory,
  resolveCredentialSource
} from "../src/credentials.js";

test("resolves platform config directories", () => {
  assert.equal(
    resolveConfigDirectory({
      platform: "darwin",
      env: {},
      homeDirectory: "/Users/test"
    }),
    "/Users/test/Library/Application Support/codex-usage-profile"
  );
  assert.equal(
    resolveConfigDirectory({
      platform: "linux",
      env: { XDG_CONFIG_HOME: "/tmp/config" },
      homeDirectory: "/home/test"
    }),
    "/tmp/config/codex-usage-profile"
  );
  assert.equal(
    resolveConfigDirectory({
      platform: "win32",
      env: { APPDATA: "C:\\Users\\test\\AppData\\Roaming" }
    }),
    path.join("C:\\Users\\test\\AppData\\Roaming", "codex-usage-profile")
  );
});

test("atomically stores credentials with private permissions", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "cup-credentials-"));
  t.after(() => fs.rm(directory, { force: true, recursive: true }));
  const store = createCredentialStore({
    configDirectory: path.join(directory, "config"),
    platform: "linux",
    randomBytes: () => Buffer.from("012345678")
  });
  const credential = {
    token: "cup_secret_value",
    serviceOrigin: "https://profiles.example.test",
    tokenRecordId: "cli_token_1",
    deviceId: "device_1"
  };

  await store.save(credential);
  const loaded = await store.load();
  const directoryMode = (await fs.stat(store.configDirectory)).mode & 0o777;
  const fileMode = (await fs.stat(store.credentialPath)).mode & 0o777;
  const files = await fs.readdir(store.configDirectory);

  assert.deepEqual(loaded, credential);
  assert.equal(directoryMode, 0o700);
  assert.equal(fileMode, 0o600);
  assert.deepEqual(files, ["credentials.json"]);
  assert.equal(await store.remove(), true);
  assert.equal(await store.load(), null);
});

test("rejects symlink and overly broad credential files", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "cup-unsafe-"));
  t.after(() => fs.rm(directory, { force: true, recursive: true }));
  const configDirectory = path.join(directory, "config");
  const store = createCredentialStore({ configDirectory, platform: "linux" });
  const credential = {
    token: "cup_secret_value",
    serviceOrigin: "https://profiles.example.test",
    tokenRecordId: null,
    deviceId: "device_1"
  };

  await store.save(credential);
  await fs.chmod(store.credentialPath, 0o644);
  await assert.rejects(() => store.load(), /permissions/);

  await fs.unlink(store.credentialPath);
  const target = path.join(directory, "target.json");
  await fs.writeFile(target, JSON.stringify(credential), { mode: 0o600 });
  await fs.symlink(target, store.credentialPath);
  await assert.rejects(() => store.load(), /regular file/);
});

test("prefers environment credentials without persisting them", () => {
  const storedCredential = {
    token: "cup_file_token",
    serviceOrigin: "https://stored.example.test",
    tokenRecordId: "cli_token_1",
    deviceId: "device_1"
  };
  const environment = resolveCredentialSource({
    env: { [TOKEN_ENV]: "cup_environment_token" },
    storedCredential
  });
  const file = resolveCredentialSource({ env: {}, storedCredential });

  assert.equal(environment.source, "environment");
  assert.equal(environment.token, "cup_environment_token");
  assert.equal(environment.serviceOrigin, null);
  assert.equal(environment.deviceId, "device_1");
  assert.equal(file.source, "file");
  assert.equal(file.serviceOrigin, "https://stored.example.test");
});

test("allows device-only metadata without treating it as a file credential", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "cup-device-only-"));
  t.after(() => fs.rm(directory, { force: true, recursive: true }));
  const store = createCredentialStore({
    configDirectory: path.join(directory, "config"),
    platform: "linux"
  });

  await store.save({
    token: null,
    serviceOrigin: "https://profiles.example.test",
    tokenRecordId: null,
    deviceId: "device_1"
  });
  const loaded = await store.load();

  assert.equal(loaded.token, null);
  assert.equal(resolveCredentialSource({ env: {}, storedCredential: loaded }), null);
  assert.equal(resolveCredentialSource({
    env: { [TOKEN_ENV]: "cup_environment_token" },
    storedCredential: loaded
  }).deviceId, "device_1");
});
