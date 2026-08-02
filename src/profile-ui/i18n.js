import {
  DEFAULT_MESSAGE_ID,
  MESSAGE_CATALOGS,
  getMessageCatalog
} from "./messages.js";

export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = Object.freeze(["en", "ko"]);

const INTL_LOCALES = Object.freeze({
  en: "en-US",
  ko: "ko-KR"
});
const numberFormatters = new Map();
const dateTimeFormatters = new Map();

export function matchSupportedLocale(value) {
  const normalized = normalizeLocaleTag(value);
  if (!normalized) return null;

  const language = normalized.split("-", 1)[0];
  return SUPPORTED_LOCALES.includes(language) ? language : null;
}

export function resolveLocale(value) {
  return matchSupportedLocale(value) ?? DEFAULT_LOCALE;
}

export function resolveBrowserLocale(navigatorValue = globalThis.navigator) {
  for (const candidate of getNavigatorLanguages(navigatorValue)) {
    const locale = matchSupportedLocale(candidate);
    if (locale) return locale;
  }

  return matchSupportedLocale(navigatorValue?.language) ?? DEFAULT_LOCALE;
}

export function formatMessage(locale, id, values = {}) {
  const normalizedLocale = resolveLocale(locale);
  const localizedCatalog = getMessageCatalog(normalizedLocale);
  const template = localizedCatalog[id]
    ?? MESSAGE_CATALOGS.en[id]
    ?? localizedCatalog[DEFAULT_MESSAGE_ID]
    ?? MESSAGE_CATALOGS.en[DEFAULT_MESSAGE_ID];

  return interpolateMessage(template, values);
}

export function formatLocalizedNumber(value, locale, options = {}) {
  const formatter = getCachedFormatter(
    numberFormatters,
    Intl.NumberFormat,
    locale,
    options
  );
  return formatter.format(value);
}

export function formatLocalizedDate(value, locale, options = {}) {
  const formatter = getCachedFormatter(
    dateTimeFormatters,
    Intl.DateTimeFormat,
    locale,
    options
  );
  return formatter.format(value);
}

export function syncDocumentLocale(locale, documentValue = globalThis.document) {
  const normalizedLocale = resolveLocale(locale);
  const documentElement = documentValue?.documentElement;

  if (documentElement) {
    documentElement.lang = normalizedLocale;
  }

  return normalizedLocale;
}

export function initializeDocumentLocale(options = {}) {
  const navigatorValue = options.navigator ?? globalThis.navigator;
  const documentValue = options.document ?? globalThis.document;
  const locale = resolveBrowserLocale(navigatorValue);

  syncDocumentLocale(locale, documentValue);
  return locale;
}

export function subscribeToLanguageChanges(
  onLocaleChange,
  windowValue = globalThis.window
) {
  if (
    typeof onLocaleChange !== "function"
    || typeof windowValue?.addEventListener !== "function"
  ) {
    return () => {};
  }

  const handleLanguageChange = () => {
    onLocaleChange(resolveBrowserLocale(windowValue.navigator));
  };

  windowValue.addEventListener("languagechange", handleLanguageChange);
  return () => {
    windowValue.removeEventListener?.("languagechange", handleLanguageChange);
  };
}

function normalizeLocaleTag(value) {
  if (typeof value !== "string") return null;

  const normalized = value.trim().replaceAll("_", "-").toLowerCase();
  return normalized || null;
}

function getNavigatorLanguages(navigatorValue) {
  const languages = navigatorValue?.languages;
  if (!languages || typeof languages === "string") return [];

  try {
    return Array.from(languages);
  } catch {
    return [];
  }
}

function interpolateMessage(template, values) {
  return String(template).replace(/\{([a-z][a-z\d_]*)\}/gi, (_match, key) => {
    const value = values?.[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function getCachedFormatter(cache, Formatter, locale, options) {
  const normalizedLocale = resolveLocale(locale);
  const intlLocale = INTL_LOCALES[normalizedLocale];
  const cacheKey = `${intlLocale}:${JSON.stringify(options)}`;

  if (!cache.has(cacheKey)) {
    cache.set(cacheKey, new Formatter(intlLocale, options));
  }

  return cache.get(cacheKey);
}
