import { randomBytes as nodeRandomBytes } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { normalizeServiceOrigin } from "./config.js";
import { CliError, requireNonEmptyString } from "./errors.js";

export const TOKEN_ENV = "CODEX_USAGE_PROFILE_TOKEN";
export const CREDENTIAL_FILE_NAME = "credentials.json";
export const CONFIG_DIRECTORY_NAME = "codex-usage-profile";

export function resolveConfigDirectory(options = {}) {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const homeDirectory = options.homeDirectory ?? os.homedir();

  if (platform === "win32") {
    const appData = env.APPDATA;
    if (!appData) {
      throw new CliError("config_directory_unavailable", "APPDATA is required on Windows.");
    }
    return path.join(appData, CONFIG_DIRECTORY_NAME);
  }

  if (env.XDG_CONFIG_HOME) {
    return path.join(env.XDG_CONFIG_HOME, CONFIG_DIRECTORY_NAME);
  }

  if (!homeDirectory) {
    throw new CliError("config_directory_unavailable", "Home directory is unavailable.");
  }

  if (platform === "darwin") {
    return path.join(homeDirectory, "Library", "Application Support", CONFIG_DIRECTORY_NAME);
  }

  return path.join(homeDirectory, ".config", CONFIG_DIRECTORY_NAME);
}

export function createCredentialStore(options = {}) {
  const fsImpl = options.fsImpl ?? fs;
  const platform = options.platform ?? process.platform;
  const configDirectory = options.configDirectory ?? resolveConfigDirectory(options);
  const credentialPath = path.join(configDirectory, CREDENTIAL_FILE_NAME);
  const randomBytes = options.randomBytes ?? nodeRandomBytes;

  return {
    configDirectory,
    credentialPath,

    async load() {
      const stat = await readSafeFileStat(fsImpl, credentialPath, platform);
      if (!stat) return null;

      let parsed;
      try {
        parsed = JSON.parse(await fsImpl.readFile(credentialPath, "utf8"));
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new CliError("credential_invalid", "Stored credentials are invalid.");
        }
        throw error;
      }

      return normalizeCredentialState(parsed);
    },

    async save(value) {
      const credential = normalizeCredentialState(value);
      await ensureSafeConfigDirectory(fsImpl, configDirectory, platform);
      await readSafeFileStat(fsImpl, credentialPath, platform);

      const suffix = randomBytes(9).toString("hex");
      const temporaryPath = path.join(configDirectory, `.${CREDENTIAL_FILE_NAME}.${suffix}.tmp`);
      try {
        await fsImpl.writeFile(
          temporaryPath,
          `${JSON.stringify(credential, null, 2)}\n`,
          { encoding: "utf8", flag: "wx", mode: 0o600 }
        );
        if (platform !== "win32") await fsImpl.chmod(temporaryPath, 0o600);
        await fsImpl.rename(temporaryPath, credentialPath);
        if (platform !== "win32") await fsImpl.chmod(credentialPath, 0o600);
      } catch (error) {
        await fsImpl.unlink(temporaryPath).catch(() => {});
        throw error;
      }

      return credential;
    },

    async remove() {
      const stat = await readSafeFileStat(fsImpl, credentialPath, platform);
      if (!stat) return false;
      await fsImpl.unlink(credentialPath);
      return true;
    }
  };
}

export function resolveCredentialSource(options = {}) {
  const env = options.env ?? process.env;
  const environmentToken = normalizeOptionalString(env[TOKEN_ENV]);

  if (environmentToken) {
    return {
      source: "environment",
      token: environmentToken,
      tokenRecordId: null,
      serviceOrigin: null,
      deviceId: options.storedCredential?.deviceId ?? null
    };
  }

  if (!options.storedCredential) return null;

  return {
    source: "file",
    ...normalizeCredentialState(options.storedCredential)
  };
}

export function createDeviceId(randomBytes = nodeRandomBytes) {
  return `device_${randomBytes(18).toString("base64url")}`;
}

export function normalizeCredentialState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CliError("credential_invalid", "Credential state must be an object.");
  }

  return {
    token: requireNonEmptyString(value.token, "token"),
    serviceOrigin: normalizeServiceOrigin(value.serviceOrigin),
    tokenRecordId: normalizeOptionalString(value.tokenRecordId),
    deviceId: requireNonEmptyString(value.deviceId, "deviceId")
  };
}

async function ensureSafeConfigDirectory(fsImpl, directory, platform) {
  await fsImpl.mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await fsImpl.lstat(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new CliError("credential_path_unsafe", "Credential directory is not a regular directory.");
  }
  if (platform !== "win32") await fsImpl.chmod(directory, 0o700);
}

async function readSafeFileStat(fsImpl, filePath, platform) {
  let stat;
  try {
    stat = await fsImpl.lstat(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }

  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new CliError("credential_path_unsafe", "Credential file must be a regular file.");
  }
  if (platform !== "win32" && (stat.mode & 0o077) !== 0) {
    throw new CliError(
      "credential_permissions_unsafe",
      "Credential file permissions must be 0600 or more restrictive."
    );
  }

  return stat;
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new CliError("credential_invalid", "Credential metadata must be strings.");
  }
  const trimmed = value.trim();
  return trimmed || null;
}
