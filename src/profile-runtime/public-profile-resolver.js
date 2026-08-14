import { normalizeCardLocale } from "../profile-card/presentation.js";
import {
  PROFILE_MEDIA_STABLE_STATE_KINDS
} from "../profile-media/media-store-contract.js";

export function createStorePublicProfileResolver(store, options = {}) {
  if (
    !store ||
    typeof store.getPublicProfileSummaryByHandle !== "function"
  ) {
    throw new TypeError("store must expose a public profile summary lookup");
  }
  const mediaStore = options.mediaStore ?? null;
  if (
    mediaStore &&
    (
      typeof mediaStore.inspectStableCard !== "function" ||
      typeof mediaStore.getSocialCard !== "function"
    )
  ) {
    throw new TypeError(
      "mediaStore must expose published and social card lookups"
    );
  }

  return async function resolvePublicProfileSummary(handle) {
    const summary = await store.getPublicProfileSummaryByHandle(handle);
    if (!summary) return null;

    return {
      cardLocale: normalizeCardLocale(summary.cardLocale),
      handle: summary.handle,
      imageRevisionAt: latestRevisionAt(
        summary.ownerUpdatedAt,
        summary.uploadedAt
      ),
      socialImageAvailable: mediaStore
        ? await hasCoherentSocialImage(mediaStore, summary.handle)
        : true
    };
  };
}

async function hasCoherentSocialImage(mediaStore, handle) {
  try {
    const stable = await mediaStore.inspectStableCard({
      handle
    });
    if (stable.kind !== PROFILE_MEDIA_STABLE_STATE_KINDS.PUBLICATION) return false;
    const authority = stable.publication;

    const social = await mediaStore.getSocialCard({
      handle,
      includeBody: false
    });
    return Boolean(
      social &&
      typeof social.etag === "string" &&
      social.ownerId === authority.ownerId &&
      social.publicationId === authority.publicationId
    );
  } catch {
    return false;
  }
}

function latestRevisionAt(...values) {
  const times = values
    .filter((value) => value !== undefined && value !== null)
    .map((value) => new Date(value).getTime());
  if (times.length === 0 || times.some((time) => !Number.isFinite(time))) {
    throw new TypeError("public profile summary has an invalid revision date");
  }
  return new Date(Math.max(...times)).toISOString();
}
