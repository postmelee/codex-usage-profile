import { useState } from "react";

import { MarketingCardPreview } from "../profile-marketing/MarketingLanding.jsx";
import { AccountUsageProfile } from "./AccountUsageProfile.jsx";
import { useLocale } from "./LocaleProvider.jsx";
import { ProfileShell } from "./ProfileShell.jsx";
import { getAccountOwner } from "./accountUi.js";
import { buildLocalizedCardUrl } from "./cardShare.js";

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
          <ReadyPublicProfile profile={profile} />
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

function ReadyPublicProfile({ profile }) {
  const { locale, t } = useLocale();
  const owner = profile.owner;
  const displayName = owner.displayName || owner.githubLogin || owner.handle;
  const cardUrl = buildLocalizedCardUrl(
    profile.selectedPublicCardUrl ?? profile.publicCardUrl,
    profile.cardLocale ?? locale,
    profile.cardStyle?.theme
  ) ?? buildLocalizedCardUrl(
    profile.publicCardUrl,
    profile.cardLocale ?? locale,
    profile.cardStyle?.theme
  );

  return (
    <div className="public-profile-stage">
      <AccountUsageProfile
        headingId="public-profile-title"
        owner={owner}
        usage={profile.usage}
      />

      <section className="profile-card-section" aria-labelledby="public-card-title">
        <header className="card-profile-heading">
          <h2 id="public-card-title">{t("profile.card.sharedTitle")}</h2>
          <span className="visibility-status is-public">
            {t("profile.visibility.public")}
          </span>
        </header>

        <div className="profile-card-preview-stage">
          <MarketingCardPreview
            alt={t("profile.card.alt.public", { name: displayName })}
            sourceKind="owner"
            src={cardUrl}
          />
        </div>
      </section>
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
  const isOwner = isOwnHandle(authState, handle);

  if (status !== "loading" && isOwner) {
    return (
      <PrivateOwnerNotice
        authState={authState}
        client={client}
        onAuthStateChange={onAuthStateChange}
      />
    );
  }

  const copy = status === "loading"
    ? {
        title: t("profile.public.loading"),
        message: t("profile.public.fetching")
      }
    : {
        title: t("profile.error.unavailable"),
        message: t("profile.public.notAvailable")
      };

  return (
    <div className={`public-profile-state is-${status}`}>
      <div className="profile-state-indicator" aria-hidden="true" />
      <h1>{copy.title}</h1>
      <p>{copy.message}</p>
    </div>
  );
}

function PrivateOwnerNotice({ authState, client, onAuthStateChange }) {
  const { t } = useLocale();
  const [state, setState] = useState({ error: null, status: "idle" });

  async function publish() {
    if (state.status === "submitting") return;
    setState({ error: null, status: "submitting" });

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
      setState({ error: "profile.public.publishFailed", status: "error" });
    }
  }

  return (
    <div className="public-profile-state is-private-owner">
      <h1>{t("profile.public.ownerPrivateTitle")}</h1>
      <p>{t("profile.public.ownerPrivateDescription")}</p>
      <button
        className="primary-command"
        disabled={state.status === "submitting"}
        onClick={publish}
        type="button"
      >
        {state.status === "submitting"
          ? t("profile.card.publishing")
          : t("profile.card.publish")}
      </button>
      {state.error ? (
        <p className="home-status is-error" role="status">{t(state.error)}</p>
      ) : null}
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
