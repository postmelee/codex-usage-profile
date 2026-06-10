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
    return createState("loading", requestedHandle, null, { source: "api" });
  }

  return createState("ready", requestedHandle, sampleSnapshot);
}

export async function loadProfileRouteSnapshot(location, options = {}) {
  const { client, sampleSnapshot } = options;
  const route = resolveProfileRoute(location, sampleSnapshot);

  if (route.source !== "api") {
    return route;
  }

  if (!client || typeof client.getPublicSnapshot !== "function") {
    return createState("unavailable", route.handle, null, { source: "api" });
  }

  try {
    const record = await client.getPublicSnapshot(route.handle);

    if (!record?.snapshot) {
      return createState("unavailable", route.handle, null, { source: "api" });
    }

    return createState("ready", record.handle ?? route.handle, record.snapshot, {
      source: "api"
    });
  } catch {
    return createState("unavailable", route.handle, null, { source: "api" });
  }
}

function createState(status, handle, snapshot, options = {}) {
  return {
    handle,
    snapshot,
    source: options.source ?? "sample",
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
