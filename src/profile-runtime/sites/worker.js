import {
  createProfileHostAdapter,
  isProfileBackendRoutePath
} from "../host-adapter.js";
import {
  PROFILE_SITES_PROVIDER_RETRY_AFTER_SECONDS,
  createProfileSitesBackendHandler,
  createProfileSitesOperationalStopResponse
} from "./backend.js";
import { loadProfileSitesConfig } from "./config.js";
import {
  PROFILE_SITES_MAINTENANCE_PATH,
  createProfileSitesMaintenanceHandler
} from "./maintenance.js";
import { observeProfileSitesRequest } from "./observability.js";

const INDEX_PATH = "/index.html";

export function createProfileSitesWorker(options = {}) {
  return {
    async fetch(request, environment = {}, executionContext = {}) {
      return observeProfileSitesRequest(
        request,
        () => handleProfileSitesRequest(
          request,
          environment,
          executionContext,
          options
        ),
        {
          createRequestId: options.createRequestId,
          now: options.observabilityNow,
          writeEvent: options.writeEvent
        }
      );
    }
  };
}

async function handleProfileSitesRequest(
  request,
  environment,
  executionContext,
  options
) {
  const pathname = new URL(request.url).pathname;
  let config;
  try {
    config = loadProfileSitesConfig({
      environment,
      requestUrl: request.url
    });
  } catch {
    if (pathname === "/healthz") {
      return createProfileSitesHealthResponse(environment, {
        configurationAvailable: false,
        method: request.method
      });
    }
    return textResponse("Sites runtime configuration is invalid", 503);
  }

  if (pathname === "/healthz") {
    return createProfileSitesHealthResponse(environment, {
      configurationAvailable: true,
      method: request.method
    });
  }

  if (pathname === PROFILE_SITES_MAINTENANCE_PATH) {
    return createProfileSitesMaintenanceHandler({
      config,
      database: config.database,
      fetchImpl: options.fetchImpl ?? globalThis.fetch,
      media: config.media,
      profileCardRenderPng: options.profileCardRenderPng,
      profileCardRendererVersion: options.profileCardRendererVersion
    })(request);
  }

  const stopResponse = createProfileSitesOperationalStopResponse(
    request,
    config
  );
  if (stopResponse) return stopResponse;

  const backendHandler = createProfileSitesBackendHandler({
    backendHandler: await resolveInjectedBackendHandler(options, {
      config,
      environment,
      executionContext
    }),
    createBackendApiHandler: options.createBackendApiHandler,
    config,
    database: config.database,
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
    githubClient: options.githubClient,
    media: config.media,
    profileCardRenderPng: options.profileCardRenderPng,
    profileCardRendererVersion: options.profileCardRendererVersion,
    rateLimiterOptions: options.rateLimiterOptions ??
      config.accountUsageRateLimit
  });
  const hostHandler = createProfileHostAdapter({
    apiHandler: backendHandler,
    frontendHandler: createSitesAssetHandler(environment)
  });

  return hostHandler(request);
}

export function createProfileSitesHealthResponse(environment = {}, options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD"].includes(method)) {
    return new Response(null, {
      status: 405,
      headers: {
        allow: "GET, HEAD",
        "cache-control": "no-store"
      }
    });
  }

  const bindingsAvailable = options.configurationAvailable !== false &&
    hasRequiredSitesBindings(environment);
  const status = bindingsAvailable ? 200 : 503;
  const body = method === "HEAD" ? null : JSON.stringify({
    status: bindingsAvailable ? "ok" : "unavailable",
    worker: "ok",
    bindings: bindingsAvailable ? "ok" : "unavailable"
  });
  const headers = {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8"
  };
  if (!bindingsAvailable) {
    headers["retry-after"] = String(PROFILE_SITES_PROVIDER_RETRY_AFTER_SECONDS);
  }
  return new Response(body, { status, headers });
}

export function createSitesAssetHandler(environment = {}) {
  return async function handleSitesAsset(request) {
    if (typeof environment.ASSETS?.fetch !== "function") {
      return textResponse("Static asset binding unavailable", 503);
    }

    const pathname = new URL(request.url).pathname;
    const method = request.method.toUpperCase();
    if (
      pathname !== "/" &&
      ["GET", "HEAD"].includes(method) &&
      !looksLikeStaticAsset(pathname)
    ) {
      const fallbackUrl = new URL(INDEX_PATH, request.url);
      return environment.ASSETS.fetch(new Request(fallbackUrl, request));
    }

    const response = await environment.ASSETS.fetch(request);
    if (
      response.status !== 404 ||
      !["GET", "HEAD"].includes(method) ||
      looksLikeStaticAsset(pathname)
    ) {
      return response;
    }

    const fallbackUrl = new URL(INDEX_PATH, request.url);
    return environment.ASSETS.fetch(new Request(fallbackUrl, request));
  };
}

async function resolveInjectedBackendHandler(options, context) {
  if (typeof options.createBackendHandler !== "function") return null;

  const handler = await options.createBackendHandler(context);
  if (typeof handler !== "function") {
    throw new TypeError("Sites backend factory must return a request handler");
  }
  return handler;
}

function looksLikeStaticAsset(pathname) {
  if (isProfileBackendRoutePath(pathname)) return false;
  const finalSegment = pathname.split("/").at(-1) ?? "";
  return finalSegment.includes(".");
}

function textResponse(body, status) {
  const headers = {
    "cache-control": "no-store",
    "content-type": "text/plain; charset=utf-8"
  };
  if (status === 503) {
    headers["retry-after"] = String(PROFILE_SITES_PROVIDER_RETRY_AFTER_SECONDS);
  }
  return new Response(body, {
    status,
    headers
  });
}

function hasRequiredSitesBindings(environment) {
  return typeof environment.ASSETS?.fetch === "function" &&
    typeof environment.DB?.prepare === "function" &&
    typeof environment.DB?.batch === "function" &&
    typeof environment.PROFILE_MEDIA?.get === "function" &&
    typeof environment.PROFILE_MEDIA?.head === "function" &&
    typeof environment.PROFILE_MEDIA?.put === "function";
}

export default createProfileSitesWorker();
