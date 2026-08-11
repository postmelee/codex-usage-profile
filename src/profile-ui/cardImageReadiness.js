import { useEffect, useMemo, useRef, useState } from "react";

export const CARD_IMAGE_READINESS_STATUSES = Object.freeze({
  ERROR: "error",
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready"
});
export const DEFAULT_CARD_IMAGE_RESOURCE_CACHE_ENTRIES = 12;
export const DEFAULT_CARD_IMAGE_RESOURCE_CACHE_TTL_MS = 60_000;

const FALLBACK_ORIGIN = "https://codex-usage-profile.invalid";
const OWNER_CARD_SOURCE_KIND = "owner";
const sharedCardImageResourceCache = createCardImageResourceCache();

export function useCardImageReadiness({
  scopeKey = "default",
  sourceKind = "owner",
  src
} = {}) {
  const request = useMemo(
    () => createCardImageRequest({ sourceKind, src }),
    [sourceKind, src]
  );
  const generationRef = useRef(0);
  const [state, setState] = useState(() => createInitialState({
    request,
    scopeKey
  }));
  const requestKey = request ? `${request.sourceKind}\u0000${request.src}` : "";

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    let active = true;

    setState((current) => ({
      error: null,
      generation,
      requested: request,
      scopeKey,
      status: request
        ? CARD_IMAGE_READINESS_STATUSES.LOADING
        : CARD_IMAGE_READINESS_STATUSES.IDLE,
      visible: current.scopeKey === scopeKey ? current.visible : null
    }));

    if (!request) {
      return () => { active = false; };
    }

    acquireCardImageResource({
      ...request,
      scopeKey
    }).then((resource) => {
      if (
        generationRef.current !== generation ||
        !active
      ) {
        resource.release();
        return;
      }
      setState((current) => (
        current.generation === generation && current.scopeKey === scopeKey
          ? {
            ...current,
            error: null,
            status: CARD_IMAGE_READINESS_STATUSES.READY,
            visible: Object.freeze({ ...request, ...resource })
          }
          : releaseUnusedResource(resource, current)
      ));
    }).catch((error) => {
      if (isCardImageAbortError(error)) return;
      setState((current) => (
        current.generation === generation && current.scopeKey === scopeKey
          ? {
            ...current,
            error,
            status: CARD_IMAGE_READINESS_STATUSES.ERROR
          }
          : current
      ));
    });

    return () => { active = false; };
  }, [requestKey, scopeKey]);

  useEffect(() => {
    const resource = state.visible;
    return () => resource?.release?.();
  }, [state.visible]);

  const stateMatchesRequest = (
    state.scopeKey === scopeKey &&
    areCardImageRequestsEqual(state.requested, request)
  );
  const visible = state.scopeKey === scopeKey ? state.visible : null;
  const status = stateMatchesRequest
    ? state.status
    : request
      ? CARD_IMAGE_READINESS_STATUSES.LOADING
      : CARD_IMAGE_READINESS_STATUSES.IDLE;
  const ready = Boolean(
    status === CARD_IMAGE_READINESS_STATUSES.READY &&
    request &&
    areCardImageRequestsEqual(visible, request)
  );

  return Object.freeze({
    busy: status === CARD_IMAGE_READINESS_STATUSES.LOADING,
    desiredSrc: request?.src ?? null,
    displaySrc: visible?.displaySrc ?? null,
    error: stateMatchesRequest ? state.error : null,
    failed: status === CARD_IMAGE_READINESS_STATUSES.ERROR,
    ready,
    sourceKind: visible?.sourceKind ?? request?.sourceKind ?? null,
    status,
    visibleSrc: visible?.src ?? null
  });
}

export function acquireCardImageResource(request) {
  return sharedCardImageResourceCache.acquire(request);
}

export function clearCardImageResourceCache(options = {}) {
  return sharedCardImageResourceCache.clear(options);
}

