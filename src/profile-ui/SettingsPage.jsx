import { useEffect, useRef, useState } from "react";

import { ProfileShell } from "./ProfileShell.jsx";
import { useLocale } from "./LocaleProvider.jsx";
import { useTheme } from "./ThemeProvider.jsx";
import { THEME_PREFERENCES } from "./theme.js";
import {
  buildAccountLoginHref,
  getAccountAuthError,
  getAccountAvatar,
  getAccountDisplayName,
  getAccountLogin,
  getAccountOwner
} from "./accountUi.js";
import {
  DEFAULT_MAX_ACTIVE_CLI_TOKENS
} from "../profile-shared/tokenLimits.js";

export function SettingsPage({
  authState,
  client,
  location = globalThis.window?.location,
  onAuthStateChange
}) {
  const authStatus = authState?.status ?? "loading";
  const { t } = useLocale();

  return (
    <ProfileShell
      authState={authState}
      client={client}
      layout="fullscreen"
      onAuthStateChange={onAuthStateChange}
      pageHeading={false}
      showShare={false}
      title={t("settings.title")}
    >
      <section className="settings-view" aria-labelledby="settings-title">
        <div className="settings-stage">
          <header className="settings-heading">
            <h1 id="settings-title">{t("settings.title")}</h1>
          </header>

          <div className="settings-page-stack">
            <SettingsAppearancePanel />

            {authStatus === "authenticated" ? (
              <AuthenticatedSettings authState={authState} client={client} />
            ) : (
              <SettingsState
                authStatus={authStatus}
                client={client}
                location={location}
              />
            )}
          </div>
        </div>
      </section>
    </ProfileShell>
  );
}

