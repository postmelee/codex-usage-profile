import assert from "node:assert/strict";
import test from "node:test";

import {
  formatLocalizedDate,
  formatLocalizedNumber,
  formatMessage,
  initializeDocumentLocale,
  matchSupportedLocale,
  resolveBrowserLocale,
  resolveLocale,
  subscribeToLanguageChanges,
  syncDocumentLocale
} from "../i18n.js";
import { MESSAGE_CATALOGS, getMessageIds } from "../messages.js";

test("locale matching normalizes supported English and Korean tags", () => {
  assert.equal(matchSupportedLocale("en-US"), "en");
  assert.equal(matchSupportedLocale("KO_kr"), "ko");
  assert.equal(matchSupportedLocale(" ko "), "ko");
  assert.equal(matchSupportedLocale("fr-FR"), null);
  assert.equal(matchSupportedLocale(null), null);
  assert.equal(resolveLocale("fr-FR"), "en");
});

test("browser locale uses the first supported language and safe fallbacks", () => {
  assert.equal(resolveBrowserLocale({
    language: "en-US",
    languages: ["fr-FR", "ko-KR", "en-US"]
  }), "ko");
  assert.equal(resolveBrowserLocale({
    language: "ko-KR",
    languages: ["fr-FR", "en-GB", "ko-KR"]
  }), "en");
  assert.equal(resolveBrowserLocale({
    language: "ko-KR",
    languages: ["fr-FR"]
  }), "ko");
  assert.equal(resolveBrowserLocale({
    language: "fr-FR",
    languages: ["fr-FR", "ja-JP"]
  }), "en");
  assert.equal(resolveBrowserLocale(undefined), "en");
});

test("message catalogs have matching ids and never expose unknown ids", () => {
  assert.deepEqual(getMessageIds("ko"), getMessageIds("en"));
  assert.ok(Object.isFrozen(MESSAGE_CATALOGS));
  assert.equal(
    formatMessage("ko-KR", "common.error.actionFailed", { action: "복사" }),
    "복사 작업을 완료하지 못했습니다."
  );
  assert.equal(
    formatMessage("fr-FR", "common.error.actionFailed", { action: "copy" }),
    "Could not copy."
  );
  assert.equal(
    formatMessage("ko", "missing.message.id"),
    "문제가 발생했습니다."
  );
});

test("number and date formatters use the resolved locale", () => {
  assert.equal(formatLocalizedNumber(1_234_567, "en"), "1,234,567");
  assert.equal(formatLocalizedNumber(1_234_567, "ko"), "1,234,567");

  const value = new Date("2026-01-02T00:00:00.000Z");
  const options = Object.freeze({
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric"
  });
  assert.equal(formatLocalizedDate(value, "en", options), "January 2, 2026");
  assert.equal(formatLocalizedDate(value, "ko", options), "2026년 1월 2일");
});

test("document bootstrap resolves and synchronizes the html language", () => {
  const documentValue = { documentElement: { lang: "en" } };
  assert.equal(initializeDocumentLocale({
    document: documentValue,
    navigator: { language: "ko-KR", languages: ["ko-KR"] }
  }), "ko");
  assert.equal(documentValue.documentElement.lang, "ko");
  assert.equal(syncDocumentLocale("fr-FR", documentValue), "en");
  assert.equal(documentValue.documentElement.lang, "en");
});

test("languagechange subscription resolves the latest browser language", () => {
  const windowValue = new EventTarget();
  windowValue.navigator = {
    language: "en-US",
    languages: ["en-US"]
  };
  const observed = [];
  const unsubscribe = subscribeToLanguageChanges((locale) => {
    observed.push(locale);
  }, windowValue);

  windowValue.navigator = {
    language: "ko-KR",
    languages: ["ko-KR"]
  };
  windowValue.dispatchEvent(new Event("languagechange"));
  unsubscribe();
  windowValue.navigator = {
    language: "en-US",
    languages: ["en-US"]
  };
  windowValue.dispatchEvent(new Event("languagechange"));

  assert.deepEqual(observed, ["ko"]);
});
