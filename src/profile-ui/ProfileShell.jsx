import { AccountMenu } from "./AccountMenu.jsx";

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
  title = "Profile"
}) {
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
            <a className="profile-topbar-title" href="/">Codex Usage</a>
          </div>
          <div className="profile-actions" aria-label="Page actions">
            {showShare ? (
              <button
                aria-label="Share profile"
                disabled={shareDisabled}
                onClick={onShare}
                type="button"
              >
                Share
              </button>
            ) : null}
            <AccountMenu
              authState={authState}
              client={client}
              onAuthStateChange={onAuthStateChange}
            />
          </div>
        </header>
        <p className="sr-only" aria-live="polite">
          {getSessionStatusLabel(authStatus)}
        </p>
        {pageHeading ? <h1 className="sr-only">{title}</h1> : null}
        {children}
      </main>
    </div>
  );
}

function getSessionStatusLabel(status) {
  return {
    anonymous: "No signed-in account",
    authenticated: "Signed-in account loaded",
    loading: "Checking signed-in account",
    unavailable: "Signed-in account unavailable"
  }[status] ?? "Signed-in account status unknown";
}
