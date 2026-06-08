import { SettingsShell } from "./SettingsShell.jsx";

export function ProfilePage({ handle, status, viewModel }) {
  return (
    <SettingsShell>
      <section className="profile-view" aria-label="Codex profile">
        {status === "ready" && viewModel ? (
          <ReadyProfile viewModel={viewModel} />
        ) : (
          <ProfileState handle={handle} status={status} />
        )}
      </section>
    </SettingsShell>
  );
}

function ReadyProfile({ viewModel }) {
  const { header } = viewModel;
  const displayName = header.displayName ?? "Codex user";
  const username = header.username ? `@${header.username}` : "@profile";

  return (
    <div className="profile-stage profile-stage-ready">
      <div className="avatar-shell" aria-hidden="true">
        {header.avatarAsset?.url ? (
          <img alt="" src={header.avatarAsset.url} />
        ) : (
          <span>{getInitial(displayName)}</span>
        )}
      </div>
      <div className="profile-heading">
        <h2>{displayName}</h2>
        <p>
          <span>{username}</span>
          {header.planLabel ? <span className="plan-pill">{header.planLabel}</span> : null}
        </p>
      </div>
      <div className="profile-placeholder-grid" aria-label="Profile sections loading">
        <div className="profile-placeholder-card">Stats bar</div>
        <div className="profile-placeholder-card profile-placeholder-card-wide">Token activity</div>
        <div className="profile-placeholder-card">Activity insights</div>
        <div className="profile-placeholder-card">Most used plugins</div>
      </div>
    </div>
  );
}

function ProfileState({ handle, status }) {
  const copy = {
    empty: {
      title: "No profile activity yet",
      message: "This snapshot does not contain profile activity data."
    },
    loading: {
      title: "Loading profile",
      message: "Preparing the latest snapshot preview."
    },
    unavailable: {
      title: "Profile unavailable",
      message: `No local preview snapshot is available for ${handle}.`
    }
  }[status] ?? {
    title: "Profile unavailable",
    message: "No local preview snapshot is available."
  };

  return (
    <div className={`profile-stage profile-stage-${status}`}>
      <div className="profile-state-indicator" aria-hidden="true" />
      <h2>{copy.title}</h2>
      <p>{copy.message}</p>
    </div>
  );
}

function getInitial(displayName) {
  return displayName.trim().slice(0, 1).toUpperCase() || "C";
}
