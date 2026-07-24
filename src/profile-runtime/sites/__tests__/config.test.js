import assert from "node:assert/strict";
import test from "node:test";

import {
  PROFILE_SITES_BINDINGS,
  PROFILE_SITES_DEFAULT_RATE_LIMIT,
  PROFILE_SITES_DEFAULT_STOP_RETRY_AFTER_SECONDS,
  PROFILE_SITES_GITHUB_CALLBACK_PATH,
  PROFILE_SITES_MAINTENANCE_MODE_ENABLED,
  PROFILE_SITES_SERVICE_MODES,
  hasProfileSitesGitHubOAuthCredentials,
  loadProfileSitesConfig,
  normalizeRequestOrigin
} from "../config.js";

test("Sites config derives the canonical origin and GitHub callback from the request", () => {
  const config = loadProfileSitesConfig({
    environment: {
      GITHUB_CLIENT_ID: "client-id",
      GITHUB_CLIENT_SECRET: "client-secret"
    },
    requestUrl: "https://profile.example/api/auth/github/login?next=%2Fsettings"
  });

  assert.equal(config.publicBaseUrl, "https://profile.example");
  assert.equal(config.githubCallbackPath, PROFILE_SITES_GITHUB_CALLBACK_PATH);
  assert.equal(
    config.githubCallbackUrl,
    "https://profile.example/api/auth/github/callback"
  );
  assert.equal(config.secureCookies, true);
  assert.equal(hasProfileSitesGitHubOAuthCredentials(config), true);
  assert.deepEqual(PROFILE_SITES_BINDINGS, {
    assets: "ASSETS",
    database: "DB",
    media: "PROFILE_MEDIA"
  });
});

test("Sites config keeps D1 and R2 optional until their implementation stages", () => {
  const config = loadProfileSitesConfig({
    environment: {},
    requestUrl: "http://127.0.0.1:4175/"
  });

  assert.equal(config.database, null);
  assert.equal(config.media, null);
  assert.equal(config.maintenanceEnabled, false);
  assert.equal(config.maintenanceToken, null);
  assert.equal(config.secureCookies, false);
  assert.equal(hasProfileSitesGitHubOAuthCredentials(config), false);
});

test("Sites config enables maintenance only for the exact mode value", () => {
  const enabled = loadProfileSitesConfig({
    environment: {
      PROFILE_MAINTENANCE_MODE: PROFILE_SITES_MAINTENANCE_MODE_ENABLED,
      PROFILE_MAINTENANCE_TOKEN: "secret-value"
    },
    requestUrl: "https://profile.example/"
  });
  const disabled = loadProfileSitesConfig({
    environment: {
      PROFILE_MAINTENANCE_MODE: "disabled",
      PROFILE_MAINTENANCE_TOKEN: "secret-value"
    },
    requestUrl: "https://profile.example/"
  });

  assert.equal(enabled.maintenanceEnabled, true);
  assert.equal(enabled.maintenanceToken, "secret-value");
  assert.equal(disabled.maintenanceEnabled, false);
});

test("Sites config exposes bounded D1 rate and operational stop values", () => {
  const configured = loadProfileSitesConfig({
    environment: {
      PROFILE_ACCOUNT_USAGE_BURST_LIMIT: "8",
      PROFILE_ACCOUNT_USAGE_BURST_WINDOW_MS: "12000",
      PROFILE_ACCOUNT_USAGE_SUSTAINED_LIMIT: "40",
      PROFILE_ACCOUNT_USAGE_SUSTAINED_WINDOW_MS: "120000",
      PROFILE_SERVICE_MODE: PROFILE_SITES_SERVICE_MODES.QUOTA_STOP,
      PROFILE_STOP_RETRY_AFTER_SECONDS: "900"
    },
    requestUrl: "https://profile.example/"
  });

  assert.deepEqual(configured.accountUsageRateLimit, {
    burstLimit: 8,
    burstWindowMs: 12_000,
    sustainedLimit: 40,
    sustainedWindowMs: 120_000
  });
  assert.equal(configured.serviceMode, PROFILE_SITES_SERVICE_MODES.QUOTA_STOP);
  assert.equal(configured.stopRetryAfterSeconds, 900);
});