export function createCardImageResourceCache(options = {}) {
  const maxEntries = normalizePositiveInteger(
    options.maxEntries,
    DEFAULT_CARD_IMAGE_RESOURCE_CACHE_ENTRIES
  );
  const ttlMs = normalizePositiveNumber(
    options.ttlMs,
    DEFAULT_CARD_IMAGE_RESOURCE_CACHE_TTL_MS
  );
  const now = options.now ?? Date.now;
  const loadResource = options.loadResource ?? loadCardImage;
  const entries = new Map();

  if (typeof now !== "function") {
    throw new TypeError("card image resource cache clock must be a function");
  }
  if (typeof loadResource !== "function") {
    throw new TypeError("card image resource loader must be a function");
  }

  return Object.freeze({
    acquire,
    clear,
    get size() { return entries.size; }
  });

  function acquire(value = {}) {
    const request = normalizeCardImageResourceRequest(value);
    const currentTime = readCacheTime(now);
    pruneExpired(currentTime);

    let entry = entries.get(request.cacheKey);
    if (!entry || entry.retired) {
      entry = createEntry(request, currentTime);
      entries.set(request.cacheKey, entry);
    } else {
      touchEntry(entry);
    }

    entry.waiters += 1;
    return entry.promise.then(() => {
      entry.waiters -= 1;
      if (entry.retired || !entry.resource) {
        disposeEntryIfUnused(entry);
        throw createCardImageAbortError();
      }
      entry.references += 1;
      entry.lastUsedAt = readCacheTime(now);
      touchEntry(entry);
      trimEntries();
      return createResourceLease(entry, request);
    }, (error) => {
      entry.waiters -= 1;
      disposeEntryIfUnused(entry);
      throw error;
    });
  }

  function clear(filter = {}) {
    const sourceKind = normalizeOptionalCacheFilter(filter.sourceKind);
    const scopeKey = normalizeOptionalCacheFilter(filter.scopeKey);
    let cleared = 0;

    for (const entry of [...entries.values()]) {
      if (sourceKind && entry.sourceKind !== sourceKind) continue;
      if (scopeKey && entry.scopeKey !== scopeKey) continue;
      retireEntry(entry, { abortPending: true });
      cleared += 1;
    }
    return cleared;
  }

  function createEntry(request, currentTime) {
    const controller = new AbortController();
    const entry = {
      cacheKey: request.cacheKey,
      controller,
      expiresAt: Number.POSITIVE_INFINITY,
      lastUsedAt: currentTime,
      pending: true,
      promise: null,
      references: 0,
      resource: null,
      retired: false,
      scopeKey: request.scopeKey,
      sourceKind: request.sourceKind,
      waiters: 0
    };

    entry.promise = Promise.resolve().then(() => loadResource(request.src, {
      signal: controller.signal
    })).then((resource) => {
      if (
        !resource ||
        typeof resource.displaySrc !== "string" ||
        typeof resource.release !== "function"
      ) {
        throw new TypeError("card image resource loader returned an invalid resource");
      }
      entry.pending = false;
      entry.resource = resource;
      entry.expiresAt = readCacheTime(now) + ttlMs;
      if (entry.retired) disposeEntryIfUnused(entry);
      trimEntries();
      return entry;
    }).catch((error) => {
      entry.pending = false;
      if (entries.get(entry.cacheKey) === entry) {
        entries.delete(entry.cacheKey);
      }
      entry.retired = true;
      disposeEntryIfUnused(entry);
      throw error;
    });

    return entry;
  }

  function createResourceLease(entry, request) {
    let released = false;
    return Object.freeze({
      displaySrc: entry.resource.displaySrc,
      sourceKind: request.sourceKind,
      src: request.src,
      release() {
        if (released) return;
        released = true;
        entry.references = Math.max(0, entry.references - 1);
        entry.lastUsedAt = readCacheTime(now);
        disposeEntryIfUnused(entry);
        trimEntries();
      }
    });
  }

  function pruneExpired(currentTime) {
    for (const entry of [...entries.values()]) {
      if (!entry.pending && entry.expiresAt <= currentTime) {
        retireEntry(entry);
      }
    }
  }

  function trimEntries() {
    if (entries.size <= maxEntries) return;
    for (const entry of [...entries.values()]) {
      if (entries.size <= maxEntries) break;
      if (entry.pending || entry.references > 0 || entry.waiters > 0) continue;
      retireEntry(entry);
    }
  }

  function touchEntry(entry) {
    if (entries.get(entry.cacheKey) !== entry) return;
    entries.delete(entry.cacheKey);
    entries.set(entry.cacheKey, entry);
  }

  function retireEntry(entry, options = {}) {
    if (entries.get(entry.cacheKey) === entry) {
      entries.delete(entry.cacheKey);
    }
    entry.retired = true;
    if (options.abortPending && entry.pending) entry.controller.abort();
    disposeEntryIfUnused(entry);
  }

  function disposeEntryIfUnused(entry) {
    if (
      !entry.retired || entry.pending ||
      entry.references > 0 || entry.waiters > 0 ||
      !entry.resource
    ) return;
    const resource = entry.resource;
    entry.resource = null;
    resource.release();
  }
}

