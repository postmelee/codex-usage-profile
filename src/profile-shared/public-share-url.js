const PUBLIC_SHARE_FIXED_PATH_RE = /^\/api\/share\/([^/]+)$/;
const PUBLIC_SHARE_REVISION_PATH_RE = /^\/api\/share\/([^/]+)\/r\/([^/]+)$/;
const PUBLIC_SHARE_REVISION_RE = /^(0|[1-9]\d*)$/;
const UNSUPPORTED_HANDLE_RE = new RegExp("[\\u0000-\\u001f\\u007f/?#]");

export function resolvePublicShareRevision(...values) {
  const candidates = values.filter(
    (value) => value !== undefined && value !== null
  );
  if (candidates.length === 0) {
    throw new TypeError("at least one revision timestamp is required");
  }

  const revisions = candidates.map((value) => {
    const revision = new Date(value).getTime();
    if (!Number.isSafeInteger(revision) || revision < 0) {
      throw new TypeError("revision timestamps must be valid non-negative dates");
    }
    return revision;
  });

  return Math.max(...revisions);
}

export function parsePublicShareRevision(value) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value !== "string" || !PUBLIC_SHARE_REVISION_RE.test(value)) {
    return null;
  }

  const revision = Number(value);
  return Number.isSafeInteger(revision) ? revision : null;
}

export function normalizePublicShareHandle(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError("handle must be a non-empty string");
  }

  const handle = value.trim();
  if (handle.length > 100 || UNSUPPORTED_HANDLE_RE.test(handle)) {
    throw new TypeError("handle contains unsupported characters");
  }

  return handle;
}

export function buildPublicSharePath(handle, revision) {
  const encodedHandle = encodeURIComponent(normalizePublicShareHandle(handle));
  if (revision === undefined || revision === null) {
    return `/api/share/${encodedHandle}`;
  }

  const normalizedRevision = parsePublicShareRevision(revision);
  if (normalizedRevision === null) {
    throw new TypeError("revision must be a canonical safe integer token");
  }
  return `/api/share/${encodedHandle}/r/${normalizedRevision}`;
}

export function buildPublicShareUrl(origin, handle, revision) {
  return new URL(
    buildPublicSharePath(handle, revision),
    normalizePublicShareOrigin(origin)
  ).toString();
}

export function parsePublicSharePath(pathname) {
  if (typeof pathname !== "string" || pathname === "") return null;

  const normalizedPath = pathname.endsWith("/") && pathname !== "/"
    ? pathname.slice(0, -1)
    : pathname;
  const revisionMatch = PUBLIC_SHARE_REVISION_PATH_RE.exec(normalizedPath);
  if (revisionMatch) {
    const handle = decodePublicShareHandle(revisionMatch[1]);
    const revision = parsePublicShareRevision(revisionMatch[2]);
    if (handle === null || revision === null) return null;
    return Object.freeze({ handle, revision, versioned: true });
  }

  const fixedMatch = PUBLIC_SHARE_FIXED_PATH_RE.exec(normalizedPath);
  if (!fixedMatch) return null;
  const handle = decodePublicShareHandle(fixedMatch[1]);
  if (handle === null) return null;
  return Object.freeze({ handle, revision: null, versioned: false });
}

function decodePublicShareHandle(value) {
  let handle;
  try {
    handle = decodeURIComponent(value);
  } catch {
    return null;
  }

  try {
    return normalizePublicShareHandle(handle);
  } catch {
    return null;
  }
}

function normalizePublicShareOrigin(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError("origin must be an absolute http or https URL");
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new TypeError("origin must be an absolute http or https URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError("origin must be an absolute http or https URL");
  }

  return url.origin;
}
