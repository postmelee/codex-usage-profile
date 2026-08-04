import { resolveLocale } from "./i18n.js";

export function resolveShareLocale(value) {
  return resolveLocale(value);
}

export function resolveShareTheme(value) {
  return value === "light" ? "light" : "dark";
}

export function buildLocalizedCardUrl(value, locale = "en", theme) {
  if (typeof value !== "string" || value.trim() === "") return null;

  const isAbsolute = /^[a-z][a-z\d+.-]*:/i.test(value);
  const url = new URL(value, "http://localhost");
  if (isAbsolute && url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  const normalizedLocale = resolveShareLocale(locale);
  const hasTheme = theme !== undefined || url.searchParams.has("theme");
  const normalizedTheme = resolveShareTheme(
    theme ?? url.searchParams.get("theme")
  );

  url.searchParams.delete("theme");
  url.searchParams.delete("locale");

  if (hasTheme) {
    url.searchParams.set("theme", normalizedTheme);
  }

  if (normalizedLocale === "ko") {
    url.searchParams.set("locale", "ko");
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
