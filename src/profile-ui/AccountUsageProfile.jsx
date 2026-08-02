import { ProfileHeader } from "./ProfileHeader.jsx";
import { ProfileStats } from "./ProfileStats.jsx";
import { TokenActivityChart } from "./TokenActivityChart.jsx";
import { useLocale } from "./LocaleProvider.jsx";

export function AccountUsageProfile({ headingId, owner, usage }) {
  const { locale, t } = useLocale();
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
          label: t("profile.stat.lifetimeTokens"),
          value: summary.lifetimeTokens
        },
        {
          key: "peakTokens",
          label: t("profile.stat.peakDay"),
          value: summary.peakDailyTokens
        },
        {
          key: "longestRunningTurnSec",
          label: t("profile.stat.longestTurn"),
          value: summary.longestRunningTurnSec
        },
        {
          key: "currentStreakDays",
          label: t("profile.stat.currentStreak"),
          value: summary.currentStreakDays
        },
        {
          key: "longestStreakDays",
          label: t("profile.stat.longestStreak"),
          value: summary.longestStreakDays
        }
      ]} locale={locale} />
      <TokenActivityChart
        capturedAt={usage.capturedAt}
        dailyUsageBuckets={usage.usage.dailyUsageBuckets}
      />
    </div>
  );
}
