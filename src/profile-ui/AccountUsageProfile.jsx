import { ProfileHeader } from "./ProfileHeader.jsx";
import { ProfileStats } from "./ProfileStats.jsx";
import { TokenActivityChart } from "./TokenActivityChart.jsx";

export function AccountUsageProfile({ headingId, locale, owner, usage }) {
  const summary = usage.usage.summary;

  return (
    <div className="account-usage-profile">
      <ProfileHeader
        header={{
          avatarAsset: owner.avatarUrl ? { url: owner.avatarUrl } : null,
          displayName: owner.displayName || owner.githubLogin || owner.handle,
          username: owner.githubLogin || owner.handle
        }}
        headingId={headingId}
        headingLevel={1}
      />
      <ProfileStats stats={[
        {
          key: "totalTextTokens",
          label: "Lifetime tokens",
          value: summary.lifetimeTokens
        },
        {
          key: "peakTokens",
          label: "Peak day",
          value: summary.peakDailyTokens
        },
        {
          key: "longestRunningTurnSec",
          label: "Longest turn",
          value: summary.longestRunningTurnSec
        },
        {
          key: "currentStreakDays",
          label: "Current streak",
          value: summary.currentStreakDays
        },
        {
          key: "longestStreakDays",
          label: "Longest streak",
          value: summary.longestStreakDays
        }
      ]} />
      <TokenActivityChart
        capturedAt={usage.capturedAt}
        dailyUsageBuckets={usage.usage.dailyUsageBuckets}
        locale={locale}
      />
    </div>
  );
}
