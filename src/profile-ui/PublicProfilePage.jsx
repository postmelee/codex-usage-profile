import { ProfileShell } from "./ProfileShell.jsx";

export function PublicProfilePage({
  authState,
  client,
  onAuthStateChange,
  profile,
  status
}) {
  return (
    <ProfileShell
      authState={authState}
      client={client}
      onAuthStateChange={onAuthStateChange}
      showShare={false}
      title="Profile"
    >
      <section className="public-profile-view" aria-label="Public Codex profile">
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
  const owner = profile.owner;
  const displayName = owner.displayName || owner.githubLogin || owner.handle;
  const githubLogin = owner.githubLogin || owner.handle;

  return (
    <div className="public-profile-stage">
      <header className="public-profile-heading">
        <div>
          <h2 id="public-profile-title">Codex card for {displayName}</h2>
          <p>@{githubLogin}</p>
        </div>
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
      <h2>{copy.title}</h2>
      <p>{copy.message}</p>
    </div>
  );
}
