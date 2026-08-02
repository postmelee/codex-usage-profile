import { useMemo } from "react";

import { AccountUsageProfile } from "./AccountUsageProfile.jsx";
import { ProfileShell } from "./ProfileShell.jsx";
import { resolveShareLocale } from "./cardShare.js";

export function PublicProfilePage({
  authState,
  client,
  onAuthStateChange,
  profile,
  status
}) {
  const locale = useMemo(
    () => resolveShareLocale(globalThis.navigator?.language),
    []
  );

  return (
    <ProfileShell
      authState={authState}
      client={client}
      layout="fullscreen"
      onAuthStateChange={onAuthStateChange}
      pageHeading={false}
      showShare={false}
      title="Profile"
    >
      <section className="public-profile-view" aria-label="Public Codex profile">
        {status === "ready" && profile ? (
          <ReadyPublicProfile locale={locale} profile={profile} />
        ) : (
          <PublicProfileState status={status} />
        )}
      </section>
    </ProfileShell>
  );
}

function ReadyPublicProfile({ locale, profile }) {
  const owner = profile.owner;
  const displayName = owner.displayName || owner.githubLogin || owner.handle;

  return (
    <div className="public-profile-stage">
      <AccountUsageProfile
        headingId="public-profile-title"
        locale={locale}
        owner={owner}
        usage={profile.usage}
      />

      <section className="profile-card-section" aria-labelledby="public-card-title">
        <header className="card-profile-heading">
          <h2 id="public-card-title">Shared Codex card</h2>
          <span className="visibility-status is-public">Public</span>
        </header>

        <img
          alt={`Codex usage card for ${displayName}`}
          aria-describedby="public-profile-title"
          className="public-profile-card"
          height="612"
          src={profile.publicCardUrl}
          width="998"
        />
      </section>
    </div>
  );
}

function PublicProfileState({ status }) {
  const copy = status === "loading"
    ? {
        title: "Loading public profile",
        message: "Fetching the latest published card."
      }
    : {
        title: "Profile unavailable",
        message: "This public profile is not available."
      };

  return (
    <div className={`public-profile-state is-${status}`}>
      <div className="profile-state-indicator" aria-hidden="true" />
      <h1>{copy.title}</h1>
      <p>{copy.message}</p>
    </div>
  );
}
