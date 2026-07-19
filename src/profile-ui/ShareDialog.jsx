import { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "./Icons.jsx";
import {
  buildLocalizedCardUrl,
  buildReadmeCardSnippet
} from "./cardShare.js";

export function ShareDialog({
  locale,
  makingPrivate = false,
  onClose,
  onMakePrivate,
  open,
  previewUrl,
  publicCardUrl
}) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [copyStatus, setCopyStatus] = useState("");
  const imageUrl = useMemo(
    () => buildLocalizedCardUrl(publicCardUrl, locale),
    [locale, publicCardUrl]
  );
  const markdown = useMemo(() => buildReadmeCardSnippet(imageUrl), [imageUrl]);

  useEffect(() => {
    if (!open) return undefined;

    previousFocusRef.current = document.activeElement;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
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
      document.body.style.overflow = previousBodyOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [onClose, open]);

  useEffect(() => {
    if (open) setCopyStatus("");
  }, [open]);

  if (!open || !imageUrl || !markdown) return null;

  async function copyValue(value, label) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setCopyStatus(`${label} copied`);
    } catch {
      setCopyStatus(`Could not copy ${label.toLowerCase()}`);
    }
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) onClose?.();
  }

  return (
    <div className="share-backdrop" onMouseDown={handleBackdropClick}>
      <section
        aria-labelledby="share-dialog-title"
        aria-modal="true"
        className="share-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <header className="share-dialog-header">
          <h2 id="share-dialog-title">Share card</h2>
          <button
            aria-label="Close share dialog"
            className="icon-command"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <Icon name="close" />
          </button>
        </header>

        <img
          alt="Codex usage card preview"
          className="share-card-preview"
          height="612"
          src={previewUrl}
          width="998"
        />

        <ShareValue
          label="Image URL"
          onCopy={() => copyValue(imageUrl, "Image URL")}
          value={imageUrl}
        />
        <ShareValue
          label="README Markdown"
          onCopy={() => copyValue(markdown, "README Markdown")}
          value={markdown}
        />

        <div className={`share-dialog-actions${onMakePrivate ? " has-privacy-action" : ""}`}>
          {onMakePrivate ? (
            <button
              className="secondary-command"
              disabled={makingPrivate}
              onClick={onMakePrivate}
              type="button"
            >
              {makingPrivate ? "Making private" : "Make private"}
            </button>
          ) : null}
          <a className="secondary-command" download="codex-usage-profile.png" href={imageUrl}>
            <Icon name="download" />
            <span>Save PNG</span>
          </a>
        </div>
        <p aria-live="polite" className="share-copy-status">{copyStatus}</p>
      </section>
    </div>
  );
}

function getFocusableElements(container) {
  if (!container) return [];

  return Array.from(container.querySelectorAll(
    "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])"
  ));
}

function ShareValue({ label, onCopy, value }) {
  return (
    <div className="share-value">
      <span>{label}</span>
      <div>
        <code title={value}>{value}</code>
        <button aria-label={`Copy ${label}`} className="icon-command" onClick={onCopy} type="button">
          <Icon name="copy" />
        </button>
      </div>
    </div>
  );
}
