import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMarketingOperatorCardUrl,
  DEFAULT_MARKETING_COPY,
  MARKETING_CARD_LOCALES,
  MARKETING_OPERATOR_CARD_HANDLE,
  MARKETING_QUICKSTART_STEPS,
  MARKETING_SAMPLE_CARD_URL,
  MARKETING_SUBMIT_COMMAND,
  createMarketingConfig,
  normalizeOptionalCanonicalAppUrl,
  resolveMarketingCopy
} from "../marketing-config.js";

test("creates an operator-card marketing config without an app fallback URL", () => {
  const config = createMarketingConfig();

  assert.equal(config.appHref, null);
  assert.equal(config.canonicalAppUrl, null);
  assert.equal(config.copy, DEFAULT_MARKETING_COPY);
  assert.deepEqual(config.copyOverrides, {});
  assert.equal(Object.isFrozen(config.copyOverrides), true);
  assert.equal(config.operatorCardHandle, MARKETING_OPERATOR_CARD_HANDLE);
  assert.equal(
    buildMarketingOperatorCardUrl(config, "en"),
    "/u/postmelee/card.png?locale=en"
  );
  assert.equal(
    buildMarketingOperatorCardUrl(config, "ko"),
    "/u/postmelee/card.png?locale=ko"
  );
  assert.deepEqual(MARKETING_CARD_LOCALES, ["en", "ko"]);
  assert.equal(config.sampleCardUrl, MARKETING_SAMPLE_CARD_URL);
  assert.equal(config.submitCommand, MARKETING_SUBMIT_COMMAND);
  assert.equal(config.quickstartSteps, MARKETING_QUICKSTART_STEPS);
  assert.equal(Object.isFrozen(config), true);
});

test("rejects unsafe operator handles and unsupported locales", () => {
  for (const operatorCardHandle of [
    "https://example.test/card.png",
    "../postmelee",
    "postmelee?locale=ko",
    "post_melee",
    "post/Melee",
    "Postmelee"
  ]) {
    assert.throws(
      () => createMarketingConfig({ operatorCardHandle }),
      /lowercase public profile handle/
    );
  }

  const config = createMarketingConfig();
  assert.throws(
    () => buildMarketingOperatorCardUrl(config, "ja"),
    /locale must be one of: en, ko/
  );
  assert.throws(
    () => buildMarketingOperatorCardUrl({
      operatorCardHandle: "https://example.test"
    }),
    /lowercase public profile handle/
  );
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
  assert.deepEqual(config.copyOverrides, { title: longTitle });
  assert.equal(Object.isFrozen(config.copy), true);
  assert.equal(Object.isFrozen(config.copyOverrides), true);
});

test("resolves default, partial, and equal-valued explicit copy by source", () => {
  const defaultConfig = createMarketingConfig();
  const partialConfig = createMarketingConfig({
    copy: { title: DEFAULT_MARKETING_COPY.title }
  });

  assert.equal(
    resolveMarketingCopy(defaultConfig, "title", "지역화된 제목"),
    "지역화된 제목"
  );
  assert.equal(
    resolveMarketingCopy(partialConfig, "title", "지역화된 제목"),
    DEFAULT_MARKETING_COPY.title
  );
  assert.equal(
    resolveMarketingCopy(partialConfig, "description", "지역화된 설명"),
    "지역화된 설명"
  );
  assert.deepEqual(partialConfig.copyOverrides, {
    title: DEFAULT_MARKETING_COPY.title
  });
});

test("normalizes complete explicit copy and rejects invalid override values", () => {
  const explicitCopy = Object.fromEntries(
    Object.keys(DEFAULT_MARKETING_COPY).map((key) => [key, `custom-${key}`])
  );
  const config = createMarketingConfig({ copy: explicitCopy });

  assert.deepEqual(config.copy, explicitCopy);
  assert.deepEqual(config.copyOverrides, explicitCopy);
  assert.equal(Object.isFrozen(config.copy), true);
  assert.equal(Object.isFrozen(config.copyOverrides), true);

  assert.throws(
    () => createMarketingConfig({ copy: { title: " " } }),
    /copy\.title must be a non-empty string/
  );
  assert.throws(
    () => createMarketingConfig({ copy: [] }),
    /copy must be an object/
  );
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
