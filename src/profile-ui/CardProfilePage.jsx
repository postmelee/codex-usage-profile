import { useCallback, useEffect, useRef, useState } from "react";

import { MarketingCardPreview } from "../profile-marketing/MarketingLanding.jsx";
import { AccountUsageProfile } from "./AccountUsageProfile.jsx";
import { CardStyleSettings } from "./CardStyleSettings.jsx";
import { ProfileShell } from "./ProfileShell.jsx";
import { ProfileLoadingSkeleton } from "./ProfileLoadingSkeleton.jsx";
import { ShareStudio } from "./ShareStudio.jsx";
import { Icon } from "./Icons.jsx";
import { useLocale } from "./LocaleProvider.jsx";
import {
  getAccountAvatar,
  getAccountDisplayName,
  getAccountLogin
} from "./accountUi.js";
import { buildProfileLoginHref } from "./cardShare.js";
import { useCardImageReadiness } from "./cardImageReadiness.js";
import { HOME_SUBMIT_COMMAND } from "./homeOnboarding.js";

export function CardProfilePage({ authState, client, onAuthStateChange }) {
  const { locale, t } = useLocale();
  const authStatus = authState?.status ?? "loading";
  const [profileState, setProfileState] = useState({
    error: null,
    profile: null,
    status: "loading"
  });
  const [mutationState, setMutationState] = useState({ error: null, status: "idle" });
  const [cardSettingsState, setCardSettingsState] = useState({
    draftLocale: "en",
    draftStyle: null,
    error: null,
    status: "idle"
  });
  const [previewRevision, setPreviewRevision] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSourceImage, setShareSourceImage] = useState(null);
  const shareSourceCardRef = useRef(null);
  const shareSourceRectRef = useRef(null);
  useEffect(() => {
    let isCurrent = true;

    if (authStatus !== "authenticated") {
      setProfileState({ error: null, profile: null, status: authStatus });
      return () => { isCurrent = false; };
    }

    setProfileState({ error: null, profile: null, status: "loading" });
    client.getOwnerProfile().then((profile) => {
      if (isCurrent) {
        setProfileState({ error: null, profile, status: "ready" });
        setCardSettingsState({
          draftLocale: profile.cardLocale ?? "en",
          draftStyle: profile.cardStyle,
          error: null,
          status: "idle"
        });
      }
    }).catch((error) => {
      if (isCurrent) {
        setProfileState({
          error: "profile.error.unavailable",
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
  const draftStyle = cardSettingsState.draftStyle ?? profile?.cardStyle;
  const draftLocale = cardSettingsState.draftLocale ?? profile?.cardLocale ?? "en";
  const cardSettingsDirty = Boolean(profile && draftStyle) && (
    draftLocale !== (profile.cardLocale ?? "en") ||
    JSON.stringify(draftStyle) !== JSON.stringify(profile.cardStyle)
  );
  const previewUrl = hasUsage
    ? client.buildOwnerCardPreviewUrl({
      locale: draftLocale,
      revision: previewRevision,
      theme: draftStyle?.theme ?? "dark"
    })
    : null;
  const cardImage = useCardImageReadiness({
    scopeKey: profile?.owner?.id ?? "owner-profile",
    sourceKind: "owner",
    src: previewUrl
  });
  const canShare = (
    profileState.status === "ready" &&
    hasUsage &&
    isPublic &&
    cardImage.ready
  );

  const closeShare = useCallback(() => {
    setShareOpen(false);
    setShareSourceImage(null);
    shareSourceRectRef.current = null;
  }, []);

  async function openShare() {
    const sourceImage = snapshotShareSourceImage({
      displaySrc: cardImage.displaySrc,
      scopeKey: profile?.owner?.id,
      sourceKind: cardImage.sourceKind,
      sourceUrl: cardImage.visibleSrc
    });
    const sourceRect = snapshotRect(
      shareSourceCardRef.current?.getBoundingClientRect()
    );
    if (!sourceImage) return;

    if (cardSettingsDirty) {
      const nextProfile = await saveCardSettings();
      if (!nextProfile) return;
    }

    shareSourceRectRef.current = sourceRect;
    setShareSourceImage(sourceImage);
    setShareOpen(true);
  }

  async function updateVisibility(visibility) {
    if (mutationState.status === "submitting") return;
    setMutationState({ error: null, status: "submitting" });

    try {
      const nextProfile = await client.updateProfileVisibility(visibility);
      setProfileState({ error: null, profile: nextProfile, status: "ready" });
      setPreviewRevision((value) => value + 1);
      setShareOpen(false);
      setShareSourceImage(null);
      shareSourceRectRef.current = null;
      setMutationState({ error: null, status: "idle" });
      if (authState?.account?.owner && nextProfile.owner) {
        onAuthStateChange?.({
          ...authState,
          account: { ...authState.account, owner: nextProfile.owner }
        });
      }
    } catch (error) {
      setMutationState({
        error: "home.updateFailed",
        status: "error"
      });
    }
  }

  function updateCardTheme(theme) {
    setCardSettingsState((current) => ({
      ...current,
      draftStyle: { ...current.draftStyle, theme },
      error: null,
      status: "idle"
    }));
  }

  function updateCardLocale(cardLocale) {
    setCardSettingsState((current) => ({
      ...current,
      draftLocale: cardLocale,
      error: null,
      status: "idle"
    }));
  }

  async function saveCardSettings() {
    if (!draftStyle || !cardSettingsDirty || cardSettingsState.status === "saving") {
      return null;
    }
    setCardSettingsState((current) => ({ ...current, error: null, status: "saving" }));
    try {
      const nextProfile = await client.updateCardSettings(draftStyle, draftLocale);
      setProfileState({ error: null, profile: nextProfile, status: "ready" });
      setCardSettingsState({
        draftLocale: nextProfile.cardLocale,
        draftStyle: nextProfile.cardStyle,
        error: null,
        status: "saved"
      });
      setPreviewRevision((value) => value + 1);
      return nextProfile;
    } catch {
      setCardSettingsState((current) => ({
        ...current,
        error: "profile.card.settings.error",
        status: "error"
      }));
      return null;
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
      title={t("common.nav.profile")}
    >
      <section className="card-profile-view" aria-labelledby="card-profile-title">
        <CardProfileContent
          authStatus={authStatus}
          cardImage={cardImage}
          cardSettingsDirty={cardSettingsDirty}
          cardSettingsState={cardSettingsState}
          client={client}
          hasUsage={hasUsage}
          isPublic={isPublic}
          mutationState={mutationState}
          onShare={openShare}
          onCardLocaleChange={updateCardLocale}
          onCardSettingsSave={saveCardSettings}
          onCardThemeChange={updateCardTheme}
          onVisibilityChange={updateVisibility}
          previewUrl={previewUrl}
          profile={profile}
          profileState={profileState}
          shareOpen={shareOpen}
          sourceCardRef={shareSourceCardRef}
        />
      </section>

      <ShareStudio
        cardLocale={profile?.cardLocale ?? "en"}
        cardTheme={profile?.cardStyle?.theme}
        locale={locale}
        locationOrigin={globalThis.location?.origin}
        makingPrivate={mutationState.status === "submitting"}
        onClose={closeShare}
        onMakePrivate={() => updateVisibility("private")}
        open={shareOpen && (canShare || Boolean(shareSourceImage))}
        ownerUpdatedAt={profile?.owner?.updatedAt}
        publicCardUrl={profile?.publicCardUrl}
        publicOwnerHandle={profile?.owner?.handle ?? authState?.account?.owner?.handle}
        selectedPublicCardUrl={profile?.selectedPublicCardUrl}
        shareRevision={profile?.shareRevision}
        sourceCardImage={shareSourceImage}
        sourceCardRef={shareSourceCardRef}
        sourceRect={shareSourceRectRef.current}
        usageUploadedAt={profile?.usage?.uploadedAt}
      />
    </ProfileShell>
  );
}

function CardProfileContent(props) {
  const { t } = useLocale();
  const { authStatus, profileState } = props;

  if (authStatus === "anonymous") {
    return (
      <ProfileMessage title={t("settings.state.anonymous.title")}>
        <a className="primary-command" href={buildProfileLoginHref(props.client)}>
          {t("account.loginWithGitHub")}
        </a>
      </ProfileMessage>
    );
  }
  if (authStatus === "loading" || profileState.status === "loading") {
    return (
      <ProfileLoadingSkeleton
        loadingLabel={t("profile.loading.title")}
        surface="owner"
        title={t("profile.loading.title")}
      />
    );
  }
  if (authStatus === "unavailable" || profileState.status === "error") {
    return (
      <ProfileMessage
        title={t("profile.error.unavailable")}
        message={profileState.error ? t(profileState.error) : null}
      />
    );
  }
  if (!props.hasUsage) {
    return <EmptyProfileState />;
  }

  return (
    <div className="card-profile-stage profile-content-reveal">
      <AccountUsageProfile
        headingId="card-profile-title"
        owner={props.profile.owner}
        usage={props.profile.usage}
      />

      <section className="profile-card-section" aria-labelledby="owner-card-title">
        <header className="card-profile-heading">
          <h2 id="owner-card-title">{t("profile.card.title")}</h2>
          <span className={`visibility-status is-${props.isPublic ? "public" : "private"}`}>
            {props.isPublic
              ? t("profile.visibility.public")
              : t("profile.visibility.private")}
          </span>
        </header>

        <div className="profile-card-preview-stage">
          <MarketingCardPreview
            alt={t("profile.card.alt.owner")}
            busy={props.cardImage.busy}
            cardTheme={props.cardSettingsState.draftStyle?.theme
              ?? props.profile.cardStyle?.theme
              ?? "dark"}
            cardRef={props.sourceCardRef}
            errorLabel={t("home.cardUnavailable")}
            sourceKind="owner"
            sourceUrl={props.cardImage.visibleSrc}
            src={props.cardImage.displaySrc}
            status={props.cardImage.status}
            transitionSuspended={props.shareOpen}
          />
          <ProfileCardAction
            cardReady={props.cardImage.ready}
            cardSettingsDirty={props.cardSettingsDirty}
            cardSettingsSaving={props.cardSettingsState.status === "saving"}
            isPublic={props.isPublic}
            mutationState={props.mutationState}
            onPublish={() => props.onVisibilityChange("public")}
            onShare={props.onShare}
            owner={props.profile.owner}
          />
        </div>

        <CardStyleSettings
          draftLocale={props.cardSettingsState.draftLocale}
          draftTheme={props.cardSettingsState.draftStyle?.theme ?? "dark"}
          error={props.cardSettingsState.error}
          isDirty={props.cardSettingsDirty}
          isSaving={props.cardSettingsState.status === "saving"}
          isSaved={props.cardSettingsState.status === "saved"}
          onLocaleChange={props.onCardLocaleChange}
          onSave={props.onCardSettingsSave}
          onThemeChange={props.onCardThemeChange}
        />
      </section>
    </div>
  );
}

function EmptyProfileState() {
  const { t } = useLocale();
  const [copyState, setCopyState] = useState("idle");

  async function handleCopyCommand() {
    try {
      if (!globalThis.navigator?.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await globalThis.navigator.clipboard.writeText(HOME_SUBMIT_COMMAND);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  return (
    <div className="card-profile-message card-profile-empty">
      <h1 id="card-profile-title">{t("profile.empty.title")}</h1>
      <p className="card-profile-empty-description">
        {t("profile.empty.description")}
      </p>

      <div className="card-profile-empty-command">
        <span className="home-command-label">{t("quickstart.runInTerminal")}</span>
        <div className="home-command-row">
          <code>{HOME_SUBMIT_COMMAND}</code>
          <button
            aria-label={t("quickstart.copyCommand")}
            className="icon-command home-command-copy"
            onClick={handleCopyCommand}
            title={t("quickstart.copyCommand")}
            type="button"
          >
            <Icon name="copy" />
          </button>
        </div>
        <p
          aria-live="polite"
          className={`home-copy-status is-${copyState}`}
          role="status"
        >
          {getEmptyProfileCopyStatus(copyState, t)}
        </p>
      </div>

      <div className="card-profile-empty-actions">
        <a className="secondary-command" href="/#quickstart">
          {t("profile.setup.viewGuide")}
        </a>
      </div>

      <p className="card-profile-empty-privacy">
        {t("profile.empty.privacy")}
      </p>
    </div>
  );
}

function ProfileMessage({ children, message, title }) {
  return (
    <div className="card-profile-message">
      <h1 id="card-profile-title">{title}</h1>
      {message ? <p>{message}</p> : null}
      {children}
    </div>
  );
}

function getEmptyProfileCopyStatus(status, t) {
  if (status === "copied") {
    return t("quickstart.commandCopied");
  }
  if (status === "error") {
    return t("quickstart.copyFailed");
  }
  return "";
}

function ProfileCardAction({
  cardReady,
  cardSettingsDirty,
  cardSettingsSaving,
  isPublic,
  mutationState,
  onPublish,
  onShare,
  owner
}) {
  const { locale, t } = useLocale();
  const avatar = getAccountAvatar(owner, locale);
  const displayName = getAccountDisplayName(owner, locale);
  const login = getAccountLogin(owner);
  const isSubmitting = mutationState.status === "submitting";

  return (
    <div className="home-account-state profile-card-account-state">
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
        <button
          aria-busy={cardSettingsSaving || !cardReady ? true : undefined}
          aria-label={isPublic
            ? cardSettingsSaving
              ? t("profile.card.settings.savingBeforeShare")
              : !cardReady
                ? t("home.loadingCard")
              : cardSettingsDirty
                ? t("profile.card.settings.saveAndShare")
                : t("common.shareProfile")
            : undefined}
          className="primary-command"
          disabled={isSubmitting || cardSettingsSaving || !cardReady}
          onClick={isPublic ? onShare : onPublish}
          type="button"
        >
          {isPublic
            ? cardSettingsSaving
              ? t("profile.card.settings.savingBeforeShare")
              : !cardReady
                ? t("home.loadingCard")
              : cardSettingsDirty
                ? t("profile.card.settings.saveAndShare")
                : t("common.share")
            : isSubmitting
              ? t("profile.card.publishing")
              : t("profile.card.publish")}
        </button>
        {mutationState.error ? (
          <p className="home-status is-error" role="status">
            {t(mutationState.error)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function snapshotRect(rect) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;

  return {
    height: rect.height,
    left: rect.left,
    top: rect.top,
    width: rect.width
  };
}

function snapshotShareSourceImage({ displaySrc, scopeKey, sourceKind, sourceUrl }) {
  if (
    typeof displaySrc !== "string" || displaySrc === "" ||
    typeof scopeKey !== "string" || scopeKey === "" ||
    typeof sourceKind !== "string" || sourceKind === "" ||
    typeof sourceUrl !== "string" || sourceUrl === ""
  ) {
    return null;
  }

  return Object.freeze({ displaySrc, scopeKey, sourceKind, sourceUrl });
}
