import {
  createD1AccountUsageRateLimiter
} from "../../profile-backend/d1/rate-limiter.js";
import {
  createD1ProfileBackendStore
} from "../../profile-backend/d1/store.js";
import {
  createProfileBackendHttpHandler
} from "../../profile-backend/http.js";
import {
  createR2BindingProfileMediaStore
} from "../../profile-media/r2-binding/store.js";
import { createGitHubOAuthClient } from "../github-oauth-client.js";
import { PROFILE_SITES_SERVICE_MODES } from "./config.js";

export const PROFILE_SITES_BACKEND_UNAVAILABLE_CODE =
  "sites_backend_unavailable";
export const PROFILE_SITES_MAINTENANCE_CODE = "sites_maintenance";
export const PROFILE_SITES_QUOTA_STOP_CODE = "sites_quota_stop";
export const PROFILE_SITES_PROVIDER_RETRY_AFTER_SECONDS = 5;

const JSON_HEADERS = Object.freeze({
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8"
});

export function createProfileSitesBackendHandler(options = {}) {
  if (typeof options.backendHandler === "function") {
    return options.backendHandler;
  }

  if (options.database && typeof options.createBackendApiHandler === "function") {
    const dependencies = createProfileSitesBackendDependencies(options);
    const handler = options.createBackendApiHandler(dependencies);
    if (typeof handler !== "function") {
      throw new TypeError("Sites backend API factory must return a request handler");
    }
    return handler;
  }

  if (options.database && options.media && options.config) {
    const dependencies = createProfileSitesBackendDependencies(options);
    return createProfileBackendHttpHandler({
      accountUsageRateLimiter: dependencies.rateLimiter,
      fetchImpl: options.fetchImpl,
      githubCallbackPath: options.config.githubCallbackPath,
      githubClient: options.githubClient ?? createSitesGitHubClient(
        options.config,
        options.fetchImpl
      ),
      githubClientId: options.config.githubClientId,
      mediaStore: dependencies.mediaStore,
      profileCardFetchImpl: options.fetchImpl,
      profileCardRenderPng: options.profileCardRenderPng,
      profileCardRendererVersion: options.profileCardRendererVersion,
      publicBaseUrl: options.config.publicBaseUrl,
      secureCookies: options.config.secureCookies,
      store: dependencies.store
    });
  }

  return createUnavailableProfileSitesBackendHandler();
}

export function createProfileSitesOperationalStopResponse(request, config = {}) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (config.serviceMode === PROFILE_SITES_SERVICE_MODES.MAINTENANCE) {
    return operationalJsonResponse({
      code: PROFILE_SITES_MAINTENANCE_CODE,
      message: "Service is temporarily unavailable",
      retryAfterSeconds: config.stopRetryAfterSeconds,
      status: 503
    });
  }

  if (
    config.serviceMode === PROFILE_SITES_SERVICE_MODES.OWNER_ONLY &&
    isPublicProfileRoute(url.pathname, method)
  ) {
    return operationalJsonResponse({
      code: "not_found",
      message: "Route not found",
      status: 404
    });
  }

  if (
    config.serviceMode === PROFILE_SITES_SERVICE_MODES.QUOTA_STOP &&
    method === "POST" &&
    url.pathname === "/api/account-usage/submit"
  ) {
    return operationalJsonResponse({
      code: PROFILE_SITES_QUOTA_STOP_CODE,
      message: "Account usage submit is temporarily limited",
      retryAfterSeconds: config.stopRetryAfterSeconds,
      status: 429
    });
  }

  return null;
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
  const mediaStore = options.mediaStore ?? (
    options.media
      ? createR2BindingProfileMediaStore({ bucket: options.media })
      : null
  );

  const dependencies = {
    database,
    rateLimiter,
    store
  };
  if (options.media) dependencies.media = options.media;
  if (mediaStore) dependencies.mediaStore = mediaStore;
  return Object.freeze(dependencies);
}

export function createSitesGitHubClient(config = {}, fetchImpl = globalThis.fetch) {
  if (config.githubClientId && config.githubClientSecret) {
    return createGitHubOAuthClient({
      clientId: config.githubClientId,
      clientSecret: config.githubClientSecret,
      fetchImpl
    });
  }

  return {
    async exchangeCodeForToken() {
      throw new Error("GitHub OAuth credentials are not configured");
    },
    async getAuthenticatedUser() {
      throw new Error("GitHub OAuth credentials are not configured");
    }
  };
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
      headers: {
        ...JSON_HEADERS,
        "retry-after": String(PROFILE_SITES_PROVIDER_RETRY_AFTER_SECONDS)
      }
    });
  };
}

function operationalJsonResponse(options) {
  const headers = new Headers(JSON_HEADERS);
  if (options.retryAfterSeconds) {
    headers.set("retry-after", String(options.retryAfterSeconds));
  }
  return new Response(JSON.stringify({
    ok: false,
    error: {
      code: options.code,
      message: options.message
    }
  }), {
    status: options.status,
    headers
  });
}

function isPublicProfileRoute(pathname, method) {
  if (!["GET", "HEAD"].includes(method)) return false;
  return pathname.startsWith("/api/profiles/public/") ||
    pathname.startsWith("/api/snapshots/public/") ||
    /^\/u\/[^/]+\/card\.png$/.test(pathname);
}
