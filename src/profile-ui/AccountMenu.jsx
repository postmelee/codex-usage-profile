import { useEffect, useRef, useState } from "react";
import {
  LogOut as LogOutIcon,
  Settings as SettingsIcon,
  UserRound as UserRoundIcon
} from "lucide-react";

import {
  buildAccountLoginHref,
  getAccountMenuSummary
} from "./accountUi.js";

export function AccountMenu({
  authState,
  client,
  location = globalThis.window?.location,
  onAuthStateChange,
  profileHref = "/profile",
  settingsHref = "/?view=settings"
}) {
  const menuRef = useRef(null);
  const menuItemRefs = useRef([]);
  const triggerRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [logoutState, setLogoutState] = useState({
    error: null,
    status: "idle"
  });
  const authStatus = authState?.status ?? "loading";
  const isAuthenticated = authStatus === "authenticated";
  const isLoggingOut = logoutState.status === "submitting";
  const summary = getAccountMenuSummary(authState);

  useEffect(() => {
    if (isOpen) {
      menuItemRefs.current.find((item) => item && !item.disabled)?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const root = menuRef.current;
    const ownerDocument = root?.ownerDocument ?? globalThis.document;
    if (!ownerDocument) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (root && event.target && !root.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    ownerDocument.addEventListener("pointerdown", handlePointerDown);
    ownerDocument.addEventListener("keydown", handleKeyDown);

    return () => {
      ownerDocument.removeEventListener("pointerdown", handlePointerDown);
      ownerDocument.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleToggleMenu() {
    setLogoutState((current) => (
      current.status === "error" ? { error: null, status: "idle" } : current
    ));
    setIsOpen((value) => !value);
  }

  function handleMenuBlur(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsOpen(false);
    }
  }

  function handleMenuKeyDown(event) {
    if (!["ArrowDown", "ArrowUp", "End", "Home"].includes(event.key)) {
      return;
    }

    const items = menuItemRefs.current.filter((item) => item && !item.disabled);
    if (items.length === 0) {
      return;
    }

    event.preventDefault();
    const currentIndex = items.indexOf(event.target);
    const nextIndex = getNextMenuItemIndex(event.key, currentIndex, items.length);
    items[nextIndex]?.focus();
  }

  function handleMenuItemClick() {
    setIsOpen(false);
  }

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
        <AccountIcon name="signIn" size={14} />
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
      <button
        aria-label="Sign in unavailable"
        className="account-status-button is-unavailable"
        disabled
        title="Sign in is temporarily unavailable"
        type="button"
      >
        <AccountIcon name="signIn" size={14} />
        <span>Sign in</span>
      </button>
    );
  }

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        aria-controls={isOpen ? "account-menu-popover" : undefined}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Account menu for ${summary.displayName}`}
        className="account-avatar-button"
        onClick={handleToggleMenu}
        ref={triggerRef}
        type="button"
      >
        <AccountAvatar avatar={summary.avatar} />
      </button>

      {isOpen ? (
        <div
          className="account-popover"
          id="account-menu-popover"
          onBlur={handleMenuBlur}
          onKeyDown={handleMenuKeyDown}
          role="menu"
        >
          <div className="account-popover-header">
            <AccountAvatar avatar={summary.avatar} />
            <div className="account-popover-identity">
              <strong>{summary.displayName}</strong>
              {summary.login ? <span>@{summary.login}</span> : null}
            </div>
          </div>

          <div className="account-menu-items">
            <a
              className="account-menu-item"
              href={profileHref}
              onClick={handleMenuItemClick}
              ref={(item) => { menuItemRefs.current[0] = item; }}
              role="menuitem"
            >
              <AccountIcon name="profile" />
              <span>Profile</span>
            </a>
            <a
              className="account-menu-item"
              href={settingsHref}
              onClick={handleMenuItemClick}
              ref={(item) => { menuItemRefs.current[1] = item; }}
              role="menuitem"
            >
              <AccountIcon name="settings" />
              <span>Settings</span>
            </a>
            <button
              className="account-menu-item"
              disabled={isLoggingOut}
              onClick={handleLogout}
              ref={(item) => { menuItemRefs.current[2] = item; }}
              role="menuitem"
              type="button"
            >
              <AccountIcon name="logOut" />
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

const ACCOUNT_ICON_COMPONENTS = {
  logOut: LogOutIcon,
  profile: UserRoundIcon,
  settings: SettingsIcon,
  signIn: UserRoundIcon
};

function AccountIcon({ name, size = 15 }) {
  const IconComponent = ACCOUNT_ICON_COMPONENTS[name] ?? UserRoundIcon;

  return (
    <IconComponent
      aria-hidden="true"
      className="icon"
      data-account-icon={name}
      size={size}
      strokeWidth={1.75}
    />
  );
}

function getNextMenuItemIndex(key, currentIndex, itemCount) {
  if (key === "Home") return 0;
  if (key === "End") return itemCount - 1;
  if (key === "ArrowUp") {
    return currentIndex <= 0 ? itemCount - 1 : currentIndex - 1;
  }
  return currentIndex < 0 || currentIndex === itemCount - 1
    ? 0
    : currentIndex + 1;
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
