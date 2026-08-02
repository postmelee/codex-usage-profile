import { AccountUsageProfile } from "./AccountUsageProfile.jsx";
import { useLocale } from "./LocaleProvider.jsx";
import { ProfileShell } from "./ProfileShell.jsx";
import { buildLocalizedCardUrl } from "./cardShare.js";

export function PublicProfilePage({
  authState,
  client,
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
          <PublicProfileState status={status} />
        )}
      </section>
    </ProfileShell>
  );
}

function ReadyPublicProfile({ profile }) {
  const { locale, t } = useLocale();
  const owner = profile.owner;
  const displayName = owner.displayName || owner.githubLogin || owner.handle;

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

        <img
          alt={t("profile.card.alt.public", { name: displayName })}
          aria-describedby="public-profile-title"
          className="public-profile-card"
          height="612"
          src={buildLocalizedCardUrl(profile.publicCardUrl, locale)}
          width="998"
        />
      </section>
    </div>
  );
}

function PublicProfileState({ status }) {
  const { t } = useLocale();
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
