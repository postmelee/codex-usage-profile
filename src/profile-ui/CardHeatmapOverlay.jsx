import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { getCardHeatmapCellGeometry } from "../profile-card/geometry.js";
import {
  formatCardHeatmapTooltip,
  moveCardHeatmapFocusIndex,
  resolveCardHeatmapTooltipPlacement
} from "./cardHeatmapTooltip.js";

const POINTER_MODE_HOVER = "hover";
const POINTER_MODE_TOUCH = "touch";
const KEYBOARD_MODE = "keyboard";

export function CardHeatmapOverlay({
  disabled = false,
  heatmap,
  locale = "en"
}) {
  const overlayRef = useRef(null);
  const tooltipRef = useRef(null);
  const cellRefs = useRef([]);
  const lastPointerTypeRef = useRef(null);
  const tooltipId = useId();
  const sourceKey = useMemo(
    () => createHeatmapSourceKey(heatmap, locale),
    [heatmap, locale]
  );
  const defaultFocusIndex = useMemo(
    () => findDefaultFocusIndex(heatmap),
    [heatmap]
  );
  const [focusIndex, setFocusIndex] = useState(defaultFocusIndex);
  const [interaction, setInteraction] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const activeCell = interaction === null || interaction.sourceKey !== sourceKey
    ? null
    : heatmap.cells[interaction.index] ?? null;

  useEffect(() => {
    setFocusIndex(defaultFocusIndex);
    setInteraction(null);
    setTooltipPosition(null);
  }, [defaultFocusIndex, disabled, sourceKey]);

  useEffect(() => {
    if (interaction?.mode !== POINTER_MODE_TOUCH) return undefined;

    function handleOutsidePointer(event) {
      if (!overlayRef.current?.contains(event.target)) {
        setInteraction(null);
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
    };
  }, [interaction?.mode]);

  useLayoutEffect(() => {
    if (!activeCell || disabled) {
      setTooltipPosition(null);
      return undefined;
    }

    let animationFrame = null;

    function updatePosition() {
      const anchor = cellRefs.current[interaction.index];
      const container = overlayRef.current;
      const tooltip = tooltipRef.current;
      if (!anchor || !container || !tooltip) return;

      const containerRect = container.getBoundingClientRect();
      const placement = resolveCardHeatmapTooltipPlacement({
        anchorRect: anchor.getBoundingClientRect(),
        containerRect,
        tooltipSize: tooltip.getBoundingClientRect(),
        viewportRect: {
          bottom: globalThis.innerHeight,
          left: 0,
          right: globalThis.innerWidth,
          top: 0
        }
      });

      setTooltipPosition({
        left: placement.left - containerRect.left,
        placement: placement.placement,
        top: placement.top - containerRect.top
      });
    }

    function schedulePosition() {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }
      animationFrame = requestAnimationFrame(updatePosition);
    }

    updatePosition();
    globalThis.addEventListener?.("resize", schedulePosition);
    globalThis.addEventListener?.("scroll", schedulePosition, true);
    const observer = typeof ResizeObserver === "function"
      ? new ResizeObserver(schedulePosition)
      : null;
    if (observer) {
      observer.observe(overlayRef.current);
      observer.observe(tooltipRef.current);
    }

    return () => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      observer?.disconnect();
      globalThis.removeEventListener?.("resize", schedulePosition);
      globalThis.removeEventListener?.("scroll", schedulePosition, true);
    };
  }, [activeCell, disabled, interaction?.index]);

  function handleCellFocus(index) {
    if (disabled || lastPointerTypeRef.current) return;
    setFocusIndex(index);
    setInteraction({ index, mode: KEYBOARD_MODE, sourceKey });
  }

  function handleCellKeyDown(event, index) {
    if (disabled) return;
    lastPointerTypeRef.current = null;

    if (event.key === "Escape") {
      event.preventDefault();
      setInteraction(null);
      return;
    }

    const nextIndex = moveCardHeatmapFocusIndex(index, event.key, {
      columnCount: heatmap.columnCount,
      rowCount: heatmap.rowCount
    });
    if (nextIndex === index && !event.key.startsWith("Arrow")) return;

    event.preventDefault();
    setFocusIndex(nextIndex);
    setInteraction({ index: nextIndex, mode: KEYBOARD_MODE, sourceKey });
    cellRefs.current[nextIndex]?.focus({ preventScroll: true });
  }

  function handleCellPointerDown(event) {
    lastPointerTypeRef.current = event.pointerType || "mouse";
    if (event.pointerType !== "mouse") {
      event.preventDefault();
    }
  }

  function handleCellPointerEnter(event, index) {
    if (disabled || event.pointerType !== "mouse") return;
    setInteraction({ index, mode: POINTER_MODE_HOVER, sourceKey });
  }

  function handleCellPointerUp(event, index) {
    if (disabled || event.pointerType === "mouse") {
      queueMicrotask(() => { lastPointerTypeRef.current = null; });
      return;
    }

    event.preventDefault();
    setFocusIndex(index);
    setInteraction((current) => (
      current?.mode === POINTER_MODE_TOUCH &&
        current.sourceKey === sourceKey &&
        current.index === index
        ? null
        : { index, mode: POINTER_MODE_TOUCH, sourceKey }
    ));
    queueMicrotask(() => { lastPointerTypeRef.current = null; });
  }

  function handleOverlayBlur(event) {
    if (
      interaction?.mode === KEYBOARD_MODE &&
      !event.currentTarget.contains(event.relatedTarget)
    ) {
      setInteraction(null);
    }
  }

  function handleOverlayPointerLeave() {
    if (interaction?.mode === POINTER_MODE_HOVER) {
      setInteraction(null);
    }
  }

  return (
    <div
      aria-hidden={disabled ? "true" : undefined}
      aria-label="Daily Codex token usage"
      className="card-heatmap-overlay"
      data-disabled={disabled ? "true" : "false"}
      onBlur={handleOverlayBlur}
      onPointerLeave={handleOverlayPointerLeave}
      ref={overlayRef}
      role="grid"
    >
      {heatmap.cells.map((cell, index) => {
        const geometry = getCardHeatmapCellGeometry(cell.column, cell.row);
        const label = formatCardHeatmapTooltip(cell, locale);
        const isActive = Boolean(
          activeCell && interaction?.index === index
        );

        return (
          <button
            aria-describedby={isActive ? tooltipId : undefined}
            aria-label={label}
            className="card-heatmap-cell"
            data-column={cell.column}
            data-date={cell.dateIso}
            data-row={cell.row}
            key={cell.dateIso}
            onFocus={() => handleCellFocus(index)}
            onKeyDown={(event) => handleCellKeyDown(event, index)}
            onPointerDown={handleCellPointerDown}
            onPointerEnter={(event) => handleCellPointerEnter(event, index)}
            onPointerUp={(event) => handleCellPointerUp(event, index)}
            ref={(element) => { cellRefs.current[index] = element; }}
            role="gridcell"
            style={{
              "--card-heatmap-cell-height": `${geometry.heightPercent}%`,
              "--card-heatmap-cell-left": `${geometry.leftPercent}%`,
              "--card-heatmap-cell-top": `${geometry.topPercent}%`,
              "--card-heatmap-cell-width": `${geometry.widthPercent}%`
            }}
            tabIndex={disabled || index !== focusIndex ? -1 : 0}
            type="button"
          />
        );
      })}

      {activeCell ? (
        <div
          className="card-heatmap-tooltip"
          data-placement={tooltipPosition?.placement ?? "top"}
          data-positioned={tooltipPosition ? "true" : "false"}
          id={tooltipId}
          ref={tooltipRef}
          role="tooltip"
          style={tooltipPosition ? {
            left: `${tooltipPosition.left}px`,
            top: `${tooltipPosition.top}px`
          } : undefined}
        >
          {formatCardHeatmapTooltip(activeCell, locale)}
        </div>
      ) : null}
    </div>
  );
}

function createHeatmapSourceKey(heatmap, locale) {
  if (!heatmap || !Array.isArray(heatmap.cells)) {
    throw new TypeError("heatmap with cells is required");
  }

  return [
    locale,
    heatmap.startDateIso,
    heatmap.todayIso,
    ...heatmap.cells.map((cell) => `${cell.dateIso}:${cell.tokens}`)
  ].join("|");
}

function findDefaultFocusIndex(heatmap) {
  const todayIndex = heatmap.cells.findIndex(
    (cell) => cell.dateIso === heatmap.todayIso
  );
  return todayIndex >= 0 ? todayIndex : Math.max(heatmap.cells.length - 1, 0);
}
