import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";

import { CardImageFrame } from "../profile-marketing/MarketingLanding.jsx";
import { BrandLogo } from "./BrandLogo.jsx";
import { CodexCheckCircleIcon, Icon } from "./Icons.jsx";
import {
  buildReadmeCardSnippet,
  buildSameOriginCardPreviewUrl
} from "./cardShare.js";
import {
  buildShareTargets,
  formatShareStudioPlatformMessage,
  getShareStudioCopy,
  isMobileShareEnvironment,
  resolveShareStudioCardUrls,
  resolveShareStudioProfileUrls
} from "./shareStudio.js";
import { useCardImageReadiness } from "./cardImageReadiness.js";
import {
  CARD_HANDOFF_PHASES,
  useCardHandoffMotion
} from "./useCardHandoffMotion.js";
import { useCardFrameRadius } from "./useCardFrameRadius.js";

export function ShareStudio({
  cardLocale,
  cardTheme,
  locale,
  locationOrigin = globalThis.location?.origin,
  makingPrivate = false,
  onClose,
  onMakePrivate,
  open,
  ownerUpdatedAt,
  publicCardUrl,
  publicOwnerHandle,
  selectedPublicCardUrl,
  shareRevision,
  sourceCardImage,
  sourceCardRef,
  sourceRect,
  usageUploadedAt
}) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const toastTimerRef = useRef(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [toast, setToast] = useState(null);
  const mobileShareEnvironment = isMobileShareEnvironment(globalThis.navigator);
  const copy = useMemo(() => getShareStudioCopy(locale), [locale]);
  const { copyImageUrl, selectedImageUrl } = useMemo(
    () => resolveShareStudioCardUrls({
      cardLocale,
      cardTheme,
      locale,
      publicCardUrl,
      selectedPublicCardUrl
    }),
    [
      cardLocale,
      cardTheme,
      locale,
      publicCardUrl,
      selectedPublicCardUrl
    ]
  );
  const previewImageUrl = useMemo(
    () => buildSameOriginCardPreviewUrl(
      selectedImageUrl,
      locationOrigin,
      publicOwnerHandle
    ),
    [locationOrigin, publicOwnerHandle, selectedImageUrl]
  );
  const { readmeProfileUrl, shareProfileUrl } = useMemo(
    () => resolveShareStudioProfileUrls(locationOrigin, publicOwnerHandle, {
      ownerUpdatedAt,
      shareRevision,
      usageUploadedAt
    }),
    [
      locationOrigin,
      ownerUpdatedAt,
      publicOwnerHandle,
      shareRevision,
      usageUploadedAt
    ]
  );
  const markdown = useMemo(
    () => buildReadmeCardSnippet(copyImageUrl, readmeProfileUrl),
    [copyImageUrl, readmeProfileUrl]
  );
  const shareTargets = useMemo(
    () => buildShareTargets({
      locale,
      mobile: mobileShareEnvironment,
      profileUrl: shareProfileUrl
    }),
    [locale, mobileShareEnvironment, shareProfileUrl]
  );
  const canRender = Boolean(
    open
    && copyImageUrl
    && selectedImageUrl
    && typeof document !== "undefined"
  );
  const cardImage = useCardImageReadiness({
    scopeKey: publicOwnerHandle ?? "share-studio",
    sourceKind: "public",
    src: canRender ? previewImageUrl : null
  });
  const hasWarmSource = Boolean(
    canRender &&
    sourceCardImage?.displaySrc &&
    sourceCardImage?.scopeKey &&
    sourceCardImage?.sourceKind &&
    sourceCardImage?.sourceUrl
  );
  const sourceDisplaySrc = hasWarmSource ? sourceCardImage.displaySrc : null;

  const {
    cardRef: motionCardRef,
    phase: transitionPhase,
    requestClose,
    requestCloseRef,
    settleAtTarget
  } = useCardHandoffMotion({
    active: canRender,
    allowPartiallyVisibleHandoff: true,
    onClose,
    ready: hasWarmSource || (cardImage.ready && !previewFailed),
    restartKey: cardImage.desiredSrc,
    sourceCardRef,
    sourceRect
  });
  const {
    radius: measuredRadius,
    setElement: setRadiusElement
  } = useCardFrameRadius(canRender);
  const setMotionCardElement = useCallback((element) => {
    motionCardRef.current = element;
    setRadiusElement(element);
  }, [motionCardRef, setRadiusElement]);
  const cardStyle = measuredRadius === null
    ? undefined
    : { "--usage-card-radius": `${measuredRadius}px` };

  useEffect(() => {
    if (!canRender || !cardImage.failed) return;

    setPreviewFailed(true);
    if (!hasWarmSource) settleAtTarget("preview-error");
  }, [canRender, cardImage.desiredSrc, cardImage.failed, hasWarmSource]);

  useLayoutEffect(() => {
    if (!canRender) return undefined;

    previousFocusRef.current = document.activeElement;
    setPreviewFailed(false);
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
      globalThis.clearTimeout(toastTimerRef.current);
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
    };
  }, [canRender]);

  if (!canRender) return null;

  const showPublicTarget = Boolean(
    cardImage.ready &&
    !previewFailed &&
    (!hasWarmSource || transitionPhase === CARD_HANDOFF_PHASES.OPEN)
  );
  const previewSrc = showPublicTarget
    ? cardImage.displaySrc
    : sourceDisplaySrc ?? cardImage.displaySrc;
  const previewFailedWithoutSource = previewFailed && !hasWarmSource;
  const previewBusy = !previewSrc && cardImage.busy;
  const previewStatus = previewFailedWithoutSource
    ? "error"
    : previewSrc
      ? "ready"
      : cardImage.status;
  const previewSourceKind = showPublicTarget
    ? "public"
    : sourceCardImage?.sourceKind ?? "public";
  const previewSourceUrl = showPublicTarget
    ? cardImage.visibleSrc
    : sourceCardImage?.sourceUrl ?? cardImage.visibleSrc;

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
      const response = await fetch(previewImageUrl ?? selectedImageUrl, {
        credentials: "same-origin"
      });
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

  function handlePreviewError() {
    setPreviewFailed(true);
    settleAtTarget("preview-error");
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
          data-share-preview-source={showPublicTarget ? "public" : hasWarmSource ? "source" : "cold"}
          data-share-target-status={previewFailed ? "error" : cardImage.status}
          data-testid="share-studio-card-motion"
          ref={setMotionCardElement}
          style={cardStyle}
        >
          <CardImageFrame
            alt={copy.previewAlt}
            busy={previewBusy}
            cardTheme={cardTheme}
            errorLabel={copy.previewUnavailable}
            imageClassName={`share-card-preview share-studio-card${showPublicTarget ? ` is-public-target${hasWarmSource ? " is-warm-handoff-target" : ""}` : hasWarmSource ? " is-handoff-source" : ""}`}
            loadingLabel={copy.previewAlt}
            onError={showPublicTarget ? handlePreviewError : undefined}
            sourceKind={previewSourceKind}
            sourceUrl={previewSourceUrl}
            src={previewFailedWithoutSource ? null : previewSrc}
            status={previewStatus}
          />
        </div>

        {previewFailed && hasWarmSource ? (
          <p className="share-studio-preview-status is-error" role="status">
            {copy.previewUnavailable}
          </p>
        ) : null}

        <div aria-label={copy.destinations} className="share-studio-primary-actions">
          {shareTargets.map((target, index) => (
            <ShareDestination index={index} key={target.id} target={target} />
          ))}
          <a
            aria-label={copy.saveAriaLabel}
            className="share-studio-primary-action"
            download="codex-usage-profile.png"
            href={selectedImageUrl}
            onClick={() => showToast(copy.imageSaved)}
            style={{ "--share-action-index": shareTargets.length }}
          >
            <span className="share-studio-action-icon">
              <Icon name="download" size={24} />
            </span>
            <span>{copy.save}</span>
          </a>
        </div>

        <div className="share-studio-secondary">
          {shareProfileUrl ? (
            <ShareValue
              copyLabel={copy.copyShareLink}
              label={copy.shareLink}
              onCopy={() => copyValue(shareProfileUrl, {
                error: copy.shareLinkCopyFailed,
                success: copy.shareLinkCopied
              })}
              primary
              value={shareProfileUrl}
            />
          ) : null}
          {markdown ? (
            <ShareValue
              label={copy.readme}
              onCopy={() => copyValue(markdown, {
                error: copy.readmeCopyFailed,
                success: copy.readmeCopied
              })}
              copyLabel={copy.copyReadme}
              value={markdown}
            />
          ) : null}
          <ShareValue
            label={copy.imageUrl}
            onCopy={() => copyValue(copyImageUrl, {
              error: copy.imageUrlCopyFailed,
              success: copy.imageUrlCopied
            })}
            copyLabel={copy.copyImageUrl}
            value={copyImageUrl}
          />
          <ShareValue
            copyLabel={copy.copyImage}
            label={copy.copyImage}
            onCopy={copyImage}
            value={selectedImageUrl}
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

function ShareDestination({ index, target }) {
  return (
    <a
      aria-label={target.accessibleLabel}
      className="share-studio-primary-action"
      href={target.href}
      rel="noopener noreferrer"
      style={{ "--share-action-index": index }}
      target="_blank"
    >
      <span className="share-studio-action-icon">
        <BrandLogo name={target.id} />
      </span>
      <span>{target.label}</span>
    </a>
  );
}

// Retained but intentionally unwired. This panel guided users through copying
// the PNG and pasting it into a composer, which was the only way to share
// before the Open Graph share link existed. Social buttons now open the
// composer with the link prefilled. Kept for a future flow that needs the
// image-attachment path (for example KakaoTalk, which does not accept a URL
// preview for every surface).
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

function ShareValue({ copyLabel, label, onCopy, primary = false, value }) {
  return (
    <button
      aria-label={copyLabel}
      className={`share-studio-secondary-action${primary ? " is-primary" : ""}`}
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

const SHARE_INSTRUCTIONS_CLOSE_DURATION = 120;
const SHARE_INSTRUCTIONS_ID = "share-studio-social-instructions";
const SHARE_INSTRUCTIONS_OPEN_DURATION = 160;
const TOAST_DURATION = 3200;
