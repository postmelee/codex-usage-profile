export const APP_ROUTE_TYPES = Object.freeze({
  DEVICE: "device",
  PROFILE: "profile",
  SETTINGS: "settings"
});

export function resolveAppRoute(location) {
  const pathname = normalizeAppPathname(location?.pathname);

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

  return {
    pathname,
    type: APP_ROUTE_TYPES.PROFILE
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
