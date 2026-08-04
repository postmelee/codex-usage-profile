import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { BrandLogo } from "./BrandLogo.jsx";
import { CodexCheckCircleIcon, Icon } from "./Icons.jsx";
import {
  buildLocalizedCardUrl,
  buildReadmeCardSnippet
} from "./cardShare.js";
import {
  buildPublicProfileShareUrl,
  buildShareTargets,
  formatShareStudioPlatformMessage,
  getShareStudioCopy
} from "./shareStudio.js";

export function ShareStudio({
  locale,
  locationOrigin = globalThis.location?.origin,
  makingPrivate = false,
  onClose,
  onMakePrivate,
  open,
  previewUrl,
  publicCardUrl,
  publicOwnerHandle,
  sourceCardRef,
  sourceRect
}) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const closingRef = useRef(false);
  const handoffTimerRef = useRef(null);
  const motionAnimationRef = useRef(null);
  const motionCardRef = useRef(null);
  const motionTimerRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const previousFocusRef = useRef(null);
  const previewImageRef = useRef(null);
  const revealedSourceRef = useRef(null);
  const revealedSourceStyleRef = useRef(null);
  const requestCloseRef = useRef(null);
  const resizeFrameRef = useRef(null);
  const toastTimerRef = useRef(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [selectedSocialPlatform, setSelectedSocialPlatform] = useState(null);
  const [toast, setToast] = useState(null);
  const [transitionPhase, setTransitionPhase] = useState("preparing");
  const copy = useMemo(() => getShareStudioCopy(locale), [locale]);
  const imageUrl = useMemo(
    () => buildLocalizedCardUrl(publicCardUrl, locale),
    [locale, publicCardUrl]
  );
  const markdown = useMemo(() => buildReadmeCardSnippet(imageUrl), [imageUrl]);
  const publicProfileUrl = useMemo(
    () => buildPublicProfileShareUrl(locationOrigin, publicOwnerHandle),
    [locationOrigin, publicOwnerHandle]
  );
  const shareTargets = useMemo(
    () => buildShareTargets({ locale, profileUrl: publicProfileUrl }),
    [locale, publicProfileUrl]
  );
  const canRender = Boolean(
    open
    && imageUrl
    && markdown
    && previewUrl
    && typeof document !== "undefined"
  );

  onCloseRef.current = onClose;
  requestCloseRef.current = requestClose;

  useLayoutEffect(() => {
    if (!canRender) return undefined;

    closingRef.current = false;
    previousFocusRef.current = document.activeElement;
    setPreviewFailed(false);
    setSelectedSocialPlatform(null);
    setToast(null);

    const body = document.body;
    const appFrame = document.querySelector(".app-frame");
    const scrollContainer = document.querySelector(".profile-shell");
    const previousBodyOverflow = body.style.overflow;
    const previousScrollOverflow = scrollContainer?.style.overflow ?? "";
    const hadInertAttribute = appFrame?.hasAttribute("inert") ?? false;
    const previousAriaHidden = appFrame?.getAttribute("aria-hidden") ?? null;

    body.style.overflow = "hidden";
    if (scrollContainer) scrollContainer.style.overflow = "hidden";
    if (appFrame) {
      appFrame.inert = true;
      appFrame.setAttribute("aria-hidden", "true");
    }
    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        requestCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1);

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      globalThis.clearTimeout(handoffTimerRef.current);
      globalThis.clearTimeout(toastTimerRef.current);
      globalThis.cancelAnimationFrame?.(resizeFrameRef.current);
      body.style.overflow = previousBodyOverflow;
      if (scrollContainer) scrollContainer.style.overflow = previousScrollOverflow;
      if (appFrame) {
        appFrame.inert = hadInertAttribute;
        if (previousAriaHidden === null) {
          appFrame.removeAttribute("aria-hidden");
        } else {
          appFrame.setAttribute("aria-hidden", previousAriaHidden);
        }
      }
      if (previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus?.();
      }
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
  }, [canRender]);

  useLayoutEffect(() => {
    if (!canRender) return undefined;

    const card = motionCardRef.current;
    if (!card) return undefined;

    const reduceMotion = prefersReducedMotion();
    const targetRect = card.getBoundingClientRect();
    const resolvedSourceRect = resolveSourceRect(sourceCardRef, sourceRect);
    const sourceTransform = !reduceMotion
      ? buildRectTransform(resolvedSourceRect, targetRect)
      : null;
    const duration = sourceTransform ? getOpenDuration(sourceTransform.distance) : 280;
    const frames = reduceMotion
      ? [
        { opacity: 0 },
        { opacity: 1 }
      ]
      : sourceTransform
      ? [
        { opacity: 1, transform: sourceTransform.value },
        { opacity: 1, transform: IDENTITY_TRANSFORM }
      ]
      : [
        {
          opacity: 0,
          transform: "translate3d(0, 12px, 0) scale(0.985)"
        },
        { opacity: 1, transform: IDENTITY_TRANSFORM }
      ];

    setTransitionPhase("opening");
    card.dataset.motionOrigin = sourceTransform ? "source" : "target";
    delete card.dataset.motionFallback;

    if (typeof card.animate !== "function") {
      setTransitionPhase("open");
      return undefined;
    }

    const animation = card.animate(frames, {
      duration: reduceMotion ? 140 : duration,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
      fill: "both"
    });
    motionAnimationRef.current = animation;
    const finishOpening = () => {
      if (
        motionAnimationRef.current !== animation
        || closingRef.current
      ) {
        return;
      }
      setTransitionPhase("open");
    };
    animation.finished.then(finishOpening).catch(() => {});
    motionTimerRef.current = globalThis.setTimeout(
      finishOpening,
      (reduceMotion ? 140 : duration) + 80
    );

    return () => {
      globalThis.clearTimeout(motionTimerRef.current);
      if (motionAnimationRef.current === animation) {
        animation.cancel();
        motionAnimationRef.current = null;
      }
    };
  }, [canRender, previewUrl, sourceCardRef, sourceRect]);

  useLayoutEffect(() => {
    if (!canRender) return undefined;

    function handleViewportChange() {
      globalThis.cancelAnimationFrame?.(resizeFrameRef.current);
      resizeFrameRef.current = globalThis.requestAnimationFrame?.(
        () => settleMotionAtTarget("viewport-change")
      );
    }

    globalThis.addEventListener?.("resize", handleViewportChange);
    globalThis.addEventListener?.("orientationchange", handleViewportChange);

    return () => {
      globalThis.cancelAnimationFrame?.(resizeFrameRef.current);
      globalThis.removeEventListener?.("resize", handleViewportChange);
      globalThis.removeEventListener?.("orientationchange", handleViewportChange);
    };
  }, [canRender]);

  useLayoutEffect(() => {
    if (!canRender || transitionPhase !== "handoff") return undefined;

    const duration = prefersReducedMotion() ? 80 : SOURCE_HANDOFF_DURATION;
    handoffTimerRef.current = globalThis.setTimeout(
      () => onCloseRef.current?.(),
      duration + 40
    );

    return () => {
      globalThis.clearTimeout(handoffTimerRef.current);
    };
  }, [canRender, transitionPhase]);

  if (!canRender) return null;

  async function copyValue(value, status) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      showToast(status.success);
    } catch {
      showToast(status.error, "error");
    }
  }

  async function copyImage() {
    try {
      if (!navigator.clipboard?.write || !globalThis.ClipboardItem) {
        throw new Error("Image clipboard unavailable");
      }
      const response = await fetch(previewUrl, { credentials: "same-origin" });
      if (!response.ok) throw new Error("Could not load image");
      const blob = await response.blob();
      const png = blob.type === "image/png"
        ? blob
        : new Blob([await blob.arrayBuffer()], { type: "image/png" });
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": png })
      ]);
      showToast(copy.imageCopied);
    } catch {
      showToast(copy.imageCopyFailed, "error");
    }
  }

  function showToast(message, kind = "success") {
    globalThis.clearTimeout(toastTimerRef.current);
    setToast({ kind, message });
    toastTimerRef.current = globalThis.setTimeout(
      () => setToast(null),
      TOAST_DURATION
    );
  }

  function requestClose() {
    if (closingRef.current) return;
    closingRef.current = true;
    setToast(null);
    setTransitionPhase("closing");
    globalThis.clearTimeout(handoffTimerRef.current);
    globalThis.clearTimeout(motionTimerRef.current);

    const card = motionCardRef.current;
    const reduceMotion = prefersReducedMotion();
    if (!card || typeof card.animate !== "function") {
      beginSourceHandoff(card, reduceMotion);
      return;
    }

    const currentStyle = getComputedStyle(card);
    const currentTransform = currentStyle.transform === "none"
      ? IDENTITY_TRANSFORM
      : currentStyle.transform;
    const currentOpacity = Number.parseFloat(currentStyle.opacity) || 1;

    motionAnimationRef.current?.cancel();
    motionAnimationRef.current = null;
    const targetRect = card.getBoundingClientRect();
    const resolvedSourceRect = resolveSourceRect(sourceCardRef, sourceRect, true);
    const sourceTransform = !reduceMotion
      ? buildRectTransform(resolvedSourceRect, targetRect)
      : null;
    const duration = sourceTransform ? 280 : 180;
    const frames = reduceMotion
      ? [
        { opacity: currentOpacity },
        { opacity: 0 }
      ]
      : [
        { opacity: currentOpacity, transform: currentTransform },
        {
          opacity: sourceTransform ? 1 : 0,
          transform: sourceTransform?.value ?? IDENTITY_TRANSFORM
        }
      ];
    const animation = card.animate(frames, {
      duration: reduceMotion ? 110 : duration,
      easing: "cubic-bezier(0.3, 0, 1, 1)",
      fill: "both"
    });
    motionAnimationRef.current = animation;

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
      !source?.isConnected
      || source.dataset.shareTransitionActive !== "true"
    ) {
      onCloseRef.current?.();
      return;
    }

    setTransitionPhase("handoff");
    revealedSourceRef.current = source;
    revealedSourceStyleRef.current = source.getAttribute("style");
    const previousStyle = revealedSourceStyleRef.current?.trim();
    source.setAttribute(
      "style",
      `${previousStyle ? `${previousStyle};` : ""}opacity: 1;`
    );

    const duration = reduceMotion ? 80 : SOURCE_HANDOFF_DURATION;
    if (!card || typeof card.animate !== "function") {
      return;
    }

    const currentStyle = getComputedStyle(card);
    const currentTransform = currentStyle.transform === "none"
      ? IDENTITY_TRANSFORM
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
    const animation = card.animate(frames, {
      duration,
      easing: "cubic-bezier(0.3, 0, 1, 1)",
      fill: "both"
    });
    motionAnimationRef.current = animation;
  }

  function settleMotionAtTarget(reason) {
    if (closingRef.current) return;

    globalThis.clearTimeout(motionTimerRef.current);
    motionAnimationRef.current?.cancel();
    motionAnimationRef.current = null;

    const card = motionCardRef.current;
    if (card) {
      card.dataset.motionFallback = reason;
      card.dataset.motionOrigin = "target";
    }
    setTransitionPhase("open");
  }

  function handlePreviewError() {
    setPreviewFailed(true);
    settleMotionAtTarget("preview-error");
  }

  return createPortal(
    <div
      className={`share-studio-backdrop is-${transitionPhase}`}
      data-testid="share-studio-backdrop"
    >
      {toast ? (
        <ShareToast
          copy={copy}
          kind={toast.kind}
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      ) : null}

      <section
        aria-labelledby="share-studio-title"
        aria-modal="true"
        className="share-studio"
        ref={dialogRef}
        role="dialog"
      >
        <button
          aria-label={copy.close}
          className="icon-command share-studio-close"
          onClick={requestClose}
          ref={closeButtonRef}
          type="button"
        >
          <Icon name="close" size={20} />
        </button>

        <h2 className="share-studio-title" id="share-studio-title">{copy.title}</h2>

        <div
          className="share-studio-card-motion"
          data-testid="share-studio-card-motion"
          ref={motionCardRef}
        >
          {previewFailed ? (
            <div
              aria-label={copy.previewAlt}
              className="share-studio-preview-fallback"
              role="img"
            >
              <span>{copy.previewUnavailable}</span>
            </div>
          ) : (
            <img
              alt={copy.previewAlt}
              className="share-card-preview share-studio-card"
              height="612"
              onError={handlePreviewError}
              ref={previewImageRef}
              src={previewUrl}
              width="998"
            />
          )}
        </div>

        <div aria-label={copy.destinations} className="share-studio-primary-actions">
          {shareTargets.map((target, index) => (
            <ShareDestination
              active={selectedSocialPlatform === target.id}
              index={index}
              key={target.id}
              onSelect={() => setSelectedSocialPlatform(target.id)}
              target={target}
            />
          ))}
          <a
            aria-label={copy.saveAriaLabel}
            className="share-studio-primary-action"
            download="codex-usage-profile.png"
            href={imageUrl}
            onClick={() => showToast(copy.imageSaved)}
            style={{ "--share-action-index": shareTargets.length }}
          >
            <span className="share-studio-action-icon">
              <Icon name="download" size={24} />
            </span>
            <span>{copy.save}</span>
          </a>
        </div>

        {selectedSocialPlatform ? (
          <ShareInstructions
            copy={copy}
            locale={locale}
            onCopy={copyImage}
            onDismiss={() => setSelectedSocialPlatform(null)}
            target={shareTargets.find(
              (target) => target.id === selectedSocialPlatform
            )}
          />
        ) : null}

        <div className="share-studio-secondary">
          <ShareValue
            label={copy.imageUrl}
            onCopy={() => copyValue(imageUrl, {
              error: copy.imageUrlCopyFailed,
              success: copy.imageUrlCopied
            })}
            copyLabel={copy.copyImageUrl}
            value={imageUrl}
          />
          <ShareValue
            label={copy.readme}
            onCopy={() => copyValue(markdown, {
              error: copy.readmeCopyFailed,
              success: copy.readmeCopied
            })}
            copyLabel={copy.copyReadme}
            value={markdown}
          />
          {onMakePrivate ? (
            <button
              className="share-studio-privacy-action"
              disabled={makingPrivate}
              onClick={onMakePrivate}
              type="button"
            >
              {makingPrivate ? copy.makingPrivate : copy.makePrivate}
            </button>
          ) : null}
        </div>

      </section>
    </div>,
    document.body
  );
}