export function createCardImageRequest({ sourceKind = "owner", src } = {}) {
  if (src === undefined || src === null || src === "") return null;
  if (typeof sourceKind !== "string" || sourceKind.trim() === "") {
    throw new TypeError("card image source kind must be a non-empty string");
  }

  return Object.freeze({
    sourceKind: sourceKind.trim(),
    src: normalizeCardImageUrl(src)
  });
}

export function loadCardImage(src, options = {}) {
  const normalizedSrc = normalizeCardImageUrl(src, options.baseOrigin);
  const signal = options.signal;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const createImage = options.createImage ?? createBrowserImage;
  const createObjectUrl = options.createObjectUrl ?? createBrowserObjectUrl;
  const revokeObjectUrl = options.revokeObjectUrl ?? revokeBrowserObjectUrl;

  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetchImpl must be a function");
  }
  if (typeof createImage !== "function") {
    throw new TypeError("createImage must be a function");
  }
  if (typeof createObjectUrl !== "function" || typeof revokeObjectUrl !== "function") {
    throw new TypeError("object URL functions must be available");
  }
  if (signal?.aborted) {
    return Promise.reject(createCardImageAbortError());
  }

  return fetchCardImageBlob(normalizedSrc, { fetchImpl, signal }).then((blob) => {
    const displaySrc = createObjectUrl(blob);

    return decodeCardImage(displaySrc, { createImage, signal }).then(() => (
      Object.freeze({
        displaySrc,
        release: createObjectUrlRelease(displaySrc, revokeObjectUrl)
      })
    )).catch((error) => {
      revokeObjectUrl(displaySrc);
      throw error;
    });
  });
}

async function fetchCardImageBlob(src, { fetchImpl, signal }) {
  let response;
  try {
    response = await fetchImpl(src, {
      credentials: "same-origin",
      signal
    });
  } catch (error) {
    throw normalizeCardImageError(error);
  }

  if (!response?.ok) {
    throw new Error("Card image failed to load");
  }
  const blob = await response.blob();
  if (blob.size <= 0 || blob.type.split(";", 1)[0].toLowerCase() !== "image/png") {
    throw new Error("Card image response must be a non-empty PNG");
  }
  return blob;
}

function decodeCardImage(displaySrc, { createImage, signal }) {
  return new Promise((resolve, reject) => {
    let image;
    let loadStarted = false;
    let settled = false;

    function finish(callback, value) {
      if (settled) return;
      settled = true;
      if (image) {
        image.onload = null;
        image.onerror = null;
      }
      signal?.removeEventListener?.("abort", handleAbort);
      callback(value);
    }

    function handleAbort() {
      finish(reject, createCardImageAbortError());
    }

    async function handleLoad() {
      if (loadStarted || settled) return;
      loadStarted = true;

      try {
        if (typeof image.decode === "function") {
          await image.decode();
        }
        if (!Number.isFinite(image.naturalWidth) || image.naturalWidth <= 0) {
          throw new Error("Card image decoded without pixels");
        }
        if (signal?.aborted) throw createCardImageAbortError();
        finish(resolve, displaySrc);
      } catch (error) {
        finish(reject, normalizeCardImageError(error));
      }
    }

    try {
      image = createImage();
      if (!image || typeof image !== "object") {
        throw new TypeError("createImage must return an image-like object");
      }
      image.onload = handleLoad;
      image.onerror = () => finish(
        reject,
        new Error("Card image failed to load")
      );
      signal?.addEventListener?.("abort", handleAbort, { once: true });
      image.src = displaySrc;
      if (image.complete === true) queueMicrotask(handleLoad);
    } catch (error) {
      finish(reject, normalizeCardImageError(error));
    }
  });
}

