import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";

import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError
} from "./errors.js";
import { createMemoryProfileBackendStore } from "./store.js";

export const DEFAULT_DURABLE_STORE_FILE = "profile-backend-store.json";

const MUTATING_METHODS = new Set([
  "clear",
  "deleteCliToken",
  "saveCliLoginChallenge",
  "saveCliToken",
  "saveLatestSnapshot",
  "saveLatestUsage",
  "saveOAuthState",
  "saveOwner",
  "saveSession",
  "saveSubmittedDevice"
]);

export function createFileProfileBackendStore(options = {}) {
  const filePath = resolve(
    requireNonEmptyString(options.filePath ?? DEFAULT_DURABLE_STORE_FILE, "filePath")
  );
  const store = createMemoryProfileBackendStore(readStoreState(filePath));
  const persist = () => {
    writeStoreState(filePath, store.exportState());
  };

  if (options.createIfMissing === true && !existsSync(filePath)) {
    persist();
  }

  return new Proxy(store, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);

      // A transaction runs its writes against the underlying memory store
      // (bypassing the per-call persist below), so we persist exactly once
      // after it commits. On failure the memory store has already restored
      // its pre-transaction state, so the on-disk file stays consistent and
      // no persist is needed.
      if (property === "transaction") {
        return (runner) => {
          const result = value.call(target, runner);
          if (result && typeof result.then === "function") {
            return result.then((committed) => {
              persist();
              return committed;
            });
          }
          persist();
          return result;
        };
      }

      if (typeof property !== "string" || !MUTATING_METHODS.has(property)) {
        return value;
      }

      return (...args) => {
        const result = value(...args);
        persist();
        return result;
      };
    }
  });
}

export function readStoreState(filePath) {
  const normalizedPath = resolve(
    requireNonEmptyString(filePath, "filePath")
  );

  if (!existsSync(normalizedPath)) {
    return {};
  }

  const text = readFileSync(normalizedPath, "utf8");
  if (text.trim() === "") {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST,
      "Durable store file must contain valid JSON"
    );
  }
}

export function writeStoreState(filePath, state) {
  const normalizedPath = resolve(
    requireNonEmptyString(filePath, "filePath")
  );
  const directory = dirname(normalizedPath);
  const temporaryPath = `${normalizedPath}.${process.pid}.${Date.now()}.tmp`;

  mkdirSync(directory, { recursive: true });
  writeFileSync(
    temporaryPath,
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8"
  );
  renameSync(temporaryPath, normalizedPath);
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
      `${label} is required`
    );
  }

  return value.trim();
}
