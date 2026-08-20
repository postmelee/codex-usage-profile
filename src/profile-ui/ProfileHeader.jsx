import { useState } from "react";
import { LastUpdatedTime } from "./LastUpdatedTime.jsx";
import { useLocale } from "./LocaleProvider.jsx";

export function ProfileHeader({
  header,
  headingId,
  headingLevel = 2,
  uploadedAt
}) {
  const { t } = useLocale();
  const displayName = header.displayName ?? t("profile.header.defaultUser");
  const username = header.username
    ? `@${header.username}`
    : `@${t("profile.header.defaultHandle")}`;
  const Heading = headingLevel === 1 ? "h1" : "h2";

  return (
    <header className="profile-header">
      <ProfileAvatar asset={header.avatarAsset} />
      <div className="profile-heading">
        <Heading id={headingId}>{displayName}</Heading>
        <p>
          <span>{username}</span>
          {header.planLabel ? <span className="plan-pill">{header.planLabel}</span> : null}
        </p>
        <div className="profile-last-updated-slot">
          <LastUpdatedTime
            className="profile-last-updated"
            uploadedAt={uploadedAt}
          />
        </div>
      </div>
    </header>
  );
}

function ProfileAvatar({ asset }) {
  const [hasImageError, setHasImageError] = useState(false);
  const shouldUseImage = Boolean(asset?.url) && !hasImageError;

  return (
    <div aria-hidden="true" className="avatar-shell">
      {shouldUseImage ? (
        <img
          alt=""
          onError={() => setHasImageError(true)}
          src={asset.url}
        />
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
