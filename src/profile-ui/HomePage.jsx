import { useEffect, useMemo, useState } from "react";
import { BorderBeam } from "border-beam";

import { Icon } from "./Icons.jsx";
import { ProfileShell } from "./ProfileShell.jsx";
import { HomeQuickstart } from "./HomeQuickstart.jsx";
import { ShareDialog } from "./ShareDialog.jsx";
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
  const [profileState, setProfileState] = useState({
    error: null,
    profile: null,
    status: "idle"
  });
  const [mutationState, setMutationState] = useState({
    error: null,
    status: "idle"
  });
  const [previewRevision, setPreviewRevision] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const supportsCardTilt = useMediaQuery(
    "(min-width: 761px) and (hover: hover) and (pointer: fine)"
  );
  const cardPreviewUrl = ownerPreviewUrl && !ownerPreviewFailed
    ? ownerPreviewUrl
    : SAMPLE_CARD_URL;
  const isAuthenticated = status === "authenticated" && Boolean(owner);
  const showPersonalizedSample = isAuthenticated && cardPreviewUrl === SAMPLE_CARD_URL;
  const loginHref = buildAccountLoginHref(client, location);

  useEffect(() => {
    setOwnerPreviewFailed(false);
  }, [ownerPreviewUrl]);

  useEffect(() => {
    let isCurrent = true;

    if (!isAuthenticated) {
      setProfileState({ error: null, profile: null, status: "idle" });
      return () => { isCurrent = false; };
    }

    setProfileState({ error: null, profile: null, status: "loading" });
    client.getOwnerProfile().then((profile) => {
      if (isCurrent) {
        setProfileState({ error: null, profile, status: "ready" });
      }
    }).catch((error) => {
      if (isCurrent) {
        setProfileState({
          error: error instanceof Error ? error.message : "Card unavailable",
          profile: null,
          status: "error"
        });
      }
    });

    return () => { isCurrent = false; };
  }, [client, isAuthenticated]);

  const profile = profileState.profile;
  const hasUsage = Boolean(profile?.usage);
  const isPublic = profile?.visibility === "public";
  const canShare = profileState.status === "ready" && hasUsage && isPublic;
  const sharePreviewUrl = hasUsage
    ? client.buildOwnerCardPreviewUrl({ locale, revision: previewRevision })
    : null;

  async function updateVisibility(visibility) {
    if (mutationState.status === "submitting") return;
    setMutationState({ error: null, status: "submitting" });

    try {
      const nextProfile = await client.updateProfileVisibility(visibility);
      setProfileState({ error: null, profile: nextProfile, status: "ready" });
      setPreviewRevision((value) => value + 1);
      setShareOpen(false);
      setMutationState({ error: null, status: "idle" });

      if (authState?.account?.owner && nextProfile.owner) {
        onAuthStateChange?.({
          ...authState,
          account: { ...authState.account, owner: nextProfile.owner }
        });
      }
    } catch (error) {
      setMutationState({
        error: error instanceof Error ? error.message : "Card update failed",
        status: "error"
      });
    }
  }

  return (
    <ProfileShell
      authState={authState}
      client={client}
      layout="fullscreen"
      onAuthStateChange={onAuthStateChange}
      pageHeading={false}
      showShare={false}
      title="Codex Usage"
    >
      <div className="home-view">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-stage">
            <header className="home-heading">
              <h1 id="home-title">Codex Usage Profile</h1>
              <p>
                Keep one shareable card up to date with the Codex usage you submit.
              </p>
            </header>

            <HomeCardTilt enabled={supportsCardTilt && !prefersReducedMotion}>
              <BorderBeam
                active={!prefersReducedMotion}
                borderRadius={41}
                brightness={1.05}
                className="home-card-beam"
                colorVariant="ocean"
                duration={4.8}
                size="md"
                strength={0.82}
              >
                <div className="home-card-media">
                  <img
                    alt={ownerPreviewUrl && !ownerPreviewFailed
                      ? "Your Codex usage card"
                      : "Sample Codex usage card"}
                    className="home-card-preview"
                    height="918"
                    onError={() => {
                      if (ownerPreviewUrl) setOwnerPreviewFailed(true);
                    }}
                    src={cardPreviewUrl}
                    width="1497"
                  />
                  {showPersonalizedSample ? (
                    <HomeSampleIdentity owner={owner} />
                  ) : null}
                  <span className="home-card-glare" aria-hidden="true" />
                </div>
              </BorderBeam>
            </HomeCardTilt>

            <div className="home-account-state">
              {isAuthenticated ? (
                <AuthenticatedHome
                  hasUsage={hasUsage}
                  isPublic={isPublic}
                  mutationState={mutationState}
                  onPublish={() => updateVisibility("public")}
                  onShare={() => setShareOpen(true)}
                  owner={owner}
                  profileState={profileState}
                />
              ) : (
                <AnonymousHome
                  loginHref={loginHref}
                  status={status}
                />
              )}
            </div>
          </div>
        </section>

        <HomeQuickstart
          authenticated={isAuthenticated}
          loginHref={loginHref}
          status={status}
        />
      </div>

      <ShareDialog
        locale={locale}
        makingPrivate={mutationState.status === "submitting"}
        onClose={() => setShareOpen(false)}
        onMakePrivate={() => updateVisibility("private")}
        open={shareOpen && canShare}
        previewUrl={sharePreviewUrl}
        publicCardUrl={profile?.publicCardUrl}
      />
    </ProfileShell>
  );
}

