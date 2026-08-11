import { useEffect, useMemo, useRef, useState } from "react";

import { MarketingLanding } from "../profile-marketing/MarketingLanding.jsx";
import {
  buildMarketingOperatorCardUrl,
  createMarketingConfig
} from "../profile-marketing/marketing-config.js";
import { ProfileShell } from "./ProfileShell.jsx";
import { HomeQuickstart } from "./HomeQuickstart.jsx";
import { useLocale } from "./LocaleProvider.jsx";
import { ShareStudio } from "./ShareStudio.jsx";
import {
  acquireCardImageResource,
  isCardImageAbortError
} from "./cardImageReadiness.js";
import {
  buildAccountLoginHref,
  getAccountAvatar,
  getAccountDisplayName,
  getAccountLogin,
  getAccountOwner
} from "./accountUi.js";
import {
  HOME_CARD_SOURCE_KINDS,
  HOME_CARD_TRANSITION_STATUSES,
  areHomeCardSourcesEqual,
  beginHomeCardTransition,
  createHomeCardSource,
  createHomeCardTransition,
  rejectHomeCardTransition,
  resetHomeCardTransition,
  resolveHomeCardTransition
} from "./homeCardTransition.js";

const HOME_MARKETING_CONFIG = createMarketingConfig();

export function HomePage({
  authState,
  client,
  location,
  onAuthStateChange
}) {
  const status = authState?.status ?? "loading";
  const owner = getAccountOwner(authState);
  const { locale, t } = useLocale();
  const operatorCardSource = useMemo(() => createHomeCardSource({
    kind: HOME_CARD_SOURCE_KINDS.OPERATOR,
    src: buildMarketingOperatorCardUrl(HOME_MARKETING_CONFIG, locale)
  }), [locale]);
  const sampleCardSource = useMemo(() => createHomeCardSource({
    kind: HOME_CARD_SOURCE_KINDS.SAMPLE,
    src: HOME_MARKETING_CONFIG.sampleCardUrl
  }), []);
  const [cardState, setCardState] = useState(() => ({
    transition: createHomeCardTransition({
      fallbackSrc: sampleCardSource.src,
      target: operatorCardSource
    }),
    visibleResource: null
  }));
  const [profileState, setProfileState] = useState({
    error: null,
    profile: null,
    status: "idle"
  });
  const [mutationState, setMutationState] = useState({
    error: null,
    status: "idle"
  });
  const [previewRevision, setPreviewRevision] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSourceImage, setShareSourceImage] = useState(null);
  const shareSourceCardRef = useRef(null);
  const shareSourceRectRef = useRef(null);
  const cardTransition = cardState.transition;
  const visibleCardDisplaySrc = cardState.visibleResource?.displaySrc ?? null;
  const isAuthenticated = status === "authenticated" && Boolean(owner);
  const ownerKey = owner?.id ?? owner?.handle ?? null;
  const loginHref = buildAccountLoginHref(client, location);

  useEffect(() => {
    let isCurrent = true;

    if (!isAuthenticated) {
      setProfileState({ error: null, profile: null, status: "idle" });
      return () => { isCurrent = false; };
    }

    setProfileState({ error: null, profile: null, status: "loading" });
    client.getOwnerProfile().then((profile) => {
      if (isCurrent) {
        setProfileState({ error: null, profile, status: "ready" });
      }
    }).catch(() => {
      if (isCurrent) {
        setProfileState({
          error: "home.cardUnavailable",
          profile: null,
          status: "error"
        });
      }
    });

    return () => { isCurrent = false; };
  }, [client, isAuthenticated, ownerKey]);

  const profile = profileState.profile;
  const hasUsage = Boolean(profile?.usage);
  const isPublic = profile?.visibility === "public";
  const cardLocale = profile?.cardLocale ?? "en";
  const cardTheme = profile?.cardStyle?.theme ?? "dark";
  const ownerPreviewUrl = isAuthenticated && hasUsage
    ? client?.buildOwnerCardPreviewUrl?.({
      locale: cardLocale,
      theme: cardTheme,
      ...(previewRevision > 0 ? { revision: previewRevision } : {})
    }) ?? null
    : null;
  const desiredCardSource = useMemo(() => {
    if (!isAuthenticated) return operatorCardSource;
    if (
      profileState.status === "ready" &&
      hasUsage &&
      ownerPreviewUrl
    ) {
      return createHomeCardSource({
        kind: HOME_CARD_SOURCE_KINDS.OWNER,
        src: ownerPreviewUrl
      });
    }
    if (
      profileState.status === "ready" ||
      profileState.status === "error"
    ) {
      return sampleCardSource;
    }
    return operatorCardSource;
  }, [
    hasUsage,
    isAuthenticated,
    operatorCardSource,
    ownerPreviewUrl,
    profileState.status,
    sampleCardSource
  ]);

  useEffect(() => {
    setCardState((current) => {
      const currentTarget = current.transition.pending ?? current.transition.visible;
      if (areHomeCardSourcesEqual(currentTarget, desiredCardSource)) {
        return current;
      }

      const next = isAuthenticated
        ? beginHomeCardTransition(current.transition, desiredCardSource)
        : resetHomeCardTransition(current.transition, desiredCardSource);
      return {
        transition: next,
        visibleResource: isAuthenticated ? current.visibleResource : null
      };
    });
  }, [desiredCardSource, isAuthenticated]);

  useEffect(() => {
    const pending = cardTransition.pending;
    if (!pending) return undefined;

    let active = true;
    const generation = cardTransition.generation;

    acquireCardImageResource({
      scopeKey: pending.kind === HOME_CARD_SOURCE_KINDS.OWNER
        ? ownerKey ?? "authenticated-owner"
        : "public-card",
      sourceKind: pending.kind === HOME_CARD_SOURCE_KINDS.OWNER
        ? "owner"
        : pending.kind,
      src: pending.src
    }).then((resource) => {
      if (!active) {
        resource.release();
        return;
      }

      setCardState((current) => {
        const next = resolveHomeCardTransition(current.transition, generation);
        if (next === current.transition) {
          resource.release();
          return current;
        }
        return { transition: next, visibleResource: resource };
      });
    }).catch((error) => {
      if (!active || isCardImageAbortError(error)) return;
      setCardState((current) => {
        const next = rejectHomeCardTransition(current.transition, generation);
        return next === current.transition
          ? current
          : { ...current, transition: next };
      });
    });

    return () => {
      active = false;
    };
  }, [
    cardTransition.generation,
    cardTransition.pending?.kind,
    cardTransition.pending?.src,
    ownerKey
  ]);

  const visibleCardSource = (
    !isAuthenticated &&
    cardTransition.visible?.kind === HOME_CARD_SOURCE_KINDS.OWNER
  )
    ? null
    : cardTransition.visible;

  useEffect(() => {
    const resource = cardState.visibleResource;
    return () => resource?.release();
  }, [cardState.visibleResource]);
  const profileIsResolving = isAuthenticated && (
    profileState.status === "idle" ||
    profileState.status === "loading"
  );
  const cardLoading = (
    status === "loading" ||
    profileIsResolving ||
    cardTransition.status === HOME_CARD_TRANSITION_STATUSES.LOADING ||
    !visibleCardSource
  );
  const cardReady = (
    !cardLoading &&
    cardTransition.status !== HOME_CARD_TRANSITION_STATUSES.UNAVAILABLE
  );
  const ownerCardReady = (
    cardReady &&
    visibleCardSource?.kind === HOME_CARD_SOURCE_KINDS.OWNER
  );
  const showPersonalizedSample = (
    isAuthenticated &&
    profileState.status === "ready" &&
    visibleCardSource?.kind === HOME_CARD_SOURCE_KINDS.SAMPLE &&
    cardReady
  );
  const canShare = (
    profileState.status === "ready" &&
    hasUsage &&
    isPublic &&
    ownerCardReady
  );

  function handleVisibleCardError() {
    setCardState((current) => {
      if (!current.transition.visible || current.transition.pending) return current;
      const retry = beginHomeCardTransition(
        current.transition,
        current.transition.visible
      );
      const next = rejectHomeCardTransition(retry, retry.generation);
      return { transition: next, visibleResource: null };
    });
  }

  function openShare() {
    const sourceImage = snapshotShareSourceImage({
      displaySrc: visibleCardDisplaySrc,
      scopeKey: ownerKey,
      sourceKind: visibleCardSource?.kind,
      sourceUrl: visibleCardSource?.src
    });
    if (!sourceImage) return;
    shareSourceRectRef.current = snapshotRect(
      shareSourceCardRef.current?.getBoundingClientRect()
    );
    setShareSourceImage(sourceImage);
    setShareOpen(true);
  }

  function closeShare() {
    setShareOpen(false);
    setShareSourceImage(null);
    shareSourceRectRef.current = null;
  }

  async function updateVisibility(visibility) {
    if (mutationState.status === "submitting") return;
    setMutationState({ error: null, status: "submitting" });

    try {
      const nextProfile = await client.updateProfileVisibility(visibility);
      setProfileState({ error: null, profile: nextProfile, status: "ready" });
      setPreviewRevision((value) => value + 1);
      setShareOpen(false);
      setShareSourceImage(null);
      shareSourceRectRef.current = null;
      setMutationState({ error: null, status: "idle" });

      if (authState?.account?.owner && nextProfile.owner) {
        onAuthStateChange?.({
          ...authState,
          account: { ...authState.account, owner: nextProfile.owner }
        });
      }
    } catch {
      setMutationState({
        error: "home.updateFailed",
        status: "error"
      });
    }
  }

  return (
    <ProfileShell
      authState={authState}
      client={client}
      layout="fullscreen"
      onAuthStateChange={onAuthStateChange}
      pageHeading={false}
      showShare={false}
      title={t("app.brand")}
    >
      <MarketingLanding
        cardAlt={getHomeCardAlt(visibleCardSource, t)}
        cardBusy={cardLoading}
        cardLoadingLabel={t("home.loadingCardPreview")}
        cardOverlay={showPersonalizedSample ? (
          <HomeSampleIdentity owner={owner} />
        ) : null}
        cardPreviewUrl={visibleCardSource ? visibleCardDisplaySrc : null}
        cardRef={shareSourceCardRef}
        cardSourceKind={visibleCardSource?.kind ?? null}
        cardSourceUrl={visibleCardSource?.src ?? null}
        cardStatus={cardLoading
          ? HOME_CARD_TRANSITION_STATUSES.LOADING
          : cardTransition.status}
        cardTransitionSuspended={shareOpen}
        config={HOME_MARKETING_CONFIG}
        heroAction={isAuthenticated ? (
          <AuthenticatedHome
            cardReady={cardReady}
            hasUsage={hasUsage}
            isPublic={isPublic}
            mutationState={mutationState}
            onPublish={() => updateVisibility("public")}
            onShare={openShare}
            ownerCardReady={ownerCardReady}
            owner={owner}
            profileState={profileState}
          />
        ) : (
          <AnonymousHome
            loginHref={loginHref}
            status={status}
          />
        )}
        onCardError={handleVisibleCardError}
        quickstart={<HomeQuickstart
          authenticated={isAuthenticated}
          loginHref={loginHref}
          status={status}
        />}
      />

      <ShareStudio
        cardLocale={cardLocale}
        cardTheme={profile?.cardStyle?.theme}
        locale={locale}
        locationOrigin={location?.origin}
        makingPrivate={mutationState.status === "submitting"}
        onClose={closeShare}
        onMakePrivate={() => updateVisibility("private")}
        open={shareOpen && canShare}
        publicCardUrl={profile?.selectedPublicCardUrl ?? profile?.publicCardUrl}
        publicOwnerHandle={profile?.owner?.handle ?? owner?.handle}
        sourceCardImage={shareSourceImage}
        sourceCardRef={shareSourceCardRef}
        sourceRect={shareSourceRectRef.current}
      />
    </ProfileShell>
  );
}

