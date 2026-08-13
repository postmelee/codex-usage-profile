import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCompactNumber,
  formatDuration,
  formatInteger,
  formatLastUpdatedAt,
  formatReasoningEffort,
  formatStatValue
} from "../formatters.js";

const UPLOADED_AT = "2026-08-12T20:20:00.000Z";

test("formats the latest usage upload in the selected locale and timezone", () => {
  assert.deepEqual(
    formatLastUpdatedAt(UPLOADED_AT, "en", { timeZone: "Asia/Seoul" }),
    {
      dateTime: UPLOADED_AT,
      label: "Last updated · Aug 13, 5:20 AM"
    }
  );
  assert.deepEqual(
    formatLastUpdatedAt(UPLOADED_AT, "ko-KR", { timeZone: "Asia/Seoul" }),
    {
      dateTime: UPLOADED_AT,
      label: "최근 업데이트 · 8월 13일 오전 5:20"
    }
  );
  assert.deepEqual(
    formatLastUpdatedAt(UPLOADED_AT, "en", { timeZone: "UTC" }),
    {
      dateTime: UPLOADED_AT,
      label: "Last updated · Aug 12, 8:20 PM"
    }
  );
});

test("omits invalid latest usage upload timestamps and timezones", () => {
  for (const value of [null, undefined, "", "   ", "not-a-date"]) {
    assert.equal(formatLastUpdatedAt(value, "en"), null);
  }

  assert.equal(
    formatLastUpdatedAt(UPLOADED_AT, "en", { timeZone: "Invalid/Timezone" }),
    null
  );
});

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

test("matches the Codex compact-number contract at locale unit boundaries", () => {
  const cases = [
    [999, "999", "999"],
    [1_000, "1K", "1천"],
    [1_500, "1.5K", "1.5천"],
    [999_499, "999.5K", "99.9만"],
    [999_949, "999.9K", "100만"],
    [999_999, "1M", "100만"],
    [1_000_000, "1M", "100만"],
    [99_999_999, "100M", "1억"],
    [999_999_999, "1B", "10억"],
    [999_999_999_999, "1T", "1조"],
    [1_000_000_000_000, "1T", "1조"]
  ];

  for (const [value, english, korean] of cases) {
    assert.equal(formatCompactNumber(value, "en"), english);
    assert.equal(formatCompactNumber(value, "ko"), korean);
    assert.equal(formatCompactNumber(value, "ja"), english);
  }
});

test("localizes known reasoning effort labels without changing unknown values", () => {
  assert.equal(formatReasoningEffort("xhigh", "en"), "Extra High");
  assert.equal(formatReasoningEffort("xhigh", "ko"), "매우 높음");
  assert.equal(formatReasoningEffort("custom", "ko"), "custom");
});
