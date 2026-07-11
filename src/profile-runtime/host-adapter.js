export const DEFAULT_API_PREFIX = "/api";

export function createProfileHostAdapter(options = {}) {
  const {
    apiHandler,
    apiPrefix = DEFAULT_API_PREFIX,
    frontendHandler = createNotFoundFrontendHandler()
  } = options;
  const normalizedApiPrefix = normalizeApiPrefix(apiPrefix);

  requireHandler(apiHandler, "apiHandler");
  requireHandler(frontendHandler, "frontendHandler");

  return async function handleProfileHostRequest(request) {
    const url = new URL(request.url);

    if (isProfileBackendRoutePath(url.pathname, normalizedApiPrefix)) {
      return apiHandler(request);
    }

    return frontendHandler(request);
  };
}

export function createNotFoundFrontendHandler(options = {}) {
  const body = options.body ?? "Not found";

  return function handleMissingFrontendRoute() {
    return new Response(body, {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8"
      }
    });
  };
}

export function isApiRoutePath(pathname, apiPrefix = DEFAULT_API_PREFIX) {
  const normalizedApiPrefix = normalizeApiPrefix(apiPrefix);
  const normalizedPathname = requirePathname(pathname);

  return normalizedPathname === normalizedApiPrefix ||
    normalizedPathname.startsWith(`${normalizedApiPrefix}/`);
}

export function isProfileBackendRoutePath(pathname, apiPrefix = DEFAULT_API_PREFIX) {
  return isApiRoutePath(pathname, apiPrefix) || isPublicCardRoutePath(pathname);
}

export function isPublicCardRoutePath(pathname) {
  const normalizedPathname = requirePathname(pathname);
  return /^\/u\/[^/]+\/card\.png$/.test(normalizedPathname);
}

export function normalizeApiPrefix(value = DEFAULT_API_PREFIX) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError("apiPrefix must be a non-empty string");
  }

  const prefix = value.trim();

  if (!prefix.startsWith("/")) {
    throw new TypeError("apiPrefix must start with /");
  }

  if (prefix === "/") {
    throw new TypeError("apiPrefix cannot be /");
  }

  return prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
}

function requireHandler(value, label) {
  if (typeof value !== "function") {
    throw new TypeError(`${label} must be a function`);
  }
}

function requirePathname(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError("pathname must be a non-empty string");
  }

  if (!value.startsWith("/")) {
    throw new TypeError("pathname must start with /");
  }

  return value;
}
