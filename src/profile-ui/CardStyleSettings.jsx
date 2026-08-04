import { useLocale } from "./LocaleProvider.jsx";

const THEME_OPTIONS = Object.freeze(["dark", "light"]);
const LOCALE_OPTIONS = Object.freeze(["en", "ko"]);

export function CardStyleSettings({
  draftLocale,
  draftTheme,
  error,
  isDirty,
  isSaved,
  isSaving,
  onLocaleChange,
  onSave,
  onThemeChange
}) {
  const { t } = useLocale();

  return (
    <section className="card-style-settings" aria-labelledby="card-style-title">
      <div className="card-style-settings-heading">
        <h3 id="card-style-title">{t("profile.card.settings.title")}</h3>
        <p>{t("profile.card.settings.description")}</p>
      </div>

      <OptionGroup
        label={t("profile.card.settings.theme.label")}
        name="card-theme"
        onChange={onThemeChange}
        options={THEME_OPTIONS}
        selected={draftTheme}
        t={t}
        valuePrefix="profile.card.settings.theme"
      />

      <OptionGroup
        label={t("profile.card.settings.language.label")}
        name="card-locale"
        onChange={onLocaleChange}
        options={LOCALE_OPTIONS}
        selected={draftLocale}
        t={t}
        valuePrefix="profile.card.settings.language"
      />

      <div className="card-style-settings-actions">
        <button
          aria-busy={isSaving || undefined}
          className="primary-command"
          disabled={!isDirty || isSaving}
          onClick={onSave}
          type="button"
        >
          {isSaving
            ? t("profile.card.settings.saving")
            : t("profile.card.settings.save")}
        </button>
        <p
          aria-live="polite"
          className={`card-style-settings-status ${error ? "is-error" : "is-success"}`}
          role="status"
        >
          {error
            ? t("profile.card.settings.error")
            : isSaved ? t("profile.card.settings.saved") : ""}
        </p>
      </div>
    </section>
  );
}

function OptionGroup({ label, name, onChange, options, selected, t, valuePrefix }) {
  return (
    <fieldset className="card-style-option-group">
      <legend>{label}</legend>
      <div className="card-style-option-grid">
        {options.map((value) => (
          <label className="card-style-option" key={value}>
            <input
              checked={selected === value}
              name={name}
              onChange={() => onChange(value)}
              type="radio"
              value={value}
            />
            <span>
              <strong>{t(`${valuePrefix}.${value}.title`)}</strong>
              <small>{t(`${valuePrefix}.${value}.description`)}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
