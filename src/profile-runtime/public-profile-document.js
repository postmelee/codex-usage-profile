import {
  buildProfileOpenGraphDocument,
  injectProfileOpenGraphHead
} from "./open-graph.js";

export const PUBLIC_PROFILE_DOCUMENT_CACHE_CONTROL =
  "public, max-age=0, s-maxage=60, must-revalidate";

const PUBLIC_PROFILE_DOCUMENT_HEADERS = Object.freeze({
  "cross-origin-opener-policy": "same-origin",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff"
});

const PUBLIC_PROFILE_DOCUMENT_METHODS = Object.freeze(["GET", "HEAD"]);
const PUBLIC_PROFILE_DOCUMENT_PATH_RE = /^\/u\/([^/]+)$/;

export function readPublicProfileDocumentHandle(pathname) {
  if (typeof pathname !== "string" || pathname === "") return null;

  const match = PUBLIC_PROFILE_DOCUMENT_PATH_RE.exec(
    pathname.endsWith("/") && pathname !== "/"
      ? pathname.slice(0, -1)
      : pathname
  );
  if (!match) return null;

  let handle;
  try {
    handle = decodeURIComponent(match[1]);
  } catch {
    return null;
  }

  const normalized = handle.trim();
  return normalized === "" ? null : normalized;
}

export function isPublicProfileDocumentRequest(request) {
  if (!request || typeof request.url !== "string") return false;
  if (!PUBLIC_PROFILE_DOCUMENT_METHODS.includes(
    String(request.method ?? "GET").toUpperCase()
  )) {
    return false;
  }

  return readPublicProfileDocumentHandle(new URL(request.url).pathname) !== null;
}

export function createPublicProfileDocumentHandler(options = {}) {
  const loadIndexHtml = requireFunction(options.loadIndexHtml, "loadIndexHtml");
  const resolveProfile = requireFunction(options.resolveProfile, "resolveProfile");
  const cacheControl = options.cacheControl ??
    PUBLIC_PROFILE_DOCUMENT_CACHE_CONTROL;
  const publicBaseUrl = options.publicBaseUrl ?? null;

  return async function handlePublicProfileDocument(request) {
    if (!isPublicProfileDocumentRequest(request)) return null;

    const url = new URL(request.url);
    const handle = readPublicProfileDocumentHandle(url.pathname);
    const origin = publicBaseUrl ?? url.origin;
    const profile = await resolveProfileSummary(resolveProfile, handle);

    let openGraphDocument;
    try {
      openGraphDocument = buildProfileOpenGraphDocument({
        handle,
        origin,
        profile,
        requestedLocale: url.searchParams.get("locale")
      });
    } catch {
      return null;
    }

    const html = await loadIndexHtml(request);
    if (typeof html !== "string" || html.trim() === "") return null;

    let document;
    try {
      document = injectProfileOpenGraphHead(html, openGraphDocument);
    } catch {
      return null;
    }

    const method = String(request.method ?? "GET").toUpperCase();
    return new Response(method === "HEAD" ? null : document, {
      status: 200,
      headers: {
        ...PUBLIC_PROFILE_DOCUMENT_HEADERS,
        "cache-control": cacheControl,
        "content-type": "text/html; charset=utf-8"
      }
    });
  };
}

async function resolveProfileSummary(resolveProfile, handle) {
  let profile;
  try {
    profile = await resolveProfile(handle);
  } catch {
    return null;
  }

  if (!profile || typeof profile !== "object") return null;
  if (typeof profile.handle !== "string" || profile.handle.trim() === "") {
    return null;
  }
  if (!Number.isFinite(new Date(profile.uploadedAt).getTime())) return null;

  return profile;
}

function requireFunction(value, label) {
  if (typeof value !== "function") {
    throw new TypeError(`${label} must be a function`);
  }
  return value;
}