function snapshotRect(rect) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;

  return {
    height: rect.height,
    left: rect.left,
    top: rect.top,
    width: rect.width
  };
}

function snapshotShareSourceImage({ displaySrc, scopeKey, sourceKind, sourceUrl }) {
  if (
    typeof displaySrc !== "string" || displaySrc === "" ||
    typeof scopeKey !== "string" || scopeKey === "" ||
    typeof sourceKind !== "string" || sourceKind === "" ||
    typeof sourceUrl !== "string" || sourceUrl === ""
  ) {
    return null;
  }

  return Object.freeze({ displaySrc, scopeKey, sourceKind, sourceUrl });
}

function HomeSampleIdentity({ owner }) {
  const { locale } = useLocale();
  const avatar = getAccountAvatar(owner, locale);
  const displayName = getAccountDisplayName(owner, locale);
  const login = getAccountLogin(owner);

  return (
    <div className="home-card-sample-identity" aria-hidden="true">
      {avatar.url ? (
        <img className="home-card-sample-avatar" src={avatar.url} alt="" />
      ) : (
        <span className="home-card-sample-avatar-fallback">{avatar.initial}</span>
      )}
      <div className="home-card-sample-copy">
        <strong>{displayName}</strong>
        {login ? <span>@{login}</span> : null}
      </div>
    </div>
  );
}

