import { useEffect, useMemo, useState } from "react";

import { ProfileShell } from "./ProfileShell.jsx";
import { HomeQuickstart } from "./HomeQuickstart.jsx";
import {
  buildAccountLoginHref,
  getAccountAvatar,
  getAccountDisplayName,
  getAccountLogin,
  getAccountOwner
} from "./accountUi.js";
import { resolveShareLocale } from "./cardShare.js";

const SAMPLE_CARD_URL = "/assets/codex-card-sample.png";

export function HomePage({
  authState,
  client,
  location,
  onAuthStateChange
}) {
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
  const isAuthenticated = status === "authenticated" && Boolean(owner);
  const loginHref = buildAccountLoginHref(client, location);

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
      <div className="home-view">
        <section className="home-stage" aria-labelledby="home-title">
          <header className="home-heading">
            <h2 id="home-title">Codex usage profile</h2>
            <p>
              Keep one shareable card up to date with the Codex usage you submit.
            </p>
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
            {isAuthenticated ? (
              <AuthenticatedHome owner={owner} />
            ) : (
              <AnonymousHome
                loginHref={loginHref}
                status={status}
              />
            )}
          </div>
        </section>

        <HomeQuickstart
          authenticated={isAuthenticated}
          loginHref={loginHref}
          status={status}
        />
      </div>
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

function AnonymousHome({ loginHref, status }) {
  if (status === "loading") {
    return <p className="home-status" role="status">Checking account</p>;
  }
  if (status === "unavailable") {
    return <p className="home-status is-error">Account unavailable</p>;
  }

  return (
    <a
      className="primary-command"
      href={loginHref}
    >
      Sign in with GitHub
    </a>
  );
}
