import {
  useCallback,
  useEffect,
  useState
} from "react";
import { BorderBeam } from "border-beam";

import { Icon } from "../profile-ui/Icons.jsx";
import { useLocale } from "../profile-ui/LocaleProvider.jsx";
import { useCardFrameRadius } from "../profile-ui/useCardFrameRadius.js";
import { PROFILE_CARD_BORDER_BEAM_PRESET } from "../profile-card/gif-animation.js";
import { normalizeCardTheme } from "../profile-card/theme.js";
import {
  createMarketingConfig,
  resolveMarketingCopy
} from "./marketing-config.js";

const HOME_CARD_SKELETON_HEATMAP_COLUMN_COUNT = 26;
const HOME_CARD_SKELETON_HEATMAP_ROW_COUNT = 7;
const HOME_CARD_SKELETON_HEATMAP_CELL_COUNT = (
  HOME_CARD_SKELETON_HEATMAP_COLUMN_COUNT *
  HOME_CARD_SKELETON_HEATMAP_ROW_COUNT
);
const HOME_CARD_SKELETON_STAT_COUNT = 4;
const HOME_CARD_SKELETON_EXIT_DURATION_MS = 240;

export function MarketingLanding({
  cardAlt,
  cardBusy = false,
  cardLoadingLabel,
  cardOverlay = null,
  cardPreviewUrl,
  cardRef,
  cardSourceKind,
  cardSourceUrl,
  cardStatus,
  cardTheme = "dark",
  cardTransitionSuspended = false,
  config = createMarketingConfig(),
  heroAction = null,
  onCardError,
  quickstart = null
}) {
  const { t } = useLocale();
  const resolvedCardUrl = cardPreviewUrl === undefined
    ? config.sampleCardUrl
    : cardPreviewUrl;
  const resolvedCardAlt = cardAlt ?? resolveMarketingCopy(
    config,
    "sampleCardAlt",
    t("home.sampleCardAlt")
  );

  return (
    <div className="home-view">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-stage">
          <header className="home-heading">
            <h1 id="home-title">
              {resolveMarketingCopy(config, "title", t("home.title"))}
            </h1>
            <p>{resolveMarketingCopy(config, "description", t("home.description"))}</p>
          </header>

          <MarketingCardPreview
            alt={resolvedCardAlt}
            busy={cardBusy}
            cardRef={cardRef}
            loadingLabel={cardLoadingLabel ?? t("home.loadingCardPreview")}
            onError={onCardError}
            overlay={cardOverlay}
            sourceKind={cardSourceKind ?? (
              resolvedCardUrl ? "sample" : null
            )}
            sourceUrl={cardSourceUrl}
            src={resolvedCardUrl}
            status={cardStatus ?? (cardBusy ? "loading" : "ready")}
            cardTheme={cardTheme}
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
  errorLabel,
  loadingLabel,
  onError,
  overlay,
  sourceKind = null,
  sourceUrl,
  src,
  status = "ready",
  cardTheme = "dark",
  transitionSuspended = false
}) {
  const { t } = useLocale();
  const {
    radius: measuredRadius,
    setElement: setRadiusElement
  } = useCardFrameRadius();
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const supportsCardTilt = useMediaQuery(
    "(min-width: 761px) and (hover: hover) and (pointer: fine)"
  );
  const resolvedCardTheme = normalizeCardTheme(cardTheme);
  const setCardElement = useCallback((element) => {
    setRadiusElement(element);
    if (element && measuredRadius !== null) {
      setCardRadiusStyle(element, measuredRadius);
    }
    if (typeof cardRef === "function") {
      cardRef(element);
    } else if (cardRef) {
      cardRef.current = element;
    }
  }, [cardRef, measuredRadius, setRadiusElement]);

  return (
    <MarketingCardTilt
      elementRef={setCardElement}
      enabled={supportsCardTilt && !prefersReducedMotion && !busy}
      suspended={transitionSuspended}
    >
      <BorderBeam
        active={!busy && !prefersReducedMotion}
        borderRadius={measuredRadius ?? undefined}
        brightness={PROFILE_CARD_BORDER_BEAM_PRESET.brightness}
        className="home-card-beam"
        colorVariant={PROFILE_CARD_BORDER_BEAM_PRESET.colorVariant}
        duration={PROFILE_CARD_BORDER_BEAM_PRESET.durationSeconds}
        size={PROFILE_CARD_BORDER_BEAM_PRESET.size}
        strength={PROFILE_CARD_BORDER_BEAM_PRESET.strength}
        theme={resolvedCardTheme}
      >
        <CardImageFrame
          alt={alt}
          busy={busy}
          errorLabel={errorLabel}
          loadingLabel={loadingLabel ?? t("home.loadingCardPreview")}
          onError={onError}
          overlay={overlay}
          sourceKind={sourceKind}
          sourceUrl={sourceUrl}
          src={src}
          status={status}
          cardTheme={resolvedCardTheme}
        />
      </BorderBeam>
    </MarketingCardTilt>
  );
}

