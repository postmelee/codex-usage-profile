import { useMemo } from "react";

import { buildCardHeatmap } from "../profile-card/heatmap.js";
import { CardHeatmapOverlay } from "./CardHeatmapOverlay.jsx";
import { ProfileShell } from "./ProfileShell.jsx";
import { hasCardHeatmapData } from "./cardHeatmapTooltip.js";
import { resolveShareLocale } from "./cardShare.js";

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
      layout="fullscreen"
      onAuthStateChange={onAuthStateChange}
      pageHeading={false}
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
  const locale = useMemo(
    () => resolveShareLocale(globalThis.navigator?.language),
    []
  );
  const dailyUsageBuckets = profile.usage?.usage?.dailyUsageBuckets;
  const heatmap = useMemo(() => (
    hasCardHeatmapData(dailyUsageBuckets)
      ? buildCardHeatmap(dailyUsageBuckets)
      : null
  ), [dailyUsageBuckets]);

  return (
    <div className="public-profile-stage">
      <header className="public-profile-heading">
        <div>
          <h1 id="public-profile-title">Codex card for {displayName}</h1>
          <p>@{githubLogin}</p>
        </div>
        <span className="visibility-status is-public">Public</span>
      </header>

      <div className="public-profile-card-media">
        <img
          alt={`Codex usage card for ${displayName}`}
          aria-describedby="public-profile-title"
          className="public-profile-card"
          height="612"
          src={profile.publicCardUrl}
          width="998"
        />
        {heatmap ? (
          <CardHeatmapOverlay heatmap={heatmap} locale={locale} />
        ) : null}
      </div>
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
