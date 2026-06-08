import { ActivityInsights, MostUsedPlugins } from "./ActivityInsights.jsx";
import { ProfileHeader } from "./ProfileHeader.jsx";
import { ProfileShell } from "./ProfileShell.jsx";
import { ProfileStats } from "./ProfileStats.jsx";

export function ProfilePage({ handle, status, viewModel }) {
  return (
    <ProfileShell>
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
      <TokenActivityPreview tokenActivity={viewModel.tokenActivity} />
      <div className="activity-grid">
        <ActivityInsights insights={viewModel.activityInsights} />
        <MostUsedPlugins invocations={viewModel.mostUsedInvocations} />
      </div>
    </div>
  );
}

function TokenActivityPreview({ tokenActivity }) {
  const cells = buildPreviewCells(tokenActivity);
  const monthLabels = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];

  return (
    <section className="token-activity" aria-label="Token activity preview">
      <div className="token-activity-header">
        <h3>Token activity</h3>
        <div className="token-tabs" aria-label="Token activity mode">
          <button className="is-selected" type="button">Daily</button>
          <button type="button">Weekly</button>
          <button type="button">Cumulative</button>
        </div>
      </div>
      <div className="token-grid-wrap">
        <div className="token-grid" aria-hidden="true">
          {cells.map((cell) => (
            <span
              className={`token-cell token-level-${cell.level}`}
              key={cell.key}
            />
          ))}
        </div>
        <div className="month-labels" aria-hidden="true">
          {monthLabels.map((label) => <span key={label}>{label}</span>)}
        </div>
      </div>
    </section>
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

function buildPreviewCells(tokenActivity) {
  const usageByDate = new Map(
    tokenActivity.dailyUsage.map((bucket) => [bucket.date, bucket.credits])
  );
  const endDate = new Date(tokenActivity.capturedAt);
  const startDate = new Date(Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate() - 363
  ));
  const maxCredits = Math.max(...tokenActivity.dailyUsage.map((bucket) => bucket.credits), 1);

  return Array.from({ length: 52 * 7 }, (_, index) => {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    const credits = usageByDate.get(key) ?? 0;
    return {
      key,
      level: getPreviewLevel(credits, maxCredits)
    };
  });
}

function getPreviewLevel(credits, maxCredits) {
  if (credits <= 0) {
    return 0;
  }

  const ratio = credits / maxCredits;
  if (ratio >= 0.75) {
    return 4;
  }

  if (ratio >= 0.45) {
    return 3;
  }

  if (ratio >= 0.2) {
    return 2;
  }

  return 1;
}
