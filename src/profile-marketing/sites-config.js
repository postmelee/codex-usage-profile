import { createMarketingConfig } from "./marketing-config.js";

const ALLOWED_PUBLIC_ENVIRONMENT_KEYS = new Set([
  "VITE_CANONICAL_APP_URL"
]);
const ALLOWED_HOSTING_KEYS = new Set(["d1", "project_id", "r2"]);

export function createSitesMarketingConfig(environment = {}, context = {}) {
  assertPublicEnvironmentBoundary(environment);

  const canonicalAppUrl = environment.VITE_CANONICAL_APP_URL ||
    resolveDevelopmentOrigin(environment, context.currentOrigin);

  return createMarketingConfig({ canonicalAppUrl });
}

export function validateSitesHostingManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new TypeError("Sites hosting manifest must be an object");
  }

  const unsupportedKeys = Object.keys(manifest).filter(
    (key) => !ALLOWED_HOSTING_KEYS.has(key)
  );
  if (unsupportedKeys.length > 0) {
    throw new TypeError(
      `Sites hosting manifest contains unsupported keys: ${unsupportedKeys.join(", ")}`
    );
  }

  if (manifest.d1 !== null || manifest.r2 !== null) {
    throw new TypeError("Sites marketing mirror must not enable D1 or R2 bindings");
  }

  if (
    manifest.project_id !== undefined &&
    (typeof manifest.project_id !== "string" || manifest.project_id.trim() === "")
  ) {
    throw new TypeError("Sites project_id must be a non-empty string when present");
  }

  return Object.freeze({
    ...(manifest.project_id === undefined
      ? {}
      : { project_id: manifest.project_id.trim() }),
    d1: null,
    r2: null
  });
}

function assertPublicEnvironmentBoundary(environment) {
  if (!environment || typeof environment !== "object" || Array.isArray(environment)) {
    throw new TypeError("Sites environment must be an object");
  }

  const unsupportedKeys = Object.keys(environment).filter(
    (key) => key.startsWith("VITE_") && !ALLOWED_PUBLIC_ENVIRONMENT_KEYS.has(key)
  );
  if (unsupportedKeys.length > 0) {
    throw new TypeError(
      `Sites environment contains unsupported public keys: ${unsupportedKeys.join(", ")}`
    );
  }
}

function resolveDevelopmentOrigin(environment, currentOrigin) {
  if (environment.DEV !== true || !currentOrigin) return null;
  return currentOrigin;
}
