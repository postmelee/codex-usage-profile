import { useLayoutEffect, useRef, useState } from "react";

export const CARD_HANDOFF_IDENTITY_TRANSFORM = "translate3d(0, 0, 0) scale(1)";
export const CARD_HANDOFF_SOURCE_DURATION = 120;

export const CARD_HANDOFF_MODES = Object.freeze({
  SCALE: "scale",
  TARGET: "target",
  TRANSLATE: "translate"
});

const CARD_HANDOFF_MAX_SCALE = 1.5;
const CARD_HANDOFF_MIN_SCALE = 2 / 3;
const CARD_HANDOFF_SCALE_DISTORTION_LIMIT = 0.08;

export const CARD_HANDOFF_PHASES = Object.freeze({
  CLOSING: "closing",
  HANDOFF: "handoff",
  OPEN: "open",
  OPENING: "opening",
  PREPARING: "preparing"
});

export function useCardHandoffMotion(options = {}) {
  const {
    active,
    closeEasing = "cubic-bezier(0.3, 0, 1, 1)",
    introDuration = 280,
    introFrames = null,
    onClose,
    ready = true,
    restartKey,
    sourceCardRef,
    sourceRect
  } = options;

  const cardRef = useRef(null);
  const animationRef = useRef(null);
  const closingRef = useRef(false);
  const handoffTimerRef = useRef(null);
  const motionTimerRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const requestCloseRef = useRef(null);
  const resizeFrameRef = useRef(null);
  const revealedSourceRef = useRef(null);
  const revealedSourceStyleRef = useRef(null);
  const [phase, setPhase] = useState(CARD_HANDOFF_PHASES.PREPARING);

  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    if (!active || ready) return;

    closingRef.current = false;
    globalThis.clearTimeout(handoffTimerRef.current);
    globalThis.clearTimeout(motionTimerRef.current);
    animationRef.current?.cancel();
    animationRef.current = null;
    setPhase(CARD_HANDOFF_PHASES.PREPARING);
  }, [active, ready]);

  useLayoutEffect(() => {
    if (!active || !ready) return undefined;

    closingRef.current = false;

    return () => {
      globalThis.clearTimeout(handoffTimerRef.current);
      globalThis.clearTimeout(motionTimerRef.current);
      globalThis.cancelAnimationFrame?.(resizeFrameRef.current);
      if (revealedSourceRef.current?.isConnected) {
        if (revealedSourceStyleRef.current === null) {
          revealedSourceRef.current.removeAttribute("style");
        } else {
          revealedSourceRef.current.setAttribute(
            "style",
            revealedSourceStyleRef.current
          );
        }
      }
      revealedSourceRef.current = null;
      revealedSourceStyleRef.current = null;
    };
  }, [active, ready]);

  useLayoutEffect(() => {
    if (!active || !ready) return undefined;

    const card = cardRef.current;
    if (!card) return undefined;

    const reduceMotion = prefersReducedMotion();
    const targetRect = card.getBoundingClientRect();
    const resolvedSourceRect = resolveSourceRect(sourceCardRef, sourceRect);
    // Intro frames win over a measurable source rect: the handoff target is
    // already in the DOM below the fold, but the opening is not a handoff.
    const sourceTransform = !reduceMotion && !introFrames
      ? resolveCardHandoffMotion({
        coarsePointer: prefersCoarsePointer(),
        source: resolvedSourceRect,
        target: targetRect,
        viewport: getMotionViewportRect()
      })
      : null;
    const usesSourceMotion = Boolean(
      sourceTransform
      && sourceTransform.mode !== CARD_HANDOFF_MODES.TARGET
    );
    const duration = sourceTransform
      ? sourceTransform.mode === CARD_HANDOFF_MODES.TARGET
        ? 180
        : getOpenDuration(sourceTransform.distance)
      : introFrames
      ? introDuration
      : 280;
    const frames = reduceMotion
      ? [
        { opacity: 0 },
        { opacity: 1 }
      ]
      : sourceTransform
      ? sourceTransform.mode === CARD_HANDOFF_MODES.TARGET
        ? [
          { opacity: 0, transform: CARD_HANDOFF_IDENTITY_TRANSFORM },
          { opacity: 1, transform: CARD_HANDOFF_IDENTITY_TRANSFORM }
        ]
        : [
          { opacity: 1, transform: sourceTransform.value },
          { opacity: 1, transform: CARD_HANDOFF_IDENTITY_TRANSFORM }
        ]
      : introFrames ?? [
        {
          opacity: 0,
          transform: "translate3d(0, 12px, 0) scale(0.985)"
        },
        { opacity: 1, transform: CARD_HANDOFF_IDENTITY_TRANSFORM }
      ];

    setPhase(CARD_HANDOFF_PHASES.OPENING);
    card.dataset.motionOrigin = usesSourceMotion ? "source" : "target";
    card.dataset.motionMode = sourceTransform?.mode ?? "intro";
    delete card.dataset.motionFallback;

    if (typeof card.animate !== "function") {
      setPhase(CARD_HANDOFF_PHASES.OPEN);
      return undefined;
    }

    const animation = card.animate(frames, {
      duration: reduceMotion ? 140 : duration,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
      fill: "both"
    });
    animationRef.current = animation;
    const finishOpening = () => {
      if (animationRef.current !== animation || closingRef.current) return;
      setPhase(CARD_HANDOFF_PHASES.OPEN);
    };
    animation.finished.then(finishOpening).catch(() => {});
    motionTimerRef.current = globalThis.setTimeout(
      finishOpening,
      (reduceMotion ? 140 : duration) + 80
    );

    return () => {
      globalThis.clearTimeout(motionTimerRef.current);
      if (animationRef.current === animation) {
        animation.cancel();
        animationRef.current = null;
      }
    };
  }, [active, ready, restartKey, sourceCardRef, sourceRect]);

  useLayoutEffect(() => {
    if (!active) return undefined;

    function handleViewportChange() {
      globalThis.cancelAnimationFrame?.(resizeFrameRef.current);
      resizeFrameRef.current = globalThis.requestAnimationFrame?.(
        () => settleAtTarget("viewport-change")
      );
    }

    globalThis.addEventListener?.("resize", handleViewportChange);
    globalThis.addEventListener?.("orientationchange", handleViewportChange);

    return () => {
      globalThis.cancelAnimationFrame?.(resizeFrameRef.current);
      globalThis.removeEventListener?.("resize", handleViewportChange);
      globalThis.removeEventListener?.("orientationchange", handleViewportChange);
    };
  }, [active]);

  useLayoutEffect(() => {
    if (!active || phase !== CARD_HANDOFF_PHASES.HANDOFF) return undefined;

    const duration = prefersReducedMotion() ? 80 : CARD_HANDOFF_SOURCE_DURATION;
    handoffTimerRef.current = globalThis.setTimeout(
      () => onCloseRef.current?.(),
      duration + 40
    );

    return () => {
      globalThis.clearTimeout(handoffTimerRef.current);
    };
  }, [active, phase]);

  function requestClose() {
    if (!ready) {
      onCloseRef.current?.();
      return;
    }
    if (closingRef.current) return;
    closingRef.current = true;
    setPhase(CARD_HANDOFF_PHASES.CLOSING);
    globalThis.clearTimeout(handoffTimerRef.current);
    globalThis.clearTimeout(motionTimerRef.current);

    const card = cardRef.current;
    const reduceMotion = prefersReducedMotion();
    if (!card || typeof card.animate !== "function") {
      beginSourceHandoff(card, reduceMotion);
      return;
    }

    const currentStyle = getComputedStyle(card);
    const currentTransform = currentStyle.transform === "none"
      ? CARD_HANDOFF_IDENTITY_TRANSFORM
      : currentStyle.transform;
    const currentOpacity = Number.parseFloat(currentStyle.opacity) || 1;

    animationRef.current?.cancel();
    animationRef.current = null;
    const targetRect = card.getBoundingClientRect();
    const resolvedSourceRect = resolveSourceRect(sourceCardRef, sourceRect, true);
    const sourceTransform = !reduceMotion
      ? resolveCardHandoffMotion({
        coarsePointer: prefersCoarsePointer(),
        source: resolvedSourceRect,
        target: targetRect,
        viewport: getMotionViewportRect()
      })
      : null;
    const usesSourceMotion = Boolean(
      sourceTransform
      && sourceTransform.mode !== CARD_HANDOFF_MODES.TARGET
    );
    const duration = usesSourceMotion ? 280 : 180;
    const frames = reduceMotion
      ? [
        { opacity: currentOpacity },
        { opacity: 0 }
      ]
      : [
        { opacity: currentOpacity, transform: currentTransform },
        {
          opacity: usesSourceMotion ? 1 : 0,
          transform: sourceTransform?.value ?? CARD_HANDOFF_IDENTITY_TRANSFORM
        }
      ];
    const animation = card.animate(frames, {
      duration: reduceMotion ? 110 : duration,
      easing: closeEasing,
      fill: "both"
    });
    animationRef.current = animation;

    let finished = false;
    const finishClosing = () => {
      if (finished) return;
      finished = true;
      beginSourceHandoff(card, reduceMotion);
    };
    animation.finished.then(finishClosing).catch(() => {});
    motionTimerRef.current = globalThis.setTimeout(
      finishClosing,
      (reduceMotion ? 110 : duration) + 80
    );
  }

  function beginSourceHandoff(card, reduceMotion) {
    globalThis.clearTimeout(motionTimerRef.current);

    const source = sourceCardRef?.current;
    if (
      !source?.isConnected ||
      source.dataset.shareTransitionActive !== "true"
    ) {
      onCloseRef.current?.();
      return;
    }

    setPhase(CARD_HANDOFF_PHASES.HANDOFF);
    revealedSourceRef.current = source;
    revealedSourceStyleRef.current = source.getAttribute("style");
    const previousStyle = revealedSourceStyleRef.current?.trim();
    source.setAttribute(
      "style",
      `${previousStyle ? `${previousStyle};` : ""}opacity: 1;`
    );

    const duration = reduceMotion ? 80 : CARD_HANDOFF_SOURCE_DURATION;
    if (!card || typeof card.animate !== "function") return;

    const currentStyle = getComputedStyle(card);
    const currentTransform = currentStyle.transform === "none"
      ? CARD_HANDOFF_IDENTITY_TRANSFORM
      : currentStyle.transform;
    const currentOpacity = Number.parseFloat(currentStyle.opacity) || 1;
    const frames = reduceMotion
      ? [
        { opacity: currentOpacity },
        { opacity: 0 }
      ]
      : [
        { opacity: currentOpacity, transform: currentTransform },
        { opacity: 0, transform: currentTransform }
      ];
    animationRef.current = card.animate(frames, {
      duration,
      easing: "cubic-bezier(0.3, 0, 1, 1)",
      fill: "both"
    });
  }

  function settleAtTarget(reason) {
    if (closingRef.current) return;

    globalThis.clearTimeout(motionTimerRef.current);
    animationRef.current?.cancel();
    animationRef.current = null;

    const card = cardRef.current;
    if (card) {
      card.dataset.motionFallback = reason;
      card.dataset.motionMode = CARD_HANDOFF_MODES.TARGET;
      card.dataset.motionOrigin = "target";
    }
    setPhase(CARD_HANDOFF_PHASES.OPEN);
  }

  requestCloseRef.current = requestClose;

  return {
    cardRef,
    phase,
    requestClose,
    requestCloseRef,
    settleAtTarget
  };
}

