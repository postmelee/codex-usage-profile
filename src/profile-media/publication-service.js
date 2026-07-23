import { randomBytes } from "node:crypto";

import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError,
  createProfileMediaUnavailableError
} from "../profile-backend/errors.js";
import { normalizeVisibility } from "../profile-backend/accounts.js";
import { PROFILE_VISIBILITY } from "../profile-backend/store.js";
import {
  PROFILE_MEDIA_STORE_ERROR_CODES,
  PROFILE_MEDIA_SUPPORTED_LOCALES,
  assertProfileMediaStoreContract,
  createProfileMediaStoreError
} from "./media-store-contract.js";

export function createProfilePublicationService(options = {}) {
  const store = requireStructuredStore(options.store);
  const mediaStore = assertProfileMediaStoreContract(options.mediaStore);
  const cardService = requireCardService(options.cardService);
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? defaultCreatePublicationId;

  return {
    updateVisibility(updateOptions = {}) {
      const visibility = normalizeVisibility(updateOptions.visibility);
      return visibility === PROFILE_VISIBILITY.PUBLIC
        ? publishOwnerCard({ ownerId: updateOptions.ownerId })
        : unpublishOwnerCard({ ownerId: updateOptions.ownerId });
    },

    publishOwnerCard,

    refreshPublishedCard(refreshOptions = {}) {
      return publishOwnerCard({
        ownerId: refreshOptions.ownerId,
        onlyIfAlreadyPublic: true
      });
    },

    unpublishOwnerCard
  };

  async function publishOwnerCard(publishOptions = {}) {
    const ownerId = requireOwnerId(publishOptions.ownerId);
    let mediaMutation = null;

    try {
      return await store.transaction(async (tx) => {
        const owner = await requireOwner(tx, ownerId);
        const usageRecord = await tx.getLatestUsageByOwnerId(owner.id);

        if (
          publishOptions.onlyIfAlreadyPublic === true &&
          owner.visibility !== PROFILE_VISIBILITY.PUBLIC
        ) {
          const profile = await synchronizeVisibilityRecords({
            now,
            owner,
            store: tx,
            usageRecord,
            visibility: PROFILE_VISIBILITY.PRIVATE
          });
          return {
            ...profile,
            idempotent: true,
            operation: "refresh_skipped",
            publication: null
          };
        }
        if (!usageRecord) throw ownerCardNotFoundError();

        const current = await inspectPublication(owner.handle);
        if (current.publication && current.publication.ownerId !== owner.id) {
          throw createProfileMediaStoreError(
            "conflict",
            "stable media handle belongs to another owner"
          );
        }

        const cards = {};
        for (const locale of PROFILE_MEDIA_SUPPORTED_LOCALES) {
          cards[locale] = await cardService.renderOwnerCard({
            ownerId: owner.id,
            locale
          });
        }

        const publicationMatches = owner.visibility === PROFILE_VISIBILITY.PUBLIC &&
          publicationMatchesCards(current.publication, owner, cards);
        let publication = current.publication;

        if (!publicationMatches) {
          const createdAt = toIsoString(now());
          await Promise.all(PROFILE_MEDIA_SUPPORTED_LOCALES.map((locale) => {
            const card = cards[locale];
            return mediaStore.putRevision({
              body: card.body,
              createdAt,
              etag: card.etag,
              locale,
              ownerId: owner.id,
              revision: card.revision
            });
          }));

          const publicationInput = {
            handle: owner.handle,
            ownerId: owner.id,
            publicationId: createId("profile_media"),
            publishedAt: toIsoString(now()),
            representations: Object.fromEntries(
              PROFILE_MEDIA_SUPPORTED_LOCALES.map((locale) => [locale, {
                etag: cards[locale].etag,
                revision: cards[locale].revision
              }])
            )
          };
          mediaMutation = {
            handle: owner.handle,
            previousPublication: owner.visibility === PROFILE_VISIBILITY.PUBLIC
              ? current.publication
              : null,
            type: "publish"
          };
          publication = await mediaStore.publishRevision(publicationInput);
        }

        const profile = await synchronizeVisibilityRecords({
          now,
          owner,
          store: tx,
          usageRecord,
          visibility: PROFILE_VISIBILITY.PUBLIC
        });
        return {
          ...profile,
          idempotent: publicationMatches,
          operation: publishOptions.onlyIfAlreadyPublic === true ? "refresh" : "publish",
          publication
        };
      });
    } catch (error) {
      throw await normalizePublicationFailure(error, mediaMutation);
    }
  }

  async function unpublishOwnerCard(unpublishOptions = {}) {
    const ownerId = requireOwnerId(unpublishOptions.ownerId);
    let mediaMutation = null;

    try {
      return await store.transaction(async (tx) => {
        const owner = await requireOwner(tx, ownerId);
        const usageRecord = await tx.getLatestUsageByOwnerId(owner.id);
        const current = await inspectPublication(owner.handle);
        if (current.publication && current.publication.ownerId !== owner.id) {
          throw createProfileMediaStoreError(
            "conflict",
            "stable media handle belongs to another owner"
          );
        }

        if (current.incomplete || current.publication) {
          mediaMutation = {
            handle: owner.handle,
            previousPublication: owner.visibility === PROFILE_VISIBILITY.PUBLIC
              ? current.publication
              : null,
            type: "unpublish"
          };
          await mediaStore.unpublishCard({ handle: owner.handle });
        }

        const profile = await synchronizeVisibilityRecords({
          now,
          owner,
          store: tx,
          usageRecord,
          visibility: PROFILE_VISIBILITY.PRIVATE
        });
        return {
          ...profile,
          idempotent: current.publication === null && !current.incomplete,
          operation: "unpublish",
          publication: null
        };
      });
    } catch (error) {
      throw await normalizePublicationFailure(error, mediaMutation);
    }
  }

  async function inspectPublication(handle) {
    try {
      return {
        incomplete: false,
        publication: await mediaStore.getPublishedCard({
          handle,
          includeBody: false
        })
      };
    } catch (error) {
      if (![
        PROFILE_MEDIA_STORE_ERROR_CODES.INVALID,
        PROFILE_MEDIA_STORE_ERROR_CODES.UNAVAILABLE
      ].includes(error?.code)) {
        throw error;
      }
      return { incomplete: true, publication: null };
    }
  }

  async function normalizePublicationFailure(error, mutation) {
    if (!mutation && error instanceof ProfileBackendError) return error;

    let compensation = "not_needed";
    if (mutation) compensation = await compensateMediaMutation(mutation);
    return createProfileMediaUnavailableError({
      details: {
        compensation,
        operation: mutation?.type ?? "media_operation"
      }
    });
  }

  async function compensateMediaMutation(mutation) {
    if (mutation.type === "unpublish") {
      // A successful stable delete is already fail-closed. If the structured
      // commit then rolls back, leave the public PNG missing so a retry can
      // converge the still-public owner to private without re-exposing media.
      return "not_needed";
    }

    try {
      if (mutation.previousPublication) {
        await mediaStore.publishRevision({
          handle: mutation.previousPublication.handle,
          ownerId: mutation.previousPublication.ownerId,
          publicationId: mutation.previousPublication.publicationId,
          publishedAt: mutation.previousPublication.publishedAt,
          representations: mutation.previousPublication.representations
        });
      } else {
        await mediaStore.unpublishCard({ handle: mutation.handle });
      }
      return "succeeded";
    } catch {
      return "failed";
    }
  }
}

