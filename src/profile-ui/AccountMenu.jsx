import { useState } from "react";

import { Icon } from "./Icons.jsx";
import {
  buildAccountLoginHref,
  getAccountMenuSummary
} from "./accountUi.js";

export function AccountMenu({
  authState,
  client,
  location = globalThis.window?.location,
  onAuthStateChange,
  settingsHref = "/settings"
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [logoutState, setLogoutState] = useState({
    error: null,
    status: "idle"
  });
  const authStatus = authState?.status ?? "loading";
  const isAuthenticated = authStatus === "authenticated";
  const isLoggingOut = logoutState.status === "submitting";
  const summary = getAccountMenuSummary(authState);

  async function handleLogout() {
    if (!client || typeof client.logout !== "function" || isLoggingOut) {
      return;
    }

    setLogoutState({ error: null, status: "submitting" });

    try {
      await client.logout();
      onAuthStateChange?.({
        account: null,
        status: "anonymous"
      });
      setIsOpen(false);
      setLogoutState({ error: null, status: "idle" });
    } catch (error) {
      setLogoutState({
        error: error instanceof Error ? error.message : "Logout failed",
        status: "error"
      });
    }
  }

  if (authStatus === "anonymous") {
    return (
      <a className="account-login-link" href={buildAccountLoginHref(client, location)}>
        <Icon name="user" size={14} />
        <span>Sign in</span>
      </a>
    );
  }

  if (authStatus === "loading") {
    return (
      <button className="account-status-button" disabled type="button">
        <span className="account-status-dot" />
        <span>Account</span>
      </button>
    );
  }

  if (authStatus === "unavailable" || !isAuthenticated) {
    return (
      <button className="account-status-button is-unavailable" disabled type="button">
        <span className="account-status-dot" />
        <span>Account unavailable</span>
      </button>
    );
  }

  return (
    <div className="account-menu">
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Account menu for ${summary.displayName}`}
        className="account-avatar-button"
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        <AccountAvatar avatar={summary.avatar} />
      </button>

      {isOpen ? (
        <div className="account-popover" role="menu">
          <div className="account-popover-header">
            <AccountAvatar avatar={summary.avatar} />
            <div className="account-popover-identity">
              <strong>{summary.displayName}</strong>
              {summary.login ? <span>@{summary.login}</span> : null}
            </div>
          </div>

          <div className="account-menu-items">
            <a className="account-menu-item" href={settingsHref} role="menuitem">
              <Icon name="settings" size={15} />
              <span>Settings</span>
            </a>
            <button
              className="account-menu-item"
              disabled={isLoggingOut}
              onClick={handleLogout}
              role="menuitem"
              type="button"
            >
              <Icon name="logOut" size={15} />
              <span>{isLoggingOut ? "Logging out" : "Log out"}</span>
            </button>
          </div>

          {logoutState.status === "error" ? (
            <p className="account-menu-error">{logoutState.error}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AccountAvatar({ avatar }) {
  if (avatar.url) {
    return (
      <img
        alt={avatar.alt}
        className="account-avatar-image"
        height="28"
        src={avatar.url}
        width="28"
      />
    );
  }

  return (
    <span className="account-avatar-fallback" aria-hidden="true">
      {avatar.initial}
    </span>
  );
}
