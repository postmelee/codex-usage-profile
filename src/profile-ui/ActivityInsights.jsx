import {
  formatInteger,
  formatPercent,
  formatReasoningEffort
} from "./formatters.js";
import { PluginIcon } from "./PluginIcon.jsx";

export function ActivityInsights({ insights }) {
  const rows = [
    ["Fast Mode", insights.fastModePercent == null ? "Not used" : formatPercent(insights.fastModePercent)],
    [
      "Most used reasoning",
      insights.reasoningEffort == null || insights.reasoningEffortPercent == null
        ? "Not used"
        : `${formatReasoningEffort(insights.reasoningEffort)} · ${formatPercent(insights.reasoningEffortPercent)}`
    ],
    ["Skills explored", insights.skillsExplored == null ? "None" : formatInteger(insights.skillsExplored)],
    ["Total skills used", insights.totalSkillsUsed == null ? "None" : formatInteger(insights.totalSkillsUsed)],
    ["Total threads", insights.totalThreads == null ? "None" : formatInteger(insights.totalThreads)]
  ];

  return (
    <section className="activity-panel" aria-labelledby="activity-insights-title">
      <h3 id="activity-insights-title">Activity insights</h3>
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
  return (
    <section className="activity-panel" aria-labelledby="most-used-plugins-title">
      <h3 id="most-used-plugins-title">Most used plugins</h3>
      {invocations.length > 0 ? (
        <ul className="plugin-list">
          {invocations.map((invocation) => (
            <li className="plugin-row" key={`${invocation.type}:${getInvocationName(invocation)}`}>
              <span className="plugin-name-wrap">
                <PluginIcon />
                <span className="plugin-name">{getInvocationPrefix(invocation)}{getInvocationName(invocation)}</span>
              </span>
              <span className="plugin-runs">{formatInteger(invocation.usageCount)} runs</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="activity-empty">No plugins used yet</div>
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
