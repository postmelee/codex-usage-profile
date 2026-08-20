import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SERVICE_ORIGIN,
  DEFAULT_REQUEST_TIMEOUT_MS,
  normalizeRequestTimeout,
  normalizeServiceOrigin,
  resolveServiceOrigin
} from "../src/config.js";

test("defines the approved Sites production service origin", () => {
  assert.equal(
    DEFAULT_SERVICE_ORIGIN,
    "https://codex-usage-profile.meleeisdeveloping.chatgpt.site"
  );
});

test("resolves service origin by CLI, environment, stored, then default precedence", () => {
  assert.equal(resolveServiceOrigin({
    server: "https://cli.example.test",
    env: { CODEX_USAGE_PROFILE_URL: "https://env.example.test" },
    storedOrigin: "https://stored.example.test",
    defaultOrigin: "https://default.example.test"
  }), "https://cli.example.test");
  assert.equal(resolveServiceOrigin({
    env: { CODEX_USAGE_PROFILE_URL: "https://env.example.test" },
    storedOrigin: "https://stored.example.test"
  }), "https://env.example.test");
  assert.equal(resolveServiceOrigin({
    env: {},
    storedOrigin: "https://stored.example.test"
  }), "https://stored.example.test");
  assert.equal(resolveServiceOrigin({
    env: {},
    defaultOrigin: "https://default.example.test"
  }), "https://default.example.test");
  assert.equal(resolveServiceOrigin({
    server: "https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site",
    env: {}
  }), "https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site");
});

test("allows HTTPS and loopback HTTP service origins", () => {
  assert.equal(normalizeServiceOrigin("https://profiles.example.test/"), "https://profiles.example.test");
  assert.equal(normalizeServiceOrigin("http://127.0.0.1:5177"), "http://127.0.0.1:5177");
  assert.equal(normalizeServiceOrigin("http://[::1]:5177"), "http://[::1]:5177");
  assert.equal(normalizeServiceOrigin("http://localhost:5177"), "http://localhost:5177");
});

test("rejects unsafe or non-origin service URLs", () => {
  for (const value of [
    "http://profiles.example.test",
    "https://user:pass@profiles.example.test",
    "https://profiles.example.test/api",
    "https://profiles.example.test?token=value",
    "not-a-url"
  ]) {
    assert.throws(() => normalizeServiceOrigin(value), /Service URL/);
  }
  assert.throws(() => resolveServiceOrigin({ env: {} }), /Set --server/);
});

test("normalizes bounded request timeouts", () => {
  assert.equal(normalizeRequestTimeout(), DEFAULT_REQUEST_TIMEOUT_MS);
  assert.equal(normalizeRequestTimeout("5000"), 5000);
  assert.throws(() => normalizeRequestTimeout(0), /Timeout/);
  assert.throws(() => normalizeRequestTimeout("1.5"), /Timeout/);
});
