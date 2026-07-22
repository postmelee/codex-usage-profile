import { createHash } from "node:crypto";

import { createAccountService } from "../profile-backend/accounts.js";
import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError
} from "../profile-backend/errors.js";
import { PROFILE_VISIBILITY } from "../profile-backend/store.js";
import { normalizeAccountUsageReadResult } from "./account-usage.js";
import {
  CARD_RENDERER_VERSION,
  renderProfileCardPng
} from "./renderer.js";
import {
  buildCardViewModel,
  resolveCardLocale
} from "./view-model.js";

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

export function createProfileCardService(options = {}) {
  const {
    store,
    now = () => new Date(),
    fetchImpl = globalThis.fetch,
    renderPng = renderProfileCardPng,
    rendererVersion = CARD_RENDERER_VERSION,
    avatarTimeoutMs = DEFAULT_PROFILE_CARD_AVATAR_TIMEOUT_MS,
    avatarMaxBytes = DEFAULT_PROFILE_CARD_AVATAR_MAX_BYTES,
    cacheEntries = DEFAULT_PROFILE_CARD_CACHE_ENTRIES
  } = options;

  if (!store) {
    throw new TypeError("store is required");
  }
  if (typeof renderPng !== "function") {
    throw new TypeError("renderPng must be a function");
  }

  const accountService = options.accountService ?? createAccountService({ store, now });
  const pngCache = createLruCache(cacheEntries);
  const avatarCache = createLruCache(cacheEntries);

  return {
    async getOwnerProfile(profileOptions = {}) {
      const owner = await requireOwnerById(store, profileOptions.ownerId);
      const usageRecord = await store.getLatestUsageByOwnerId(owner.id);

      return { owner, usageRecord, visibility: owner.visibility };
    },

    updateVisibility(updateOptions = {}) {
      // Owner, latest usage and the legacy latest snapshot must expose one
      // visibility revision, so all writes commit together (or not at all).
      // The snapshot sync also keeps the legacy public snapshot route from
      // serving a record after the owner turns private.
      return store.transaction(async (tx) => {
        const owner = await accountService.updateVisibility({
          ownerId: updateOptions.ownerId,
          visibility: updateOptions.visibility,
          store: tx
        });
        const usageRecord = await tx.getLatestUsageByOwnerId(owner.id);
        const updatedUsageRecord = usageRecord
          ? await tx.saveLatestUsage({
            ...usageRecord,
            handle: owner.handle,
            visibility: owner.visibility
          })
          : null;
        const snapshotRecord = await tx.getLatestSnapshotByOwnerId(owner.id);
        if (snapshotRecord) {
          await tx.saveLatestSnapshot({
            ...snapshotRecord,
            handle: owner.handle,
            visibility: owner.visibility
          });
        }

        return { owner, usageRecord: updatedUsageRecord, visibility: owner.visibility };
      });
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
        includeBody: renderOptions.includeBody !== false,
        ifNoneMatch: renderOptions.ifNoneMatch
      });
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
        includeBody: renderOptions.includeBody !== false,
        ifNoneMatch: renderOptions.ifNoneMatch
      });
    }
  };

  async function renderCard(renderOptions) {
    const locale = resolveCardLocale(renderOptions.locale);
    const usage = normalizeAccountUsageReadResult(renderOptions.usageRecord.usage);
    const sourceDigest = createProfileCardSourceDigest({
      locale,
      owner: renderOptions.owner,
      rendererVersion,
      usage,
      usageRecord: renderOptions.usageRecord
    });

    let body = pngCache.get(sourceDigest);
    if (!body) {
      const avatarSource = await loadOwnerAvatar(renderOptions.owner);
      const viewModel = buildCardViewModel({
        locale,
        owner: renderOptions.owner,
        usage
      });
      body = Buffer.from(await renderPng(viewModel, { avatarSource }));
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
      sourceDigest
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

export function createProfileCardSourceDigest(options = {}) {
  const payload = JSON.stringify({
    rendererVersion: options.rendererVersion ?? CARD_RENDERER_VERSION,
    locale: resolveCardLocale(options.locale),
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
