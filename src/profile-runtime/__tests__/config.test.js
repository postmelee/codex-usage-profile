import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PROFILE_STORE_FILE,
  DEFAULT_PUBLIC_BASE_URL,
  hasGitHubOAuthCredentials,
  loadProfileRuntimeConfig,
  normalizePublicBaseUrl,
  parseBooleanEnv
} from "../config.js";

test("loads runtime config defaults without requiring GitHub OAuth credentials", () => {
  const config = loadProfileRuntimeConfig({ env: {} });

  assert.deepEqual(config, {
    githubClientId: null,
    githubClientSecret: null,
    profileStoreFile: DEFAULT_PROFILE_STORE_FILE,
    publicBaseUrl: DEFAULT_PUBLIC_BASE_URL,
    secureCookies: false
  });
  assert.equal(hasGitHubOAuthCredentials(config), false);
});

test("loads and normalizes runtime config from env", () => {
  const config = loadProfileRuntimeConfig({
    env: {
      GITHUB_CLIENT_ID: " github_client_1 ",
      GITHUB_CLIENT_SECRET: " github_secret_1 ",
      PROFILE_STORE_FILE: " .data/custom-store.json ",
      PUBLIC_BASE_URL: "http://localhost:5173/",
      SESSION_SECURE_COOKIES: "yes"
    },
    requireGitHubOAuth: true
  });

  assert.deepEqual(config, {
    githubClientId: "github_client_1",
    githubClientSecret: "github_secret_1",
    profileStoreFile: ".data/custom-store.json",
    publicBaseUrl: "http://localhost:5173",
    secureCookies: true
  });
  assert.equal(hasGitHubOAuthCredentials(config), true);
});

test("requires GitHub OAuth credentials only when requested", () => {
  assert.throws(
    () => loadProfileRuntimeConfig({
      env: {
        GITHUB_CLIENT_SECRET: "github_secret_1"
      },
      requireGitHubOAuth: true
    }),
    /GITHUB_CLIENT_ID is required/
  );
  assert.throws(
    () => loadProfileRuntimeConfig({
      env: {
        GITHUB_CLIENT_ID: "github_client_1"
      },
      requireGitHubOAuth: true
    }),
    /GITHUB_CLIENT_SECRET is required/
  );
});

test("parses boolean env values", () => {
  for (const value of ["1", "true", "yes", "on", true]) {
    assert.equal(parseBooleanEnv(value), true);
  }

  for (const value of ["0", "false", "no", "off", false]) {
    assert.equal(parseBooleanEnv(value), false);
  }

  assert.equal(parseBooleanEnv(undefined, { defaultValue: true }), true);
  assert.throws(
    () => parseBooleanEnv("maybe", { name: "SESSION_SECURE_COOKIES" }),
    /SESSION_SECURE_COOKIES must be true or false/
  );
});

test("validates public base URLs", () => {
  assert.equal(normalizePublicBaseUrl("https://profiles.example.test/"), "https://profiles.example.test");
  assert.equal(normalizePublicBaseUrl("http://127.0.0.1:5173/app/"), "http://127.0.0.1:5173/app");

  assert.throws(
    () => normalizePublicBaseUrl("localhost:5173"),
    /PUBLIC_BASE_URL must be an absolute URL/
  );
  assert.throws(
    () => normalizePublicBaseUrl("file:///tmp/profile"),
    /PUBLIC_BASE_URL must use http or https/
  );
});
