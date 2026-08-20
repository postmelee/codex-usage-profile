import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  normalizeThemePreference,
  readDocumentThemeState,
  subscribeToThemeChanges,
  syncDocumentTheme,
  writeStoredThemePreference
} from "./theme.js";

const ThemeContext = createContext(null);

export const THEME_TRANSITION_ATTRIBUTE = "data-theme-animating";
export const THEME_TRANSITION_DURATION = 240;

export function ThemeProvider({
  children,
  targetDocument = globalThis.document,
  targetStorage,
  targetWindow = globalThis.window
}) {
  const [themeState, setThemeState] = useState(() => (
    readDocumentThemeState({
      document: targetDocument,
      storage: targetStorage,
      window: targetWindow
    })
  ));

  useEffect(() => {
    const nextState = syncDocumentTheme(themeState.preference, {
      document: targetDocument,
      window: targetWindow
    });

    setThemeState((currentState) => (
      isSameThemeState(currentState, nextState) ? currentState : nextState
    ));
  }, [targetDocument, targetWindow, themeState.preference]);

  useEffect(() => subscribeToThemeChanges((nextState) => {
    setThemeState((currentState) => (
      isSameThemeState(currentState, nextState) ? currentState : nextState
    ));
  }, {
    document: targetDocument,
    storage: targetStorage,
    window: targetWindow
  }), [targetDocument, targetStorage, targetWindow]);

  const setPreference = useCallback((preference) => {
    const requestedPreference = normalizeThemePreference(preference);
    if (requestedPreference !== themeState.preference) {
      markThemeTransition(targetDocument, targetWindow);
    }
    const normalized = writeStoredThemePreference(
      requestedPreference,
      targetStorage,
      targetWindow
    );
    const nextState = syncDocumentTheme(normalized, {
      document: targetDocument,
      window: targetWindow
    });

    setThemeState(nextState);
    return nextState;
  }, [
    targetDocument,
    targetStorage,
    targetWindow,
    themeState.preference
  ]);

  const contextValue = useMemo(() => Object.freeze({
    preference: themeState.preference,
    resolvedTheme: themeState.resolvedTheme,
    setPreference
  }), [setPreference, themeState.preference, themeState.resolvedTheme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const contextValue = useContext(ThemeContext);
  if (!contextValue) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return contextValue;
}

function isSameThemeState(left, right) {
  return left.preference === right.preference
    && left.resolvedTheme === right.resolvedTheme;
}

// Colour transitions stay off by default so they never fight other motion.
// Every user preference surface enters the same short transition timeline.
export function markThemeTransition(
  targetDocument = globalThis.document,
  targetWindow = globalThis.window
) {
  const root = targetDocument?.documentElement;
  if (!root) return;
  const timerHost = targetWindow ?? globalThis;

  const prefersReducedMotion = timerHost.matchMedia?.(
    "(prefers-reduced-motion: reduce)"
  )?.matches ?? false;
  if (prefersReducedMotion) return;

  timerHost.clearTimeout?.(root.dataset.themeAnimatingTimer);
  root.setAttribute(THEME_TRANSITION_ATTRIBUTE, "");
  root.dataset.themeAnimatingTimer = String(timerHost.setTimeout?.(() => {
    root.removeAttribute(THEME_TRANSITION_ATTRIBUTE);
    delete root.dataset.themeAnimatingTimer;
  }, THEME_TRANSITION_DURATION + 60));
}
