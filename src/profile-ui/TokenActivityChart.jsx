import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { buildTokenHeatmap, HEATMAP_MODES } from "./heatmap.js";

const TOOLTIP_GAP = 8;
const TOOLTIP_MARGIN = 8;
const HEATMAP_CELL_GAP = 3;
const HEATMAP_CELL_SIZE = 13;

const MODE_LABELS = {
  cumulative: "Cumulative",
  daily: "Daily",
  weekly: "Weekly"
};

export function TokenActivityChart({ tokenActivity }) {
  const [mode, setMode] = useState("daily");
  const [tooltip, setTooltip] = useState(null);
  const gridWrapRef = useRef(null);
  const tooltipRef = useRef(null);
  const heatmap = useMemo(
    () => buildTokenHeatmap(tokenActivity, { mode }),
    [mode, tokenActivity]
  );
  const heatmapWidth =
    heatmap.columnCount * HEATMAP_CELL_SIZE +
    (heatmap.columnCount - 1) * HEATMAP_CELL_GAP;

  const hideTooltip = useCallback(() => {
    setTooltip(null);
  }, []);

  const showTooltip = useCallback((cell, target) => {
    const rect = target.getBoundingClientRect();

    setTooltip({
      anchor: {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        top: rect.top,
        width: rect.width
      },
      left: rect.left + rect.width / 2,
      measured: false,
      placement: "top",
      text: cell.tooltip,
      top: rect.top
    });
  }, []);

  useLayoutEffect(() => {
    if (!tooltip || !tooltipRef.current) {
      return;
    }

    const { offsetHeight: height, offsetWidth: width } = tooltipRef.current;
    const anchorCenter = tooltip.anchor.left + tooltip.anchor.width / 2;
    const minLeft = TOOLTIP_MARGIN + width / 2;
    const maxLeft = window.innerWidth - TOOLTIP_MARGIN - width / 2;
    const left = Math.min(Math.max(anchorCenter, minLeft), maxLeft);
    let nextTop = tooltip.anchor.top - height - TOOLTIP_GAP;
    let placement = "top";

    if (nextTop < TOOLTIP_MARGIN) {
      nextTop = tooltip.anchor.bottom + TOOLTIP_GAP;
      placement = "bottom";
    }

    if (nextTop + height > window.innerHeight - TOOLTIP_MARGIN) {
      nextTop = Math.max(TOOLTIP_MARGIN, window.innerHeight - TOOLTIP_MARGIN - height);
    }

    if (
      tooltip.left === left &&
      tooltip.top === nextTop &&
      tooltip.placement === placement &&
      tooltip.measured
    ) {
      return;
    }

    setTooltip({
      ...tooltip,
      left,
      measured: true,
      placement,
      top: nextTop
    });
  }, [tooltip]);

  useEffect(() => {
    if (!tooltip) {
      return undefined;
    }

    window.addEventListener("resize", hideTooltip);
    window.addEventListener("scroll", hideTooltip, true);

    return () => {
      window.removeEventListener("resize", hideTooltip);
      window.removeEventListener("scroll", hideTooltip, true);
    };
  }, [hideTooltip, tooltip]);

  useLayoutEffect(() => {
    const gridWrap = gridWrapRef.current;

    if (!gridWrap) {
      return;
    }

    gridWrap.scrollLeft = gridWrap.scrollWidth - gridWrap.clientWidth;
  }, [heatmapWidth, mode]);

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
      <div
        className="token-grid-wrap"
        ref={gridWrapRef}
        style={{
          "--heatmap-columns": heatmap.columnCount,
          "--heatmap-width": `${heatmapWidth}px`
        }}
      >
        <div
          className="token-grid"
          data-heatmap-mode={mode}
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
              onBlur={hideTooltip}
              onFocus={(event) => showTooltip(cell, event.currentTarget)}
              onPointerEnter={(event) => showTooltip(cell, event.currentTarget)}
              onPointerLeave={hideTooltip}
              type="button"
            />
          ))}
        </div>
        <div className="month-labels" aria-hidden="true">
          {heatmap.monthLabels.map((label) => <span key={label}>{label}</span>)}
        </div>
      </div>
      {tooltip ? (
        <span
          className="token-tooltip"
          data-placement={tooltip.placement}
          ref={tooltipRef}
          role="tooltip"
          style={{
            left: tooltip.left,
            top: tooltip.top,
            visibility: tooltip.measured ? "visible" : "hidden"
          }}
        >
          {tooltip.text}
        </span>
      ) : null}
    </section>
  );
}