export function isCardImageAbortError(error) {
  return error?.name === "AbortError";
}

function createInitialState({ request, scopeKey }) {
  return {
    error: null,
    generation: 0,
    requested: request,
    scopeKey,
    status: request
      ? CARD_IMAGE_READINESS_STATUSES.LOADING
      : CARD_IMAGE_READINESS_STATUSES.IDLE,
    visible: null
  };
}

function releaseUnusedResource(resource, state) {
  resource.release();
  return state;
}

function areCardImageRequestsEqual(left, right) {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.sourceKind === right.sourceKind && left.src === right.src;
}

function normalizeCardImageResourceRequest(value) {
  const request = createCardImageRequest(value);
  if (!request) {
    throw new TypeError("card image resource request requires a source");
  }
  const scopeKey = request.sourceKind === OWNER_CARD_SOURCE_KIND
    ? normalizeOwnerScopeKey(value.scopeKey)
    : null;
  const cacheKey = request.sourceKind === OWNER_CARD_SOURCE_KIND
    ? `${OWNER_CARD_SOURCE_KIND}\u0000${scopeKey}\u0000${request.src}`
    : `public\u0000${request.src}`;

  return Object.freeze({
    ...request,
    cacheKey,
    scopeKey
  });
}

function normalizeOwnerScopeKey(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError("owner card image cache requires a non-empty scope key");
  }
  return value.trim();
}

function normalizeOptionalCacheFilter(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new TypeError("card image cache filter must be a string");
  }
  return value.trim() || null;
}

function normalizePositiveInteger(value, fallback) {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function normalizePositiveNumber(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readCacheTime(now) {
  const value = Number(now());
  if (!Number.isFinite(value)) {
    throw new TypeError("card image resource cache clock is invalid");
  }
  return value;
}

function normalizeCardImageUrl(value, baseOrigin) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError("card image src must be a non-empty same-origin URL");
  }

  const candidate = value.trim();
  if (
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    hasUnsafePathSegment(candidate)
  ) {
    throw new TypeError("card image src must be a safe same-origin URL");
  }

  const resolvedOrigin = resolveBaseOrigin(baseOrigin);
  let url;
  try {
    url = new URL(candidate, resolvedOrigin);
  } catch {
    throw new TypeError("card image src must be a safe same-origin URL");
  }

  if (
    url.origin !== resolvedOrigin ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new TypeError("card image src must be a safe same-origin URL");
  }

  return candidate;
}

function resolveBaseOrigin(value) {
  const candidate = value ?? globalThis.location?.origin ?? FALLBACK_ORIGIN;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new TypeError("card image base origin must be a valid origin");
  }
  return url.origin;
}

function hasUnsafePathSegment(candidate) {
  let pathname;
  try {
    pathname = new URL(candidate, FALLBACK_ORIGIN).pathname;
  } catch {
    return true;
  }

  return candidate.split(/[?#]/, 1)[0].split("/").some((segment) => {
    let decoded = segment;
    for (let pass = 0; pass < 3; pass += 1) {
      let next;
      try {
        next = decodeURIComponent(decoded);
      } catch {
        return true;
      }
      if (next === decoded) break;
      decoded = next;
    }
    return decoded === "." || decoded === "..";
  }) || pathname.split("/").some((segment) => segment === "." || segment === "..");
}

function createBrowserImage() {
  if (typeof globalThis.Image !== "function") {
    throw new TypeError("Image constructor is unavailable");
  }
  return new globalThis.Image();
}

function createBrowserObjectUrl(blob) {
  if (typeof globalThis.URL?.createObjectURL !== "function") {
    throw new TypeError("URL.createObjectURL is unavailable");
  }
  return globalThis.URL.createObjectURL(blob);
}

function revokeBrowserObjectUrl(value) {
  globalThis.URL?.revokeObjectURL?.(value);
}

function createObjectUrlRelease(value, revokeObjectUrl) {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    revokeObjectUrl(value);
  };
}

function createCardImageAbortError() {
  const error = new Error("Card image load was aborted");
  error.name = "AbortError";
  return error;
}

function normalizeCardImageError(error) {
  if (isCardImageAbortError(error)) return error;
  return error instanceof Error
    ? error
    : new Error("Card image failed to load");
}
