import assert from "node:assert/strict";
import test from "node:test";

import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError,
  assertNoForbiddenSecrets,
  detectForbiddenSecrets,
  hasForbiddenSecrets,
  isForbiddenSecretKey,
  isForbiddenSecretValue
} from "../index.js";
import { sampleProfileSnapshot } from "../../profile-snapshot/fixtures/sample-snapshot.js";

test("does not flag normal profile snapshot token metrics", () => {
  const findings = detectForbiddenSecrets(sampleProfileSnapshot);

  assert.deepEqual(findings, []);
  assert.equal(hasForbiddenSecrets(sampleProfileSnapshot), false);
});

test("distinguishes usage token fields from credential token fields", () => {
  assert.equal(isForbiddenSecretKey("totalTextTokens"), false);
  assert.equal(isForbiddenSecretKey("peakTokens"), false);
  assert.equal(isForbiddenSecretKey("tokenDigest"), false);
  assert.equal(isForbiddenSecretKey("apiTokenDigest"), false);
  assert.equal(isForbiddenSecretKey("apiKeyDigest"), false);

  assert.equal(isForbiddenSecretKey("accessToken"), true);
  assert.equal(isForbiddenSecretKey("api_key"), true);
  assert.equal(isForbiddenSecretKey("githubToken"), true);
  assert.equal(isForbiddenSecretKey("openaiApiKey"), true);
  assert.equal(isForbiddenSecretKey("refresh_token"), true);
  assert.equal(isForbiddenSecretKey("CODEX_ACCESS_TOKEN"), true);
  assert.equal(isForbiddenSecretKey("auth.json"), true);
});

test("detects nested credential-like keys and values", () => {
  const findings = detectForbiddenSecrets({
    snapshot: sampleProfileSnapshot,
    credentials: {
      access_token: "redacted",
      env: "CODEX_ACCESS_TOKEN=codex-secret-value"
    }
  });

  assert.deepEqual(
    findings.map((finding) => finding.path),
    ["$.credentials.access_token", "$.credentials.env"]
  );
});

test("detects OpenAI, GitHub, bearer, and private key values", () => {
  assert.equal(isForbiddenSecretValue("sk-proj-1234567890abcdef"), true);
  assert.equal(isForbiddenSecretValue("ghp_1234567890abcdefghijklmnopqrstuv"), true);
  assert.equal(isForbiddenSecretValue("Bearer eyJhbGciOiJIUzI1NiJ9.fake"), true);
  assert.equal(isForbiddenSecretValue("-----BEGIN PRIVATE KEY-----"), true);
});

test("assertNoForbiddenSecrets throws a backend error with details", () => {
  assert.throws(
    () => assertNoForbiddenSecrets({ githubToken: "gho_1234567890abcdefghijklmnopqrstuv" }),
    (error) => {
      assert.equal(error instanceof ProfileBackendError, true);
      assert.equal(error.code, PROFILE_BACKEND_ERROR_CODES.FORBIDDEN_SECRET);
      assert.equal(error.status, 400);
      assert.equal(error.details.length, 2);
      return true;
    }
  );
});
