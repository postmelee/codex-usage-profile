import { ActivityInsights, MostUsedPlugins } from "./ActivityInsights.jsx";
import { ProfileHeader } from "./ProfileHeader.jsx";
import { ProfileShell } from "./ProfileShell.jsx";
import { ProfileStats } from "./ProfileStats.jsx";
import { TokenActivityChart } from "./TokenActivityChart.jsx";

export function ProfilePage({ authState, handle, status, viewModel }) {
  return (
    <ProfileShell authState={authState}>
      <section className="profile-view" aria-label="Codex profile">
        {status === "ready" && viewModel ? (
          <ReadyProfile viewModel={viewModel} />
        ) : (
          <ProfileState handle={handle} status={status} />
        )}
      </section>
    </ProfileShell>
  );
}

function ReadyProfile({ viewModel }) {
  return (
    <div className="profile-stage profile-stage-ready">
      <ProfileHeader header={viewModel.header} />
      <ProfileStats stats={viewModel.stats} />
      <TokenActivityChart tokenActivity={viewModel.tokenActivity} />
      <div className="activity-grid">
        <ActivityInsights insights={viewModel.activityInsights} />
        <MostUsedPlugins invocations={viewModel.mostUsedInvocations} />
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