function ShareDestination({ active, index, onSelect, target }) {
  return (
    <button
      aria-controls={active ? SHARE_INSTRUCTIONS_ID : undefined}
      aria-expanded={active}
      aria-label={target.accessibleLabel}
      aria-pressed={active}
      className={`share-studio-primary-action${active ? " is-active" : ""}`}
      onClick={onSelect}
      style={{ "--share-action-index": index }}
      type="button"
    >
      <span className="share-studio-action-icon">
        <BrandLogo name={target.id} />
      </span>
      <span>{target.label}</span>
    </button>
  );
}

function ShareInstructions({ copy, locale, onCopy, onDismiss, target }) {
  const dismissTimerRef = useRef(null);
  const dismissedRef = useRef(false);
  const instructionsRef = useRef(null);
  const motionPhaseRef = useRef("measuring");
  const onDismissRef = useRef(onDismiss);
  const openingTimerRef = useRef(null);
  const [expandedHeight, setExpandedHeight] = useState(null);
  const [motionPhase, setMotionPhase] = useState("measuring");

  onDismissRef.current = onDismiss;
  motionPhaseRef.current = motionPhase;

  useLayoutEffect(() => {
    globalThis.clearTimeout(dismissTimerRef.current);
    globalThis.clearTimeout(openingTimerRef.current);
    dismissedRef.current = false;
    motionPhaseRef.current = "measuring";
    setMotionPhase("measuring");
    setExpandedHeight(null);

    const height = instructionsRef.current?.offsetHeight ?? 0;
    if (height <= 0) {
      motionPhaseRef.current = "open";
      setMotionPhase("open");
      return undefined;
    }

    setExpandedHeight(height);
    motionPhaseRef.current = "opening";
    setMotionPhase("opening");
    openingTimerRef.current = globalThis.setTimeout(
      finishOpening,
      SHARE_INSTRUCTIONS_OPEN_DURATION + 80
    );

    return () => {
      globalThis.clearTimeout(dismissTimerRef.current);
      globalThis.clearTimeout(openingTimerRef.current);
    };
  }, [target?.id]);

  if (!target) return null;

  function finishOpening() {
    if (motionPhaseRef.current !== "opening") return;
    globalThis.clearTimeout(openingTimerRef.current);
    motionPhaseRef.current = "open";
    setMotionPhase("open");
    setExpandedHeight(null);
  }

  function finishDismiss() {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    globalThis.clearTimeout(dismissTimerRef.current);
    globalThis.clearTimeout(openingTimerRef.current);
    onDismissRef.current?.();
  }

  function requestDismiss() {
    if (motionPhaseRef.current === "closing") return;
    globalThis.clearTimeout(openingTimerRef.current);
    setExpandedHeight(
      Math.max(0, instructionsRef.current?.getBoundingClientRect().height ?? 0)
    );
    motionPhaseRef.current = "closing";
    setMotionPhase("closing");
    dismissTimerRef.current = globalThis.setTimeout(
      finishDismiss,
      SHARE_INSTRUCTIONS_CLOSE_DURATION + 80
    );
  }

  function handleAnimationEnd(event) {
    if (
      motionPhaseRef.current === "opening"
      && event.currentTarget === event.target
      && event.animationName === "share-studio-instructions-in"
    ) {
      finishOpening();
      return;
    }

    if (
      motionPhaseRef.current === "closing"
      && event.currentTarget === event.target
      && event.animationName === "share-studio-instructions-out"
    ) {
      finishDismiss();
    }
  }

  return (
    <div
      className={`share-studio-instructions is-${motionPhase}`}
      id={SHARE_INSTRUCTIONS_ID}
      onAnimationEnd={handleAnimationEnd}
      ref={instructionsRef}
      style={expandedHeight === null ? undefined : {
        "--share-instructions-expanded-height": `${expandedHeight}px`
      }}
    >
      <div className="share-studio-instructions-header">
        <h3>{formatShareStudioPlatformMessage(
          locale,
          "shareInstructionsTitle",
          target.label
        )}</h3>
        <button
          aria-label={copy.dismissInstructions}
          className="icon-command share-studio-instructions-close"
          onClick={requestDismiss}
          type="button"
        >
          <Icon name="close" size={14} />
        </button>
      </div>
      <ol>
        <li>
          <ShareStepNumber value="1" />
          <button
            className="share-studio-step-action"
            onClick={onCopy}
            type="button"
          >
            <Icon name="copy" size={14} />
            <span>{copy.copyImage}</span>
          </button>
        </li>
        <li>
          <ShareStepNumber value="2" />
          <a
            className="share-studio-step-action"
            href={target.href}
            rel="noopener noreferrer"
            target="_blank"
          >
            <Icon name="globe" size={14} />
            <span>{formatShareStudioPlatformMessage(
              locale,
              "openComposer",
              target.label
            )}</span>
          </a>
        </li>
        <li className="share-studio-step-copy">
          <ShareStepNumber value="3" />
          <span>{copy.pasteImage}</span>
        </li>
      </ol>
    </div>
  );
}

