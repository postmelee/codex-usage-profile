import {
  MARKETING_OPERATOR_CARD_HANDLE
} from "../profile-marketing/marketing-config.js";
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
const UNSUPPORTED_HANDLE_RE = new RegExp("[\\u0000-\\u001f\\u007f/?#]");

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

  return normalizePublicProfileDocumentHandle(handle);
}

export function readPublicProfileDocumentRequestHandle(request) {
  if (!request || typeof request.url !== "string") return null;

  const url = new URL(request.url);
  const pathHandle = readPublicProfileDocumentHandle(url.pathname);
  if (pathHandle !== null) return pathHandle;
  if (url.pathname !== "/") return null;

  const queryHandles = url.searchParams.getAll("profile");
  if (queryHandles.length !== 1) return null;
  return normalizePublicProfileDocumentHandle(queryHandles[0]);
}

export function isPublicProfileDocumentRequest(request) {
  if (!request || typeof request.url !== "string") return false;
  if (!PUBLIC_PROFILE_DOCUMENT_METHODS.includes(
    String(request.method ?? "GET").toUpperCase()
  )) {
    return false;
  }

  return readPublicProfileDocumentRequestHandle(request) !== null;
}

export function createPublicProfileDocumentHandler(options = {}) {
  const loadIndexHtml = requireFunction(options.loadIndexHtml, "loadIndexHtml");
  const resolveProfile = requireFunction(options.resolveProfile, "resolveProfile");
  const cacheControl = options.cacheControl ??
    PUBLIC_PROFILE_DOCUMENT_CACHE_CONTROL;
  const publicBaseUrl = options.publicBaseUrl ?? null;
  const fallbackImageHandle = Object.hasOwn(options, "fallbackImageHandle")
    ? options.fallbackImageHandle
    : MARKETING_OPERATOR_CARD_HANDLE;

  return async function handlePublicProfileDocument(request) {
    if (!isPublicProfileDocumentRequest(request)) return null;

    const url = new URL(request.url);
    const handle = readPublicProfileDocumentRequestHandle(request);
    const origin = publicBaseUrl ?? url.origin;
    const profile = await resolveProfileSummary(resolveProfile, handle);

    let openGraphDocument;
    try {
      openGraphDocument = buildProfileOpenGraphDocument({
        fallbackImageHandle,
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

function normalizePublicProfileDocumentHandle(value) {
  if (typeof value !== "string") return null;

  const handle = value.trim();
  if (
    handle === "" ||
    handle.length > 100 ||
    UNSUPPORTED_HANDLE_RE.test(handle)
  ) {
    return null;
  }

  return handle;
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
  const imageRevisionAt = profile.imageRevisionAt ?? profile.uploadedAt;
  if (!Number.isFinite(new Date(imageRevisionAt).getTime())) return null;

  return profile;
}

function requireFunction(value, label) {
  if (typeof value !== "function") {
    throw new TypeError(`${label} must be a function`);
  }
  return value;
}