function HomeSampleIdentity({ owner }) {
  const avatar = getAccountAvatar(owner);
  const displayName = getAccountDisplayName(owner);
  const login = getAccountLogin(owner);

  return (
    <div className="home-card-sample-identity" aria-hidden="true">
      {avatar.url ? (
        <img className="home-card-sample-avatar" src={avatar.url} alt="" />
      ) : (
        <span className="home-card-sample-avatar-fallback">{avatar.initial}</span>
      )}
      <div className="home-card-sample-copy">
        <strong>{displayName}</strong>
        {login ? <span>@{login}</span> : null}
      </div>
    </div>
  );
}

function AuthenticatedHome({
  hasUsage,
  isPublic,
  mutationState,
  onPublish,
  onShare,
  owner,
  profileState
}) {
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
      <div className="home-account-actions">
        <HomeCardAction
          hasUsage={hasUsage}
          isPublic={isPublic}
          mutationStatus={mutationState.status}
          onPublish={onPublish}
          onShare={onShare}
          profileStatus={profileState.status}
        />
        {mutationState.error ? (
          <p className="home-status is-error" role="status">{mutationState.error}</p>
        ) : null}
        {profileState.status === "error" ? (
          <p className="home-status is-error" role="status">Card unavailable</p>
        ) : null}
      </div>
    </>
  );
}

function HomeCardAction({
  hasUsage,
  isPublic,
  mutationStatus,
  onPublish,
  onShare,
  profileStatus
}) {
  if (profileStatus === "loading" || profileStatus === "idle") {
    return <button className="secondary-command" disabled type="button">Loading card</button>;
  }
  if (profileStatus === "error") return null;
  if (!hasUsage) {
    return <button className="secondary-command" disabled type="button">Submit usage first</button>;
  }

  const isSubmitting = mutationStatus === "submitting";
  if (isPublic) {
    return (
      <button className="primary-command" disabled={isSubmitting} onClick={onShare} type="button">
        <Icon name="share" />
        <span>Share</span>
      </button>
    );
  }

  return (
    <button className="primary-command" disabled={isSubmitting} onClick={onPublish} type="button">
      {isSubmitting ? "Publishing" : "Publish card"}
    </button>
  );
}

function HomeCardTilt({ children, enabled }) {
  const [ready, setReady] = useState(
    () => Boolean(globalThis.customElements?.get("hover-tilt"))
  );

  useEffect(() => {
    let isCurrent = true;

    if (!enabled || ready) return () => { isCurrent = false; };

    import("hover-tilt/web-component").then(() => {
      if (isCurrent) setReady(true);
    }).catch(() => {
      if (isCurrent) setReady(false);
    });

    return () => { isCurrent = false; };
  }, [enabled, ready]);

  if (!enabled || !ready) {
    return (
      <div className="home-card-tilt" data-tilt-enabled="false">
        {children}
      </div>
    );
  }

  return (
    <hover-tilt
      blend-mode="screen"
      className="home-card-tilt"
      data-tilt-enabled="true"
      exit-delay="120"
      glare-hue="210"
      glare-intensity="0.15"
      scale-factor="1.018"
      tilt-factor="0.45"
      tilt-factor-y="0.35"
    >
      {children}
    </hover-tilt>
  );
}

function usePrefersReducedMotion() {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

function useMediaQuery(mediaQuery) {
  const [matches, setMatches] = useState(
    () => globalThis.matchMedia?.(mediaQuery).matches ?? false
  );

  useEffect(() => {
    const media = globalThis.matchMedia?.(mediaQuery);
    if (!media) return undefined;

    const handleChange = (event) => setMatches(event.matches);
    setMatches(media.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [mediaQuery]);

  return matches;
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
