import {
  createFileProfileBackendStore,
  createProfileBackendHttpHandler
} from "../profile-backend/index.js";
import {
  CARD_RENDERER_VERSION,
  renderProfileCardPng
} from "../profile-card/renderer.js";
import { createMemoryProfileMediaStore } from "../profile-media/index.js";
import {
  hasGitHubOAuthCredentials,
  loadProfileRuntimeConfig
} from "./config.js";
import { createGitHubOAuthClient } from "./github-oauth-client.js";

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
  const backendOptions = options.backendOptions ?? {};
  const mediaStore = backendOptions.mediaStore ??
    options.mediaStore ??
    createMemoryProfileMediaStore();

  return createProfileBackendHttpHandler({
    store,
    githubClient,
    githubClientId: config.githubClientId,
    mediaStore,
    publicBaseUrl: config.publicBaseUrl,
    secureCookies: config.secureCookies,
    profileCardRenderPng: renderProfileCardPng,
    profileCardRendererVersion: CARD_RENDERER_VERSION,
    ...backendOptions
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
