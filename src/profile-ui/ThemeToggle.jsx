import { Icon } from "./Icons.jsx";
import { useLocale } from "./LocaleProvider.jsx";
import { useTheme } from "./ThemeProvider.jsx";

// A two-state control: it always sets an explicit preference. The three-way
// choice including "system" stays in Settings, where it can be explained.
export function ThemeToggle() {
  const { t } = useLocale();
  const { resolvedTheme, setPreference } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      aria-label={t(isDark ? "theme.switchToLight" : "theme.switchToDark")}
      className="profile-topbar-theme"
      onClick={() => setPreference(isDark ? "light" : "dark")}
      title={t(isDark ? "theme.switchToLight" : "theme.switchToDark")}
      type="button"
    >
      <Icon name={isDark ? "sun" : "moon"} size={18} />
    </button>
  );
}
