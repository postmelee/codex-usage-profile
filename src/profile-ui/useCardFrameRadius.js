import { useLayoutEffect, useState } from "react";

export const CARD_FRAME_LOGICAL_WIDTH = 499;
export const CARD_FRAME_LOGICAL_RADIUS = 32;

export function resolveCardFrameRadius(width) {
  if (!Number.isFinite(width) || width <= 0) return null;

  return (width * CARD_FRAME_LOGICAL_RADIUS) / CARD_FRAME_LOGICAL_WIDTH;
}

export function useCardFrameRadius(active = true) {
  const [element, setElement] = useState(null);
  const [radius, setRadius] = useState(null);

  useLayoutEffect(() => {
    if (!active) {
      setRadius(null);
      return undefined;
    }

    if (!element) return undefined;

    const ownerWindow = element.ownerDocument?.defaultView ?? globalThis;
    const updateRadius = () => {
      const nextRadius = resolveCardFrameRadius(
        element.getBoundingClientRect().width
      );
      if (nextRadius === null) return;

      setRadius((currentRadius) => (
        currentRadius !== null && Math.abs(currentRadius - nextRadius) < 0.01
          ? currentRadius
          : nextRadius
      ));
    };

    updateRadius();

    if (typeof ownerWindow.ResizeObserver === "function") {
      const observer = new ownerWindow.ResizeObserver(updateRadius);
      observer.observe(element);
      return () => observer.disconnect();
    }

    ownerWindow.addEventListener?.("resize", updateRadius);
    return () => ownerWindow.removeEventListener?.("resize", updateRadius);
  }, [active, element]);

  return { radius, setElement };
}
