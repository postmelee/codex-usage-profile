export const THEME_PREFERENCES = Object.freeze(["system", "light", "dark"]);
export const THEME_STORAGE_KEY = "codex-usage-profile:appearance";
export const THEME_PREFERENCE_ATTRIBUTE = "data-theme-preference";
export const THEME_ATTRIBUTE = "data-theme";
export const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export const DEFAULT_THEME_PREFERENCE = "system";
export const DEFAULT_RESOLVED_THEME = "light";

const RESOLVED_THEMES = Object.freeze(["light", "dark"]);

export function normalizeThemePreference(value) {
  if (typeof value !== "string") return DEFAULT_THEME_PREFERENCE;

  const normalized = value.trim().toLowerCase();
  return THEME_PREFERENCES.includes(normalized)
    ? normalized
    : DEFAULT_THEME_PREFERENCE;
}

export function readStoredThemePreference(
  storageValue,
  windowValue = globalThis.window
) {
  const storage = resolveThemeStorage(storageValue, windowValue);

  try {
    return normalizeThemePreference(storage?.getItem?.(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

export function writeStoredThemePreference(
  preference,
  storageValue,
  windowValue = globalThis.window
) {
  const normalized = normalizeThemePreference(preference);
  const storage = resolveThemeStorage(storageValue, windowValue);

  try {
    if (normalized === DEFAULT_THEME_PREFERENCE) {
      storage?.removeItem?.(THEME_STORAGE_KEY);
    } else {
      storage?.setItem?.(THEME_STORAGE_KEY, normalized);
    }
  } catch {
    // A device-local preference must not prevent the application from loading.
  }

  return normalized;
}

export function getThemeMediaQuery(
  windowValue = globalThis.window,
  mediaQueryList
) {
  if (mediaQueryList !== undefined) return mediaQueryList;

  try {
    return windowValue?.matchMedia?.(THEME_MEDIA_QUERY) ?? null;
  } catch {
    return null;
  }
}

export function resolveSystemTheme(mediaQueryList) {
  return mediaQueryList?.matches === true
    ? "dark"
    : DEFAULT_RESOLVED_THEME;
}

export function resolveThemePreference(preference, mediaQueryList) {
  const normalized = normalizeThemePreference(preference);
  return normalized === DEFAULT_THEME_PREFERENCE
    ? resolveSystemTheme(mediaQueryList)
    : normalized;
}

export function syncDocumentTheme(preference, options = {}) {
  const normalized = normalizeThemePreference(preference);
  const mediaQueryList = getThemeMediaQuery(
    options.window ?? globalThis.window,
    options.mediaQueryList
  );
  const resolvedTheme = resolveThemePreference(normalized, mediaQueryList);
  const documentElement = (options.document ?? globalThis.document)
    ?.documentElement;

  if (documentElement) {
    documentElement.setAttribute?.(THEME_PREFERENCE_ATTRIBUTE, normalized);
    documentElement.setAttribute?.(THEME_ATTRIBUTE, resolvedTheme);

    if (documentElement.style) {
      documentElement.style.colorScheme = resolvedTheme;
    }
  }

  return createThemeState(normalized, resolvedTheme);
}

export function initializeDocumentTheme(options = {}) {
  const windowValue = options.window ?? globalThis.window;
  const preference = readStoredThemePreference(options.storage, windowValue);

  return syncDocumentTheme(preference, {
    document: options.document,
    mediaQueryList: options.mediaQueryList,
    window: windowValue
  });
}

export function readDocumentThemeState(options = {}) {
  const documentElement = (options.document ?? globalThis.document)
    ?.documentElement;
  const preferenceValue = documentElement?.getAttribute?.(
    THEME_PREFERENCE_ATTRIBUTE
  );
  const resolvedValue = documentElement?.getAttribute?.(THEME_ATTRIBUTE);

  if (
    THEME_PREFERENCES.includes(preferenceValue)
    && RESOLVED_THEMES.includes(resolvedValue)
    && (
      preferenceValue === DEFAULT_THEME_PREFERENCE
      || preferenceValue === resolvedValue
    )
  ) {
    return createThemeState(preferenceValue, resolvedValue);
  }

  return initializeDocumentTheme(options);
}

export function subscribeToThemeChanges(onThemeChange, options = {}) {
  if (typeof onThemeChange !== "function") return () => {};

  const windowValue = options.window ?? globalThis.window;
  const mediaQueryList = getThemeMediaQuery(
    windowValue,
    options.mediaQueryList
  );
  const emitThemeChange = () => {
    onThemeChange(initializeDocumentTheme({
      document: options.document,
      mediaQueryList,
      storage: options.storage,
      window: windowValue
    }));
  };
  const handleStorage = (event) => {
    if (event?.key === null || event?.key === THEME_STORAGE_KEY) {
      emitThemeChange();
    }
  };

  let removeMediaListener = () => {};
  if (typeof mediaQueryList?.addEventListener === "function") {
    mediaQueryList.addEventListener("change", emitThemeChange);
    removeMediaListener = () => {
      mediaQueryList.removeEventListener?.("change", emitThemeChange);
    };
  } else if (typeof mediaQueryList?.addListener === "function") {
    mediaQueryList.addListener(emitThemeChange);
    removeMediaListener = () => {
      mediaQueryList.removeListener?.(emitThemeChange);
    };
  }

  windowValue?.addEventListener?.("storage", handleStorage);

  return () => {
    removeMediaListener();
    windowValue?.removeEventListener?.("storage", handleStorage);
  };
}

function resolveThemeStorage(storageValue, windowValue) {
  if (storageValue !== undefined) return storageValue;

  try {
    return windowValue?.localStorage ?? globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function createThemeState(preference, resolvedTheme) {
  return Object.freeze({ preference, resolvedTheme });
}
