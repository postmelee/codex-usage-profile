export function getAccountOwner(authState) {
  return authState?.account?.owner ?? null;
}

export function getAccountStatus(authState) {
  const status = authState?.status ?? "loading";

  return {
    authenticated: {
      label: "Signed in",
      status
    },
    anonymous: {
      label: "Not signed in",
      status
    },
    loading: {
      label: "Checking account",
      status
    },
    unavailable: {
      label: "Account unavailable",
      status
    }
  }[status] ?? {
    label: "Account status unknown",
    status
  };
}

export function getAccountDisplayName(owner) {
  return normalizeText(owner?.displayName)
    ?? normalizeText(owner?.githubLogin)
    ?? normalizeText(owner?.handle)
    ?? "GitHub user";
}

export function getAccountLogin(owner) {
  return normalizeText(owner?.githubLogin)
    ?? normalizeText(owner?.handle)
    ?? null;
}

export function getAccountAvatar(owner) {
  const displayName = getAccountDisplayName(owner);
  const login = getAccountLogin(owner);
  const initialSource = login ?? displayName;

  return {
    alt: `${displayName} avatar`,
    initial: initialSource.slice(0, 1).toUpperCase() || "G",
    url: normalizeText(owner?.avatarUrl)
  };
}

export function getAccountMenuSummary(authState) {
  const owner = getAccountOwner(authState);
  const status = getAccountStatus(authState);

  return {
    avatar: getAccountAvatar(owner),
    displayName: owner ? getAccountDisplayName(owner) : status.label,
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

export function getAccountAuthError(location) {
  const search = typeof location?.search === "string" ? location.search : "";
  const params = new URLSearchParams(search);
  const code = params.get("auth_error");

  return {
    github_login_failed: {
      action: "Sign in with GitHub",
      code,
      message: "GitHub sign in could not be completed.",
      title: "Sign in failed"
    },
    github_oauth_not_configured: {
      action: null,
      code,
      message: "GitHub sign in is not configured for this environment.",
      title: "Sign in unavailable"
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
