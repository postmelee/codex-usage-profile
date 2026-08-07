import { Icon } from "./Icons.jsx";
import { useLocale } from "./LocaleProvider.jsx";
import { useTheme } from "./ThemeProvider.jsx";

export const THEME_TRANSITION_ATTRIBUTE = "data-theme-animating";
export const THEME_TRANSITION_DURATION = 240;

// A two-state switch: it always sets an explicit preference. The three-way
// choice including "system" stays in Settings, where it can be explained.
export function ThemeToggle() {
  const { t } = useLocale();
  const { resolvedTheme, setPreference } = useTheme();
  const isDark = resolvedTheme === "dark";
  const label = t(isDark ? "theme.switchToLight" : "theme.switchToDark");

  function toggle() {
    markThemeTransition();
    setPreference(isDark ? "light" : "dark");
  }

  return (
    <button
      aria-checked={isDark}
      aria-label={label}
      className="profile-topbar-theme"
      onClick={toggle}
      role="switch"
      title={label}
      type="button"
    >
      <span className="profile-topbar-theme-track" aria-hidden="true">
        <span className="profile-topbar-theme-icon is-sun">
          <Icon name="sun" size={12} />
        </span>
        <span className="profile-topbar-theme-icon is-moon">
          <Icon name="moon" size={12} />
        </span>
        <span className="profile-topbar-theme-knob" />
      </span>
    </button>
  );
}

// Colour transitions stay off by default so they never fight other motion.
// They are enabled only for the moment a theme swap is in flight.
export function markThemeTransition(targetDocument = globalThis.document) {
  const root = targetDocument?.documentElement;
  if (!root) return;

  const prefersReducedMotion = globalThis.matchMedia?.(
    "(prefers-reduced-motion: reduce)"
  )?.matches ?? false;
  if (prefersReducedMotion) return;

  globalThis.clearTimeout(root.dataset.themeAnimatingTimer);
  root.setAttribute(THEME_TRANSITION_ATTRIBUTE, "");
  root.dataset.themeAnimatingTimer = String(globalThis.setTimeout(() => {
    root.removeAttribute(THEME_TRANSITION_ATTRIBUTE);
    delete root.dataset.themeAnimatingTimer;
  }, THEME_TRANSITION_DURATION + 60));
}