function AuthenticatedHome({
  cardReady,
  hasUsage,
  isPublic,
  mutationState,
  onPublish,
  onShare,
  ownerCardReady,
  owner,
  profileState
}) {
  const { locale, t } = useLocale();
  const avatar = getAccountAvatar(owner, locale);
  const displayName = getAccountDisplayName(owner, locale);
  const login = getAccountLogin(owner);

  return (
    <>
      <div className="home-account-identity">
        {avatar.url ? (
          <img alt={avatar.alt} height="40" src={avatar.url} width="40" />
        ) : (
          <span aria-hidden="true">{avatar.initial}</span>
        )}
        <div>
          <strong>{displayName}</strong>
          {login ? <small>@{login}</small> : null}
        </div>
      </div>
      <div className="home-account-actions">
        <HomeCardAction
          cardReady={cardReady}
          hasUsage={hasUsage}
          isPublic={isPublic}
          mutationStatus={mutationState.status}
          onPublish={onPublish}
          onShare={onShare}
          ownerCardReady={ownerCardReady}
          profileStatus={profileState.status}
        />
        {mutationState.error ? (
          <p className="home-status is-error" role="status">{t(mutationState.error)}</p>
        ) : null}
        {profileState.status === "error" ? (
          <p className="home-status is-error" role="status">
            {t("home.cardUnavailable")}
          </p>
        ) : null}
      </div>
    </>
  );
}

