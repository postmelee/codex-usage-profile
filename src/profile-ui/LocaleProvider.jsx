import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  formatLocalizedDate,
  formatLocalizedNumber,
  formatMessage,
  resolveBrowserLocale,
  resolveLocale,
  subscribeToLanguageChanges,
  syncDocumentLocale
} from "./i18n.js";

const LocaleContext = createContext(null);

export function LocaleProvider({
  children,
  initialLocale,
  targetDocument = globalThis.document,
  targetWindow = globalThis.window
}) {
  const [locale, setLocale] = useState(() => (
    initialLocale === undefined
      ? resolveBrowserLocale(targetWindow?.navigator)
      : resolveLocale(initialLocale)
  ));

  useEffect(() => {
    syncDocumentLocale(locale, targetDocument);
  }, [locale, targetDocument]);

  useEffect(() => subscribeToLanguageChanges((nextLocale) => {
    setLocale(nextLocale);
  }, targetWindow), [targetWindow]);

  const t = useCallback(
    (id, values) => formatMessage(locale, id, values),
    [locale]
  );
  const formatNumber = useCallback(
    (value, options) => formatLocalizedNumber(value, locale, options),
    [locale]
  );
  const formatDate = useCallback(
    (value, options) => formatLocalizedDate(value, locale, options),
    [locale]
  );

  const contextValue = useMemo(() => Object.freeze({
    formatDate,
    formatNumber,
    locale,
    t
  }), [formatDate, formatNumber, locale, t]);

  return (
    <LocaleContext.Provider value={contextValue}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const contextValue = useContext(LocaleContext);
  if (!contextValue) {
    throw new Error("useLocale must be used within LocaleProvider");
  }

  return contextValue;
}
