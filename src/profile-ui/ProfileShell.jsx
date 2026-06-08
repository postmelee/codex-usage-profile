import { Icon } from "./Icons.jsx";

export function ProfileShell({ children }) {
  return (
    <div className="app-frame">
      <main className="profile-shell">
        <header className="profile-topbar">
          <h1>Profile</h1>
          <div className="profile-actions" aria-label="Profile actions">
            <button aria-label="Share profile" type="button">
              <Icon name="share" />
              <span>Share</span>
            </button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
