import { useEffect, useMemo, useState } from "react";

import { ProfileShell } from "./ProfileShell.jsx";
import {
  getAccountAvatar,
  getAccountDisplayName,
  getAccountLogin,
  getAccountOwner
} from "./accountUi.js";
import { buildProfileLoginHref, resolveShareLocale } from "./cardShare.js";

const SAMPLE_CARD_URL = "/assets/codex-card-sample.png";

export function HomePage({ authState, client, onAuthStateChange }) {
  const status = authState?.status ?? "loading";
  const owner = getAccountOwner(authState);
  const locale = useMemo(
    () => resolveShareLocale(globalThis.navigator?.language),
    []
  );
  const ownerPreviewUrl = status === "authenticated" && owner
    ? client?.buildOwnerCardPreviewUrl?.({ locale }) ?? null
    : null;
  const [ownerPreviewFailed, setOwnerPreviewFailed] = useState(false);
  const cardPreviewUrl = ownerPreviewUrl && !ownerPreviewFailed
    ? ownerPreviewUrl
    : SAMPLE_CARD_URL;

  useEffect(() => {
    setOwnerPreviewFailed(false);
  }, [ownerPreviewUrl]);

  return (
    <ProfileShell
      authState={authState}
      client={client}
      onAuthStateChange={onAuthStateChange}
      showShare={false}
      title="Codex usage"
    >
      <section className="home-view" aria-labelledby="home-title">
        <div className="home-stage">
          <header className="home-heading">
            <h2 id="home-title">Codex usage profile</h2>
          </header>

          <img
            alt={ownerPreviewUrl && !ownerPreviewFailed
              ? "Your Codex usage card"
              : "Sample Codex usage card"}
            className="home-card-preview"
            height="612"
            onError={() => {
              if (ownerPreviewUrl) setOwnerPreviewFailed(true);
            }}
            src={cardPreviewUrl}
            width="998"
          />

          <div className="home-account-state">
            {status === "authenticated" && owner ? (
              <AuthenticatedHome owner={owner} />
            ) : (
              <AnonymousHome client={client} status={status} />
            )}
          </div>
        </div>
      </section>
    </ProfileShell>
  );
}

function AuthenticatedHome({ owner }) {
  const avatar = getAccountAvatar(owner);
  const displayName = getAccountDisplayName(owner);
  const login = getAccountLogin(owner);

  return (
    <>
      <div className="home-account-identity">
        {avatar.url ? (
          <img alt={avatar.alt} height="40" src={avatar.url} width="40" />
        ) : (
          <span aria-hidden="true">{avatar.initial}</span>
        )}
        <div>
          <strong>{displayName}</strong>
          {login ? <small>@{login}</small> : null}
        </div>
      </div>
      <a className="primary-command" href="/profile">View profile</a>
    </>
  );
}

function AnonymousHome({ client, status }) {
  if (status === "loading") {
    return <p className="home-status" role="status">Checking account</p>;
  }
  if (status === "unavailable") {
    return <p className="home-status is-error">Account unavailable</p>;
  }

  return (
    <a className="primary-command" href={buildProfileLoginHref(client)}>
      Sign in with GitHub
    </a>
  );
}