async function synchronizeVisibilityRecords(options) {
  const visibility = options.visibility;
  let owner = options.owner;
  let usageRecord = options.usageRecord;

  if (owner.visibility !== visibility) {
    owner = await options.store.saveOwner({
      ...owner,
      updatedAt: toIsoString(options.now()),
      visibility
    });
  }
  if (
    usageRecord &&
    (usageRecord.visibility !== visibility || usageRecord.handle !== owner.handle)
  ) {
    usageRecord = await options.store.saveLatestUsage({
      ...usageRecord,
      handle: owner.handle,
      visibility
    });
  }

  const snapshotRecord = await options.store.getLatestSnapshotByOwnerId(owner.id);
  if (
    snapshotRecord &&
    (snapshotRecord.visibility !== visibility || snapshotRecord.handle !== owner.handle)
  ) {
    await options.store.saveLatestSnapshot({
      ...snapshotRecord,
      handle: owner.handle,
      visibility
    });
  }

  return { owner, usageRecord, visibility };
}

function publicationMatchesCards(publication, owner, cards) {
  return Boolean(
    publication &&
    publication.ownerId === owner.id &&
    publication.handle === owner.handle &&
    PROFILE_MEDIA_SUPPORTED_LOCALES.every((locale) => {
      const representation = publication.representations?.[locale];
      return representation?.revision === cards[locale].revision &&
        representation?.etag === cards[locale].etag;
    })
  );
}

async function requireOwner(store, ownerId) {
  const owner = await store.getOwnerById(ownerId);
  if (!owner) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
      "Owner not found"
    );
  }
  return owner;
}

function requireStructuredStore(store) {
  if (!store || typeof store.transaction !== "function") {
    throw new TypeError("structured store with transaction is required");
  }
  return store;
}

function requireCardService(cardService) {
  if (!cardService || typeof cardService.renderOwnerCard !== "function") {
    throw new TypeError("cardService with renderOwnerCard is required");
  }
  return cardService;
}

function requireOwnerId(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
      "ownerId is required"
    );
  }
  return value.trim();
}

function ownerCardNotFoundError() {
  return new ProfileBackendError(
    PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
    "Card not found"
  );
}

function defaultCreatePublicationId(prefix) {
  return `${prefix}_${randomBytes(12).toString("base64url")}`;
}

function toIsoString(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("expected a valid publication time");
  return date.toISOString();
}