function ShareStepNumber({ value }) {
  return <span aria-hidden="true" className="share-studio-step-number">{value}</span>;
}

function ShareToast({ copy, kind, message, onDismiss }) {
  return (
    <div
      aria-live="polite"
      className={`share-studio-toast is-${kind}`}
      role="status"
    >
      {kind === "success" ? (
        <CodexCheckCircleIcon />
      ) : (
        <Icon name="close" size={16} />
      )}
      <span>{message}</span>
      <button
        aria-label={copy.dismissToast}
        className="share-studio-toast-close"
        onClick={onDismiss}
        type="button"
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}

function ShareValue({ copyLabel, label, onCopy, value }) {
  return (
    <button
      aria-label={copyLabel}
      className="share-studio-secondary-action"
      onClick={onCopy}
      title={value}
      type="button"
    >
      <Icon name="copy" size={14} />
      <span>{label}</span>
    </button>
  );
}

function getFocusableElements(container) {
  if (!container) return [];

  return Array.from(container.querySelectorAll(
    "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])"
  ));
}

const IDENTITY_TRANSFORM = "translate3d(0, 0, 0) scale(1)";
const SHARE_INSTRUCTIONS_CLOSE_DURATION = 120;
const SHARE_INSTRUCTIONS_ID = "share-studio-social-instructions";
const SHARE_INSTRUCTIONS_OPEN_DURATION = 160;
const SOURCE_HANDOFF_DURATION = 120;
const TOAST_DURATION = 3200;

function buildRectTransform(source, target) {
  if (!isValidRect(source) || !isValidRect(target)) return null;

  const translateX = source.left - target.left;
  const translateY = source.top - target.top;
  const scaleX = source.width / target.width;
  const scaleY = source.height / target.height;

  if (
    !Number.isFinite(translateX)
    || !Number.isFinite(translateY)
    || !Number.isFinite(scaleX)
    || !Number.isFinite(scaleY)
    || scaleX <= 0
    || scaleY <= 0
  ) {
    return null;
  }

  return {
    distance: Math.hypot(translateX, translateY),
    value: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleX}, ${scaleY})`
  };
}

function getOpenDuration(distance) {
  return Math.round(Math.min(440, Math.max(320, 320 + (distance * 0.3))));
}

function isValidRect(rect) {
  return Boolean(
    rect
    && Number.isFinite(rect.left)
    && Number.isFinite(rect.top)
    && Number.isFinite(rect.width)
    && Number.isFinite(rect.height)
    && rect.width > 0
    && rect.height > 0
  );
}

function prefersReducedMotion() {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function resolveSourceRect(sourceCardRef, snapshot, preferLive = false) {
  const source = sourceCardRef?.current;
  const liveRect = source?.isConnected ? source.getBoundingClientRect() : null;

  if (!isValidRect(liveRect)) return null;
  if (preferLive) return liveRect;
  return isValidRect(snapshot) ? snapshot : liveRect;
}
