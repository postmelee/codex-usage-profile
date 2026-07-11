import { AccountMenu } from "./AccountMenu.jsx";
import { Icon } from "./Icons.jsx";

export function ProfileShell({
  authState,
  children,
  client,
  onAuthStateChange,
  onShare,
  shareDisabled = false,
  showShare = true,
  title = "Profile"
}) {
  const authStatus = authState?.status ?? "unknown";
  const currentPath = globalThis.window?.location?.pathname ?? "/";

  return (
    <div className="app-frame">
      <main className="profile-shell" data-auth-status={authStatus}>
        <header className="profile-topbar">
          <div className="profile-topbar-leading">
            <h1>{title}</h1>
            <nav aria-label="Primary" className="profile-navigation">
              {currentPath !== "/" ? <a href="/">Home</a> : null}
              {currentPath !== "/profile" ? <a href="/profile">Profile</a> : null}
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
                <Icon name="share" />
                <span>Share</span>
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
