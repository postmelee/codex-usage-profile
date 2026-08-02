import { formatStatValue } from "./formatters.js";
import { useLocale } from "./LocaleProvider.jsx";

export function ProfileStats({ stats }) {
  const { locale, t } = useLocale();

  return (
    <dl className="profile-stats" aria-label={t("profile.stats.label")}>
      {stats.map((stat) => (
        <div className="profile-stat" key={stat.key}>
          <dd>{formatStatValue(stat.key, stat.value, locale)}</dd>
          <dt>{stat.label}</dt>
        </div>
      ))}
    </dl>
  );
}
