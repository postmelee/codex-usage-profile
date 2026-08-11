import { useEffect, useRef, useState } from "react";

import { MarketingCardPreview } from "../profile-marketing/MarketingLanding.jsx";
import { AccountUsageProfile } from "./AccountUsageProfile.jsx";
import { PublicCardIntro } from "./PublicCardIntro.jsx";
import { useLocale } from "./LocaleProvider.jsx";
import { ProfileShell } from "./ProfileShell.jsx";
import { ProfileLoadingSkeleton } from "./ProfileLoadingSkeleton.jsx";
import { getAccountOwner } from "./accountUi.js";
import { OWNER_PROFILE_HREF } from "./appRoutes.js";
import { buildLocalizedCardUrl, buildProfileLoginHref } from "./cardShare.js";
import { useCardImageReadiness } from "./cardImageReadiness.js";

export function PublicProfilePage({
  authState,
  client,
  handle,
  onAuthStateChange,
  profile,
  status
}) {
  const { t } = useLocale();

  return (
    <ProfileShell
      authState={authState}
      client={client}
      layout="fullscreen"
      onAuthStateChange={onAuthStateChange}
      pageHeading={false}
      showShare={false}
      title={t("common.nav.profile")}
    >
      <section className="public-profile-view" aria-label={t("profile.public.ariaLabel")}>
        {status === "ready" && profile ? (
          <PublicProfileStage
            authState={authState}
            client={client}
            intro
            profile={profile}
          />
        ) : (
          <PublicProfileState
            authState={authState}
            client={client}
            handle={handle}
            onAuthStateChange={onAuthStateChange}
            status={status}
          />
        )}
      </section>
    </ProfileShell>
  );
}

function PublicProfileStage({
  authState = null,
  banner = null,
  cardUrl,
  client = null,
  intro = false,
  preview = false,
  profile
}) {
  const { locale, t } = useLocale();
  const cardRef = useRef(null);
  const [introOpen, setIntroOpen] = useState(intro);
  const owner = profile.owner;
  const displayName = owner.displayName || owner.githubLogin || owner.handle;
  const resolvedCardUrl = cardUrl ?? (
    buildLocalizedCardUrl(
      profile.selectedPublicCardUrl ?? profile.publicCardUrl,
      profile.cardLocale ?? locale,
      profile.cardStyle?.theme
    ) ?? buildLocalizedCardUrl(
      profile.publicCardUrl,
      profile.cardLocale ?? locale,
      profile.cardStyle?.theme
    )
  );
  const cardImage = useCardImageReadiness({
    scopeKey: owner.id ?? owner.handle,
    sourceKind: "public",
    src: resolvedCardUrl
  });

  return (
    <div className="public-profile-stage">
      {banner}

      <AccountUsageProfile
        headingId="public-profile-title"
        owner={owner}
        usage={profile.usage}
      />

      <section className="profile-card-section" aria-labelledby="public-card-title">
        <header className="card-profile-heading">
          <h2 id="public-card-title">{t("profile.card.sharedTitle")}</h2>
          <span className={`visibility-status is-${preview ? "preview" : "public"}`}>
            {t(preview ? "profile.visibility.preview" : "profile.visibility.public")}
          </span>
        </header>

        <div className="profile-card-preview-stage">
          <MarketingCardPreview
            alt={t("profile.card.alt.public", { name: displayName })}
            busy={cardImage.busy}
            cardRef={cardRef}
            errorLabel={t("home.cardUnavailable")}
            sourceKind="public"
            sourceUrl={cardImage.visibleSrc}
            src={cardImage.displaySrc}
            status={cardImage.status}
            transitionSuspended={introOpen}
          />
        </div>
      </section>

      {intro ? (
        <PublicCardIntro
          cardAlt={t("profile.card.alt.public", { name: displayName })}
          cardImage={cardImage}
          cardUrl={resolvedCardUrl}
          createCardHref={authState?.status === "authenticated"
            ? OWNER_PROFILE_HREF
            : buildProfileLoginHref(client)}
          onClose={() => setIntroOpen(false)}
          open={introOpen}
          ownerName={displayName}
          targetCardRef={cardRef}
        />
      ) : null}
    </div>
  );
}

