import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_MARKETING_COPY,
  MARKETING_QUICKSTART_STEPS,
  MARKETING_SAMPLE_CARD_URL,
  MARKETING_SUBMIT_COMMAND,
  createMarketingConfig,
  normalizeOptionalCanonicalAppUrl
} from "../marketing-config.js";

test("creates a sample-only marketing config without an app fallback URL", () => {
  const config = createMarketingConfig();

  assert.equal(config.appHref, null);
  assert.equal(config.canonicalAppUrl, null);
  assert.equal(config.copy, DEFAULT_MARKETING_COPY);
  assert.equal(config.sampleCardUrl, MARKETING_SAMPLE_CARD_URL);
  assert.equal(config.submitCommand, MARKETING_SUBMIT_COMMAND);
  assert.equal(config.quickstartSteps, MARKETING_QUICKSTART_STEPS);
  assert.equal(Object.isFrozen(config), true);
});

test("normalizes a canonical Cloud Run app destination to its root", () => {
  const config = createMarketingConfig({
    canonicalAppUrl: "https://profiles.example.test/app/"
  });

  assert.equal(config.canonicalAppUrl, "https://profiles.example.test/app");
  assert.equal(config.appHref, "https://profiles.example.test/");
});

test("allows loopback http but rejects insecure remote app URLs", () => {
  assert.equal(
    normalizeOptionalCanonicalAppUrl("http://127.0.0.1:5177/"),
    "http://127.0.0.1:5177"
  );
  assert.throws(
    () => normalizeOptionalCanonicalAppUrl("http://profiles.example.test"),
    /must use https outside local development/
  );
  assert.throws(
    () => normalizeOptionalCanonicalAppUrl("javascript:alert(1)"),
    /must use http or https/
  );
  assert.throws(
    () => normalizeOptionalCanonicalAppUrl("https://token@example.test"),
    /must not contain credentials/
  );
});

test("accepts long localized copy without changing the data contract", () => {
  const longTitle = "제출한 Codex 사용량으로 항상 최신 상태를 유지하는 공유 가능한 프로필 카드";
  const config = createMarketingConfig({
    copy: { title: longTitle }
  });

  assert.equal(config.copy.title, longTitle);
  assert.equal(config.copy.description, DEFAULT_MARKETING_COPY.description);
  assert.equal(Object.isFrozen(config.copy), true);
});

test("keeps the marketing fixture independent from account and usage state", () => {
  const config = createMarketingConfig({
    canonicalAppUrl: "https://profiles.example.test"
  });
  const serialized = JSON.stringify(config);

  assert.doesNotMatch(serialized, /githubClientSecret|session|owner|visibility/i);
  assert.equal(
    config.quickstartSteps.every((step) => Object.isFrozen(step)),
    true
  );
});
