import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CANONICAL_APP_ORIGIN,
  DEFAULT_DEVELOPMENT_HOST,
  DEFAULT_DEVELOPMENT_PORT,
  DEFAULT_PRODUCTION_HOST,
  DEFAULT_PRODUCTION_PORT,
  loadProfileDeploymentConfig,
  normalizeBindHost,
  normalizeCanonicalAppOrigin,
  normalizeDeploymentPort
} from "../deployment-config.js";

test("loads a loopback file-store development config by default", () => {
  assert.deepEqual(loadProfileDeploymentConfig({ env: {} }), {
    bindHost: DEFAULT_DEVELOPMENT_HOST,
    canonicalAppOrigin: DEFAULT_CANONICAL_APP_ORIGIN,
    port: DEFAULT_DEVELOPMENT_PORT,
    runtimeMode: "development",
    storeMode: "file"
  });
});

test("loads an external-store production config for Cloud Run", () => {
  assert.deepEqual(loadProfileDeploymentConfig({
    env: {
      CANONICAL_APP_ORIGIN: "https://profiles.example.test/",
      NODE_ENV: "production",
      PORT: "9090",
      PROFILE_STORE_MODE: "external"
    }
  }), {
    bindHost: DEFAULT_PRODUCTION_HOST,
    canonicalAppOrigin: "https://profiles.example.test",
    port: 9090,
    runtimeMode: "production",
    storeMode: "external"
  });
});

test("uses the Cloud Run port default when PORT is omitted", () => {
  const config = loadProfileDeploymentConfig({
    env: {
      CANONICAL_APP_ORIGIN: "https://profiles.example.test",
      PROFILE_RUNTIME_MODE: "production",
      PROFILE_STORE_MODE: "external"
    }
  });

  assert.equal(config.port, DEFAULT_PRODUCTION_PORT);
});

test("allows an explicit file store only outside production", () => {
  const spikeConfig = loadProfileDeploymentConfig({
    env: {
      PROFILE_RUNTIME_MODE: "spike",
      PROFILE_STORE_MODE: "file"
    }
  });

  assert.equal(spikeConfig.storeMode, "file");
  assert.throws(
    () => loadProfileDeploymentConfig({
      env: {
        CANONICAL_APP_ORIGIN: "https://profiles.example.test",
        PROFILE_RUNTIME_MODE: "production",
        PROFILE_STORE_MODE: "file"
      }
    }),
    /PROFILE_STORE_MODE=file is not allowed in production/
  );
});

test("requires an explicit secure canonical origin in production", () => {
  assert.throws(
    () => loadProfileDeploymentConfig({
      env: {
        PROFILE_RUNTIME_MODE: "production",
        PROFILE_STORE_MODE: "external"
      }
    }),
    /CANONICAL_APP_ORIGIN is required/
  );
  assert.throws(
    () => normalizeCanonicalAppOrigin("http://127.0.0.1:8080", {
      runtimeMode: "production"
    }),
    /must use https in production/
  );
});

test("allows insecure origins only for explicit loopback development", () => {
  assert.equal(
    normalizeCanonicalAppOrigin("http://localhost:5177/"),
    "http://localhost:5177"
  );
  assert.equal(
    normalizeCanonicalAppOrigin("http://[::1]:5177/"),
    "http://[::1]:5177"
  );
  assert.throws(
    () => normalizeCanonicalAppOrigin("http://profiles.example.test"),
    /only for a loopback host/
  );
  assert.throws(
    () => normalizeCanonicalAppOrigin("https://profiles.example.test/app"),
    /must contain only an origin/
  );
  assert.throws(
    () => normalizeCanonicalAppOrigin("profiles.example.test"),
    /must be an absolute URL/
  );
});

test("validates deployment ports and bind hosts", () => {
  assert.equal(normalizeDeploymentPort("5177"), 5177);
  assert.equal(normalizeBindHost(" 0.0.0.0 "), "0.0.0.0");

  for (const invalidPort of [0, 65536, "5.5", "port", ""]) {
    assert.throws(
      () => normalizeDeploymentPort(invalidPort),
      /PORT must be an integer between 1 and 65535/
    );
  }
  for (const invalidHost of ["", "https://0.0.0.0", "host/path"]) {
    assert.throws(() => normalizeBindHost(invalidHost), /HOST must/);
  }
});

test("rejects unknown runtime and store modes", () => {
  assert.throws(
    () => loadProfileDeploymentConfig({
      env: { PROFILE_RUNTIME_MODE: "preview" }
    }),
    /PROFILE_RUNTIME_MODE must be one of/
  );
  assert.throws(
    () => loadProfileDeploymentConfig({
      env: { PROFILE_STORE_MODE: "sqlite" }
    }),
    /PROFILE_STORE_MODE must be one of/
  );
});
