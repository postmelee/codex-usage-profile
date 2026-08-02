import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { buildTokenHeatmap, HEATMAP_MODES } from "./heatmap.js";
import { formatLocalizedDate } from "./i18n.js";
import { useLocale } from "./LocaleProvider.jsx";

const TOOLTIP_GAP = 8;
const TOOLTIP_MARGIN = 8;
const HEATMAP_CELL_GAP = 3;
const HEATMAP_MIN_CELL_SIZE = 13;
const HEATMAP_MAX_CELL_SIZE = 16;

const MODE_MESSAGE_IDS = {
  cumulative: "profile.heatmap.cumulative",
  daily: "profile.heatmap.daily",
  weekly: "profile.heatmap.weekly"
};

function calculateHeatmapWidth(columnCount, cellSize) {
  return columnCount * cellSize + Math.max(columnCount - 1, 0) * HEATMAP_CELL_GAP;
}

function calculateHeatmapCellSize(containerWidth, columnCount) {
  if (containerWidth <= 0 || columnCount <= 0) {
    return HEATMAP_MIN_CELL_SIZE;
  }

  const gapWidth = Math.max(columnCount - 1, 0) * HEATMAP_CELL_GAP;
  const availableCellSize = (containerWidth - gapWidth) / columnCount;
  const clampedCellSize = Math.min(
    Math.max(availableCellSize, HEATMAP_MIN_CELL_SIZE),
    HEATMAP_MAX_CELL_SIZE
  );

  return Math.round(clampedCellSize * 100) / 100;
}

