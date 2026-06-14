import { ProfileShell } from "./ProfileShell.jsx";
import {
  buildAccountLoginHref,
  getAccountAvatar,
  getAccountDisplayName,
  getAccountLogin,
  getAccountOwner
} from "./accountUi.js";

export function SettingsPage({
  authState,
  client,
  location = globalThis.window?.location,
  onAuthStateChange
}) {
  const authStatus = authState?.status ?? "loading";

  return (
    <ProfileShell
      authState={authState}
      client={client}
      onAuthStateChange={onAuthStateChange}
      showShare={false}
      title="Settings"
    >
      <section className="settings-view" aria-labelledby="settings-title">
        {authStatus === "authenticated" ? (
          <AuthenticatedSettings authState={authState} />
        ) : (
          <SettingsState
            authStatus={authStatus}
            client={client}
            location={location}
          />
        )}
      </section>
    </ProfileShell>
  );
}

function AuthenticatedSettings({ authState }) {
  const owner = getAccountOwner(authState);
  const avatar = getAccountAvatar(owner);
  const displayName = getAccountDisplayName(owner);
  const login = getAccountLogin(owner);
  const details = getAccountDetails(owner);

  return (
    <div className="settings-stage">
      <header className="settings-heading">
        <h2 id="settings-title">Profile</h2>
      </header>

      <div className="settings-panel">
        <div className="settings-account">
          <SettingsAvatar avatar={avatar} />
          <div className="settings-account-copy">
            <strong>{displayName}</strong>
            {login ? <span>@{login}</span> : null}
          </div>
        </div>

        <p className="settings-note">
          Profile information is synced from GitHub and cannot be edited here.
        </p>

        <dl className="settings-detail-list">
          {details.map((detail) => (
            <div className="settings-detail-row" key={detail.label}>
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function SettingsState({ authStatus, client, location }) {
  const copy = {
    anonymous: {
      action: "Sign in with GitHub",
      message: "Sign in with GitHub to view account settings.",
      title: "Sign in required"
    },
    loading: {
      action: null,
      message: "Checking signed-in account.",
      title: "Loading account"
    },
    unavailable: {
      action: null,
      message: "Signed-in account unavailable.",
      title: "Account unavailable"
    }
  }[authStatus] ?? {
    action: null,
    message: "Account status unavailable.",
    title: "Account unavailable"
  };

  return (
    <div className={`settings-stage settings-stage-${authStatus}`}>
      <header className="settings-heading">
        <h2 id="settings-title">{copy.title}</h2>
        <p>{copy.message}</p>
      </header>
      {copy.action ? (
        <a className="settings-primary-action" href={buildAccountLoginHref(client, location)}>
          {copy.action}
        </a>
      ) : null}
    </div>
  );
}

function SettingsAvatar({ avatar }) {
  if (avatar.url) {
    return (
      <img
        alt={avatar.alt}
        className="settings-avatar-image"
        height="64"
        src={avatar.url}
        width="64"
      />
    );
  }

  return (
    <span className="settings-avatar-fallback" aria-hidden="true">
      {avatar.initial}
    </span>
  );
}

function getAccountDetails(owner) {
  const login = getAccountLogin(owner);

  return [
    {
      label: "GitHub",
      value: login ? `@${login}` : "Unknown"
    },
    {
      label: "Handle",
      value: owner?.handle ?? "Not set"
    },
    {
      label: "Visibility",
      value: owner?.visibility ?? "private"
    }
  ];
}
