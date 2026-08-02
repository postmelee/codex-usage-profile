import {
  formatInteger,
  formatPercent,
  formatReasoningEffort
} from "./formatters.js";
import { PluginIcon } from "./PluginIcon.jsx";
import { useLocale } from "./LocaleProvider.jsx";

export function ActivityInsights({ insights }) {
  const { locale, t } = useLocale();
  const rows = [
    [t("profile.activity.fastMode"), insights.fastModePercent == null ? t("profile.activity.notUsed") : formatPercent(insights.fastModePercent, locale)],
    [
      t("profile.activity.mostUsedReasoning"),
      insights.reasoningEffort == null || insights.reasoningEffortPercent == null
        ? t("profile.activity.notUsed")
        : `${formatReasoningEffort(insights.reasoningEffort, locale)} · ${formatPercent(insights.reasoningEffortPercent, locale)}`
    ],
    [t("profile.activity.skillsExplored"), insights.skillsExplored == null ? t("profile.activity.none") : formatInteger(insights.skillsExplored, locale)],
    [t("profile.activity.totalSkillsUsed"), insights.totalSkillsUsed == null ? t("profile.activity.none") : formatInteger(insights.totalSkillsUsed, locale)],
    [t("profile.activity.totalThreads"), insights.totalThreads == null ? t("profile.activity.none") : formatInteger(insights.totalThreads, locale)]
  ];

  return (
    <section className="activity-panel" aria-labelledby="activity-insights-title">
      <h3 id="activity-insights-title">{t("profile.activity.title")}</h3>
      <dl className="activity-list">
        {rows.map(([label, value]) => (
          <div className="activity-row" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function MostUsedPlugins({ invocations }) {
  const { locale, t } = useLocale();
  return (
    <section className="activity-panel" aria-labelledby="most-used-plugins-title">
      <h3 id="most-used-plugins-title">{t("profile.activity.mostUsedPlugins")}</h3>
      {invocations.length > 0 ? (
        <ul className="plugin-list">
          {invocations.map((invocation) => (
            <li className="plugin-row" key={`${invocation.type}:${getInvocationName(invocation)}`}>
              <span className="plugin-name-wrap">
                <PluginIcon />
                <span className="plugin-name">{getInvocationPrefix(invocation)}{getInvocationName(invocation)}</span>
              </span>
              <span className="plugin-runs">{t("profile.activity.pluginRuns", {
                count: formatInteger(invocation.usageCount, locale)
              })}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="activity-empty">{t("profile.activity.noPlugins")}</div>
      )}
    </section>
  );
}

function getInvocationPrefix(invocation) {
  return invocation.type === "skill" ? "$" : "@";
}

function getInvocationName(invocation) {
  return invocation.type === "skill"
    ? invocation.skillName ?? invocation.skillId ?? "skill"
    : invocation.pluginName ?? invocation.pluginId ?? "plugin";
}
