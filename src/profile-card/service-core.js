import { createHash } from "node:crypto";

import { normalizeVisibility } from "../profile-backend/accounts.js";
import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError,
  createProfileMediaUnavailableError
} from "../profile-backend/errors.js";
import { PROFILE_VISIBILITY } from "../profile-backend/store-values.js";
import { normalizeAccountUsageReadResult } from "./account-usage.js";
import {
  normalizeCardLocale,
  normalizeCardStyle
} from "./presentation.js";
import {
  DEFAULT_CARD_THEME,
  normalizeCardTheme
} from "./theme.js";
import {
  buildCardViewModel,
  resolveCardLocale
} from "./view-model.js";

export const DEFAULT_PROFILE_CARD_RENDERER_VERSION = "codex-share-card-3";
export const DEFAULT_PROFILE_CARD_CACHE_ENTRIES = 32;
export const DEFAULT_PROFILE_CARD_AVATAR_TIMEOUT_MS = 5_000;
export const DEFAULT_PROFILE_CARD_AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const DEFAULT_PROFILE_CARD_AVATAR_RETRY_COUNT = 1;
export const DEFAULT_PROFILE_CARD_AVATAR_CACHE_TTL_MS = 5 * 60 * 1_000;

const ALLOWED_AVATAR_HOST = "avatars.githubusercontent.com";
const ALLOWED_AVATAR_CONTENT_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

