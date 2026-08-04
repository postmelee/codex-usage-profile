import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  readDocumentThemeState,
  subscribeToThemeChanges,
  syncDocumentTheme,
  writeStoredThemePreference
} from "./theme.js";

const ThemeContext = createContext(null);

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
    const normalized = writeStoredThemePreference(
      preference,
      targetStorage,
      targetWindow
    );
    const nextState = syncDocumentTheme(normalized, {
      document: targetDocument,
      window: targetWindow
    });

    setThemeState(nextState);
    return nextState;
  }, [targetDocument, targetStorage, targetWindow]);

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
