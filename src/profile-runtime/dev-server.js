import { existsSync, readFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createServer as createViteServer } from "vite";

import { loadProfileRuntimeConfig } from "./config.js";
import {
  DEFAULT_API_PREFIX,
  createProfileHostAdapter,
  isProfileBackendRoutePath
} from "./host-adapter.js";
import {
  closeServer,
  createNodeRequestUrl,
  createServerUrl,
  createWebRequestFromNodeRequest,
  isNodeResponseEnded,
  listen,
  writeNodeErrorResponse,
  writeWebResponseToNodeResponse
} from "./node-http.js";
import {
  createProfileRuntimeBackendHandler
} from "./runtime-backend.js";
import {
  createPublicProfileDocumentHandler
} from "./public-profile-document.js";
import {
  createStorePublicProfileResolver
} from "./public-profile-resolver.js";
import {
  createFileProfileBackendStore
} from "../profile-backend/index.js";
import { createMemoryProfileMediaStore } from "../profile-media/index.js";

export {
  createNodeRequestUrl,
  createWebRequestFromNodeRequest,
  writeWebResponseToNodeResponse
} from "./node-http.js";
export {
  createMissingGitHubOAuthClient,
  createProfileRuntimeBackendHandler,
  createRuntimeGitHubClient
} from "./runtime-backend.js";

export const DEFAULT_RUNTIME_HOST = "127.0.0.1";
export const DEFAULT_RUNTIME_PORT = 5173;
export const DEFAULT_ENV_FILE = ".env";

export function createProfileRuntimeNodeHandler(options = {}) {
  const {
    apiHandler,
    apiPrefix = DEFAULT_API_PREFIX,
    documentHandler = null,
    frontendMiddleware = createMissingFrontendMiddleware(),
    publicBaseUrl
  } = options;
  const hostHandler = createProfileHostAdapter({
    apiHandler,
    apiPrefix,
    frontendHandler: async () => new Response("Not found", { status: 404 })
  });

  return async function handleProfileRuntimeNodeRequest(nodeRequest, nodeResponse) {
    try {
      const requestUrl = createNodeRequestUrl(nodeRequest, { publicBaseUrl });
      const pathname = new URL(requestUrl).pathname;

      if (isProfileBackendRoutePath(pathname, apiPrefix)) {
        const request = createWebRequestFromNodeRequest(nodeRequest, {
          url: requestUrl
        });
        const response = await hostHandler(request);

        await writeWebResponseToNodeResponse(response, nodeResponse);
        return;
      }

      if (documentHandler) {
        const request = createWebRequestFromNodeRequest(nodeRequest, {
          url: requestUrl
        });
        const documentResponse = await documentHandler(request);
        if (documentResponse) {
          await writeWebResponseToNodeResponse(documentResponse, nodeResponse);
          return;
        }
      }

      frontendMiddleware(nodeRequest, nodeResponse, (error) => {
        if (error) {
          writeNodeErrorResponse(nodeResponse, error);
          return;
        }

        if (!isNodeResponseEnded(nodeResponse)) {
          nodeResponse.statusCode = 404;
          nodeResponse.end("Not found");
        }
      });
    } catch (error) {
      writeNodeErrorResponse(nodeResponse, error);
    }
  };
}

export async function startProfileRuntimeDevServer(options = {}) {
  const env = options.env ?? process.env;

  if (options.loadEnv !== false) {
    loadRuntimeEnvFile(options.envFile ?? DEFAULT_ENV_FILE, { env });
  }

  const config = options.config ?? loadProfileRuntimeConfig({
    env,
    requireGitHubOAuth: options.requireGitHubOAuth === true
  });
  const vite = options.viteServer ?? await createViteMiddlewareServer(options);
  const store = options.store ?? createFileProfileBackendStore({
    createIfMissing: true,
    filePath: config.profileStoreFile
  });
  const mediaStore = options.mediaStore ?? createMemoryProfileMediaStore();
  const apiHandler = options.apiHandler ?? createProfileRuntimeBackendHandler({
    ...options,
    config,
    env,
    mediaStore,
    store
  });
  const documentHandler = options.documentHandler ??
    createDevPublicProfileDocumentHandler({ config, mediaStore, store, vite });
  const server = options.server ?? createHttpServer(
    createProfileRuntimeNodeHandler({
      apiHandler,
      apiPrefix: options.apiPrefix ?? DEFAULT_API_PREFIX,
      documentHandler,
      frontendMiddleware: vite.middlewares,
      publicBaseUrl: config.publicBaseUrl
    })
  );
  const host = options.host ?? env.HOST ?? DEFAULT_RUNTIME_HOST;
  const port = normalizePort(
    options.port ?? env.PORT ?? new URL(config.publicBaseUrl).port ?? DEFAULT_RUNTIME_PORT
  );

  await listen(server, { host, port });

  const url = createServerUrl(server, host);
  return {
    config,
    server,
    url,
    vite,
    async close() {
      await Promise.all([
        closeServer(server),
        vite.close()
      ]);
    }
  };
}

export function createDevPublicProfileDocumentHandler(options = {}) {
  const { config, mediaStore, store, vite } = options;
  if (!config || !store || typeof vite?.transformIndexHtml !== "function") {
    return null;
  }

  const indexPath = resolve(process.cwd(), "index.html");
  return createPublicProfileDocumentHandler({
    loadIndexHtml: async (request) => {
      try {
        const html = readFileSync(indexPath, "utf8");
        return await vite.transformIndexHtml(
          new URL(request.url).pathname,
          html
        );
      } catch {
        return null;
      }
    },
    publicBaseUrl: config.publicBaseUrl,
    resolveProfile: createStorePublicProfileResolver(store, { mediaStore })
  });
}

export async function createViteMiddlewareServer(options = {}) {
  return createViteServer({
    appType: "spa",
    root: options.root ?? process.cwd(),
    server: {
      middlewareMode: true
    }
  });
}

export function loadRuntimeEnvFile(filePath = DEFAULT_ENV_FILE, options = {}) {
  const env = options.env ?? process.env;
  const resolvedPath = resolve(options.cwd ?? process.cwd(), filePath);

  if (!existsSync(resolvedPath)) {
    return false;
  }

  for (const [name, value] of parseRuntimeEnvFile(readFileSync(resolvedPath, "utf8"))) {
    if (options.override === true || env[name] === undefined) {
      env[name] = value;
    }
  }

  return true;
}

export function parseRuntimeEnvFile(text) {
  if (typeof text !== "string") {
    throw new TypeError("env file text must be a string");
  }

  const entries = [];
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (line === "" || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      throw new TypeError(`Invalid env assignment on line ${index + 1}`);
    }

    entries.push([match[1], normalizeEnvValue(match[2])]);
  }

  return entries;
}

function normalizePort(value) {
  const port = Number(value);

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new TypeError("port must be an integer between 0 and 65535");
  }

  return port;
}

function normalizeEnvValue(value) {
  const trimmed = value.trim();
  const quote = trimmed[0];

  if (
    (quote === "\"" || quote === "'") &&
    trimmed.endsWith(quote)
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function createMissingFrontendMiddleware() {
  return function missingFrontendMiddleware(_request, response) {
    response.statusCode = 404;
    response.end("Not found");
  };
}

async function main() {
  const runtime = await startProfileRuntimeDevServer();

  console.log(`Profile runtime available at ${runtime.url}`);
}

function isMainModule() {
  if (!process.argv[1]) {
    return false;
  }

  return fileURLToPath(import.meta.url) === resolve(process.argv[1]);
}

if (isMainModule()) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
