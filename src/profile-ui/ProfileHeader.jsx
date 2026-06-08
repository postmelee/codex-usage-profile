import { useState } from "react";

export function ProfileHeader({ header }) {
  const displayName = header.displayName ?? "Codex user";
  const username = header.username ? `@${header.username}` : "@profile";

  return (
    <header className="profile-header">
      <ProfileAvatar asset={header.avatarAsset} displayName={displayName} />
      <div className="profile-heading">
        <h2>{displayName}</h2>
        <p>
          <span>{username}</span>
          {header.planLabel ? <span className="plan-pill">{header.planLabel}</span> : null}
        </p>
      </div>
    </header>
  );
}

function ProfileAvatar({ asset, displayName }) {
  const [hasImageError, setHasImageError] = useState(false);
  const shouldUseImage = Boolean(asset?.url) && !hasImageError;

  return (
    <div className="avatar-shell" aria-hidden="true">
      {shouldUseImage ? (
        <img alt="" onError={() => setHasImageError(true)} src={asset.url} />
      ) : (
        <div className="avatar-fallback">
          <span className="avatar-face avatar-face-top" />
          <span className="avatar-face avatar-face-mouth" />
          <span className="avatar-face avatar-face-teeth" />
          <span className="avatar-initial">{getInitial(displayName)}</span>
        </div>
      )}
    </div>
  );
}

function getInitial(displayName) {
  return displayName.trim().slice(0, 1).toUpperCase() || "C";
}
