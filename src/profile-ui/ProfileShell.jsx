import { AccountMenu } from "./AccountMenu.jsx";
import { BrandLogo } from "./BrandLogo.jsx";
import { ThemeToggle } from "./ThemeToggle.jsx";
import { useLocale } from "./LocaleProvider.jsx";

export const PROJECT_GITHUB_URL =
  "https://github.com/postmelee/codex-usage-profile";

export function ProfileShell({
  authState,
  children,
  client,
  layout = "frame",
  onAuthStateChange,
  onShare,
  pageHeading = true,
  shareDisabled = false,
  showShare = true,
  title
}) {
  const { t } = useLocale();
  const authStatus = authState?.status ?? "unknown";
  const isFullscreen = layout === "fullscreen";

  return (
    <div className={`app-frame${isFullscreen ? " app-frame--fullscreen" : ""}`}>
      <main
        className={`profile-shell${isFullscreen ? " profile-shell--fullscreen" : ""}`}
        data-auth-status={authStatus}
      >
        <header className="profile-topbar">
          <div className="profile-topbar-leading">
            <a className="profile-topbar-title" href="/">{t("app.brand")}</a>
            <a
              aria-label={t("common.nav.githubLabel")}
              className="profile-topbar-github"
              href={PROJECT_GITHUB_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              <BrandLogo name="github" size={16} />
              <span>{t("common.nav.github")}</span>
            </a>
          </div>
          <div className="profile-actions" aria-label={t("common.nav.pageActions")}>
            {showShare ? (
              <button
                aria-label={t("common.shareProfile")}
                disabled={shareDisabled}
                onClick={onShare}
                type="button"
              >
                {t("common.share")}
              </button>
            ) : null}
            <ThemeToggle />
            <AccountMenu
              authState={authState}
              client={client}
              onAuthStateChange={onAuthStateChange}
            />
          </div>
        </header>
        <p className="sr-only" aria-live="polite">
          {getSessionStatusLabel(authStatus, t)}
        </p>
        {pageHeading ? (
          <h1 className="sr-only">{title ?? t("common.nav.profile")}</h1>
        ) : null}
        {children}
      </main>
    </div>
  );
}

function getSessionStatusLabel(status, t) {
  return {
    anonymous: t("session.anonymous"),
    authenticated: t("session.authenticated"),
    loading: t("session.loading"),
    unavailable: t("session.unavailable")
  }[status] ?? t("session.unknown");
}
