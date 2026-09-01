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
  formatShareStudioGifProgress,
  formatShareStudioPlatformMessage,
  getShareStudioCopy,
  getShareStudioGifErrorCopy,
  isMobileShareEnvironment,
  quantizeShareStudioGifAnnouncementProgress,
  resolveShareStudioCardUrls,
  resolveShareStudioGifSourceUrl,
  resolveShareStudioProfileUrls,
  shouldShowAnimatedGifPreview
} from "./shareStudio.js";
import {
  buildGifExportSourceKey,
  createGifExportController,
  GIF_EXPORT_STATUSES
} from "./gifExport.js";
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
  const [downloadFormat, setDownloadFormat] = useState(DOWNLOAD_FORMATS.PNG);
  const [hasChangedDownloadFormat, setHasChangedDownloadFormat] = useState(
    false
  );
  const [gifExportState, setGifExportState] = useState(INITIAL_GIF_EXPORT_STATE);
  const [selectedSocialPlatform, setSelectedSocialPlatform] = useState(null);
  const [toast, setToast] = useState(null);
  const mobileShareEnvironment = isMobileShareEnvironment(globalThis.navigator);
  const prefersReducedMotion = usePrefersReducedMotion();
  const gifExportController = useMemo(() => (
    mobileShareEnvironment || typeof document === "undefined"
      ? null
      : createGifExportController()
  ), [mobileShareEnvironment]);
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
  const gifSourceKey = useMemo(() => (
    selectedImageUrl
      ? buildGifExportSourceKey({
        cardLocale,
        cardTheme,
        selectedImageUrl,
        shareRevision
      })
      : null
  ), [cardLocale, cardTheme, selectedImageUrl, shareRevision]);
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
      format: downloadFormat,
      locale,
      mobile: mobileShareEnvironment,
      profileUrl: shareProfileUrl
    }),
    [downloadFormat, locale, mobileShareEnvironment, shareProfileUrl]
  );
  const selectedShareTarget = downloadFormat === DOWNLOAD_FORMATS.GIF
    ? shareTargets.find((target) => target.id === selectedSocialPlatform) ?? null
    : null;
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
  const gifSourceUrl = resolveShareStudioGifSourceUrl({
    previewImageUrl,
    selectedImageUrl,
    warmSourceUrl: hasWarmSource ? sourceCardImage.sourceUrl : null
  });

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
  const gifExportControllerRef = useRef(gifExportController);
  const gifExportLifetimeRef = useRef(0);
  gifExportControllerRef.current = gifExportController;
  const requestStudioClose = useCallback(() => {
    gifExportControllerRef.current?.reset();
    setDownloadFormat(DOWNLOAD_FORMATS.PNG);
    setHasChangedDownloadFormat(false);
    setSelectedSocialPlatform(null);
    requestClose();
  }, [requestClose]);
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
    if (!gifExportController) {
      setGifExportState(INITIAL_GIF_EXPORT_STATE);
      return undefined;
    }

    setGifExportState(gifExportController.getSnapshot());
    return gifExportController.subscribe(() => {
      setGifExportState(gifExportController.getSnapshot());
    });
  }, [gifExportController]);

  useEffect(() => {
    if (!gifExportController) return undefined;
    const lifetime = ++gifExportLifetimeRef.current;
    return () => {
      globalThis.queueMicrotask(() => {
        if (
          gifExportControllerRef.current !== gifExportController ||
          gifExportLifetimeRef.current === lifetime
        ) {
          gifExportController.dispose();
        }
      });
    };
  }, [gifExportController]);

  useEffect(() => {
    if (!gifExportController || !gifSourceKey) return;
    gifExportController.synchronizeSource(gifSourceKey);
  }, [gifExportController, gifSourceKey]);

  useEffect(() => {
    if (
      downloadFormat !== DOWNLOAD_FORMATS.GIF ||
      !gifExportController ||
      !gifSourceKey ||
      !gifSourceUrl
    ) return;

    gifExportController.generate({
      cardTheme,
      sourceKey: gifSourceKey,
      sourceUrl: gifSourceUrl
    });
  }, [cardTheme, downloadFormat, gifExportController, gifSourceKey, gifSourceUrl]);

  useEffect(() => {
    if (!canRender || !cardImage.failed) return;

    setPreviewFailed(true);
    if (!hasWarmSource) settleAtTarget("preview-error");
  }, [canRender, cardImage.desiredSrc, cardImage.failed, hasWarmSource]);

  useLayoutEffect(() => {
    if (!canRender) return undefined;

    previousFocusRef.current = document.activeElement;
    setPreviewFailed(false);
    setDownloadFormat(DOWNLOAD_FORMATS.PNG);
    setHasChangedDownloadFormat(false);
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
        gifExportControllerRef.current?.reset();
        setDownloadFormat(DOWNLOAD_FORMATS.PNG);
        setHasChangedDownloadFormat(false);
        setSelectedSocialPlatform(null);
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
      gifExportControllerRef.current?.reset();
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
  const gifGenerating = downloadFormat === DOWNLOAD_FORMATS.GIF
    && gifExportState.status === GIF_EXPORT_STATUSES.GENERATING;
  const showAnimatedGifPreview = shouldShowAnimatedGifPreview({
    blobUrl: gifExportState.blobUrl,
    format: downloadFormat,
    prefersReducedMotion,
    status: gifExportState.status
  });
  const renderedPreviewSrc = showAnimatedGifPreview
    ? gifExportState.blobUrl
    : previewSrc;
  const gifProgressCopy = formatShareStudioGifProgress(
    locale,
    gifExportState.progress
  );
  const gifProgressAnnouncement = formatShareStudioGifProgress(
    locale,
    quantizeShareStudioGifAnnouncementProgress(gifExportState.progress)
  );
  const gifErrorCopy = getShareStudioGifErrorCopy(
    copy,
    gifExportState.errorCode
  );

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

  function selectDownloadFormat(nextFormat) {
    if (nextFormat === downloadFormat) return;
    setHasChangedDownloadFormat(true);
    setSelectedSocialPlatform(null);
    if (nextFormat === DOWNLOAD_FORMATS.PNG) {
      if (gifExportState.status === GIF_EXPORT_STATUSES.GENERATING) {
        gifExportController?.cancel();
      }
      setDownloadFormat(DOWNLOAD_FORMATS.PNG);
      return;
    }
    setDownloadFormat(DOWNLOAD_FORMATS.GIF);
  }

  function handleDownloadFormatKeyDown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const nextFormat = event.key === "ArrowRight" || event.key === "End"
      ? DOWNLOAD_FORMATS.GIF
      : DOWNLOAD_FORMATS.PNG;
    selectDownloadFormat(nextFormat);
    event.currentTarget.parentElement
      ?.querySelector(`[data-share-format="${nextFormat}"]`)
      ?.focus();
  }

  function generateGif() {
    if (!gifExportController || !gifSourceKey || !gifSourceUrl) return;
    gifExportController.generate({
      cardTheme,
      sourceKey: gifSourceKey,
      sourceUrl: gifSourceUrl
    });
  }

  return createPortal(
    <div
      className={`share-studio-backdrop is-${transitionPhase}${selectedShareTarget ? " has-instructions" : ""}`}
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
        className={`share-studio${selectedShareTarget ? " has-instructions" : ""}`}
        ref={dialogRef}
        role="dialog"
      >
        <button
          aria-label={copy.close}
          className="icon-command share-studio-close"
          onClick={requestStudioClose}
          ref={closeButtonRef}
          type="button"
        >
          <Icon name="close" size={20} />
        </button>

        <h2 className="share-studio-title" id="share-studio-title">{copy.title}</h2>

        <div
          className="share-studio-card-motion"
          data-share-preview-format={showAnimatedGifPreview ? "gif" : "png"}
          data-share-preview-state={downloadFormat === DOWNLOAD_FORMATS.GIF ? gifExportState.status : "png"}
          data-share-preview-source={showAnimatedGifPreview ? "gif" : showPublicTarget ? "public" : hasWarmSource ? "source" : "cold"}
          data-share-target-status={gifGenerating ? "loading" : showAnimatedGifPreview ? "ready" : previewFailed ? "error" : cardImage.status}
          data-testid="share-studio-card-motion"
          ref={setMotionCardElement}
          style={cardStyle}
        >
          <CardImageFrame
            alt={copy.previewAlt}
            busy={gifGenerating || (!showAnimatedGifPreview && previewBusy)}
            cardTheme={cardTheme}
            errorLabel={copy.previewUnavailable}
            imageClassName={`share-card-preview share-studio-card${showAnimatedGifPreview ? " is-gif-preview" : showPublicTarget ? ` is-public-target${hasWarmSource ? " is-warm-handoff-target" : ""}` : hasWarmSource ? " is-handoff-source" : ""}`}
            loadingLabel={copy.previewAlt}
            onError={showAnimatedGifPreview ? undefined : showPublicTarget ? handlePreviewError : undefined}
            sourceKind={showAnimatedGifPreview ? "gif" : previewSourceKind}
            sourceUrl={showAnimatedGifPreview ? gifExportState.blobUrl : previewSourceUrl}
            src={previewFailedWithoutSource && !showAnimatedGifPreview ? null : renderedPreviewSrc}
            status={gifGenerating ? "loading" : showAnimatedGifPreview ? "ready" : previewStatus}
          />
        </div>

        {previewFailed && hasWarmSource && downloadFormat === DOWNLOAD_FORMATS.PNG ? (
          <p className="share-studio-preview-status is-error" role="status">
            {copy.previewUnavailable}
          </p>
        ) : null}

        {!mobileShareEnvironment ? (
          <div className="share-studio-format">
            <div
              aria-label={copy.format}
              className="share-studio-format-control"
              role="radiogroup"
            >
              <button
                aria-checked={downloadFormat === DOWNLOAD_FORMATS.PNG}
                className="share-studio-format-option"
                data-share-format={DOWNLOAD_FORMATS.PNG}
                onKeyDown={handleDownloadFormatKeyDown}
                onClick={() => selectDownloadFormat(DOWNLOAD_FORMATS.PNG)}
                role="radio"
                tabIndex={downloadFormat === DOWNLOAD_FORMATS.PNG ? 0 : -1}
                type="button"
              >
                {copy.formatPng}
              </button>
              <button
                aria-checked={downloadFormat === DOWNLOAD_FORMATS.GIF}
                className="share-studio-format-option"
                data-share-format={DOWNLOAD_FORMATS.GIF}
                onKeyDown={handleDownloadFormatKeyDown}
                onClick={() => selectDownloadFormat(DOWNLOAD_FORMATS.GIF)}
                role="radio"
                tabIndex={downloadFormat === DOWNLOAD_FORMATS.GIF ? 0 : -1}
                type="button"
              >
                {copy.formatGif}
              </button>
            </div>
            <div className="share-studio-gif-feedback">
              <p
                className={`share-studio-gif-status${gifExportState.status === GIF_EXPORT_STATUSES.ERROR ? " is-error" : ""}`}
                role="status"
              >
                {downloadFormat === DOWNLOAD_FORMATS.GIF
                  ? gifExportState.status === GIF_EXPORT_STATUSES.GENERATING
                    ? (
                        <>
                          <span aria-hidden="true">{gifProgressCopy}</span>
                          <span className="sr-only">{gifProgressAnnouncement}</span>
                        </>
                      )
                    : gifExportState.status === GIF_EXPORT_STATUSES.ERROR
                      ? gifErrorCopy
                      : gifExportState.status === GIF_EXPORT_STATUSES.READY
                        ? copy.gifAttachmentHint
                        : ""
                  : ""}
              </p>
              {downloadFormat === DOWNLOAD_FORMATS.GIF && gifExportState.status === GIF_EXPORT_STATUSES.ERROR ? (
                <button
                  className="share-studio-gif-retry"
                  onClick={generateGif}
                  type="button"
                >
                  {copy.retryGif}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div
          aria-label={copy.destinations}
          className={`share-studio-primary-actions${hasChangedDownloadFormat ? " is-format-transition" : ""}`}
          data-share-action-transition={hasChangedDownloadFormat ? "format" : "initial"}
          data-share-format={downloadFormat}
          key={downloadFormat}
        >
          {shareTargets.map((target, index) => (
            <ShareDestination
              active={selectedShareTarget?.id === target.id}
              guided={downloadFormat === DOWNLOAD_FORMATS.GIF && !mobileShareEnvironment}
              index={index}
              key={target.id}
              onSelect={() => setSelectedSocialPlatform((current) => (
                current === target.id ? null : target.id
              ))}
              target={target}
            />
          ))}
          {downloadFormat === DOWNLOAD_FORMATS.GIF && !mobileShareEnvironment ? (
            <GifExportAction
              copy={copy}
              gifExportState={gifExportState}
              onSaved={() => showToast(copy.gifSaved)}
              style={{ "--share-action-index": shareTargets.length }}
            />
          ) : (
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
          )}
        </div>

        {selectedShareTarget ? (
          <ShareInstructions
            copy={copy}
            gifExportState={gifExportState}
            locale={locale}
            onDismiss={() => setSelectedSocialPlatform(null)}
            onSaved={() => showToast(copy.gifSaved)}
            target={selectedShareTarget}
          />
        ) : null}

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

function ShareDestination({ active, guided, index, onSelect, target }) {
  const content = (
    <>
      <span className="share-studio-action-icon">
        <BrandLogo name={target.id} />
      </span>
      <span>{target.label}</span>
    </>
  );

  if (guided) {
    return (
      <button
        aria-controls={active ? SHARE_INSTRUCTIONS_ID : undefined}
        aria-expanded={active}
        aria-label={target.accessibleLabel}
        className={`share-studio-primary-action${active ? " is-active" : ""}`}
        onClick={onSelect}
        style={{ "--share-action-index": index }}
        type="button"
      >
        {content}
      </button>
    );
  }

  return (
    <a
      aria-label={target.accessibleLabel}
      className="share-studio-primary-action"
      href={target.href}
      rel="noopener noreferrer"
      style={{ "--share-action-index": index }}
      target="_blank"
    >
      {content}
    </a>
  );
}

function GifExportAction({
  copy,
  gifExportState,
  onSaved,
  style
}) {
  if (gifExportState.status === GIF_EXPORT_STATUSES.READY) {
    return (
      <a
        aria-label={copy.saveGifAriaLabel}
        className="share-studio-primary-action"
        download="codex-usage-profile.gif"
        href={gifExportState.blobUrl}
        onClick={onSaved}
        style={style}
      >
        <span className="share-studio-action-icon">
          <Icon name="download" size={24} />
        </span>
        <span>{copy.saveGif}</span>
      </a>
    );
  }

  return (
    <button
      aria-label={copy.saveGifAriaLabel}
      className="share-studio-primary-action"
      data-gif-export-status={gifExportState.status}
      disabled
      style={style}
      type="button"
    >
      <span className="share-studio-action-icon">
        <Icon name="download" size={24} />
      </span>
      <span>{copy.saveGif}</span>
    </button>
  );
}

function ShareInstructions({
  copy,
  gifExportState,
  locale,
  onDismiss,
  onSaved,
  target
}) {
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
          {gifExportState.status === GIF_EXPORT_STATUSES.READY ? (
            <a
              className="share-studio-step-action"
              download="codex-usage-profile.gif"
              href={gifExportState.blobUrl}
              onClick={onSaved}
            >
              <Icon name="download" size={14} />
              <span>{copy.saveGif}</span>
            </a>
          ) : (
            <button
              className="share-studio-step-action"
              data-gif-export-status={gifExportState.status}
              disabled
              type="button"
            >
              <Icon name="download" size={14} />
              <span>{copy.saveGif}</span>
            </button>
          )}
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
          <span>{copy.attachGif}</span>
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
    "a[href]:not([tabindex='-1']), button:not([disabled]):not([tabindex='-1']), [tabindex]:not([tabindex='-1'])"
  ));
}

function usePrefersReducedMotion() {
  const [matches, setMatches] = useState(
    () => globalThis.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches ?? false
  );

  useEffect(() => {
    const media = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return undefined;

    const handleChange = (event) => setMatches(event.matches);
    setMatches(media.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  return matches;
}

const SHARE_INSTRUCTIONS_CLOSE_DURATION = 120;
const SHARE_INSTRUCTIONS_ID = "share-studio-social-instructions";
const SHARE_INSTRUCTIONS_OPEN_DURATION = 160;
const TOAST_DURATION = 3200;
const DOWNLOAD_FORMATS = Object.freeze({ GIF: "gif", PNG: "png" });
const INITIAL_GIF_EXPORT_STATE = Object.freeze({
  blobUrl: null,
  byteLength: null,
  errorCode: null,
  progress: 0,
  sourceKey: null,
  status: GIF_EXPORT_STATUSES.IDLE
});
