export const PROFILE_SITES_BACKEND_UNAVAILABLE_CODE =
  "sites_backend_unavailable";

const JSON_HEADERS = Object.freeze({
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8"
});

export function createProfileSitesBackendHandler(options = {}) {
  if (typeof options.backendHandler === "function") {
    return options.backendHandler;
  }

  return createUnavailableProfileSitesBackendHandler();
}

export function createUnavailableProfileSitesBackendHandler() {
  return function handleUnavailableProfileSitesBackend() {
    return new Response(JSON.stringify({
      error: {
        code: PROFILE_SITES_BACKEND_UNAVAILABLE_CODE,
        message: "Sites full-stack backend bindings are not configured"
      }
    }), {
      status: 503,
      headers: JSON_HEADERS
    });
  };
}