export function TokenActivityChart({ capturedAt, dailyUsageBuckets }) {
  const { locale, t } = useLocale();
  const [mode, setMode] = useState("daily");
  const [showExactTokens, setShowExactTokens] = useState(false);
  const [heatmapCellSize, setHeatmapCellSize] = useState(HEATMAP_MIN_CELL_SIZE);
  const [heatmapContainerWidth, setHeatmapContainerWidth] = useState(0);
  const [focusKey, setFocusKey] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const chartRef = useRef(null);
  const cellRefs = useRef(new Map());
  const gridWrapRef = useRef(null);
  const tooltipRef = useRef(null);
  const heatmap = useMemo(
    () => buildTokenHeatmap(dailyUsageBuckets, { capturedAt, locale, mode }),
    [capturedAt, dailyUsageBuckets, locale, mode]
  );
  const heatmapWidth = calculateHeatmapWidth(heatmap.columnCount, heatmapCellSize);
  const sourceKey = `${capturedAt ?? ""}:${heatmap.startDateIso}:${heatmap.todayIso}:${locale}`;

  const hideTooltip = useCallback(() => {
    setTooltip(null);
  }, []);

  const showTooltip = useCallback((cell, target, interaction) => {
    const rect = target.getBoundingClientRect();

    setTooltip({
      anchor: {
        bottom: rect.bottom,
        left: rect.left,
        top: rect.top,
        width: rect.width
      },
      interaction,
      key: cell.key,
      left: rect.left + rect.width / 2,
      measured: false,
      placement: "top",
      text: getCellTooltip(cell, showExactTokens),
      top: rect.top
    });
  }, [showExactTokens]);

  useEffect(() => {
    setFocusKey(heatmap.latestTargetKey);
    hideTooltip();
  }, [heatmap.latestTargetKey, hideTooltip, mode, sourceKey]);

  useEffect(() => {
    hideTooltip();
  }, [hideTooltip, showExactTokens]);

  useLayoutEffect(() => {
    if (!tooltip || !tooltipRef.current) {
      return;
    }

    const { offsetHeight: height, offsetWidth: width } = tooltipRef.current;
    const anchorCenter = tooltip.anchor.left + tooltip.anchor.width / 2;
    const minLeft = TOOLTIP_MARGIN + width / 2;
    const maxLeft = window.innerWidth - TOOLTIP_MARGIN - width / 2;
    const left = Math.min(Math.max(anchorCenter, minLeft), maxLeft);
    let top = tooltip.anchor.top - height - TOOLTIP_GAP;
    let placement = "top";

    if (top < TOOLTIP_MARGIN) {
      top = tooltip.anchor.bottom + TOOLTIP_GAP;
      placement = "bottom";
    }

    if (top + height > window.innerHeight - TOOLTIP_MARGIN) {
      top = Math.max(TOOLTIP_MARGIN, window.innerHeight - TOOLTIP_MARGIN - height);
    }

    if (
      tooltip.left === left &&
      tooltip.top === top &&
      tooltip.placement === placement &&
      tooltip.measured
    ) {
      return;
    }

    setTooltip((current) => current ? {
      ...current,
      left,
      measured: true,
      placement,
      top
    } : current);
  }, [tooltip]);

  useEffect(() => {
    if (!tooltip) {
      return undefined;
    }

    const handleOutsidePointer = (event) => {
      if (!chartRef.current?.contains(event.target)) {
        hideTooltip();
      }
    };

    document.addEventListener("pointerdown", handleOutsidePointer);
    window.addEventListener("resize", hideTooltip);
    window.addEventListener("scroll", hideTooltip, true);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
      window.removeEventListener("resize", hideTooltip);
      window.removeEventListener("scroll", hideTooltip, true);
    };
  }, [hideTooltip, tooltip]);

  useLayoutEffect(() => {
    const gridWrap = gridWrapRef.current;

    if (!gridWrap) {
      return undefined;
    }

    const updateCellSize = () => {
      const containerWidth = gridWrap.clientWidth;
      const nextCellSize = calculateHeatmapCellSize(
        containerWidth,
        heatmap.columnCount
      );

      setHeatmapContainerWidth((currentWidth) => (
        currentWidth === containerWidth ? currentWidth : containerWidth
      ));
      setHeatmapCellSize((currentCellSize) => (
        Math.abs(currentCellSize - nextCellSize) < 0.01 ? currentCellSize : nextCellSize
      ));
    };

    updateCellSize();

    if (!window.ResizeObserver) {
      window.addEventListener("resize", updateCellSize);

      return () => {
        window.removeEventListener("resize", updateCellSize);
      };
    }

    const observer = new window.ResizeObserver(updateCellSize);
    observer.observe(gridWrap);

    return () => {
      observer.disconnect();
    };
  }, [heatmap.columnCount]);

  useLayoutEffect(() => {
    const gridWrap = gridWrapRef.current;

    if (!gridWrap) {
      return;
    }

    gridWrap.scrollLeft = gridWrap.scrollWidth - gridWrap.clientWidth;
  }, [heatmapContainerWidth, heatmapWidth, mode]);

  function handleCellKeyDown(event, cell) {
    if (event.key === "Escape") {
      event.preventDefault();
      hideTooltip();
      return;
    }

    const nextCell = findKeyboardTarget(heatmap.cells, cell, event.key, mode);
    if (!nextCell) return;

    event.preventDefault();
    setFocusKey(nextCell.key);
    cellRefs.current.get(nextCell.key)?.focus();
  }

  function handleTouchPointerUp(event, cell) {
    if (event.pointerType !== "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();

    setTooltip((current) => {
      if (current?.interaction === "touch" && current.key === cell.key) {
        return null;
      }

      return {
        anchor: {
          bottom: rect.bottom,
          left: rect.left,
          top: rect.top,
          width: rect.width
        },
        interaction: "touch",
        key: cell.key,
        left: rect.left + rect.width / 2,
        measured: false,
        placement: "top",
        text: getCellTooltip(cell, showExactTokens),
        top: rect.top
      };
    });
  }

  return (
    <section className="token-activity" aria-label={t("profile.heatmap.title")} ref={chartRef}>
      <div className="token-activity-header">
        <h2>{t("profile.heatmap.title")}</h2>
        <div className="token-tabs" aria-label={t("profile.heatmap.modeLabel")}>
          {HEATMAP_MODES.map((modeName) => (
            <button
              aria-pressed={mode === modeName}
              className={mode === modeName ? "is-selected" : undefined}
              key={modeName}
              onClick={() => setMode(modeName)}
              type="button"
            >
              {t(MODE_MESSAGE_IDS[modeName])}
            </button>
          ))}
        </div>
      </div>
      <div
        className="token-grid-wrap"
        ref={gridWrapRef}
        style={{
          "--heatmap-cell-gap": `${HEATMAP_CELL_GAP}px`,
          "--heatmap-cell-size": `${heatmapCellSize}px`,
          "--heatmap-columns": heatmap.columnCount,
          "--heatmap-width": `${heatmapWidth}px`
        }}
      >
        <div
          aria-label={t("profile.heatmap.gridLabel", {
            mode: t(MODE_MESSAGE_IDS[mode])
          })}
          aria-rowcount={heatmap.rowCount}
          className="token-grid"
          data-heatmap-mode={mode}
          role="grid"
        >
          {heatmap.cells.map((cell) => (
            <HeatmapCell
              cell={cell}
              focusKey={focusKey}
              key={cell.key}
              label={getCellTooltip(cell, showExactTokens)}
              mode={mode}
              onBlur={() => setTooltip((current) => (
                current?.interaction === "keyboard" ? null : current
              ))}
              onFocus={(event) => {
                setFocusKey(cell.key);
                showTooltip(cell, event.currentTarget, "keyboard");
              }}
              onKeyDown={(event) => handleCellKeyDown(event, cell)}
              onPointerDown={(event) => {
                if (event.pointerType === "touch") event.preventDefault();
              }}
              onPointerEnter={(event) => {
                if (event.pointerType !== "touch") {
                  showTooltip(cell, event.currentTarget, "pointer");
                }
              }}
              onPointerLeave={() => setTooltip((current) => (
                current?.interaction === "pointer" ? null : current
              ))}
              onPointerUp={(event) => handleTouchPointerUp(event, cell)}
              registerRef={(node) => {
                if (node) cellRefs.current.set(cell.key, node);
                else cellRefs.current.delete(cell.key);
              }}
            />
          ))}
        </div>
        <div className="month-labels" aria-hidden="true">
          {heatmap.monthLabels.map((label) => (
            <span
              key={`${label.year}-${label.month}`}
              style={{ "--month-label-column": label.column }}
            >
              {formatMonthLabel(label, locale)}
            </span>
          ))}
        </div>
      </div>
      <div className="token-activity-options">
        <label className="exact-token-toggle">
          <input
            checked={showExactTokens}
            onChange={(event) => setShowExactTokens(event.currentTarget.checked)}
            type="checkbox"
          />
          <span>{t("profile.heatmap.exactTokens")}</span>
        </label>
      </div>
      {tooltip ? (
        <span
          className="token-tooltip"
          data-placement={tooltip.placement}
          data-positioned={tooltip.measured ? "true" : "false"}
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

function HeatmapCell({
  cell,
  focusKey,
  label,
  mode,
  onBlur,
  onFocus,
  onKeyDown,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onPointerUp,
  registerRef
}) {
  const className = `token-cell token-level-${cell.level}`;
  const style = {
    gridColumn: cell.column + 1,
    gridRow: `${cell.row + 1} / span ${cell.rowSpan}`
  };
  const data = {
    "data-date": cell.dateIso,
    "data-end-date": cell.endDateIso,
    "data-mode": mode,
    "data-start-date": cell.startDateIso,
    "data-token-cell": ""
  };

  if (!cell.interactive) {
    return (
      <span
        aria-disabled="true"
        aria-label={label}
        className={`${className} is-future`}
        role="gridcell"
        style={style}
        {...data}
      />
    );
  }

  return (
    <button
      aria-label={label}
      className={className}
      onBlur={onBlur}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerUp={onPointerUp}
      ref={registerRef}
      role="gridcell"
      style={style}
      tabIndex={cell.key === focusKey ? 0 : -1}
      type="button"
      {...data}
    />
  );
}

function getCellTooltip(cell, showExactTokens) {
  return showExactTokens ? cell.tooltip : cell.compactTooltip;
}

function findKeyboardTarget(cells, current, key, mode) {
  let columnDelta = 0;
  let rowDelta = 0;

  if (key === "ArrowLeft") columnDelta = -1;
  else if (key === "ArrowRight") columnDelta = 1;
  else if (mode === "daily" && key === "ArrowUp") rowDelta = -1;
  else if (mode === "daily" && key === "ArrowDown") rowDelta = 1;
  else return null;

  const nextColumn = current.column + columnDelta;
  const nextRow = current.row + rowDelta;
  return cells.find((cell) => (
    cell.interactive && cell.column === nextColumn && cell.row === nextRow
  )) ?? null;
}

function formatMonthLabel(label, locale) {
  return formatLocalizedDate(
    new Date(`${label.dateIso}T00:00:00.000Z`),
    locale,
    { month: "short", timeZone: "UTC" }
  );
}
