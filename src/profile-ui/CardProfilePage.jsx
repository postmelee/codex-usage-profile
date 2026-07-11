import { useCallback, useEffect, useMemo, useState } from "react";

import { ProfileShell } from "./ProfileShell.jsx";
import { ShareDialog } from "./ShareDialog.jsx";
import { buildProfileLoginHref, resolveShareLocale } from "./cardShare.js";

export function CardProfilePage({ authState, client, onAuthStateChange }) {
  const authStatus = authState?.status ?? "loading";
  const [profileState, setProfileState] = useState({
    error: null,
    profile: null,
    status: "loading"
  });
  const [mutationState, setMutationState] = useState({ error: null, status: "idle" });
  const [previewRevision, setPreviewRevision] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const locale = useMemo(
    () => resolveShareLocale(globalThis.navigator?.language),
    []
  );

  useEffect(() => {
    let isCurrent = true;

    if (authStatus !== "authenticated") {
      setProfileState({ error: null, profile: null, status: authStatus });
      return () => { isCurrent = false; };
    }

    setProfileState({ error: null, profile: null, status: "loading" });
    client.getOwnerProfile().then((profile) => {
      if (isCurrent) setProfileState({ error: null, profile, status: "ready" });
    }).catch((error) => {
      if (isCurrent) {
        setProfileState({
          error: error instanceof Error ? error.message : "Profile unavailable",
          profile: null,
          status: "error"
        });
      }
    });

    return () => { isCurrent = false; };
  }, [authStatus, client]);

  const profile = profileState.profile;
  const hasUsage = Boolean(profile?.usage);
  const isPublic = profile?.visibility === "public";
  const canShare = profileState.status === "ready" && hasUsage && isPublic;
  const previewUrl = hasUsage
    ? client.buildOwnerCardPreviewUrl({ locale, revision: previewRevision })
    : null;

  const closeShare = useCallback(() => setShareOpen(false), []);

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
        error: error instanceof Error ? error.message : "Profile update failed",
        status: "error"
      });
    }
  }

  return (
    <ProfileShell
      authState={authState}
      client={client}
      onAuthStateChange={onAuthStateChange}
      onShare={() => setShareOpen(true)}
      shareDisabled={!canShare}
      title="Profile"
    >
      <section className="card-profile-view" aria-labelledby="card-profile-title">
        <CardProfileContent
          authStatus={authStatus}
          client={client}
          hasUsage={hasUsage}
          isPublic={isPublic}
          mutationState={mutationState}
          onVisibilityChange={updateVisibility}
          previewUrl={previewUrl}
          profile={profile}
          profileState={profileState}
        />
      </section>

      <ShareDialog
        locale={locale}
        onClose={closeShare}
        open={shareOpen && canShare}
        previewUrl={previewUrl}
        publicCardUrl={profile?.publicCardUrl}
      />
    </ProfileShell>
  );
}

function CardProfileContent(props) {
  const { authStatus, profileState } = props;

  if (authStatus === "anonymous") {
    return (
      <ProfileMessage title="Sign in required">
        <a className="primary-command" href={buildProfileLoginHref(props.client)}>
          Sign in with GitHub
        </a>
      </ProfileMessage>
    );
  }
  if (authStatus === "loading" || profileState.status === "loading") {
    return <ProfileMessage title="Loading profile" />;
  }
  if (authStatus === "unavailable" || profileState.status === "error") {
    return <ProfileMessage title="Profile unavailable" message={profileState.error} />;
  }
  if (!props.hasUsage) {
    return <ProfileMessage title="No usage submitted yet" />;
  }

  return (
    <div className="card-profile-stage">
      <header className="card-profile-heading">
        <div>
          <h2 id="card-profile-title">Your Codex card</h2>
          <span className={`visibility-status is-${props.isPublic ? "public" : "private"}`}>
            {props.isPublic ? "Public" : "Private"}
          </span>
        </div>
      </header>

      <img
        alt="Your Codex usage card"
        className="card-profile-preview"
        height="612"
        src={props.previewUrl}
        width="998"
      />

      <div className="card-profile-controls">
        <button
          className={props.isPublic ? "secondary-command" : "primary-command"}
          disabled={props.mutationState.status === "submitting"}
          onClick={() => props.onVisibilityChange(props.isPublic ? "private" : "public")}
          type="button"
        >
          {getVisibilityActionLabel(props.isPublic, props.mutationState.status)}
        </button>
      </div>
      {props.mutationState.error ? (
        <p className="card-profile-error">{props.mutationState.error}</p>
      ) : null}
    </div>
  );
}

function ProfileMessage({ children, message, title }) {
  return (
    <div className="card-profile-message">
      <h2 id="card-profile-title">{title}</h2>
      {message ? <p>{message}</p> : null}
      {children}
    </div>
  );
}

function getVisibilityActionLabel(isPublic, status) {
  if (status === "submitting") return isPublic ? "Making private" : "Publishing";
  return isPublic ? "Make private" : "Publish card";
}
