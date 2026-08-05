import { readFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createFileProfileBackendStore,
  createPostgresProfileBackendStore
} from "../profile-backend/index.js";
import {
  assertProfileMediaStoreContract,
  createMemoryProfileMediaStore,
  createS3ProfileMediaStore,
  resolveR2ProfileMediaStoreOptions
} from "../profile-media/index.js";
import {
  hasGitHubOAuthCredentials,
  loadProfileDeploymentConfig,
  loadProfileRuntimeConfig
} from "./config.js";
import {
  createMissingGitHubOAuthClient,
  createProfileRuntimeBackendHandler,
  createRuntimeGitHubClient
} from "./runtime-backend.js";
import {
  DEFAULT_API_PREFIX,
  createProfileHostAdapter
} from "./host-adapter.js";
import {
  closeServer,
  createServerUrl,
  createWebRequestFromNodeRequest,
  listen,
  writeNodeErrorResponse,
  writeWebResponseToNodeResponse
} from "./node-http.js";
import {
  assertStaticAssetRoot,
  createStaticAssetHandler
} from "./static-assets.js";
import {
  createPublicProfileDocumentHandler
} from "./public-profile-document.js";
import {
  createStorePublicProfileResolver
} from "./public-profile-resolver.js";

export const DEFAULT_HEALTH_PATH = "/healthz";
export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 8_000;

export function createProductionStore(options = {}) {
  const { deploymentConfig } = options;
  if (!deploymentConfig) {
    throw new TypeError("deploymentConfig is required");
  }

  if (options.store) return options.store;

  if (deploymentConfig.storeMode === "file") {
    return createFileProfileBackendStore({
      createIfMissing: true,
      filePath: options.filePath
    });
  }

  // PROFILE_STORE_MODE=external: the Postgres adapter reads its server-only
  // connection secret (NEON_DATABASE_URL) here and still fails closed when
  // the secret is missing.
  return createPostgresProfileBackendStore({ env: options.env });
}

export function createProductionMediaStore(options = {}) {
  const { deploymentConfig } = options;
  if (!deploymentConfig) {
    throw new TypeError("deploymentConfig is required");
  }

  if (options.mediaStore) {
    return assertProfileMediaStoreContract(options.mediaStore);
  }
  if (typeof options.createMediaStore === "function") {
    return assertProfileMediaStoreContract(options.createMediaStore({
      deploymentConfig,
      env: options.env
    }));
  }

  const mediaMode = deploymentConfig.mediaMode ?? (
    deploymentConfig.runtimeMode === "production" ? "external" : "memory"
  );
  if (mediaMode === "memory") {
    return createMemoryProfileMediaStore();
  }
  if (mediaMode !== "external") {
    throw new TypeError("PROFILE_MEDIA_MODE must be one of: external, memory");
  }

  return createS3ProfileMediaStore({
    ...resolveR2ProfileMediaStoreOptions(options.env),
    client: options.mediaClient
  });
}

export function createProductionNodeHandler(options = {}) {
  const {
    apiHandler,
    documentHandler = null,
    frontendHandler,
    apiPrefix = DEFAULT_API_PREFIX,
    healthPath = DEFAULT_HEALTH_PATH,
    publicBaseUrl
  } = options;
  const hostHandler = createProfileHostAdapter({
    apiHandler,
    apiPrefix,
    frontendHandler
  });

  return async function handleProductionRequest(nodeRequest, nodeResponse) {
    try {
      const requestUrl = new URL(nodeRequest.url ?? "/", publicBaseUrl);

      if (requestUrl.pathname === healthPath) {
        await writeWebResponseToNodeResponse(
          createHealthResponse(nodeRequest.method),
          nodeResponse
        );
        return;
      }

      const request = createWebRequestFromNodeRequest(nodeRequest, {
        url: requestUrl.toString()
      });
      const documentResponse = documentHandler
        ? await documentHandler(request)
        : null;
      const response = documentResponse ?? await hostHandler(request);
      await writeWebResponseToNodeResponse(response, nodeResponse);
    } catch (error) {
      writeNodeErrorResponse(nodeResponse, error);
    }
  };
}

