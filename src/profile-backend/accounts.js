import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError
} from "./errors.js";
import { normalizeGitHubIdentity } from "./auth.js";
import { PROFILE_VISIBILITY } from "./store.js";

const DEFAULT_HANDLE = "user";

export function createAccountService(options = {}) {
  const { store, now = () => new Date() } = options;

  if (!store) {
    throw new TypeError("store is required");
  }

  return {
    updateVisibility(updateOptions = {}) {
      const owner = store.getOwnerById(updateOptions.ownerId);
      if (!owner) {
        throw new ProfileBackendError(
          PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
          "Owner not found"
        );
      }

      return store.saveOwner({
        ...owner,
        visibility: normalizeVisibility(updateOptions.visibility),
        updatedAt: toIsoString(now())
      });
    },

    upsertGitHubOwner(identityPayload, upsertOptions = {}) {
      const identity = normalizeGitHubIdentity(identityPayload);
      const existingOwner = store.getOwnerByProviderIdentity(
        identity.authProvider,
        identity.providerUserId
      );
      const ownerId = existingOwner?.id ?? createOwnerId(identity);
      const handle = resolveOwnerHandle(store, {
        ownerId,
        existingHandle: existingOwner?.handle,
        requestedHandle: upsertOptions.handle,
        githubLogin: identity.githubLogin
      });
      const nowIso = toIsoString(now());
      const visibility = normalizeVisibility(
        upsertOptions.visibility ?? existingOwner?.visibility ?? PROFILE_VISIBILITY.PRIVATE
      );

      return store.saveOwner({
        ...existingOwner,
        id: ownerId,
        authProvider: identity.authProvider,
        providerUserId: identity.providerUserId,
        githubLogin: identity.githubLogin,
        displayName: identity.displayName,
        avatarUrl: identity.avatarUrl,
        profileUrl: identity.profileUrl,
        handle,
        visibility,
        createdAt: existingOwner?.createdAt ?? nowIso,
        updatedAt: nowIso
      });
    }
  };
}

export function createOwnerId(identity) {
  const authProvider = String(identity.authProvider || "provider");
  const providerUserId = String(identity.providerUserId || "user");
  const safeProvider = authProvider.replace(/[^a-z0-9_-]+/gi, "_");
  const safeUserId = providerUserId.replace(/[^a-z0-9_-]+/gi, "_");

  return `owner_${safeProvider}_${safeUserId}`;
}

export function resolveOwnerHandle(store, options) {
  const baseHandle = slugifyHandleCandidate(
    options.requestedHandle || options.existingHandle || options.githubLogin
  );

  return findAvailableHandle(store, baseHandle, options.ownerId);
}

export function slugifyHandleCandidate(value) {
  const slug = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || DEFAULT_HANDLE;
}

export function normalizeVisibility(value) {
  if (value === PROFILE_VISIBILITY.PRIVATE || value === PROFILE_VISIBILITY.PUBLIC) {
    return value;
  }

  throw new ProfileBackendError(
    PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
    "Owner visibility must be private or public"
  );
}

function findAvailableHandle(store, baseHandle, ownerId) {
  let handle = baseHandle;
  let suffix = 2;

  while (true) {
    const existingOwner = store.getOwnerByHandle(handle);
    if (!existingOwner || existingOwner.id === ownerId) {
      return handle;
    }

    handle = `${baseHandle}-${suffix}`;
    suffix += 1;
  }
}

function toIsoString(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
}
