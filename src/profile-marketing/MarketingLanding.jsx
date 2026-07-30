import { useEffect, useState } from "react";
import { BorderBeam } from "border-beam";

import { Icon } from "../profile-ui/Icons.jsx";
import { createMarketingConfig } from "./marketing-config.js";

const HOME_CARD_SKELETON_HEATMAP_COLUMN_COUNT = 26;
const HOME_CARD_SKELETON_HEATMAP_ROW_COUNT = 7;
const HOME_CARD_SKELETON_HEATMAP_CELL_COUNT = (
  HOME_CARD_SKELETON_HEATMAP_COLUMN_COUNT *
  HOME_CARD_SKELETON_HEATMAP_ROW_COUNT
);
const HOME_CARD_SKELETON_STAT_COUNT = 4;

export function MarketingLanding({
  cardAlt,
  cardBusy = false,
  cardLoadingLabel = "Loading card preview",
  cardOverlay = null,
  cardPreviewUrl,
  cardRef,
  cardSourceKind,
  cardStatus,
  cardTransitionSuspended = false,
  config = createMarketingConfig(),
  heroAction = null,
  onCardError,
  quickstart = null
}) {
  const resolvedCardUrl = cardPreviewUrl === undefined
    ? config.sampleCardUrl
    : cardPreviewUrl;
  const resolvedCardAlt = cardAlt ?? config.copy.sampleCardAlt;

  return (
    <div className="home-view">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-stage">
          <header className="home-heading">
            <h1 id="home-title">{config.copy.title}</h1>
            <p>{config.copy.description}</p>
          </header>

          <MarketingCardPreview
            alt={resolvedCardAlt}
            busy={cardBusy}
            cardRef={cardRef}
            loadingLabel={cardLoadingLabel}
            onError={onCardError}
            overlay={cardOverlay}
            sourceKind={cardSourceKind ?? (
              resolvedCardUrl ? "sample" : null
            )}
            src={resolvedCardUrl}
            status={cardStatus ?? (cardBusy ? "loading" : "ready")}
            transitionSuspended={cardTransitionSuspended}
          />

          <div className="home-account-state">
            {heroAction ?? <MarketingAppAction config={config} />}
          </div>
        </div>
      </section>

      {quickstart ?? <MarketingQuickstart config={config} />}
    </div>
  );
}

export function MarketingCardPreview({
  alt,
  busy = false,
  cardRef,
  loadingLabel = "Loading card preview",
  onError,
  overlay,
  sourceKind = null,
  src,
  status = "ready",
  transitionSuspended = false
}) {
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const supportsCardTilt = useMediaQuery(
    "(min-width: 761px) and (hover: hover) and (pointer: fine)"
  );

  return (
    <MarketingCardTilt
      elementRef={cardRef}
      enabled={supportsCardTilt && !prefersReducedMotion && !busy}
      suspended={transitionSuspended}
    >
      <BorderBeam
        active={!busy && !prefersReducedMotion && !transitionSuspended}
        borderRadius={41}
        brightness={1.05}
        className="home-card-beam"
        colorVariant="ocean"
        duration={4.8}
        size="md"
        strength={0.82}
      >
        <div
          aria-busy={busy}
          className="home-card-media"
          data-card-source-kind={sourceKind ?? undefined}
          data-card-status={status}
        >
          {src ? (
            <img
              alt={alt}
              className="home-card-preview"
              height="918"
              onError={onError}
              src={src}
              width="1497"
            />
          ) : null}
          {overlay}
          <HomeCardSkeleton active={busy} />
          <span className="home-card-glare" aria-hidden="true" />
          <p
            aria-live="polite"
            className="sr-only"
            data-testid="home-card-loading-status"
            role="status"
          >
            {busy ? loadingLabel : ""}
          </p>
        </div>
      </BorderBeam>
    </MarketingCardTilt>
  );
}

