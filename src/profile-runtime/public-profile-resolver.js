import { normalizeCardLocale } from "../profile-card/presentation.js";

export function createStorePublicProfileResolver(store) {
  if (
    !store ||
    typeof store.getPublicProfileSummaryByHandle !== "function"
  ) {
    throw new TypeError("store must expose a public profile summary lookup");
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
      )
    };
  };
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
