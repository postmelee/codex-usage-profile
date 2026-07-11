export function resolveShareLocale(value) {
  const locale = String(value ?? "en").trim().toLowerCase();
  return locale === "ko" || locale.startsWith("ko-") ? "ko" : "en";
}

export function buildLocalizedCardUrl(value, locale = "en") {
  if (typeof value !== "string" || value.trim() === "") return null;

  const isAbsolute = /^[a-z][a-z\d+.-]*:/i.test(value);
  const url = new URL(value, "http://localhost");
  const normalizedLocale = resolveShareLocale(locale);

  if (normalizedLocale === "ko") {
    url.searchParams.set("locale", "ko");
  } else {
    url.searchParams.delete("locale");
  }

  return isAbsolute ? url.toString() : `${url.pathname}${url.search}`;
}

export function buildReadmeCardSnippet(cardUrl) {
  if (!cardUrl) return null;
  return `![Codex usage profile](${cardUrl})`;
}

export function buildProfileLoginHref(client) {
  if (client && typeof client.buildGitHubLoginUrl === "function") {
    return client.buildGitHubLoginUrl({ redirectTo: "/profile" });
  }

  return "/api/auth/github/login?redirect_to=%2Fprofile";
}
