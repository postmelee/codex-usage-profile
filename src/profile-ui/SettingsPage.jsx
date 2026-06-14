import { useEffect, useState } from "react";

import { ProfileShell } from "./ProfileShell.jsx";
import {
  buildAccountLoginHref,
  getAccountAvatar,
  getAccountDisplayName,
  getAccountLogin,
  getAccountOwner
} from "./accountUi.js";

const DEFAULT_TOKEN_NAME = "CI token";

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
          <AuthenticatedSettings authState={authState} client={client} />
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

function AuthenticatedSettings({ authState, client }) {
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

      <div className="settings-section-stack">
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

        <SettingsTokenPanel client={client} />
        <SettingsDevicePanel client={client} />
      </div>
    </div>
  );
}

function SettingsTokenPanel({ client }) {
  const [tokens, setTokens] = useState([]);
  const [loadState, setLoadState] = useState({
    error: null,
    status: "loading"
  });
  const [createState, setCreateState] = useState({
    error: null,
    status: "idle"
  });
  const [revokeState, setRevokeState] = useState({
    error: null,
    tokenId: null
  });
  const [tokenName, setTokenName] = useState(DEFAULT_TOKEN_NAME);
  const [createdToken, setCreatedToken] = useState(null);

  useEffect(() => {
    let isCurrent = true;

    if (!client || typeof client.listSettingsTokens !== "function") {
      setLoadState({
        error: "Token settings are unavailable.",
        status: "error"
      });
      return () => {
        isCurrent = false;
      };
    }

    setLoadState({ error: null, status: "loading" });
    client.listSettingsTokens().then((nextTokens) => {
      if (!isCurrent) return;
      setTokens(nextTokens);
      setLoadState({ error: null, status: "ready" });
    }).catch((error) => {
      if (!isCurrent) return;
      setLoadState({
        error: error instanceof Error ? error.message : "Failed to load tokens.",
        status: "error"
      });
    });

    return () => {
      isCurrent = false;
    };
  }, [client]);

  async function handleCreateToken(event) {
    event.preventDefault();
    if (!client || createState.status === "submitting") {
      return;
    }

    setCreateState({ error: null, status: "submitting" });

    try {
      const result = await client.createSettingsToken({ label: tokenName });
      setCreatedToken(result);
      setTokens((current) => prependTokenRecord(current, result.tokenRecord));
      setTokenName(DEFAULT_TOKEN_NAME);
      setCreateState({ error: null, status: "idle" });
    } catch (error) {
      setCreateState({
        error: error instanceof Error ? error.message : "Failed to create token.",
        status: "error"
      });
    }
  }

  async function handleCopyCreatedToken() {
    if (!createdToken) {
      return;
    }

    if (globalThis.navigator?.clipboard?.writeText) {
      await globalThis.navigator.clipboard.writeText(createdToken.token);
    }
    setCreatedToken(null);
  }

  async function handleRevokeToken(tokenId) {
    if (!client || revokeState.tokenId) {
      return;
    }

    setRevokeState({ error: null, tokenId });

    try {
      await client.revokeSettingsToken(tokenId);
      setTokens((current) => current.filter((token) => token.id !== tokenId));
      setRevokeState({ error: null, tokenId: null });
    } catch (error) {
      setRevokeState({
        error: error instanceof Error ? error.message : "Failed to revoke token.",
        tokenId: null
      });
    }
  }

  return (
    <div className="settings-panel">
      <div className="settings-panel-heading">
        <h3>API Tokens</h3>
      </div>

      <form className="settings-token-form" onSubmit={handleCreateToken}>
        <label htmlFor="settings-token-name">Token name</label>
        <div className="settings-action-row">
          <input
            id="settings-token-name"
            maxLength={100}
            onChange={(event) => setTokenName(event.target.value)}
            type="text"
            value={tokenName}
          />
          <button
            className="settings-secondary-action"
            disabled={createState.status === "submitting"}
            type="submit"
          >
            {createState.status === "submitting" ? "Creating" : "Create token"}
          </button>
        </div>
      </form>

      {createState.status === "error" ? (
        <p className="settings-error">{createState.error}</p>
      ) : null}

      {createdToken ? (
        <div className="settings-token-reveal">
          <strong>Copy this token now. It will not be shown again.</strong>
          <div className="settings-token-code-row">
            <code>{createdToken.token}</code>
            <button
              className="settings-secondary-action"
              onClick={handleCopyCreatedToken}
              type="button"
            >
              Copy
            </button>
          </div>
        </div>
      ) : null}

      <SettingsTokenList
        loadState={loadState}
        onRevokeToken={handleRevokeToken}
        revokeState={revokeState}
        tokens={tokens}
      />
    </div>
  );
}

function SettingsTokenList({
  loadState,
  onRevokeToken,
  revokeState,
  tokens
}) {
  if (loadState.status === "loading") {
    return <p className="settings-list-state">Loading tokens.</p>;
  }

  if (loadState.status === "error") {
    return <p className="settings-error">{loadState.error}</p>;
  }

  if (tokens.length === 0) {
    return <p className="settings-list-state">No API tokens yet.</p>;
  }

  return (
    <div className="settings-token-list">
      {tokens.map((token) => (
        <div className="settings-token-row" key={token.id}>
          <div className="settings-token-info">
            <strong>{token.label ?? "CLI token"}</strong>
            <span>{formatTokenMeta(token)}</span>
          </div>
          <button
            className="settings-danger-action"
            disabled={revokeState.tokenId === token.id}
            onClick={() => onRevokeToken(token.id)}
            type="button"
          >
            {revokeState.tokenId === token.id ? "Revoking" : "Revoke"}
          </button>
        </div>
      ))}
      {revokeState.error ? (
        <p className="settings-error">{revokeState.error}</p>
      ) : null}
    </div>
  );
}

