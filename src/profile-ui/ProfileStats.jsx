import { formatStatValue } from "./formatters.js";

export function ProfileStats({ stats }) {
  return (
    <dl className="profile-stats" aria-label="Profile stats">
      {stats.map((stat) => (
        <div className="profile-stat" key={stat.key}>
          <dd>{formatStatValue(stat.key, stat.value)}</dd>
          <dt>{stat.label}</dt>
        </div>
      ))}
    </dl>
  );
}
