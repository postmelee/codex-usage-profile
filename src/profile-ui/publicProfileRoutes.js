export function resolvePublicProfileRoute(location) {
  const pathname = normalizePathname(location?.pathname);
  const match = pathname.match(/^\/u\/([^/]+)$/);

  if (!match) {
    return createState("unavailable", null, null);
  }

  const handle = decodeHandle(match[1]);
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
      return createState("unavailable", null, null);
    }

    return createState("ready", profile.owner.handle, profile);
  } catch {
    return createState("unavailable", null, null);
  }
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
    const handle = decodeURIComponent(value).trim();
    return handle || null;
  } catch {
    return null;
  }
}

function isPublicProfile(profile) {
  return Boolean(
    profile &&
    profile.visibility === "public" &&
    typeof profile.publicCardUrl === "string" &&
    profile.publicCardUrl !== "" &&
    profile.owner &&
    typeof profile.owner.handle === "string" &&
    profile.owner.handle !== ""
  );
}

function normalizePathname(pathname) {
  if (!pathname || pathname === "") {
    return "/";
  }

  return pathname.endsWith("/") && pathname !== "/"
    ? pathname.slice(0, -1)
    : pathname;
}