export function createProfileCardServiceCore(options = {}) {
  const {
    store,
    now = () => new Date(),
    fetchImpl = globalThis.fetch,
    renderPng,
    rendererVersion = DEFAULT_PROFILE_CARD_RENDERER_VERSION,
    avatarTimeoutMs = DEFAULT_PROFILE_CARD_AVATAR_TIMEOUT_MS,
    avatarMaxBytes = DEFAULT_PROFILE_CARD_AVATAR_MAX_BYTES,
    avatarRetryCount = DEFAULT_PROFILE_CARD_AVATAR_RETRY_COUNT,
    avatarCacheTtlMs = DEFAULT_PROFILE_CARD_AVATAR_CACHE_TTL_MS,
    cacheEntries = DEFAULT_PROFILE_CARD_CACHE_ENTRIES
  } = options;
  const observeAvatarLoadFailure = options.observeAvatarLoadFailure ?? null;
  const ensureCardStyleMedia = options.ensureCardStyleMedia ?? (async () => {});
  const renderSocialPng = options.renderSocialPng ??
    (typeof renderPng?.renderSocial === "function"
      ? renderPng.renderSocial
      : null);

  if (!store) {
    throw new TypeError("store is required");
  }
  if (
    observeAvatarLoadFailure !== null &&
    typeof observeAvatarLoadFailure !== "function"
  ) {
    throw new TypeError("observeAvatarLoadFailure must be a function");
  }
  const pngCache = createLruCache(cacheEntries);
  const pngInflight = new Map();
  const avatarCache = createLruCache(cacheEntries);

  return {
    async getOwnerProfile(profileOptions = {}) {
      const owner = await requireOwnerById(store, profileOptions.ownerId);
      const usageRecord = await store.getLatestUsageByOwnerId(owner.id);

      return { owner, usageRecord, visibility: owner.visibility };
    },

    async updateVisibility(updateOptions = {}) {
      // Owner, latest usage and the legacy latest snapshot must expose one
      // visibility revision, so all writes commit together (or not at all).
      // The snapshot sync also keeps the legacy public snapshot route from
      // serving a record after the owner turns private.
      const owner = await requireOwnerById(store, updateOptions.ownerId);
      return store.atomic.updateVisibility({
        ownerId: owner.id,
        expectedOwnerUpdatedAt: owner.updatedAt ?? null,
        visibility: normalizeVisibility(updateOptions.visibility),
        updatedAt: nextOwnerRevisionTimestamp(owner.updatedAt, now())
      });
    },

    async updateCardSettings(updateOptions = {}) {
      const current = await requireOwnerById(store, updateOptions.ownerId);
      const cardStyle = normalizeCardStyle(updateOptions.cardStyle, {
        defaultWhenMissing: false
      });
      const cardLocale = normalizeCardLocale(updateOptions.cardLocale, {
        defaultWhenMissing: false
      });
      const usageRecord = await store.getLatestUsageByOwnerId(current.id);
      const updatedAt = nextOwnerRevisionTimestamp(current.updatedAt, now());

      let mediaPreparation = null;
      if (current.visibility === PROFILE_VISIBILITY.PUBLIC) {
        // Exact retries intentionally prepare media even when settings match.
        // A prior request may have committed D1 before its authority write failed.
        mediaPreparation = await ensureCardStyleMedia({
          owner: current,
          usageRecord,
          cardLocale,
          cardStyle
        });
      }

      let result;
      try {
        result = await store.atomic.updateCardSettings({
          ownerId: current.id,
          expectedOwnerUpdatedAt: current.updatedAt ?? null,
          cardLocale,
          cardStyle,
          updatedAt
        });
      } catch (error) {
        if (typeof mediaPreparation?.rollback === "function") {
          await mediaPreparation.rollback();
        }
        throw error;
      }
      if (typeof mediaPreparation?.commit === "function") {
        const mediaStatus = await mediaPreparation.commit({ owner: result.owner });
        if (mediaStatus === "superseded") {
          throw createProfileMediaUnavailableError({
            details: {
              operation: "commit_card_settings_media",
              reason: "superseded"
            }
          });
        }
      }
      return {
        owner: result.owner,
        usageRecord,
        visibility: result.owner.visibility
      };
    },

    async getPublicProfile(profileOptions = {}) {
      return requirePublicProfile(store, profileOptions.handle);
    },

    async renderOwnerCard(renderOptions = {}) {
      const owner = await requireOwnerById(store, renderOptions.ownerId);
      const usageRecord = await requireUsageByOwnerId(store, owner.id);

      return renderCard({
        owner,
        usageRecord,
        locale: renderOptions.locale,
        theme: renderOptions.theme,
        includeBody: renderOptions.includeBody !== false,
        ifNoneMatch: renderOptions.ifNoneMatch
      });
    },

    supportsSocialCard() {
      return typeof renderSocialPng === "function";
    },

    async renderOwnerSocialCard(renderOptions = {}) {
      if (typeof renderSocialPng !== "function") {
        throw new TypeError("renderSocialPng must be a function");
      }

      const owner = await requireOwnerById(store, renderOptions.ownerId);
      const usageRecord = await requireUsageByOwnerId(store, owner.id);
      const locale = resolveCardLocale(renderOptions.locale);
      const theme = normalizeCardTheme(renderOptions.theme);
      const usage = normalizeAccountUsageReadResult(usageRecord.usage);
      const avatar = await loadOwnerAvatar(owner);
      const viewModel = buildCardViewModel({ locale, owner, theme, usage });
      const body = Buffer.from(
        await renderSocialPng(viewModel, { avatarSource: avatar.source, theme })
      );

      return {
        body,
        etag: createProfileCardEtag(body),
        locale,
        revision: createProfileCardRevision(body),
        theme
      };
    },

    async renderPublicCard(renderOptions = {}) {
      const { owner, usageRecord } = await requirePublicProfile(
        store,
        renderOptions.handle
      );

      return renderCard({
        owner,
        usageRecord,
        locale: renderOptions.locale,
        theme: DEFAULT_CARD_THEME,
        includeBody: renderOptions.includeBody !== false,
        ifNoneMatch: renderOptions.ifNoneMatch
      });
    }
  };

  async function renderCard(renderOptions) {
    const locale = resolveCardLocale(renderOptions.locale);
    const theme = normalizeCardTheme(renderOptions.theme);
    const usage = normalizeAccountUsageReadResult(renderOptions.usageRecord.usage);
    const sourceDigest = createProfileCardSourceDigest({
      locale,
      owner: renderOptions.owner,
      rendererVersion,
      theme,
      usage,
      usageRecord: renderOptions.usageRecord
    });

    let body = pngCache.get(sourceDigest);
    if (!body) {
      let pending = pngInflight.get(sourceDigest);
      if (!pending) {
        pending = renderCardBody({
          locale,
          owner: renderOptions.owner,
          theme,
          usage
        });
        pngInflight.set(sourceDigest, pending);
      }
      try {
        const rendered = await pending;
        body = rendered.body;
        if (rendered.cacheable) pngCache.set(sourceDigest, body);
      } finally {
        if (pngInflight.get(sourceDigest) === pending) {
          pngInflight.delete(sourceDigest);
        }
      }
    }

    const revision = createProfileCardRevision(body);
    const etag = createProfileCardEtag(body);
    const notModified = matchesIfNoneMatch(renderOptions.ifNoneMatch, etag);
    const includeBody = renderOptions.includeBody && !notModified;

    return {
      body: includeBody ? Buffer.from(body) : null,
      etag,
      locale,
      notModified,
      revision,
      sourceDigest,
      theme
    };
  }

  async function renderCardBody({ locale, owner, theme, usage }) {
    if (typeof renderPng !== "function") {
      throw new TypeError("renderPng must be a function");
    }
    const avatar = await loadOwnerAvatar(owner);
    const viewModel = buildCardViewModel({ locale, owner, theme, usage });
    return Object.freeze({
      body: Buffer.from(await renderPng(viewModel, {
        avatarSource: avatar.source,
        theme
      })),
      cacheable: avatar.cacheable
    });
  }

  async function loadOwnerAvatar(owner) {
    const avatarUrl = normalizeGitHubAvatarUrl(owner.avatarUrl);
    if (!avatarUrl || typeof fetchImpl !== "function") {
      return Object.freeze({ cacheable: true, source: null });
    }

    const cached = avatarCache.get(avatarUrl);
    const currentTime = normalizeServiceDate(now()).getTime();
    if (cached && cached.expiresAt > currentTime) {
      return Object.freeze({ cacheable: true, source: cached.source });
    }
    if (cached) avatarCache.delete(avatarUrl);

    const retryCount = normalizeAvatarRetryCount(avatarRetryCount);
    const attemptCount = retryCount + 1;
    const attemptTimeoutMs = normalizeAvatarAttemptTimeout(
      avatarTimeoutMs,
      attemptCount
    );

    for (let attempt = 1; attempt <= attemptCount; attempt += 1) {
      try {
        const response = await fetchImpl(avatarUrl, {
          redirect: "manual",
          signal: AbortSignal.timeout(attemptTimeoutMs)
        });
        const source = await readAvatarResponse(response, {
          maxBytes: avatarMaxBytes
        });
        avatarCache.set(avatarUrl, Object.freeze({
          expiresAt: currentTime + normalizeAvatarCacheTtl(avatarCacheTtlMs),
          source
        }));
        return Object.freeze({ cacheable: true, source });
      } catch (error) {
        const failure = normalizeAvatarLoadFailure(error);
        const retrying = failure.retryable && attempt < attemptCount;
        notifyAvatarLoadFailure(observeAvatarLoadFailure, {
          attempt,
          errorCode: failure.code,
          retrying
        });
        if (!retrying) break;
      }
    }

    return Object.freeze({ cacheable: false, source: null });
  }
}

function normalizeServiceDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Expected a valid date");
  }
  return date;
}

function nextOwnerRevisionTimestamp(currentValue, nextValue) {
  const next = normalizeServiceDate(nextValue);
  if (currentValue === undefined || currentValue === null) {
    return next.toISOString();
  }

  const current = normalizeServiceDate(currentValue);
  return new Date(Math.max(
    next.getTime(),
    current.getTime() + 1
  )).toISOString();
}

export function createProfileCardSourceDigest(options = {}) {
  const theme = normalizeCardTheme(options.theme);
  const payload = JSON.stringify({
    rendererVersion: options.rendererVersion ??
      DEFAULT_PROFILE_CARD_RENDERER_VERSION,
    locale: resolveCardLocale(options.locale),
    ...(theme === DEFAULT_CARD_THEME ? {} : { theme }),
    owner: {
      id: options.owner?.id ?? null,
      handle: options.owner?.handle ?? null,
      displayName: options.owner?.displayName ?? null,
      githubLogin: options.owner?.githubLogin ?? null,
      avatarUrl: options.owner?.avatarUrl ?? null,
      updatedAt: options.owner?.updatedAt ?? null
    },
    usageRecord: {
      capturedAt: options.usageRecord?.capturedAt ?? null,
      uploadedAt: options.usageRecord?.uploadedAt ?? null,
      usage: options.usage
    }
  });
  return createHash("sha256").update(payload).digest("base64url");
}

export function createProfileCardRevision(body) {
  if (!Buffer.isBuffer(body) && !(body instanceof Uint8Array)) {
    throw new TypeError("profile card body must be a Buffer or Uint8Array");
  }
  if (body.byteLength === 0) {
    throw new TypeError("profile card body must not be empty");
  }
  return createHash("sha256").update(body).digest("base64url");
}

export function createProfileCardEtag(body) {
  return `"${createProfileCardRevision(body)}"`;
}

export function normalizeGitHubAvatarUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return null;

  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== ALLOWED_AVATAR_HOST ||
      url.username || url.password || url.port
    ) return null;

    return url.toString();
  } catch {
    return null;
  }
}

async function requireOwnerById(store, ownerId) {
  const owner = await store.getOwnerById(ownerId);
  if (!owner) throw cardNotFoundError();
  return owner;
}

async function requireUsageByOwnerId(store, ownerId) {
  const usageRecord = await store.getLatestUsageByOwnerId(ownerId);
  if (!usageRecord) throw cardNotFoundError();
  return usageRecord;
}

async function requirePublicProfile(store, value) {
  const handle = normalizePublicHandle(value);
  const owner = handle ? await store.getOwnerByHandle(handle) : null;
  const usageRecord = owner ? await store.getLatestUsageByOwnerId(owner.id) : null;

  if (
    !owner || !usageRecord ||
    owner.visibility !== PROFILE_VISIBILITY.PUBLIC ||
    usageRecord.visibility !== PROFILE_VISIBILITY.PUBLIC ||
    usageRecord.handle !== owner.handle
  ) {
    throw cardNotFoundError();
  }

  return { owner, usageRecord, visibility: PROFILE_VISIBILITY.PUBLIC };
}