function HomeCardAction({
  cardReady,
  hasUsage,
  isPublic,
  mutationStatus,
  onPublish,
  onShare,
  ownerCardReady,
  profileStatus
}) {
  const { t } = useLocale();

  if (profileStatus === "loading" || profileStatus === "idle") {
    return (
      <button className="secondary-command" disabled type="button">
        {t("home.loadingCard")}
      </button>
    );
  }
  if (profileStatus === "error") return null;
  if (!hasUsage) {
    return (
      <button className="secondary-command" disabled type="button">
        {t("home.submitUsageFirst")}
      </button>
    );
  }
  if (!cardReady) {
    return (
      <button className="secondary-command" disabled type="button">
        {t("home.loadingCard")}
      </button>
    );
  }

  const isSubmitting = mutationStatus === "submitting";
  if (isPublic) {
    return (
      <button
        className={ownerCardReady ? "primary-command" : "secondary-command"}
        disabled={isSubmitting || !ownerCardReady}
        onClick={onShare}
        type="button"
      >
        {ownerCardReady ? t("common.share") : t("home.cardUnavailable")}
      </button>
    );
  }

  return (
    <button className="primary-command" disabled={isSubmitting} onClick={onPublish} type="button">
      {isSubmitting ? t("home.publishing") : t("home.publishCard")}
    </button>
  );
}

function getHomeCardAlt(source, t) {
  if (source?.kind === HOME_CARD_SOURCE_KINDS.OWNER) {
    return t("home.yourCardAlt");
  }
  if (source?.kind === HOME_CARD_SOURCE_KINDS.OPERATOR) {
    return t("home.operatorCardAlt", {
      handle: HOME_MARKETING_CONFIG.operatorCardHandle
    });
  }
  return t("home.sampleCardAlt");
}

function AnonymousHome({ loginHref, status }) {
  const { t } = useLocale();

  if (status === "loading") {
    return <p className="home-status" role="status">{t("home.checkingAccount")}</p>;
  }
  if (status === "unavailable") {
    return <p className="home-status is-error">{t("home.accountUnavailable")}</p>;
  }

  return (
    <a
      className="primary-command"
      href={loginHref}
    >
      {t("account.loginWithGitHub")}
    </a>
  );
}
