import { useMemo, useState } from "react";

import { buildTokenHeatmap, HEATMAP_MODES } from "./heatmap.js";

const MODE_LABELS = {
  cumulative: "Cumulative",
  daily: "Daily",
  weekly: "Weekly"
};

export function TokenActivityChart({ tokenActivity }) {
  const [mode, setMode] = useState("daily");
  const heatmap = useMemo(
    () => buildTokenHeatmap(tokenActivity, { mode }),
    [mode, tokenActivity]
  );

  return (
    <section className="token-activity" aria-label="Token activity">
      <div className="token-activity-header">
        <h3>Token activity</h3>
        <div className="token-tabs" aria-label="Token activity mode">
          {HEATMAP_MODES.map((modeName) => (
            <button
              aria-pressed={mode === modeName}
              className={mode === modeName ? "is-selected" : undefined}
              key={modeName}
              onClick={() => setMode(modeName)}
              type="button"
            >
              {MODE_LABELS[modeName]}
            </button>
          ))}
        </div>
      </div>
      <div className="token-grid-wrap">
        <div
          className="token-grid"
          data-heatmap-mode={mode}
          style={{ "--heatmap-columns": heatmap.columnCount }}
        >
          {heatmap.cells.map((cell) => (
            <button
              aria-label={cell.tooltip}
              className={`token-cell token-level-${cell.level}`}
              data-date={cell.dateIso}
              data-mode={mode}
              data-token-cell=""
              data-tooltip={cell.tooltip}
              key={cell.key}
              type="button"
            >
              <span className="token-tooltip" role="tooltip">{cell.tooltip}</span>
            </button>
          ))}
        </div>
        <div className="month-labels" aria-hidden="true">
          {heatmap.monthLabels.map((label) => <span key={label}>{label}</span>)}
        </div>
      </div>
    </section>
  );
}
