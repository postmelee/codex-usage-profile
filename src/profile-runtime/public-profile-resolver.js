import { normalizeCardLocale } from "../profile-card/presentation.js";

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
      typeof mediaStore.getPublishedCard !== "function" ||
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
    const authority = await mediaStore.getPublishedCard({
      handle,
      includeBody: false
    });
    if (!authority) return false;

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
