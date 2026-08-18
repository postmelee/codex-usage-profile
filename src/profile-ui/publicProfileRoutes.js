import { isAccountUsageReadResult } from "../profile-card/account-usage.js";
import {
  parsePublicShareHandle,
  parsePublicSharePath,
  parsePublicShareRevision
} from "../profile-shared/public-share-url.js";

export function resolvePublicProfileRoute(location) {
  const pathname = normalizePathname(location?.pathname);
  const rootHandle = pathname === "/"
    ? new URLSearchParams(location?.search ?? "").get("profile")
    : null;
  const profileMatch = pathname.match(/^\/u\/([^/]+)$/);
  const sharePath = parsePublicSharePath(pathname);

  if (rootHandle === null && !profileMatch && !sharePath) {
    return createState("unavailable", null, null);
  }

  const handle = rootHandle === null
    ? sharePath?.handle ?? decodeHandle(profileMatch[1])
    : parsePublicShareHandle(rootHandle);
  if (!handle) {
    return createState("unavailable", null, null);
  }

  return createState("loading", handle, null);
}

export async function loadPublicProfileRoute(location, options = {}) {
  const route = resolvePublicProfileRoute(location);

  if (route.status !== "loading") {
    return route;
  }
  if (!options.client || typeof options.client.getPublicProfile !== "function") {
    return createState("unavailable", null, null);
  }

  try {
    const profile = await options.client.getPublicProfile(route.handle);
    if (!isPublicProfile(profile)) {
      return createUnavailableState(route.handle);
    }

    return createState("ready", profile.owner.handle, profile);
  } catch {
    return createUnavailableState(route.handle);
  }
}

// The requested handle comes from the URL, so keeping it on the unavailable
// state leaks nothing and lets the page recognise its own owner.
function createUnavailableState(handle) {
  return createState("unavailable", handle ?? null, null);
}

function createState(status, handle, profile) {
  return {
    handle,
    profile,
    source: "api",
    status
  };
}

function decodeHandle(value) {
  try {
    return parsePublicShareHandle(decodeURIComponent(value));
  } catch {
    return null;
  }
}

function isPublicProfile(profile) {
  return Boolean(
    profile &&
    profile.visibility === "public" &&
    (
      profile.shareRevision === undefined ||
      parsePublicShareRevision(profile.shareRevision) !== null
    ) &&
    isShareableCardUrl(profile.publicCardUrl) &&
    (
      profile.selectedPublicCardUrl === undefined ||
      isShareableCardUrl(profile.selectedPublicCardUrl)
    ) &&
    profile.owner &&
    typeof profile.owner.handle === "string" &&
    profile.owner.handle !== "" &&
    profile.usage &&
    isUtcTimestamp(profile.usage.capturedAt) &&
    isAccountUsageReadResult(profile.usage.usage)
  );
}

function isShareableCardUrl(value) {
  if (typeof value !== "string") return false;

  const url = value.trim();
  if (!url) return false;
  if (url.startsWith("/")) return true;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isUtcTimestamp(value) {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function normalizePathname(pathname) {
  if (!pathname || pathname === "") {
    return "/";
  }

  return pathname.endsWith("/") && pathname !== "/"
    ? pathname.slice(0, -1)
    : pathname;
}