function SettingsDevicePanel({ client }) {
  const [devices, setDevices] = useState([]);
  const [loadState, setLoadState] = useState({
    error: null,
    status: "loading"
  });
  const [editState, setEditState] = useState({
    deviceId: null,
    name: ""
  });
  const [saveState, setSaveState] = useState({
    deviceId: null,
    error: null
  });

  useEffect(() => {
    let isCurrent = true;

    if (!client || typeof client.listSettingsDevices !== "function") {
      setLoadState({
        error: "Device settings are unavailable.",
        status: "error"
      });
      return () => {
        isCurrent = false;
      };
    }

    setLoadState({ error: null, status: "loading" });
    client.listSettingsDevices().then((nextDevices) => {
      if (!isCurrent) return;
      setDevices(nextDevices);
      setLoadState({ error: null, status: "ready" });
    }).catch((error) => {
      if (!isCurrent) return;
      setLoadState({
        error: error instanceof Error ? error.message : "Failed to load devices.",
        status: "error"
      });
    });

    return () => {
      isCurrent = false;
    };
  }, [client]);

  function startEditingDevice(device) {
    setEditState({
      deviceId: device.id,
      name: device.customName ?? ""
    });
    setSaveState({ deviceId: null, error: null });
  }

  function cancelEditingDevice() {
    setEditState({ deviceId: null, name: "" });
    setSaveState({ deviceId: null, error: null });
  }

  async function handleSaveDevice(device) {
    if (!client || saveState.deviceId) {
      return;
    }

    setSaveState({ deviceId: device.id, error: null });

    try {
      const updated = await client.renameSettingsDevice(device.id, editState.name);
      setDevices((current) => current.map((item) => (
        item.id === updated.id ? updated : item
      )));
      setEditState({ deviceId: null, name: "" });
      setSaveState({ deviceId: null, error: null });
    } catch (error) {
      setSaveState({
        deviceId: null,
        error: error instanceof Error ? error.message : "Failed to rename device."
      });
    }
  }

  return (
    <div className="settings-panel">
      <div className="settings-panel-heading">
        <h3>Devices</h3>
      </div>

      <SettingsDeviceList
        devices={devices}
        editState={editState}
        loadState={loadState}
        onCancelEdit={cancelEditingDevice}
        onEditNameChange={(name) => setEditState((current) => ({
          ...current,
          name
        }))}
        onSaveDevice={handleSaveDevice}
        onStartEdit={startEditingDevice}
        saveState={saveState}
      />
    </div>
  );
}

function SettingsDeviceList({
  devices,
  editState,
  loadState,
  onCancelEdit,
  onEditNameChange,
  onSaveDevice,
  onStartEdit,
  saveState
}) {
  if (loadState.status === "loading") {
    return <p className="settings-list-state">Loading devices.</p>;
  }

  if (loadState.status === "error") {
    return <p className="settings-error">{loadState.error}</p>;
  }

  if (devices.length === 0) {
    return <p className="settings-list-state">No devices yet.</p>;
  }

  return (
    <div className="settings-token-list">
      {devices.map((device) => (
        <div className="settings-token-row" key={device.id}>
          {editState.deviceId === device.id ? (
            <div className="settings-device-edit-row">
              <input
                aria-label="Device name"
                maxLength={120}
                onChange={(event) => onEditNameChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onSaveDevice(device);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    onCancelEdit();
                  }
                }}
                placeholder="Device name"
                type="text"
                value={editState.name}
              />
              <button
                className="settings-secondary-action"
                disabled={saveState.deviceId === device.id}
                onClick={() => onSaveDevice(device)}
                type="button"
              >
                {saveState.deviceId === device.id ? "Saving" : "Save"}
              </button>
              <button
                className="settings-muted-action"
                disabled={saveState.deviceId === device.id}
                onClick={onCancelEdit}
                type="button"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <div className="settings-token-info">
                <strong>{device.displayName ?? "Unnamed device"}</strong>
                <span>{formatDeviceMeta(device)}</span>
              </div>
              <button
                className="settings-secondary-action"
                onClick={() => onStartEdit(device)}
                type="button"
              >
                Rename
              </button>
            </>
          )}
        </div>
      ))}
      {saveState.error ? (
        <p className="settings-error">{saveState.error}</p>
      ) : null}
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

function prependTokenRecord(tokens, tokenRecord) {
  if (!tokenRecord) {
    return tokens;
  }

  return [
    tokenRecord,
    ...tokens.filter((token) => token.id !== tokenRecord.id)
  ];
}

function formatTokenMeta(token) {
  const parts = [];
  const created = formatShortDate(token.createdAt);
  const lastUsed = formatShortDate(token.lastUsedAt);

  if (created) {
    parts.push(`Created ${created}`);
  }
  if (lastUsed) {
    parts.push(`Last used ${lastUsed}`);
  }
  if (token.sourceChallengeId) {
    parts.push("Device login");
  }

  return parts.join(" · ") || "Token metadata unavailable";
}

function formatDeviceMeta(device) {
  const parts = [];
  const lastSubmittedAt = formatShortDate(device.lastSubmittedAt);
  const createdAt = formatShortDate(device.createdAt);

  if (device.deviceKey) {
    parts.push(device.deviceKey);
  }
  if (lastSubmittedAt) {
    parts.push(`Last submit ${lastSubmittedAt}`);
  } else if (createdAt) {
    parts.push(`Created ${createdAt}`);
  }

  return parts.join(" · ") || "Device metadata unavailable";
}

function formatShortDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
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
