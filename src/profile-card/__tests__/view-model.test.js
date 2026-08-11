import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCardViewModel,
  formatCardStreak,
  formatCardTokenCount,
  resolveCardLocale
} from "../view-model.js";
import {
  SAMPLE_CARD_TODAY_ISO,
  sampleAccountUsageReadResult,
  sampleCardOwner
} from "../fixtures/sample-account-usage.js";

test("merges GitHub-owned identity with account usage", () => {
  const viewModel = buildCardViewModel({
    locale: "ko-KR",
    owner: sampleCardOwner,
    todayIso: SAMPLE_CARD_TODAY_ISO,
    usage: sampleAccountUsageReadResult
  });

  assert.deepEqual(viewModel.header, {
    avatarUrl: "/assets/postmelee-avatar.png",
    displayName: "postmelee",
    username: "@meleeisdeveloping"
  });
  assert.deepEqual(
    viewModel.stats.map(({ label, value }) => ({ label, value })),
    [
      { label: "누적 토큰", value: "143.5억" },
      { label: "최대 사용일", value: "7억" },
      { label: "현재 연속 기록", value: "7일" },
      { label: "최장 연속 기록", value: "49일" }
    ]
  );
});

test("uses deterministic GitHub owner fallbacks", () => {
  const viewModel = buildCardViewModel({
    owner: {
      avatarUrl: null,
      displayName: null,
      githubLogin: "octocat",
      handle: "ignored-handle"
    },
    todayIso: SAMPLE_CARD_TODAY_ISO,
    usage: sampleAccountUsageReadResult
  });

  assert.equal(viewModel.header.displayName, "octocat");
  assert.equal(viewModel.header.username, "@octocat");
  assert.equal(viewModel.header.avatarUrl, null);
});

test("formats English and Korean token and streak values", () => {
  assert.equal(formatCardTokenCount(14_350_000_000, "ko"), "143.5억");
  assert.equal(formatCardTokenCount(700_000_000, "ko"), "7억");
  assert.equal(formatCardTokenCount(14_350_000_000, "en"), "14.4B");
  assert.equal(formatCardTokenCount(null, "en"), "—");
  assert.equal(formatCardStreak(1, "en"), "1 day");
  assert.equal(formatCardStreak(49, "en"), "49 days");
  assert.equal(formatCardStreak(49, "ko"), "49일");
});

test("normalizes supported locales and falls back to English", () => {
  assert.equal(resolveCardLocale("ko-KR"), "ko");
  assert.equal(resolveCardLocale("en-US"), "en");
  assert.equal(resolveCardLocale("de-DE"), "en");
});

test("normalizes the card theme without changing usage content", () => {
  const light = buildCardViewModel({
    owner: sampleCardOwner,
    theme: "light",
    todayIso: SAMPLE_CARD_TODAY_ISO,
    usage: sampleAccountUsageReadResult
  });
  const fallback = buildCardViewModel({
    owner: sampleCardOwner,
    theme: "unsupported",
    todayIso: SAMPLE_CARD_TODAY_ISO,
    usage: sampleAccountUsageReadResult
  });

  assert.equal(light.theme, "light");
  assert.equal(light.heatmap.theme, "light");
  assert.equal(fallback.theme, "dark");
  assert.deepEqual(
    light.heatmap.cells.map((cell) => cell.level),
    fallback.heatmap.cells.map((cell) => cell.level)
  );
});
