import { Icon } from "./Icons.jsx";
import { useLocale } from "./LocaleProvider.jsx";
import { useTheme } from "./ThemeProvider.jsx";

// A two-state switch: it always sets an explicit preference. The three-way
// choice including "system" stays in Settings, where it can be explained.
export function ThemeToggle() {
  const { t } = useLocale();
  const { resolvedTheme, setPreference } = useTheme();
  const isDark = resolvedTheme === "dark";
  const label = t(isDark ? "theme.switchToLight" : "theme.switchToDark");

  function toggle() {
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
