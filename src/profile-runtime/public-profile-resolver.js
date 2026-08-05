import { PROFILE_VISIBILITY } from "../profile-backend/store-values.js";
import { normalizeCardLocale } from "../profile-card/presentation.js";

export function createStorePublicProfileResolver(store) {
  if (
    !store ||
    typeof store.getOwnerByHandle !== "function" ||
    typeof store.getLatestUsageByOwnerId !== "function"
  ) {
    throw new TypeError("store must expose public profile lookups");
  }

  return async function resolvePublicProfileSummary(handle) {
    const owner = await store.getOwnerByHandle(handle);
    if (!owner || owner.visibility !== PROFILE_VISIBILITY.PUBLIC) return null;

    const usageRecord = await store.getLatestUsageByOwnerId(owner.id);
    if (
      !usageRecord ||
      usageRecord.visibility !== PROFILE_VISIBILITY.PUBLIC ||
      usageRecord.handle !== owner.handle
    ) {
      return null;
    }

    return {
      cardLocale: normalizeCardLocale(owner.cardLocale),
      handle: owner.handle,
      uploadedAt: usageRecord.uploadedAt
    };
  };
}