export function buildRectTransform(source, target) {
  if (!isValidRect(source) || !isValidRect(target)) return null;

  const translateX = source.left - target.left;
  const translateY = source.top - target.top;
  const scaleX = source.width / target.width;
  const scaleY = source.height / target.height;

  if (
    !Number.isFinite(translateX) ||
    !Number.isFinite(translateY) ||
    !Number.isFinite(scaleX) ||
    !Number.isFinite(scaleY) ||
    scaleX <= 0 ||
    scaleY <= 0
  ) {
    return null;
  }

  return {
    distance: Math.hypot(translateX, translateY),
    value: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleX}, ${scaleY})`
  };
}

export function resolveCardHandoffMotion({
  coarsePointer = false,
  source,
  target,
  viewport
} = {}) {
  const scaleTransform = buildRectTransform(source, target);
  if (!scaleTransform) return null;
  if (!isValidViewportRect(viewport)) {
    return {
      distance: 0,
      mode: CARD_HANDOFF_MODES.TARGET,
      value: CARD_HANDOFF_IDENTITY_TRANSFORM
    };
  }

  if (
    !coarsePointer
    && isSafeScaleTransform(source, target, viewport)
  ) {
    return {
      ...scaleTransform,
      mode: CARD_HANDOFF_MODES.SCALE
    };
  }

  const translateX = rectCenterX(source) - rectCenterX(target);
  const translateY = rectCenterY(source) - rectCenterY(target);
  const translatedTarget = offsetRect(target, translateX, translateY);

  if (isRectWithinViewport(translatedTarget, viewport)) {
    return {
      distance: Math.hypot(translateX, translateY),
      mode: CARD_HANDOFF_MODES.TRANSLATE,
      value: `translate3d(${translateX}px, ${translateY}px, 0) scale(1)`
    };
  }

  return {
    distance: 0,
    mode: CARD_HANDOFF_MODES.TARGET,
    value: CARD_HANDOFF_IDENTITY_TRANSFORM
  };
}

export function getOpenDuration(distance) {
  return Math.round(Math.min(440, Math.max(320, 320 + (distance * 0.3))));
}

export function isValidRect(rect) {
  return Boolean(
    rect &&
    Number.isFinite(rect.left) &&
    Number.isFinite(rect.top) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

export function getMotionViewportRect() {
  const visualViewport = globalThis.visualViewport;
  const left = finiteOr(visualViewport?.offsetLeft, 0);
  const top = finiteOr(visualViewport?.offsetTop, 0);
  const width = finiteOr(visualViewport?.width, globalThis.innerWidth);
  const height = finiteOr(visualViewport?.height, globalThis.innerHeight);

  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width
  };
}

export function isRectWithinViewport(rect, viewport) {
  if (!isValidRect(rect) || !isValidViewportRect(viewport)) return false;

  return (
    rect.left >= viewport.left
    && rect.top >= viewport.top
    && rect.left + rect.width <= viewport.right
    && rect.top + rect.height <= viewport.bottom
  );
}

export function prefersCoarsePointer() {
  return globalThis.matchMedia?.("(pointer: coarse)").matches ?? false;
}

export function prefersReducedMotion() {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function resolveSourceRect(sourceCardRef, snapshot, preferLive = false) {
  const source = sourceCardRef?.current;
  const liveRect = source?.isConnected ? source.getBoundingClientRect() : null;

  if (!isValidRect(liveRect)) return null;
  if (preferLive) return liveRect;
  return isValidRect(snapshot) ? snapshot : liveRect;
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function isSafeScaleTransform(source, target, viewport) {
  const scaleX = source.width / target.width;
  const scaleY = source.height / target.height;
  const scaleDistortion = Math.abs(scaleX - scaleY) / Math.max(scaleX, scaleY);

  return (
    scaleX >= CARD_HANDOFF_MIN_SCALE
    && scaleX <= CARD_HANDOFF_MAX_SCALE
    && scaleY >= CARD_HANDOFF_MIN_SCALE
    && scaleY <= CARD_HANDOFF_MAX_SCALE
    && scaleDistortion <= CARD_HANDOFF_SCALE_DISTORTION_LIMIT
    && isRectWithinViewport(source, viewport)
  );
}

function isValidViewportRect(rect) {
  return Boolean(
    isValidRect(rect)
    && Number.isFinite(rect.right)
    && Number.isFinite(rect.bottom)
    && rect.right === rect.left + rect.width
    && rect.bottom === rect.top + rect.height
  );
}

function offsetRect(rect, offsetX, offsetY) {
  return {
    height: rect.height,
    left: rect.left + offsetX,
    top: rect.top + offsetY,
    width: rect.width
  };
}

function rectCenterX(rect) {
  return rect.left + (rect.width / 2);
}

function rectCenterY(rect) {
  return rect.top + (rect.height / 2);
}
