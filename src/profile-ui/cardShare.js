import { resolveLocale } from "./i18n.js";
import { OWNER_PROFILE_HREF } from "./appRoutes.js";

export function resolveShareLocale(value) {
  return resolveLocale(value);
}

export function resolveShareTheme(value) {
  return value === "light" ? "light" : "dark";
}

export function buildCanonicalCardUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return null;

  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password
  ) {
    return null;
  }

  url.search = "";
  url.hash = "";
  return url.toString();
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

export function buildSameOriginCardPreviewUrl(
  value,
  locationOrigin,
  expectedHandle
) {
  if (
    typeof value !== "string" || value.trim() === "" ||
    typeof locationOrigin !== "string" || locationOrigin.trim() === ""
  ) {
    return null;
  }

  let origin;
  let url;
  try {
    origin = new URL(locationOrigin);
    url = new URL(value, origin);
  } catch {
    return null;
  }

  if (
    (origin.protocol !== "http:" && origin.protocol !== "https:") ||
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.hash
  ) {
    return null;
  }

  if (
    url.origin !== origin.origin &&
    !isExpectedPublicCardPath(url.pathname, expectedHandle)
  ) {
    return null;
  }

  return `${url.pathname}${url.search}`;
}

export function buildReadmeCardSnippet(cardUrl) {
  if (!cardUrl) return null;
  return `![Codex usage profile](${cardUrl})`;
}

export function buildProfileLoginHref(client) {
  if (client && typeof client.buildGitHubLoginUrl === "function") {
    return client.buildGitHubLoginUrl({ redirectTo: OWNER_PROFILE_HREF });
  }

  const params = new URLSearchParams({ redirect_to: OWNER_PROFILE_HREF });
  return `/api/auth/github/login?${params.toString()}`;
}

function isExpectedPublicCardPath(pathname, expectedHandle) {
  if (typeof expectedHandle !== "string" || expectedHandle.trim() === "") {
    return false;
  }

  const match = pathname.match(/^\/u\/([^/]+)\/card\.png$/);
  if (!match) return false;

  try {
    return decodeURIComponent(match[1]).toLowerCase()
      === expectedHandle.trim().toLowerCase();
  } catch {
    return false;
  }
}
