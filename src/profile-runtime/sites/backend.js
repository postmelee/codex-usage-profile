export const PROFILE_SITES_BACKEND_UNAVAILABLE_CODE =
  "sites_backend_unavailable";

const JSON_HEADERS = Object.freeze({
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8"
});

export function createProfileSitesBackendHandler(options = {}) {
  if (typeof options.backendHandler === "function") {
    return options.backendHandler;
  }

  if (
    options.database &&
    typeof options.createBackendApiHandler === "function"
  ) {
    const dependencies = createProfileSitesBackendDependencies(options);
    const handler = options.createBackendApiHandler(dependencies);
    if (typeof handler !== "function") {
      throw new TypeError("Sites backend API factory must return a request handler");
    }
    return handler;
  }

  return createUnavailableProfileSitesBackendHandler();
}

export function createProfileSitesBackendDependencies(options = {}) {
  const database = options.database;
  if (
    !database ||
    typeof database.prepare !== "function" ||
    typeof database.batch !== "function"
  ) {
    throw new TypeError("Sites D1 DB binding is required");
  }

  const store = options.store ?? createD1ProfileBackendStore({
    database,
    createNonce: options.createNonce
  });
  const rateLimiter = options.rateLimiter ?? createD1AccountUsageRateLimiter({
    database,
    ...options.rateLimiterOptions
  });

  return Object.freeze({
    database,
    rateLimiter,
    store
  });
}

export function createUnavailableProfileSitesBackendHandler() {
  return function handleUnavailableProfileSitesBackend() {
    return new Response(JSON.stringify({
      error: {
        code: PROFILE_SITES_BACKEND_UNAVAILABLE_CODE,
        message: "Sites full-stack backend bindings are not configured"
      }
    }), {
      status: 503,
      headers: JSON_HEADERS
    });
  };
}
import {
  createD1AccountUsageRateLimiter
} from "../../profile-backend/d1/rate-limiter.js";
import {
  createD1ProfileBackendStore
} from "../../profile-backend/d1/store.js";