function SettingsAppearancePanel() {
  const { preference, setPreference } = useTheme();
  const { t } = useLocale();

  return (
    <section className="settings-appearance settings-panel">
      <fieldset
        aria-describedby="settings-appearance-description"
        className="settings-appearance-fieldset"
      >
        <legend className="settings-appearance-title">
          {t("settings.appearance.title")}
        </legend>
        <p
          className="settings-appearance-description"
          id="settings-appearance-description"
        >
          {t("settings.appearance.description")}
        </p>

        <div className="settings-appearance-options">
          {THEME_PREFERENCES.map((option) => (
            <label className="settings-appearance-option" key={option}>
              <input
                checked={preference === option}
                name="settings-appearance"
                onChange={() => setPreference(option)}
                type="radio"
                value={option}
              />
              <span className="settings-appearance-copy">
                <strong>{t(`settings.appearance.${option}.title`)}</strong>
                <small>{t(`settings.appearance.${option}.description`)}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}

function AuthenticatedSettings({ authState, client }) {
  const { locale, t } = useLocale();
  const owner = getAccountOwner(authState);
  const avatar = getAccountAvatar(owner, locale);
  const displayName = getAccountDisplayName(owner, locale);
  const login = getAccountLogin(owner);
  const details = getAccountDetails(owner, t);

  return (
    <div className="settings-section-stack">
      <section
        aria-labelledby="settings-github-account-title"
        className="settings-panel"
      >
        <div className="settings-panel-heading">
          <h2 id="settings-github-account-title">
            {t("settings.account.githubAccount")}
          </h2>
        </div>

        <div className="settings-account">
          <SettingsAvatar avatar={avatar} />
          <div className="settings-account-copy">
            <strong>{displayName}</strong>
            {login ? <span>@{login}</span> : null}
          </div>
        </div>

        <p className="settings-note">
          {t("settings.account.note")}
        </p>

        <dl className="settings-detail-list">
          {details.map((detail) => (
            <div className="settings-detail-row" key={detail.label}>
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <SettingsTokenPanel client={client} />
      <SettingsDevicePanel client={client} />
    </div>
  );
}

function SettingsTokenPanel({ client }) {
  const { formatDate, t } = useLocale();
  const defaultTokenName = t("settings.tokens.defaultName");
  const previousDefaultTokenName = useRef(defaultTokenName);
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
  const [tokenName, setTokenName] = useState(defaultTokenName);
  const [createdToken, setCreatedToken] = useState(null);
  const activeTokenCount = tokens.length;
  const tokenLimitReached = activeTokenCount >= DEFAULT_MAX_ACTIVE_CLI_TOKENS;
  const createDisabled = createState.status === "submitting" ||
    tokenLimitReached ||
    loadState.status === "loading";

  useEffect(() => {
    setTokenName((current) => (
      current === previousDefaultTokenName.current ? defaultTokenName : current
    ));
    previousDefaultTokenName.current = defaultTokenName;
  }, [defaultTokenName]);

  useEffect(() => {
    let isCurrent = true;

    if (!client || typeof client.listSettingsTokens !== "function") {
      setLoadState({
        error: "settings.tokens.unavailable",
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
    }).catch(() => {
      if (!isCurrent) return;
      setLoadState({
        error: "settings.tokens.loadFailed",
        status: "error"
      });
    });

    return () => {
      isCurrent = false;
    };
  }, [client]);

  async function handleCreateToken(event) {
    event.preventDefault();
    if (!client || createDisabled) {
      return;
    }

    setCreateState({ error: null, status: "submitting" });

    try {
      const result = await client.createSettingsToken({ label: tokenName });
      setCreatedToken(result);
      setTokens((current) => prependTokenRecord(current, result.tokenRecord));
      setTokenName(defaultTokenName);
      setCreateState({ error: null, status: "idle" });
    } catch (error) {
      setCreateState({
        error: getCreateTokenErrorId(error),
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
    } catch {
      setRevokeState({
        error: "settings.tokens.revokeFailed",
        tokenId: null
      });
    }
  }

  return (
    <section className="settings-panel" aria-labelledby="settings-tokens-title">
      <div className="settings-panel-heading">
        <h2 id="settings-tokens-title">{t("settings.tokens.title")}</h2>
        {loadState.status === "ready" ? (
          <span className="settings-token-count">
            {activeTokenCount}/{DEFAULT_MAX_ACTIVE_CLI_TOKENS}
          </span>
        ) : null}
      </div>

      <form className="settings-token-form" onSubmit={handleCreateToken}>
        <label htmlFor="settings-token-name">{t("settings.tokens.name")}</label>
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
            disabled={createDisabled}
            type="submit"
          >
            {getCreateTokenButtonLabel(createState.status, tokenLimitReached, t)}
          </button>
        </div>
      </form>

      {tokenLimitReached ? (
        <p className="settings-limit-note" role="status">
          {t("settings.tokens.limitMessage")}
        </p>
      ) : null}

      {createState.status === "error" ? (
        <p className="settings-error">{t(createState.error)}</p>
      ) : null}

      {createdToken ? (
        <div className="settings-token-reveal">
          <strong>{t("settings.tokens.reveal")}</strong>
          <div className="settings-token-code-row">
            <code>{createdToken.token}</code>
            <button
              className="settings-secondary-action"
              onClick={handleCopyCreatedToken}
              type="button"
            >
              {t("settings.tokens.copy")}
            </button>
          </div>
        </div>
      ) : null}

      <SettingsTokenList
        loadState={loadState}
        onRevokeToken={handleRevokeToken}
        revokeState={revokeState}
        formatDate={formatDate}
        t={t}
        tokens={tokens}
      />
    </section>
  );
}

function SettingsTokenList({
  formatDate,
  loadState,
  onRevokeToken,
  revokeState,
  t,
  tokens
}) {
  if (loadState.status === "loading") {
    return <p className="settings-list-state">{t("settings.tokens.loading")}</p>;
  }

  if (loadState.status === "error") {
    return <p className="settings-error">{t(loadState.error)}</p>;
  }

  if (tokens.length === 0) {
    return <p className="settings-list-state">{t("settings.tokens.empty")}</p>;
  }

  return (
    <div className="settings-token-list">
      {tokens.map((token) => (
        <div className="settings-token-row" key={token.id}>
          <div className="settings-token-info">
            <strong>{token.label ?? t("settings.tokens.defaultName")}</strong>
            <span>{formatTokenMeta(token, formatDate, t)}</span>
          </div>
          <button
            className="settings-danger-action"
            disabled={revokeState.tokenId === token.id}
            onClick={() => onRevokeToken(token.id)}
            type="button"
          >
            {revokeState.tokenId === token.id
              ? t("settings.tokens.revoking")
              : t("settings.tokens.revoke")}
          </button>
        </div>
      ))}
      {revokeState.error ? (
        <p className="settings-error">{t(revokeState.error)}</p>
      ) : null}
    </div>
  );
}

function SettingsDevicePanel({ client }) {
  const { formatDate, t } = useLocale();
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
        error: "settings.devices.unavailable",
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
    }).catch(() => {
      if (!isCurrent) return;
      setLoadState({
        error: "settings.devices.loadFailed",
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
    } catch {
      setSaveState({
        deviceId: null,
        error: "settings.devices.renameFailed"
      });
    }
  }

  return (
    <section className="settings-panel" aria-labelledby="settings-devices-title">
      <div className="settings-panel-heading">
        <h2 id="settings-devices-title">{t("settings.devices.title")}</h2>
      </div>

      <SettingsDeviceList
        devices={devices}
        editState={editState}
        formatDate={formatDate}
        loadState={loadState}
        onCancelEdit={cancelEditingDevice}
        onEditNameChange={(name) => setEditState((current) => ({
          ...current,
          name
        }))}
        onSaveDevice={handleSaveDevice}
        onStartEdit={startEditingDevice}
        saveState={saveState}
        t={t}
      />
    </section>
  );
}

function SettingsDeviceList({
  devices,
  editState,
  formatDate,
  loadState,
  onCancelEdit,
  onEditNameChange,
  onSaveDevice,
  onStartEdit,
  saveState,
  t
}) {
  if (loadState.status === "loading") {
    return <p className="settings-list-state">{t("settings.devices.loading")}</p>;
  }

  if (loadState.status === "error") {
    return <p className="settings-error">{t(loadState.error)}</p>;
  }

  if (devices.length === 0) {
    return <p className="settings-list-state">{t("settings.devices.empty")}</p>;
  }

  return (
    <div className="settings-token-list">
      {devices.map((device) => (
        <div className="settings-token-row" key={device.id}>
          {editState.deviceId === device.id ? (
            <div className="settings-device-edit-row">
              <input
                aria-label={t("settings.devices.deviceName")}
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
                placeholder={t("settings.devices.deviceName")}
                type="text"
                value={editState.name}
              />
              <button
                className="settings-secondary-action"
                disabled={saveState.deviceId === device.id}
                onClick={() => onSaveDevice(device)}
                type="button"
              >
                {saveState.deviceId === device.id
                  ? t("settings.devices.saving")
                  : t("settings.devices.save")}
              </button>
              <button
                className="settings-muted-action"
                disabled={saveState.deviceId === device.id}
                onClick={onCancelEdit}
                type="button"
              >
                {t("settings.devices.cancel")}
              </button>
            </div>
          ) : (
            <>
              <div className="settings-token-info">
                <strong>{device.displayName ?? t("settings.devices.unnamed")}</strong>
                <span>{formatDeviceMeta(device, formatDate, t)}</span>
              </div>
              <button
                className="settings-secondary-action"
                onClick={() => onStartEdit(device)}
                type="button"
              >
                {t("settings.devices.rename")}
              </button>
            </>
          )}
        </div>
      ))}
      {saveState.error ? (
        <p className="settings-error">{t(saveState.error)}</p>
      ) : null}
    </div>
  );
}

function SettingsState({ authStatus, client, location }) {
  const { locale, t } = useLocale();
  const authError = getAccountAuthError(location, locale);
  const copy = authError ?? {
    anonymous: {
      action: t("account.loginWithGitHub"),
      message: t("settings.state.anonymous.message"),
      title: t("settings.state.anonymous.title")
    },
    loading: {
      action: null,
      message: t("settings.state.loading.message"),
      title: t("settings.state.loading.title")
    },
    unavailable: {
      action: null,
      message: t("settings.state.unavailable.message"),
      title: t("settings.state.unavailable.title")
    }
  }[authStatus] ?? {
    action: null,
    message: t("settings.state.unavailable.message"),
    title: t("settings.state.unavailable.title")
  };

  return (
    <div className={`settings-state settings-state-${authStatus}`}>
      <header className="settings-state-heading">
        <h2>{copy.title}</h2>
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

function getCreateTokenButtonLabel(createStatus, tokenLimitReached, t) {
  if (createStatus === "submitting") {
    return t("settings.tokens.creating");
  }
  if (tokenLimitReached) {
    return t("settings.tokens.limitReached");
  }
  return t("settings.tokens.create");
}

function getCreateTokenErrorId(error) {
  if (error?.code === "conflict" || error?.status === 409) {
    return "settings.tokens.limitMessage";
  }

  return "settings.tokens.createFailed";
}

function formatTokenMeta(token, formatDate, t) {
  const parts = [];
  const created = formatShortDate(token.createdAt, formatDate);
  const lastUsed = formatShortDate(token.lastUsedAt, formatDate);

  if (created) {
    parts.push(t("settings.tokens.created", { date: created }));
  }
  if (lastUsed) {
    parts.push(t("settings.tokens.lastUsed", { date: lastUsed }));
  }
  if (token.sourceChallengeId) {
    parts.push(t("settings.tokens.deviceLogin"));
  }

  return parts.join(" · ") || t("settings.tokens.metadataUnavailable");
}

function formatDeviceMeta(device, formatDate, t) {
  const parts = [];
  const lastSubmittedAt = formatShortDate(device.lastSubmittedAt, formatDate);
  const createdAt = formatShortDate(device.createdAt, formatDate);

  if (device.deviceKey) {
    parts.push(device.deviceKey);
  }
  if (lastSubmittedAt) {
    parts.push(t("settings.devices.lastSubmit", { date: lastSubmittedAt }));
  } else if (createdAt) {
    parts.push(t("settings.devices.created", { date: createdAt }));
  }

  return parts.join(" · ") || t("settings.devices.metadataUnavailable");
}

function formatShortDate(value, formatDate) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return formatDate(date, {
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

function getAccountDetails(owner, t) {
  const login = getAccountLogin(owner);
  const visibility = owner?.visibility === "public" ? "public" : "private";

  return [
    {
      label: t("settings.account.github"),
      value: login ? `@${login}` : t("settings.account.unknown")
    },
    {
      label: t("settings.account.handle"),
      value: owner?.handle ?? t("settings.account.notSet")
    },
    {
      label: t("settings.account.visibility"),
      value: t(`settings.account.visibility.${visibility}`)
    }
  ];
}