function normalizePublicHandle(value) {
  if (typeof value !== "string") return null;
  const handle = value.trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle) ? handle : null;
}

function matchesIfNoneMatch(value, etag) {
  if (typeof value !== "string") return false;
  return value.split(",").some((candidate) => {
    const normalized = candidate.trim();
    return normalized === "*" || normalized === etag;
  });
}

async function readAvatarResponse(response, options) {
  if (!response?.ok) {
    const status = Number(response?.status);
    const retryable = status === 408 || status === 425 || status === 429 ||
      (Number.isFinite(status) && status >= 500 && status <= 599);
    await cancelAvatarResponseBody(response);
    throw createAvatarLoadError(
      retryable ? "avatar_http_unavailable" : "avatar_http_rejected",
      retryable
    );
  }
  const contentType = (response.headers.get("content-type") ?? "")
    .split(";", 1)[0].trim().toLowerCase();
  if (!ALLOWED_AVATAR_CONTENT_TYPES.has(contentType)) {
    await cancelAvatarResponseBody(response);
    throw createAvatarLoadError("avatar_content_type_invalid");
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > options.maxBytes) {
    await cancelAvatarResponseBody(response);
    throw createAvatarLoadError("avatar_too_large");
  }
  if (!response.body) {
    throw createAvatarLoadError("avatar_body_invalid");
  }

  const reader = response.body.getReader();
  const chunks = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > options.maxBytes) {
      await reader.cancel();
      throw createAvatarLoadError("avatar_too_large");
    }
    chunks.push(Buffer.from(value));
  }
  if (byteLength === 0) {
    throw createAvatarLoadError("avatar_body_invalid");
  }
  return Buffer.concat(chunks, byteLength);
}

async function cancelAvatarResponseBody(response) {
  try {
    await response?.body?.cancel?.();
  } catch {
    // Response validation already failed; cancellation is best-effort only.
  }
}

function normalizeAvatarRetryCount(value) {
  return Number.isSafeInteger(value) && value >= 0
    ? Math.min(value, DEFAULT_PROFILE_CARD_AVATAR_RETRY_COUNT)
    : DEFAULT_PROFILE_CARD_AVATAR_RETRY_COUNT;
}

function normalizeAvatarAttemptTimeout(value, attemptCount) {
  const total = Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_PROFILE_CARD_AVATAR_TIMEOUT_MS;
  return Math.max(1, Math.ceil(total / attemptCount));
}

function normalizeAvatarCacheTtl(value) {
  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_PROFILE_CARD_AVATAR_CACHE_TTL_MS;
}

function createAvatarLoadError(code, retryable = false) {
  const error = new Error("Profile card avatar is unavailable");
  error.code = code;
  error.retryable = retryable;
  return error;
}

function normalizeAvatarLoadFailure(error) {
  if (
    typeof error?.code === "string" &&
    /^avatar_[a-z0-9_]+$/.test(error.code)
  ) {
    return Object.freeze({
      code: error.code,
      retryable: error.retryable === true
    });
  }
  if (error?.name === "AbortError" || error?.name === "TimeoutError") {
    return Object.freeze({ code: "avatar_timeout", retryable: true });
  }
  return Object.freeze({
    code: "avatar_fetch_unavailable",
    retryable: true
  });
}

function notifyAvatarLoadFailure(observer, value) {
  if (typeof observer !== "function") return;
  const event = Object.freeze({
    errorCode: value.errorCode,
    attempt: value.attempt,
    retrying: value.retrying === true
  });
  try {
    observer(event);
  } catch {
    // Avatar logging must never affect card rendering or expose its failure.
  }
}

function createLruCache(maxEntries) {
  const entries = new Map();
  const limit = Number.isSafeInteger(maxEntries) && maxEntries > 0
    ? maxEntries
    : DEFAULT_PROFILE_CARD_CACHE_ENTRIES;
  return {
    get(key) {
      if (!entries.has(key)) return null;
      const value = entries.get(key);
      entries.delete(key);
      entries.set(key, value);
      return value;
    },
    has(key) { return entries.has(key); },
    delete(key) { return entries.delete(key); },
    set(key, value) {
      if (entries.has(key)) entries.delete(key);
      entries.set(key, value);
      if (entries.size > limit) entries.delete(entries.keys().next().value);
    }
  };
}

function cardNotFoundError() {
  return new ProfileBackendError(
    PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
    "Card not found"
  );
}