export async function startProfileProductionServer(options = {}) {
  const env = options.env ?? process.env;
  const deploymentConfig = options.deploymentConfig ??
    loadProfileDeploymentConfig({ env });
  const runtimeEnv = {
    ...env,
    PUBLIC_BASE_URL: deploymentConfig.canonicalAppOrigin,
    SESSION_SECURE_COOKIES: deploymentConfig.runtimeMode === "production"
      ? "true"
      : env.SESSION_SECURE_COOKIES
  };
  const runtimeConfig = options.runtimeConfig ?? loadProfileRuntimeConfig({
    env: runtimeEnv,
    requireGitHubOAuth: options.requireGitHubOAuth === true
  });
  const rootDirectory = await assertStaticAssetRoot({
    rootDirectory: options.rootDirectory ?? env.PROFILE_STATIC_ROOT ?? "dist"
  });
  const store = createProductionStore({
    deploymentConfig,
    env,
    filePath: runtimeConfig.profileStoreFile,
    store: options.store
  });
  const ownsStore = !options.store;
  let mediaStore;
  try {
    mediaStore = createProductionMediaStore({
      createMediaStore: options.createMediaStore,
      deploymentConfig,
      env,
      mediaClient: options.mediaClient,
      mediaStore: options.mediaStore
    });
  } catch (error) {
    if (ownsStore && typeof store.close === "function") {
      await store.close();
    }
    throw error;
  }
  const ownsMediaStore = !options.mediaStore;

  // Dependency readiness is separate from /healthz liveness: a store the
  // runtime created itself must be reachable and fully migrated before the
  // server starts accepting traffic. Injected stores are the caller's
  // responsibility.
  try {
    if (
      ownsStore &&
      options.verifyStoreReadiness !== false &&
      typeof store.verifyReadiness === "function"
    ) {
      await store.verifyReadiness();
    }
    if (
      ownsMediaStore &&
      options.verifyMediaReadiness !== false &&
      typeof mediaStore.verifyReadiness === "function"
    ) {
      await mediaStore.verifyReadiness();
    }
  } catch (error) {
    await closeOwnedDependencies({
      mediaStore,
      ownsMediaStore,
      ownsStore,
      store
    });
    throw error;
  }
  let server;
  try {
    const githubClient = options.githubClient ?? (
      hasGitHubOAuthCredentials(runtimeConfig)
        ? createRuntimeGitHubClient(runtimeConfig, options)
        : createMissingGitHubOAuthClient()
    );
    const apiHandler = options.apiHandler ?? createProfileRuntimeBackendHandler({
      ...options,
      config: runtimeConfig,
      env: runtimeEnv,
      githubClient,
      mediaStore,
      store
    });
    const frontendHandler = options.frontendHandler ?? createStaticAssetHandler({
      rootDirectory
    });
    const documentHandler = options.documentHandler ??
      createPublicProfileDocumentHandler({
        loadIndexHtml: async () => readFile(
          resolve(rootDirectory, "index.html"),
          "utf8"
        ).catch(() => null),
        publicBaseUrl: deploymentConfig.canonicalAppOrigin,
        resolveProfile: createStorePublicProfileResolver(store)
      });
    server = options.server ?? createHttpServer(
      createProductionNodeHandler({
        apiHandler,
        apiPrefix: options.apiPrefix ?? DEFAULT_API_PREFIX,
        documentHandler,
        frontendHandler,
        publicBaseUrl: deploymentConfig.canonicalAppOrigin
      })
    );

    await listen(server, {
      host: deploymentConfig.bindHost,
      port: deploymentConfig.port
    });
  } catch (error) {
    if (server?.listening) await closeServer(server);
    await closeOwnedDependencies({
      mediaStore,
      ownsMediaStore,
      ownsStore,
      store
    });
    throw error;
  }

  let closePromise = null;
  const close = () => {
    if (!closePromise) {
      closePromise = (async () => {
        try {
          await closeServerWithDeadline(server, {
            timeoutMs: options.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS
          });
        } finally {
          await closeOwnedDependencies({
            mediaStore,
            ownsMediaStore,
            ownsStore,
            store
          });
        }
      })();
    }
    return closePromise;
  };

  return {
    close,
    deploymentConfig,
    mediaStore,
    rootDirectory,
    runtimeConfig,
    server,
    store,
    url: createServerUrl(server, deploymentConfig.bindHost, {
      defaultPort: deploymentConfig.port
    })
  };
}

async function closeOwnedDependencies(options) {
  let firstError = null;
  if (options.ownsMediaStore && typeof options.mediaStore?.close === "function") {
    try {
      await options.mediaStore.close();
    } catch (error) {
      firstError = error;
    }
  }
  if (options.ownsStore && typeof options.store?.close === "function") {
    try {
      await options.store.close();
    } catch (error) {
      firstError ??= error;
    }
  }
  if (firstError) throw firstError;
}

export function installProductionSignalHandlers(runtime, options = {}) {
  const processRef = options.processRef ?? process;
  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    processRef.stdout?.write(`Received ${signal}; shutting down.\n`);

    try {
      await runtime.close();
      processRef.exitCode = 0;
    } catch {
      processRef.stderr?.write("Production server shutdown failed.\n");
      processRef.exitCode = 1;
    }
  };

  processRef.once("SIGTERM", shutdown);
  processRef.once("SIGINT", shutdown);

  return () => {
    processRef.off("SIGTERM", shutdown);
    processRef.off("SIGINT", shutdown);
  };
}

export async function closeServerWithDeadline(server, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;
  let timeout;

  try {
    await Promise.race([
      closeServer(server),
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          server.closeAllConnections?.();
          reject(new Error("Production server shutdown timed out"));
        }, timeoutMs);
        timeout.unref?.();
      })
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function createHealthResponse(method = "GET") {
  const normalizedMethod = method.toUpperCase();
  if (!["GET", "HEAD"].includes(normalizedMethod)) {
    return new Response("Method not allowed", {
      status: 405,
      headers: { allow: "GET, HEAD" }
    });
  }

  return new Response(
    normalizedMethod === "HEAD" ? null : JSON.stringify({ ok: true }),
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8"
      }
    }
  );
}

async function main() {
  const runtime = await startProfileProductionServer();
  installProductionSignalHandlers(runtime);
  console.log(`Production runtime listening at ${runtime.url}`);
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return fileURLToPath(import.meta.url) === resolve(process.argv[1]);
}

if (isMainModule()) {
  main().catch(() => {
    console.error("Production runtime failed to start. Check deployment configuration and build artifacts.");
    process.exitCode = 1;
  });
}
