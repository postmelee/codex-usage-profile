import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCompactNumber,
  formatDuration,
  formatInteger,
  formatReasoningEffort,
  formatStatValue
} from "../formatters.js";

test("formats Profile values with the selected locale", () => {
  assert.equal(formatCompactNumber(250_000_000, "en"), "250M");
  assert.equal(formatCompactNumber(250_000_000, "ko"), "2.5억");
  assert.equal(formatDuration(6_030_000, "en"), "1h 41m");
  assert.equal(formatDuration(6_030_000, "ko"), "1시간 41분");
  assert.equal(formatStatValue("currentStreakDays", 1, "en"), "1 day");
  assert.equal(formatStatValue("currentStreakDays", 5, "ko"), "5일");
  assert.equal(formatStatValue("peakTokens", null, "ko"), "사용할 수 없음");
  assert.equal(formatInteger(1_234_567, "ko-KR"), "1,234,567");
});

test("localizes known reasoning effort labels without changing unknown values", () => {
  assert.equal(formatReasoningEffort("xhigh", "en"), "Extra High");
  assert.equal(formatReasoningEffort("xhigh", "ko"), "매우 높음");
  assert.equal(formatReasoningEffort("custom", "ko"), "custom");
});
