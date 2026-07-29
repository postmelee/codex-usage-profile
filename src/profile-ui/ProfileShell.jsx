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
  const currentPath = globalThis.window?.location?.pathname ?? "/";
  const isFullscreen = layout === "fullscreen";
  const TitleElement = pageHeading ? "h1" : "span";
  const homeBrand = isFullscreen && currentPath === "/" && !pageHeading;

  return (
    <div className={`app-frame${isFullscreen ? " app-frame--fullscreen" : ""}`}>
      <main
        className={`profile-shell${isFullscreen ? " profile-shell--fullscreen" : ""}`}
        data-auth-status={authStatus}
      >
        <header className="profile-topbar">
          <div className="profile-topbar-leading">
            {homeBrand ? (
              <a className="profile-topbar-title" href="/">{title}</a>
            ) : (
              <TitleElement className="profile-topbar-title">{title}</TitleElement>
            )}
            <nav aria-label="Primary" className="profile-navigation">
              {currentPath !== "/" ? <a href="/">Home</a> : null}
            </nav>
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
