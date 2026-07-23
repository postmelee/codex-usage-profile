import {
  createProfileHostAdapter,
  isProfileBackendRoutePath
} from "../host-adapter.js";
import { createProfileSitesBackendHandler } from "./backend.js";
import { loadProfileSitesConfig } from "./config.js";

const INDEX_PATH = "/index.html";

export function createProfileSitesWorker(options = {}) {
  return {
    async fetch(request, environment = {}, executionContext = {}) {
      let config;
      try {
        config = loadProfileSitesConfig({
          environment,
          requestUrl: request.url
        });
      } catch {
        return textResponse("Sites runtime configuration is invalid", 503);
      }

      const backendHandler = createProfileSitesBackendHandler({
        backendHandler: await resolveInjectedBackendHandler(options, {
          config,
          environment,
          executionContext
        })
      });
      const hostHandler = createProfileHostAdapter({
        apiHandler: backendHandler,
        frontendHandler: createSitesAssetHandler(environment)
      });

      return hostHandler(request);
    }
  };
}

export function createSitesAssetHandler(environment = {}) {
  return async function handleSitesAsset(request) {
    if (typeof environment.ASSETS?.fetch !== "function") {
      return textResponse("Static asset binding unavailable", 503);
    }

    const response = await environment.ASSETS.fetch(request);
    if (
      response.status !== 404 ||
      !["GET", "HEAD"].includes(request.method.toUpperCase()) ||
      looksLikeStaticAsset(new URL(request.url).pathname)
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
  return new Response(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8"
    }
  });
}

export default createProfileSitesWorker();
