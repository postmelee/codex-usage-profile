import { existsSync, readFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createServer as createViteServer } from "vite";

import {
  createFileProfileBackendStore,
  createProfileBackendHttpHandler
} from "../profile-backend/index.js";
import {
  hasGitHubOAuthCredentials,
  loadProfileRuntimeConfig
} from "./config.js";
import { createGitHubOAuthClient } from "./github-oauth-client.js";
import {
  DEFAULT_API_PREFIX,
  createProfileHostAdapter,
  isProfileBackendRoutePath
} from "./host-adapter.js";

export const DEFAULT_RUNTIME_HOST = "127.0.0.1";
export const DEFAULT_RUNTIME_PORT = 5173;
export const DEFAULT_ENV_FILE = ".env";

export function createProfileRuntimeBackendHandler(options = {}) {
  const config = options.config ?? loadProfileRuntimeConfig({
    env: options.env,
    requireGitHubOAuth: options.requireGitHubOAuth === true
  });
  const store = options.store ?? createFileProfileBackendStore({
    createIfMissing: true,
    filePath: config.profileStoreFile
  });
  const githubClient = options.githubClient ?? createRuntimeGitHubClient(
    config,
    options
  );

  return createProfileBackendHttpHandler({
    store,
    githubClient,
    githubClientId: config.githubClientId,
    publicBaseUrl: config.publicBaseUrl,
    secureCookies: config.secureCookies,
    ...options.backendOptions
  });
}

export function createRuntimeGitHubClient(config, options = {}) {
  if (!hasGitHubOAuthCredentials(config)) {
    return createMissingGitHubOAuthClient();
  }

  return createGitHubOAuthClient({
    clientId: config.githubClientId,
    clientSecret: config.githubClientSecret,
    fetchImpl: options.fetchImpl ?? globalThis.fetch
  });
}

export function createMissingGitHubOAuthClient() {
  return {
    async exchangeCodeForToken() {
      throw new Error("GitHub OAuth credentials are not configured");
    },
    async getAuthenticatedUser() {
      throw new Error("GitHub OAuth credentials are not configured");
    }
  };
}

export function createProfileRuntimeNodeHandler(options = {}) {
  const {
    apiHandler,
    apiPrefix = DEFAULT_API_PREFIX,
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

export function createWebRequestFromNodeRequest(nodeRequest, options = {}) {
  const method = normalizeMethod(nodeRequest.method);
  const init = {
    headers: createWebHeadersFromNodeHeaders(nodeRequest.headers),
    method
  };

  if (!["GET", "HEAD"].includes(method)) {
    init.body = nodeRequest;
    init.duplex = "half";
  }

  return new Request(
    options.url ?? createNodeRequestUrl(nodeRequest, options),
    init
  );
}

export function createNodeRequestUrl(nodeRequest, options = {}) {
  const rawUrl = typeof nodeRequest.url === "string" && nodeRequest.url.trim() !== ""
    ? nodeRequest.url
    : "/";
  const origin = options.origin ?? options.publicBaseUrl ?? createRequestOrigin(
    nodeRequest,
    options
  );

  return new URL(rawUrl, origin).toString();
}

export async function writeWebResponseToNodeResponse(webResponse, nodeResponse) {
  nodeResponse.statusCode = webResponse.status;

  if (webResponse.statusText) {
    nodeResponse.statusMessage = webResponse.statusText;
  }

  writeWebResponseHeaders(webResponse, nodeResponse);

  if (!webResponse.body) {
    nodeResponse.end();
    return;
  }

  const body = Buffer.from(await webResponse.arrayBuffer());
  nodeResponse.end(body);
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
  const apiHandler = options.apiHandler ?? createProfileRuntimeBackendHandler({
    ...options,
    config,
    env
  });
  const server = options.server ?? createHttpServer(
    createProfileRuntimeNodeHandler({
      apiHandler,
      apiPrefix: options.apiPrefix ?? DEFAULT_API_PREFIX,
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

function createWebHeadersFromNodeHeaders(nodeHeaders = {}) {
  const headers = new Headers();

  for (const [name, value] of Object.entries(nodeHeaders)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
      continue;
    }

    if (value !== undefined) {
      headers.set(name, String(value));
    }
  }

  return headers;
}

function writeWebResponseHeaders(webResponse, nodeResponse) {
  const setCookieValues = typeof webResponse.headers.getSetCookie === "function"
    ? webResponse.headers.getSetCookie()
    : [];

  webResponse.headers.forEach((value, name) => {
    if (name.toLowerCase() === "set-cookie" && setCookieValues.length > 0) {
      return;
    }

    nodeResponse.setHeader(name, value);
  });

  if (setCookieValues.length > 0) {
    nodeResponse.setHeader("set-cookie", setCookieValues);
  }
}

function createRequestOrigin(nodeRequest, options = {}) {
  const protocol = options.protocol ?? "http";
  const host = normalizeHeaderValue(nodeRequest.headers?.host) ??
    `${DEFAULT_RUNTIME_HOST}:${DEFAULT_RUNTIME_PORT}`;

  return `${protocol}://${host}`;
}

function normalizeHeaderValue(value) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }

  return null;
}

function normalizeMethod(method) {
  if (typeof method !== "string" || method.trim() === "") {
    return "GET";
  }

  return method.toUpperCase();
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

function writeNodeErrorResponse(nodeResponse, error) {
  if (isNodeResponseEnded(nodeResponse)) {
    return;
  }

  nodeResponse.statusCode = 500;
  nodeResponse.setHeader("content-type", "application/json; charset=utf-8");
  nodeResponse.end(JSON.stringify({
    ok: false,
    error: {
      message: error instanceof Error ? error.message : "Runtime request failed"
    }
  }));
}

function isNodeResponseEnded(nodeResponse) {
  return nodeResponse.writableEnded === true || nodeResponse.finished === true;
}

function listen(server, options) {
  return new Promise((resolveListen, rejectListen) => {
    const onError = (error) => {
      server.off("listening", onListening);
      rejectListen(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolveListen();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(options.port, options.host);
  });
}

function closeServer(server) {
  return new Promise((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) {
        rejectClose(error);
        return;
      }

      resolveClose();
    });
  });
}

function createServerUrl(server, host) {
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : DEFAULT_RUNTIME_PORT;
  const normalizedHost = host === "0.0.0.0" || host === "::"
    ? DEFAULT_RUNTIME_HOST
    : host;

  return `http://${normalizedHost}:${port}`;
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