test("Sites config fails closed to approved defaults for invalid production values", () => {
  const invalid = loadProfileSitesConfig({
    environment: {
      PROFILE_ACCOUNT_USAGE_BURST_LIMIT: "1001",
      PROFILE_ACCOUNT_USAGE_BURST_WINDOW_MS: "999",
      PROFILE_ACCOUNT_USAGE_SUSTAINED_LIMIT: "2",
      PROFILE_ACCOUNT_USAGE_SUSTAINED_WINDOW_MS: "1000",
      PROFILE_SERVICE_MODE: "typo-opens-public",
      PROFILE_STOP_RETRY_AFTER_SECONDS: "0"
    },
    requestUrl: "https://profile.example/"
  });
  const missing = loadProfileSitesConfig({
    environment: {},
    requestUrl: "https://profile.example/"
  });

  assert.deepEqual(invalid.accountUsageRateLimit, PROFILE_SITES_DEFAULT_RATE_LIMIT);
  assert.equal(invalid.serviceMode, PROFILE_SITES_SERVICE_MODES.MAINTENANCE);
  assert.equal(
    invalid.stopRetryAfterSeconds,
    PROFILE_SITES_DEFAULT_STOP_RETRY_AFTER_SECONDS
  );
  assert.deepEqual(missing.accountUsageRateLimit, PROFILE_SITES_DEFAULT_RATE_LIMIT);
  assert.equal(missing.serviceMode, PROFILE_SITES_SERVICE_MODES.NORMAL);
});

test("Sites config rejects a request origin outside the configured public origin", () => {
  assert.throws(
    () => loadProfileSitesConfig({
      environment: {
        PUBLIC_BASE_URL: "https://profile.example"
      },
      requestUrl: "https://unexpected.example/api/auth/github/login"
    }),
    /does not match PUBLIC_BASE_URL/
  );

  const config = loadProfileSitesConfig({
    environment: {
      PUBLIC_BASE_URL: "https://profile.example/"
    },
    requestUrl: "https://profile.example/api/auth/github/login"
  });
  assert.equal(config.publicBaseUrl, "https://profile.example");

  assert.throws(
    () => loadProfileSitesConfig({
      environment: {
        PUBLIC_BASE_URL: "https://profile.example/settings"
      },
      requestUrl: "https://profile.example/"
    }),
    /must contain only an HTTP origin/
  );
});

test("Sites config can require OAuth credentials without exposing their values", () => {
  assert.throws(
    () => loadProfileSitesConfig({
      environment: {
        GITHUB_CLIENT_SECRET: "do-not-print-this-secret"
      },
      requestUrl: "https://profile.example/",
      requireGitHubOAuth: true
    }),
    (error) => {
      assert.equal(error.message, "GITHUB_CLIENT_ID is required");
      assert.doesNotMatch(error.message, /do-not-print-this-secret/);
      return true;
    }
  );
});

test("Sites config can require the future logical data bindings", () => {
  assert.throws(
    () => loadProfileSitesConfig({
      environment: {},
      requestUrl: "https://profile.example/",
      requireDataBindings: true
    }),
    /Sites binding DB is required/
  );

  const database = {};
  const media = {};
  const config = loadProfileSitesConfig({
    environment: {
      DB: database,
      PROFILE_MEDIA: media
    },
    requestUrl: "https://profile.example/",
    requireDataBindings: true
  });

  assert.equal(config.database, database);
  assert.equal(config.media, media);
});

test("Sites config can require D1 independently before the R2 stage", () => {
  assert.throws(
    () => loadProfileSitesConfig({
      environment: {},
      requestUrl: "https://profile.example/",
      requireDatabase: true
    }),
    /Sites binding DB is required/
  );

  const database = {};
  const config = loadProfileSitesConfig({
    environment: { DB: database },
    requestUrl: "https://profile.example/",
    requireDatabase: true
  });
  assert.equal(config.database, database);
  assert.equal(config.media, null);
});

test("Sites request origin accepts only absolute HTTP URLs", () => {
  assert.equal(
    normalizeRequestOrigin("http://localhost:4175/settings"),
    "http://localhost:4175"
  );
  assert.throws(
    () => normalizeRequestOrigin("/settings"),
    /absolute URL/
  );
  assert.throws(
    () => normalizeRequestOrigin("file:///tmp/index.html"),
    /must use http or https/
  );
});