function HomeCardSkeleton({ active }) {
  return (
    <div
      aria-hidden="true"
      className="home-card-skeleton"
      data-active={active ? "true" : "false"}
    >
      <span className="home-card-skeleton-header">
        <span className="home-card-skeleton-avatar" />
        <span className="home-card-skeleton-identity">
          <span className="home-card-skeleton-display-name" />
          <span className="home-card-skeleton-username" />
        </span>
        <span className="home-card-skeleton-brand">Codex</span>
      </span>
      <span
        className="home-card-skeleton-heatmap"
        data-column-count={HOME_CARD_SKELETON_HEATMAP_COLUMN_COUNT}
        data-row-count={HOME_CARD_SKELETON_HEATMAP_ROW_COUNT}
      >
        {Array.from(
          { length: HOME_CARD_SKELETON_HEATMAP_CELL_COUNT },
          (_, index) => (
            <span
              className="home-card-skeleton-heatmap-cell"
              key={index}
            />
          )
        )}
      </span>
      <span className="home-card-skeleton-stats">
        {Array.from({ length: HOME_CARD_SKELETON_STAT_COUNT }, (_, index) => (
          <span className="home-card-skeleton-stat" key={index}>
            <span className="home-card-skeleton-stat-value" />
            <span className="home-card-skeleton-stat-label" />
          </span>
        ))}
      </span>
    </div>
  );
}

export function MarketingQuickstart({ config }) {
  const [copyState, setCopyState] = useState("idle");

  async function handleCopyCommand() {
    try {
      if (!globalThis.navigator?.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }

      await globalThis.navigator.clipboard.writeText(config.submitCommand);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  return (
    <section
      className="home-quickstart"
      id="quickstart"
      aria-labelledby="quickstart-title"
    >
      <div className="home-quickstart-inner">
        <header className="home-quickstart-heading">
          <h2 id="quickstart-title">{config.copy.quickstartTitle}</h2>
          <p>{config.copy.quickstartDescription}</p>
        </header>

        <div className="home-command-tool">
          <span className="home-command-label">Run in your terminal</span>
          <div className="home-command-row">
            <code>{config.submitCommand}</code>
            <button
              aria-label="Copy submit command"
              className="icon-command home-command-copy"
              onClick={handleCopyCommand}
              title="Copy submit command"
              type="button"
            >
              <Icon name="copy" />
            </button>
          </div>
          <p
            aria-live="polite"
            className={`home-copy-status is-${copyState}`}
            role="status"
          >
            {getCopyStatus(copyState)}
          </p>
        </div>

        <ol className="home-quickstart-steps">
          {config.quickstartSteps.map((step, index) => (
            <li key={step.id}>
              <span aria-hidden="true" className="home-step-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function MarketingAppAction({ config }) {
  if (!config.appHref) {
    return (
      <button className="secondary-command" disabled type="button">
        {config.copy.appUnavailable}
      </button>
    );
  }

  return (
    <a className="primary-command marketing-app-action" href={config.appHref}>
      {config.copy.appCta}
    </a>
  );
}

function MarketingCardTilt({ children, elementRef, enabled, suspended }) {
  const [ready, setReady] = useState(
    () => Boolean(globalThis.customElements?.get("hover-tilt"))
  );

  useEffect(() => {
    let isCurrent = true;

    if (!enabled || ready) return () => { isCurrent = false; };

    import("hover-tilt/web-component").then(() => {
      if (isCurrent) setReady(true);
    }).catch(() => {
      if (isCurrent) setReady(false);
    });

    return () => { isCurrent = false; };
  }, [enabled, ready]);

  if (!enabled || !ready) {
    return (
      <div
        className="home-card-tilt"
        data-card-source="true"
        data-share-transition-active={suspended ? "true" : undefined}
        data-tilt-enabled="false"
        ref={elementRef}
      >
        {children}
      </div>
    );
  }

  return (
    <hover-tilt
      blend-mode="screen"
      className="home-card-tilt"
      data-card-source="true"
      data-share-transition-active={suspended ? "true" : undefined}
      data-tilt-enabled="true"
      exit-delay="120"
      glare-hue="210"
      glare-intensity="0.15"
      scale-factor="1.018"
      tilt-factor="0.45"
      tilt-factor-y="0.35"
      ref={elementRef}
    >
      {children}
    </hover-tilt>
  );
}

function useMediaQuery(mediaQuery) {
  const [matches, setMatches] = useState(
    () => globalThis.matchMedia?.(mediaQuery).matches ?? false
  );

  useEffect(() => {
    const media = globalThis.matchMedia?.(mediaQuery);
    if (!media) return undefined;

    const handleChange = (event) => setMatches(event.matches);
    setMatches(media.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [mediaQuery]);

  return matches;
}

function getCopyStatus(status) {
  return {
    copied: "Command copied.",
    error: "Copy failed. Select the command and copy it manually.",
    idle: ""
  }[status] ?? "";
}
