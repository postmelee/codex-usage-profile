export function resolveProfileRoute(location, sampleSnapshot) {
  const pathname = normalizePathname(location.pathname);
  const searchParams = new URLSearchParams(location.search);
  const forcedState = searchParams.get("state");
  const sampleHandle = getSnapshotHandle(sampleSnapshot);

  if (forcedState === "loading") {
    return createState("loading", sampleHandle, sampleSnapshot);
  }

  if (forcedState === "empty") {
    return createState("empty", sampleHandle, null);
  }

  if (forcedState === "unavailable") {
    return createState("unavailable", sampleHandle, null);
  }

  if (pathname === "/") {
    return createState("ready", sampleHandle, sampleSnapshot);
  }

  const profileMatch = pathname.match(/^\/u\/([^/]+)$/);
  if (!profileMatch) {
    return createState("unavailable", sampleHandle, null);
  }

  const requestedHandle = decodeURIComponent(profileMatch[1]);
  if (!isSampleHandle(requestedHandle, sampleSnapshot)) {
    return createState("unavailable", requestedHandle, null);
  }

  return createState("ready", requestedHandle, sampleSnapshot);
}

function createState(status, handle, snapshot) {
  return {
    handle,
    snapshot,
    status
  };
}

function normalizePathname(pathname) {
  if (!pathname || pathname === "") {
    return "/";
  }

  return pathname.endsWith("/") && pathname !== "/"
    ? pathname.slice(0, -1)
    : pathname;
}

function getSnapshotHandle(snapshot) {
  return snapshot.profile.username ?? snapshot.profile.displayName ?? "profile";
}

function isSampleHandle(handle, snapshot) {
  return [
    snapshot.profile.username,
    snapshot.profile.displayName
  ].filter(Boolean).includes(handle);
}
