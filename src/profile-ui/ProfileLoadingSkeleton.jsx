import { MarketingCardPreview } from "../profile-marketing/MarketingLanding.jsx";

const PROFILE_LOADING_STAT_COUNT = 5;
const PROFILE_LOADING_ACTIVITY_ROW_COUNT = 7;
const PROFILE_LOADING_MONTH_COUNT = 12;
const PROFILE_LOADING_TAB_COUNT = 3;

export function ProfileLoadingSkeleton({
  description = null,
  loadingLabel,
  surface,
  title
}) {
  const testId = `${surface}-profile-loading-skeleton`;

  return (
    <div
      aria-busy="true"
      className="profile-loading-skeleton public-profile-loading-skeleton"
      data-profile-loading-surface={surface}
      data-testid={testId}
    >
      <div
        aria-hidden="true"
        className="profile-loading-identity public-profile-loading-identity"
      >
        <span
          className="profile-loading-avatar public-profile-loading-avatar profile-loading-shimmer"
          data-skeleton-part="avatar"
        />
        <span
          className="profile-loading-name public-profile-loading-name profile-loading-shimmer"
          data-skeleton-part="name"
          style={{ "--profile-skeleton-delay": "-120ms" }}
        />
        <span
          className="profile-loading-handle public-profile-loading-handle profile-loading-shimmer"
          data-skeleton-part="handle"
          style={{ "--profile-skeleton-delay": "-240ms" }}
        />
        <span
          className="profile-loading-updated public-profile-loading-updated profile-loading-shimmer"
          data-skeleton-part="updated"
          style={{ "--profile-skeleton-delay": "-320ms" }}
        />
      </div>

      <div
        aria-hidden="true"
        className="profile-loading-stats public-profile-loading-stats"
      >
        {Array.from({ length: PROFILE_LOADING_STAT_COUNT }, (_, index) => (
          <span
            className="profile-loading-stat"
            data-skeleton-part="stat"
            key={index}
          >
            <span
              className="profile-loading-stat-value profile-loading-shimmer"
              data-skeleton-part="stat-value"
              style={{ "--profile-skeleton-delay": `${-80 * index}ms` }}
            />
            <span
              className="profile-loading-stat-label profile-loading-shimmer"
              data-skeleton-part="stat-label"
              style={{ "--profile-skeleton-delay": `${-80 * index - 120}ms` }}
            />
          </span>
        ))}
      </div>

      <div
        aria-hidden="true"
        className="profile-loading-activity public-profile-loading-activity"
      >
        <div className="profile-loading-activity-header">
          <span
            className="profile-loading-activity-title profile-loading-shimmer"
            data-skeleton-part="activity-title"
          />
          <span className="profile-loading-activity-tabs">
            {Array.from({ length: PROFILE_LOADING_TAB_COUNT }, (_, index) => (
              <span
                className="profile-loading-shimmer"
                data-skeleton-part="activity-tab"
                key={index}
                style={{ "--profile-skeleton-delay": `${-100 * (index + 1)}ms` }}
              />
            ))}
          </span>
        </div>
        <span className="profile-loading-activity-grid-wrap">
          <span className="profile-loading-activity-grid">
            {Array.from({ length: PROFILE_LOADING_ACTIVITY_ROW_COUNT }, (_, index) => (
              <span
                className="profile-loading-activity-row profile-loading-shimmer"
                data-skeleton-part="activity-row"
                key={index}
                style={{ "--profile-skeleton-delay": `${-90 * index}ms` }}
              />
            ))}
          </span>
          <span className="profile-loading-activity-months">
            {Array.from({ length: PROFILE_LOADING_MONTH_COUNT }, (_, index) => (
              <span
                className="profile-loading-shimmer"
                data-skeleton-part="activity-month"
                key={index}
                style={{ "--profile-skeleton-delay": `${-70 * index}ms` }}
              />
            ))}
          </span>
        </span>
        <span
          className="profile-loading-activity-option profile-loading-shimmer"
          data-skeleton-part="activity-option"
          style={{ "--profile-skeleton-delay": "-360ms" }}
        />
      </div>

      <div className="profile-loading-card public-profile-loading-card">
        <div aria-hidden="true" className="profile-loading-card-header">
          <span
            className="profile-loading-card-title profile-loading-shimmer"
            data-skeleton-part="card-title"
            style={{ "--profile-skeleton-delay": "-160ms" }}
          />
          <span
            className="profile-loading-card-status profile-loading-shimmer"
            data-skeleton-part="card-status"
            style={{ "--profile-skeleton-delay": "-280ms" }}
          />
        </div>
        <MarketingCardPreview
          alt=""
          busy
          cardTheme="dark"
          loadingLabel={loadingLabel ?? description ?? title}
          sourceKind={surface}
          src={null}
          status="loading"
        />
      </div>

      <h1 className="sr-only">{title}</h1>
      {description ? <p className="sr-only">{description}</p> : null}
    </div>
  );
}
