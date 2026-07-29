import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Icon } from "./Icons.jsx";
import {
  buildLocalizedCardUrl,
  buildReadmeCardSnippet
} from "./cardShare.js";
import {
  buildPublicProfileShareUrl,
  buildShareTargets,
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
  publicOwnerHandle
}) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const previousFocusRef = useRef(null);
  const [copyStatus, setCopyStatus] = useState("");
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

  useEffect(() => {
    if (!canRender) return undefined;

    previousFocusRef.current = document.activeElement;
    setCopyStatus("");

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
        onCloseRef.current?.();
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

  async function copyValue(value, status) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setCopyStatus(status.success);
    } catch {
      setCopyStatus(status.error);
    }
  }

  function handleBackdropPointerDown(event) {
    if (event.target === event.currentTarget) onCloseRef.current?.();
  }

  return createPortal(
    <div
      className="share-studio-backdrop"
      data-testid="share-studio-backdrop"
      onPointerDown={handleBackdropPointerDown}
    >
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
          onClick={() => onCloseRef.current?.()}
          ref={closeButtonRef}
          type="button"
        >
          <Icon name="close" size={20} />
        </button>

        <h2 id="share-studio-title">{copy.title}</h2>

        <img
          alt={copy.previewAlt}
          className="share-card-preview share-studio-card"
          height="612"
          src={previewUrl}
          width="998"
        />

        <div aria-label="Share destinations" className="share-studio-primary-actions">
          {shareTargets.map((target) => (
            <ShareDestination key={target.id} target={target} />
          ))}
          <a
            aria-label={copy.saveAriaLabel}
            className="share-studio-primary-action"
            download="codex-usage-profile.png"
            href={imageUrl}
          >
            <span className="share-studio-action-icon">
              <Icon name="download" size={24} />
            </span>
            <span>{copy.save}</span>
          </a>
        </div>

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

        <p
          aria-live="polite"
          className="share-copy-status"
          role="status"
        >
          {copyStatus}
        </p>
      </section>
    </div>,
    document.body
  );
}

function ShareDestination({ target }) {
  return (
    <a
      aria-label={target.accessibleLabel}
      className="share-studio-primary-action"
      href={target.href}
      rel="noopener noreferrer"
      target="_blank"
    >
      <span className="share-studio-action-icon">
        <Icon name={target.id} size={24} />
      </span>
      <span>{target.label}</span>
    </a>
  );
}

function ShareValue({ copyLabel, label, onCopy, value }) {
  return (
    <div className="share-studio-copy-value">
      <span>{label}</span>
      <div>
        <code title={value}>{value}</code>
        <button
          aria-label={copyLabel}
          className="icon-command"
          onClick={onCopy}
          type="button"
        >
          <Icon name="copy" />
        </button>
      </div>
    </div>
  );
}

function getFocusableElements(container) {
  if (!container) return [];

  return Array.from(container.querySelectorAll(
    "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])"
  ));
}
