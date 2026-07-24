export const APP_ROUTE_TYPES = Object.freeze({
  DEVICE: "device",
  HOME: "home",
  OWNER_PROFILE: "owner-profile",
  PUBLIC_PROFILE: "public-profile",
  SETTINGS: "settings"
});

export function resolveAppRoute(location) {
  const pathname = normalizeAppPathname(location?.pathname);
  const rootView = pathname === "/"
    ? new URLSearchParams(location?.search ?? "").get("view")
    : null;

  if (rootView === "settings") {
    return {
      pathname,
      type: APP_ROUTE_TYPES.SETTINGS
    };
  }

  if (pathname === "/device") {
    return {
      pathname,
      type: APP_ROUTE_TYPES.DEVICE
    };
  }

  if (pathname === "/settings") {
    return {
      pathname,
      type: APP_ROUTE_TYPES.SETTINGS
    };
  }

  if (pathname === "/") {
    return {
      pathname,
      type: APP_ROUTE_TYPES.HOME
    };
  }

  if (pathname === "/profile") {
    return {
      pathname,
      type: APP_ROUTE_TYPES.OWNER_PROFILE
    };
  }

  return {
    pathname,
    type: APP_ROUTE_TYPES.PUBLIC_PROFILE
  };
}

export function isDeviceApprovalRoute(location) {
  return resolveAppRoute(location).type === APP_ROUTE_TYPES.DEVICE;
}

export function isSettingsRoute(location) {
  return resolveAppRoute(location).type === APP_ROUTE_TYPES.SETTINGS;
}

function normalizeAppPathname(pathname) {
  if (!pathname || pathname === "") {
    return "/";
  }

  return pathname.endsWith("/") && pathname !== "/"
    ? pathname.slice(0, -1)
    : pathname;
}
