import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { MarketingCardPreview } from "../profile-marketing/MarketingLanding.jsx";
import { Icon } from "./Icons.jsx";
import { useLocale } from "./LocaleProvider.jsx";
import {
  prefersReducedMotion,
  useCardHandoffMotion
} from "./useCardHandoffMotion.js";

export const PUBLIC_CARD_INTRO_ROTATION_DURATION = 900;
// Decelerating curve: the card leaves fast and settles slowly into its slot.
export const PUBLIC_CARD_INTRO_CLOSE_EASING = "cubic-bezier(0.05, 0.7, 0.1, 1)";

// Every frame stays fully opaque so a stalled or unsupported Web Animation can
// never leave the card invisible; the rotation alone carries the entrance.
const INTRO_FRAMES = Object.freeze([
  {
    opacity: 1,
    transform: "perspective(1400px) rotateY(-360deg) scale(0.82)"
  },
  {
    offset: 0.65,
    opacity: 1,
    transform: "perspective(1400px) rotateY(-40deg) scale(0.97)"
  },
  {
    opacity: 1,
    transform: "perspective(1400px) rotateY(0deg) scale(1)"
  }
]);

export function PublicCardIntro({
  cardAlt,
  cardUrl,
  createCardHref,
  onClose,
  open,
  ownerName,
  targetCardRef
}) {
  const { t } = useLocale();
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const canRender = Boolean(open && cardUrl && typeof document !== "undefined");

  const {
    cardRef: motionCardRef,
    phase,
    requestClose,
    requestCloseRef
  } = useCardHandoffMotion({
    active: canRender,
    closeEasing: PUBLIC_CARD_INTRO_CLOSE_EASING,
    introDuration: prefersReducedMotion()
      ? 140
      : PUBLIC_CARD_INTRO_ROTATION_DURATION,
    introFrames: INTRO_FRAMES,
    onClose,
    sourceCardRef: targetCardRef,
    sourceRect: null
  });

  useLayoutEffect(() => {
    if (!canRender) return undefined;

    previousFocusRef.current = document.activeElement;

    const body = document.body;
    const appFrame = document.querySelector(".app-frame");
    const previousBodyOverflow = body.style.overflow;
    const hadInertAttribute = appFrame?.hasAttribute("inert") ?? false;
    const previousAriaHidden = appFrame?.getAttribute("aria-hidden") ?? null;

    body.style.overflow = "hidden";
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
      body.style.overflow = previousBodyOverflow;
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
  }, [canRender, requestCloseRef]);

  if (!canRender) return null;

  function handleClose() {
    // The page stays where it is: the card travels down to its resting slot,
    // sliding out of view rather than dragging the viewport with it.
    requestClose();
  }

  return createPortal(
    <div
      className={`public-card-intro-backdrop is-${phase}`}
      data-testid="public-card-intro-backdrop"
    >
      <section
        aria-labelledby="public-card-intro-title"
        aria-modal="true"
        className="public-card-intro"
        ref={dialogRef}
        role="dialog"
      >
        <button
          aria-label={t("profile.intro.close")}
          className="icon-command public-card-intro-close"
          onClick={handleClose}
          ref={closeButtonRef}
          type="button"
        >
          <Icon name="close" size={20} />
        </button>

        <h2 className="public-card-intro-title" id="public-card-intro-title">
          {t("profile.intro.title", { name: ownerName })}
        </h2>

        <div
          className="public-card-intro-card"
          data-testid="public-card-intro-card"
          ref={motionCardRef}
        >
          <MarketingCardPreview alt={cardAlt} sourceKind="owner" src={cardUrl} />
        </div>

        <div className="public-card-intro-actions">
          <a className="primary-command" href={createCardHref}>
            {t("profile.public.createYourCard")}
          </a>
          <button
            className="secondary-command"
            onClick={handleClose}
            type="button"
          >
            {t("profile.intro.viewProfile")}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}

function getFocusableElements(container) {
  if (!container) return [];

  return Array.from(container.querySelectorAll(
    "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])"
  ));
}
