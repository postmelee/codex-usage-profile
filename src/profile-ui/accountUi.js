import { formatMessage } from "./i18n.js";

export function getAccountOwner(authState) {
  return authState?.account?.owner ?? null;
}

export function getAccountStatus(authState, locale = "en") {
  const status = authState?.status ?? "loading";

  return {
    authenticated: {
      label: formatMessage(locale, "account.status.authenticated"),
      status
    },
    anonymous: {
      label: formatMessage(locale, "account.status.anonymous"),
      status
    },
    loading: {
      label: formatMessage(locale, "account.status.loading"),
      status
    },
    unavailable: {
      label: formatMessage(locale, "account.status.unavailable"),
      status
    }
  }[status] ?? {
    label: formatMessage(locale, "account.status.unknown"),
    status
  };
}

export function getAccountDisplayName(owner, locale = "en") {
  return normalizeText(owner?.displayName)
    ?? normalizeText(owner?.githubLogin)
    ?? normalizeText(owner?.handle)
    ?? formatMessage(locale, "account.genericUser");
}

export function getAccountLogin(owner) {
  return normalizeText(owner?.githubLogin)
    ?? normalizeText(owner?.handle)
    ?? null;
}

export function getAccountAvatar(owner, locale = "en") {
  const displayName = getAccountDisplayName(owner, locale);
  const login = getAccountLogin(owner);
  const initialSource = login ?? displayName;

  return {
    alt: formatMessage(locale, "account.avatarAlt", { name: displayName }),
    initial: initialSource.slice(0, 1).toUpperCase() || "G",
    url: normalizeText(owner?.avatarUrl)
  };
}

export function getAccountMenuSummary(authState, locale = "en") {
  const owner = getAccountOwner(authState);
  const status = getAccountStatus(authState, locale);

  return {
    avatar: getAccountAvatar(owner, locale),
    displayName: owner ? getAccountDisplayName(owner, locale) : status.label,
    login: owner ? getAccountLogin(owner) : null,
    owner,
    status
  };
}

export function getAccountRedirectPath(location) {
  const pathname = normalizeText(location?.pathname) ?? "/";
  const search = normalizeText(location?.search) ?? "";

  return `${pathname}${search}`;
}

export function buildAccountLoginHref(client, location) {
  const redirectTo = getAccountRedirectPath(location);

  if (client && typeof client.buildGitHubLoginUrl === "function") {
    return client.buildGitHubLoginUrl({ redirectTo });
  }

  const params = new URLSearchParams();
  params.set("redirect_to", redirectTo);
  return `/api/auth/github/login?${params.toString()}`;
}

export function getAccountAuthError(location, locale = "en") {
  const search = typeof location?.search === "string" ? location.search : "";
  const params = new URLSearchParams(search);
  const code = params.get("auth_error");

  return {
    github_login_failed: {
      action: formatMessage(locale, "account.loginWithGitHub"),
      code,
      message: formatMessage(locale, "account.loginFailed.message"),
      title: formatMessage(locale, "account.loginFailed.title")
    },
    github_oauth_not_configured: {
      action: null,
      code,
      message: formatMessage(locale, "account.loginUnavailable.message"),
      title: formatMessage(locale, "account.loginUnavailable.label")
    }
  }[code] ?? null;
}

function normalizeText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