function PublicProfileState({
  authState,
  client,
  handle,
  onAuthStateChange,
  status
}) {
  const { t } = useLocale();

  if (status !== "loading" && isOwnHandle(authState, handle)) {
    return (
      <PrivateOwnerPreview
        authState={authState}
        client={client}
        onAuthStateChange={onAuthStateChange}
      />
    );
  }

  if (status === "loading") {
    return (
      <ProfileLoadingSkeleton
        description={t("profile.public.fetching")}
        loadingLabel={t("profile.public.fetching")}
        surface="public"
        title={t("profile.public.loading")}
      />
    );
  }

  return (
    <div className="public-profile-state is-unavailable">
      <h1>{t("profile.public.unavailableTitle")}</h1>
      <p>{t("profile.public.unavailableDescription")}</p>
      <div className="public-profile-state-actions">
        <a
          className="primary-command"
          href={authState?.status === "authenticated"
            ? OWNER_PROFILE_HREF
            : buildProfileLoginHref(client)}
        >
          {t("profile.public.createYourCard")}
        </a>
        <a className="secondary-command" href="/">
          {t("common.nav.home")}
        </a>
      </div>
    </div>
  );
}

function PrivateOwnerPreview({ authState, client, onAuthStateChange }) {
  const { t } = useLocale();
  const [profileState, setProfileState] = useState({
    profile: null,
    status: "loading"
  });
  const [publishState, setPublishState] = useState({
    error: null,
    status: "idle"
  });

  useEffect(() => {
    let isCurrent = true;

    client.getOwnerProfile().then((profile) => {
      if (isCurrent) setProfileState({ profile, status: "ready" });
    }).catch(() => {
      if (isCurrent) setProfileState({ profile: null, status: "error" });
    });

    return () => { isCurrent = false; };
  }, [client]);

  async function publish() {
    if (publishState.status === "submitting") return;
    setPublishState({ error: null, status: "submitting" });

    try {
      const profile = await client.updateProfileVisibility("public");
      if (authState?.account?.owner && profile.owner) {
        onAuthStateChange?.({
          ...authState,
          account: { ...authState.account, owner: profile.owner }
        });
      }
      globalThis.location?.reload?.();
    } catch {
      setPublishState({
        error: "profile.public.publishFailed",
        status: "error"
      });
    }
  }

  const banner = (
    <PrivateOwnerBanner
      error={publishState.error}
      onPublish={publish}
      submitting={publishState.status === "submitting"}
    />
  );
  const profile = profileState.profile;

  if (profileState.status === "loading") {
    return <PublicProfileLoadingSkeleton />;
  }

  if (!profile?.usage) {
    return (
      <div className="public-profile-state is-private-owner">
        <h1>{t("profile.public.ownerPrivateTitle")}</h1>
        <p>{t("profile.public.ownerNoUsage")}</p>
      </div>
    );
  }

  return (
    <PublicProfileStage
      banner={banner}
      cardUrl={client.buildOwnerCardPreviewUrl?.({
        locale: profile.cardLocale ?? "en",
        theme: profile.cardStyle?.theme ?? "dark"
      }) ?? null}
      preview
      profile={profile}
    />
  );
}

function PrivateOwnerBanner({ error, onPublish, submitting }) {
  const { t } = useLocale();

  return (
    <div className="public-profile-owner-banner" role="status">
      <div className="public-profile-owner-banner-copy">
        <strong>{t("profile.public.ownerPrivateTitle")}</strong>
        <span>{t("profile.public.ownerPreviewDescription")}</span>
        {error ? (
          <span className="public-profile-owner-banner-error">{t(error)}</span>
        ) : null}
      </div>
      <button
        className="primary-command"
        disabled={submitting}
        onClick={onPublish}
        type="button"
      >
        {submitting ? t("profile.card.publishing") : t("profile.card.publish")}
      </button>
    </div>
  );
}

function isOwnHandle(authState, handle) {
  if (authState?.status !== "authenticated") return false;

  const ownerHandle = getAccountOwner(authState)?.handle;
  return Boolean(
    ownerHandle &&
    typeof handle === "string" &&
    ownerHandle === handle
  );
}