export function CardImageFrame({
  alt,
  busy = false,
  errorLabel,
  imageClassName = "home-card-preview",
  loadingLabel,
  onError,
  overlay,
  sourceKind = null,
  sourceUrl,
  src,
  status = "ready",
  cardTheme = "dark"
}) {
  return (
    <div
      aria-busy={busy}
      className="home-card-media"
      data-card-theme={normalizeCardTheme(cardTheme)}
      data-card-source-kind={sourceKind ?? undefined}
      data-card-source-url={sourceUrl ?? undefined}
      data-card-status={status}
    >
      {src ? (
        <img
          alt={alt}
          className={imageClassName}
          height="918"
          onError={onError}
          src={src}
          width="1497"
        />
      ) : null}
      {!src && status === "error" ? (
        <div
          aria-label={alt}
          className="card-preview-fallback"
          role="img"
        >
          <span>{errorLabel}</span>
        </div>
      ) : null}
      {overlay}
      <CardImageSkeleton active={busy} />
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
  );
}

export function CardImageSkeleton({ active }) {
  const [retained, setRetained] = useState(active);

  useEffect(() => {
    if (active) {
      setRetained(true);
      return undefined;
    }

    const timeoutId = globalThis.setTimeout(() => {
      setRetained(false);
    }, HOME_CARD_SKELETON_EXIT_DURATION_MS);

    return () => globalThis.clearTimeout(timeoutId);
  }, [active]);

  if (!active && !retained) {
    return null;
  }

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
  const { t } = useLocale();

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
          <h2 id="quickstart-title">
            {resolveMarketingCopy(config, "quickstartTitle", t("quickstart.title"))}
          </h2>
          <p>
            {resolveMarketingCopy(
              config,
              "quickstartDescription",
              t("quickstart.description")
            )}
          </p>
        </header>

        <div className="home-command-tool">
          <span className="home-command-label">{t("quickstart.runInTerminal")}</span>
          <div className="home-command-row">
            <code>{config.submitCommand}</code>
            <button
              aria-label={t("quickstart.copyCommand")}
              className="icon-command home-command-copy"
              onClick={handleCopyCommand}
              title={t("quickstart.copyCommand")}
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
            {getCopyStatus(copyState, t)}
          </p>
        </div>

        <ol className="home-quickstart-steps">
          {config.quickstartSteps.map((step, index) => (
            <li key={step.id}>
              <span aria-hidden="true" className="home-step-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{t(`quickstart.step.${step.id}.title`)}</h3>
                <p>{t(`quickstart.step.${step.id}.description`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function MarketingAppAction({ config }) {
  const { t } = useLocale();

  if (!config.appHref) {
    return (
      <button className="secondary-command" disabled type="button">
        {resolveMarketingCopy(
          config,
          "appUnavailable",
          t("quickstart.appUnavailable")
        )}
      </button>
    );
  }

  return (
    <a className="primary-command marketing-app-action" href={config.appHref}>
      {resolveMarketingCopy(config, "appCta", t("quickstart.appCta"))}
    </a>
  );
}

function MarketingCardTilt({ children, elementRef, enabled, suspended }) {
  useEffect(() => {
    if (
      !enabled ||
      globalThis.customElements?.get("hover-tilt")
    ) {
      return;
    }

    // The unresolved custom element is intentionally already in the DOM.
    // Registration upgrades that same node in place so card readiness never
    // remounts the source used by scroll anchoring and Share handoff motion.
    import("hover-tilt/web-component").catch(() => {});
  }, [enabled]);

  return (
    <hover-tilt
      blend-mode="screen"
      className="home-card-tilt"
      data-card-source="true"
      data-share-transition-active={suspended ? "true" : undefined}
      data-tilt-enabled={enabled ? "true" : "false"}
      exit-delay="120"
      glare-hue="210"
      glare-intensity={enabled ? "0.15" : "0"}
      scale-factor={enabled ? "1.018" : "1"}
      tilt-factor={enabled ? "0.45" : "0"}
      tilt-factor-y={enabled ? "0.35" : "0"}
      ref={elementRef}
    >
      {children}
    </hover-tilt>
  );
}

function setCardRadiusStyle(element, radius) {
  const existingStyle = element.getAttribute("style") ?? "";
  const preservedStyle = existingStyle
    .split(";")
    .map((declaration) => declaration.trim())
    .filter((declaration) => (
      declaration && !declaration.startsWith("--usage-card-radius:")
    ));
  preservedStyle.push(`--usage-card-radius: ${radius}px`);
  element.setAttribute("style", `${preservedStyle.join("; ")};`);
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

function getCopyStatus(status, t) {
  return {
    copied: t("quickstart.commandCopied"),
    error: t("quickstart.copyFailed"),
    idle: ""
  }[status] ?? "";
}
