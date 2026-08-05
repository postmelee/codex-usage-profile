import { createHash } from "node:crypto";

import { normalizeVisibility } from "../profile-backend/accounts.js";
import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError
} from "../profile-backend/errors.js";
import { PROFILE_VISIBILITY } from "../profile-backend/store-values.js";
import { normalizeAccountUsageReadResult } from "./account-usage.js";
import {
  normalizeCardLocale,
  normalizeCardStyle,
  serializeCardStyle
} from "./presentation.js";
import {
  DEFAULT_CARD_THEME,
  normalizeCardTheme
} from "./theme.js";
import {
  buildCardViewModel,
  resolveCardLocale
} from "./view-model.js";

export const DEFAULT_PROFILE_CARD_RENDERER_VERSION = "codex-share-card-2";
export const DEFAULT_PROFILE_CARD_CACHE_ENTRIES = 32;
export const DEFAULT_PROFILE_CARD_AVATAR_TIMEOUT_MS = 3_000;
export const DEFAULT_PROFILE_CARD_AVATAR_MAX_BYTES = 2 * 1024 * 1024;

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
    cacheEntries = DEFAULT_PROFILE_CARD_CACHE_ENTRIES
  } = options;
  const ensureCardStyleMedia = options.ensureCardStyleMedia ?? (async () => {});
  const renderSocialPng = options.renderSocialPng ??
    (typeof renderPng?.renderSocial === "function"
      ? renderPng.renderSocial
      : null);

  if (!store) {
    throw new TypeError("store is required");
  }
  const pngCache = createLruCache(cacheEntries);
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

      let mediaPreparation = null;
      const presentationChanged = serializeCardStyle(current.cardStyle) !==
        serializeCardStyle(cardStyle);
      const localeChanged = resolveCardLocale(current.cardLocale) !== cardLocale;
      if (
        current.visibility === PROFILE_VISIBILITY.PUBLIC &&
        (presentationChanged || localeChanged)
      ) {
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
          updatedAt: nextOwnerRevisionTimestamp(current.updatedAt, now())
        });
      } catch (error) {
        if (typeof mediaPreparation?.rollback === "function") {
          await mediaPreparation.rollback();
        }
        throw error;
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
      const avatarSource = await loadOwnerAvatar(owner);
      const viewModel = buildCardViewModel({ locale, owner, theme, usage });
      const body = Buffer.from(
        await renderSocialPng(viewModel, { avatarSource, theme })
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
      if (typeof renderPng !== "function") {
        throw new TypeError("renderPng must be a function");
      }
      const avatarSource = await loadOwnerAvatar(renderOptions.owner);
      const viewModel = buildCardViewModel({
        locale,
        owner: renderOptions.owner,
        theme,
        usage
      });
      body = Buffer.from(await renderPng(viewModel, { avatarSource, theme }));
      pngCache.set(sourceDigest, body);
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

  async function loadOwnerAvatar(owner) {
    const avatarUrl = normalizeGitHubAvatarUrl(owner.avatarUrl);
    if (!avatarUrl || typeof fetchImpl !== "function") return null;

    const cacheKey = `${avatarUrl}|${owner.updatedAt ?? ""}`;
    if (avatarCache.has(cacheKey)) return avatarCache.get(cacheKey);

    let avatar = null;
    try {
      const response = await fetchImpl(avatarUrl, {
        redirect: "error",
        signal: AbortSignal.timeout(avatarTimeoutMs)
      });
      avatar = await readAvatarResponse(response, { maxBytes: avatarMaxBytes });
    } catch {
      avatar = null;
    }

    avatarCache.set(cacheKey, avatar);
    return avatar;
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
  if (!response?.ok) return null;
  const contentType = (response.headers.get("content-type") ?? "")
    .split(";", 1)[0].trim().toLowerCase();
  if (!ALLOWED_AVATAR_CONTENT_TYPES.has(contentType)) return null;

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > options.maxBytes) return null;
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > options.maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, byteLength);
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
