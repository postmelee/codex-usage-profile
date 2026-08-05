import { randomBytes } from "node:crypto";

import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError,
  createProfileMediaUnavailableError
} from "../profile-backend/errors.js";
import { normalizeVisibility } from "../profile-backend/accounts.js";
import { PROFILE_VISIBILITY } from "../profile-backend/store-values.js";
import {
  createPresentationDigest,
  normalizeCardStyle
} from "../profile-card/presentation.js";
import {
  PROFILE_MEDIA_CONTENT_TYPE,
  PROFILE_MEDIA_FORMAT,
  PROFILE_MEDIA_LEGACY_CONTRACT_VERSION,
  PROFILE_MEDIA_STORE_CONTRACT_VERSION,
  PROFILE_MEDIA_STABLE_STATE_KINDS,
  PROFILE_MEDIA_STORE_ERROR_CODES,
  PROFILE_MEDIA_SUPPORTED_LOCALES,
  PROFILE_MEDIA_SUPPORTED_THEMES,
  assertProfileMediaStoreContract,
  createProfileMediaStoreError,
  supportsProfileMediaSocialCard
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

    ensurePublishedCardVariants,

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
      const owner = await requireOwner(store, ownerId);
      const usageRecord = await store.getLatestUsageByOwnerId(owner.id);
      if (
        publishOptions.onlyIfAlreadyPublic === true &&
        owner.visibility !== PROFILE_VISIBILITY.PUBLIC
      ) {
        return {
          owner,
          usageRecord,
          visibility: PROFILE_VISIBILITY.PRIVATE,
          idempotent: true,
          operation: "refresh_skipped",
          publication: null
        };
      }
      if (!usageRecord) throw ownerCardNotFoundError();

      const current = await inspectPublication(owner.handle);
      if (current.publication && current.publication.ownerId !== owner.id) {
        throw createProfileMediaStoreError(
          PROFILE_MEDIA_STORE_ERROR_CODES.CONFLICT,
          "stable media handle belongs to another owner"
        );
      }

      const cardStyle = normalizeCardStyle(
        publishOptions.cardStyle ?? owner.cardStyle
      );
      const presentationDigest = await createPresentationDigest(
        createStaticFallbackStyle(cardStyle, "dark")
      );
      const cards = await renderCardVariants(owner, cardStyle);

      const publicationMatches =
        owner.visibility === PROFILE_VISIBILITY.PUBLIC &&
        publicationMatchesCards(
          current.publication,
          owner,
          cards,
          presentationDigest
        );
      if (publicationMatches) {
        await writeSocialCard({
          cardLocale: publishOptions.cardLocale ?? owner.cardLocale,
          cardStyle,
          createdAt: toIsoString(now()),
          owner,
          presentationDigest,
          publicationId: current.publication.publicationId
        });
        return {
          owner,
          usageRecord,
          visibility: PROFILE_VISIBILITY.PUBLIC,
          idempotent: true,
          operation: publishOptions.onlyIfAlreadyPublic === true
            ? "refresh"
            : "publish",
          publication: current.publication
        };
      }

      const createdAt = toIsoString(now());
      await writeCardVariants({ cards, createdAt, owner, presentationDigest });

      const publicationInput = {
        contractVersion: PROFILE_MEDIA_STORE_CONTRACT_VERSION,
        format: PROFILE_MEDIA_FORMAT,
        handle: owner.handle,
        ownerId: owner.id,
        presentationDigest,
        publicationId: createId("profile_media"),
        publishedAt: toIsoString(now()),
        representations: createVariantRepresentations(cards)
      };
      if (!current.incomplete) {
        publicationInput.expectedStorageEtag = current.storageEtag;
      }
      mediaMutation = {
        attemptedPublicationId: publicationInput.publicationId,
        handle: owner.handle,
        previousPublication: current.publication,
        type: "publish",
        writtenStorageEtag: null
      };

      const publication = await mediaStore.publishRevision(publicationInput);
      mediaMutation.writtenStorageEtag = publication.storageEtag;
      await writeSocialCard({
        cardLocale: publishOptions.cardLocale ?? owner.cardLocale,
        cardStyle,
        createdAt,
        owner,
        presentationDigest,
        publicationId: publicationInput.publicationId
      });
      if (publishOptions.prepareOnly === true) {
        return {
          owner,
          usageRecord,
          visibility: owner.visibility,
          idempotent: false,
          operation: "prepare",
          publication,
          mediaMutation
        };
      }
      const profile = await updateStructuredVisibility(
        owner,
        PROFILE_VISIBILITY.PUBLIC
      );
      return {
        ...profile,
        idempotent: false,
        operation: publishOptions.onlyIfAlreadyPublic === true
          ? "refresh"
          : "publish",
        publication
      };
    } catch (error) {
      throw await normalizePublicationFailure(error, mediaMutation);
    }
  }

  async function ensurePublishedCardVariants(ensureOptions = {}) {
    const ownerId = requireOwnerId(
      ensureOptions.ownerId ?? ensureOptions.owner?.id
    );
    const owner = ensureOptions.owner ?? await requireOwner(store, ownerId);
    if (owner.id !== ownerId) {
      throw new TypeError("owner does not match ownerId");
    }
    if (owner.visibility !== PROFILE_VISIBILITY.PUBLIC) {
      return { idempotent: true, rollback: async () => "not_needed" };
    }

    const result = await publishOwnerCard({
      cardLocale: ensureOptions.cardLocale,
      cardStyle: ensureOptions.cardStyle,
      ownerId,
      onlyIfAlreadyPublic: true,
      prepareOnly: true
    });
    return {
      ...result,
      rollback: result.mediaMutation
        ? async () => compensateMediaMutation(result.mediaMutation)
        : async () => "not_needed"
    };
  }

  async function renderCardVariants(owner, cardStyle) {
    const cards = {};
    for (const theme of PROFILE_MEDIA_SUPPORTED_THEMES) {
      cards[theme] = {};
      for (const locale of PROFILE_MEDIA_SUPPORTED_LOCALES) {
        const staticStyle = createStaticFallbackStyle(cardStyle, theme);
        cards[theme][locale] = await cardService.renderOwnerCard({
          ownerId: owner.id,
          locale,
          theme: staticStyle.theme
        });
      }
    }
    return cards;
  }

  async function writeCardVariants(options) {
    // The non-authoritative light stable object must be ready before the dark
    // queryless object is allowed to become the v4 authority.
    for (const theme of ["light", "dark"]) {
      await Promise.all(PROFILE_MEDIA_SUPPORTED_LOCALES.map((locale) => {
        const card = options.cards[theme][locale];
        return putVariantRevision({
          card,
          createdAt: options.createdAt,
          locale,
          owner: options.owner,
          presentationDigest: options.presentationDigest,
          theme
        });
      }));
    }
  }

  async function writeSocialCard(options) {
    if (
      !supportsProfileMediaSocialCard(mediaStore) ||
      typeof cardService.renderOwnerSocialCard !== "function" ||
      cardService.supportsSocialCard?.() === false
    ) {
      return null;
    }

    const staticStyle = createStaticFallbackStyle(
      options.cardStyle,
      options.cardStyle.theme
    );
    const card = await cardService.renderOwnerSocialCard({
      ownerId: options.owner.id,
      locale: options.cardLocale,
      theme: staticStyle.theme
    });

    return mediaStore.putSocialCard({
      body: card.body,
      contentType: PROFILE_MEDIA_CONTENT_TYPE,
      createdAt: options.createdAt,
      etag: card.etag,
      handle: options.owner.handle,
      ownerId: options.owner.id,
      presentationDigest: options.presentationDigest,
      publicationId: options.publicationId,
      revision: card.revision
    });
  }

  async function removeSocialCard(handle) {
    if (!supportsProfileMediaSocialCard(mediaStore)) return null;
    return mediaStore.deleteSocialCard({ handle });
  }

  async function putVariantRevision(options) {
    try {
      return await mediaStore.putRevision({
        body: options.card.body,
        contractVersion: PROFILE_MEDIA_STORE_CONTRACT_VERSION,
        createdAt: options.createdAt,
        etag: options.card.etag,
        format: PROFILE_MEDIA_FORMAT,
        locale: options.locale,
        ownerId: options.owner.id,
        presentationDigest: options.presentationDigest,
        revision: options.card.revision,
        theme: options.theme
      });
    } catch (error) {
      if (
        error?.code !== PROFILE_MEDIA_STORE_ERROR_CODES.CONFLICT ||
        options.theme !== "dark"
      ) {
        throw error;
      }
      const legacy = await mediaStore.getRevision({
        locale: options.locale,
        ownerId: options.owner.id,
        revision: options.card.revision,
        theme: "dark"
      });
      if (
        legacy?.contractVersion !== PROFILE_MEDIA_LEGACY_CONTRACT_VERSION ||
        legacy.etag !== options.card.etag
      ) {
        throw error;
      }
      return { idempotent: true, record: legacy };
    }
  }

  async function unpublishOwnerCard(unpublishOptions = {}) {
    const ownerId = requireOwnerId(unpublishOptions.ownerId);
    let mediaMutation = null;

    try {
      const owner = await requireOwner(store, ownerId);
      const usageRecord = await store.getLatestUsageByOwnerId(owner.id);
      const current = await inspectPublication(owner.handle);
      if (current.publication && current.publication.ownerId !== owner.id) {
        throw createProfileMediaStoreError(
          PROFILE_MEDIA_STORE_ERROR_CODES.CONFLICT,
          "stable media handle belongs to another owner"
        );
      }

      if (current.incomplete || current.publication) {
        mediaMutation = {
          handle: owner.handle,
          previousPublication: current.publication,
          tombstoneId: createId("profile_media_tombstone"),
          tombstoneStorageEtag: null,
          type: "unpublish"
        };
        const unpublishInput = {
          handle: owner.handle,
          tombstoneId: mediaMutation.tombstoneId,
          unpublishedAt: toIsoString(now())
        };
        if (!current.incomplete) {
          unpublishInput.expectedStorageEtag = current.storageEtag;
        }
        const unpublished = await mediaStore.unpublishCard(unpublishInput);
        mediaMutation.tombstoneStorageEtag =
          unpublished?.unpublishedStorageEtag ?? null;
        await removeSocialCard(owner.handle);
      }

      if (
        owner.visibility === PROFILE_VISIBILITY.PRIVATE &&
        mediaMutation === null
      ) {
        return {
          owner,
          usageRecord,
          visibility: PROFILE_VISIBILITY.PRIVATE,
          idempotent: true,
          operation: "unpublish",
          publication: null
        };
      }

      const profile = await updateStructuredVisibility(
        owner,
        PROFILE_VISIBILITY.PRIVATE
      );
      return {
        ...profile,
        idempotent: current.publication === null && !current.incomplete,
        operation: "unpublish",
        publication: null
      };
    } catch (error) {
      throw await normalizePublicationFailure(error, mediaMutation);
    }
  }

  async function updateStructuredVisibility(owner, visibility) {
    return store.atomic.updateVisibility({
      ownerId: owner.id,
      expectedOwnerUpdatedAt: owner.updatedAt ?? null,
      visibility,
      updatedAt: nextOwnerRevisionTimestamp(owner.updatedAt, now())
    });
  }

  async function inspectPublication(handle) {
    try {
      const stable = await mediaStore.inspectStableCard({ handle });
      return {
        incomplete: false,
        publication: stable.kind === PROFILE_MEDIA_STABLE_STATE_KINDS.PUBLICATION
          ? stable.publication
          : null,
        stableKind: stable.kind,
        storageEtag: stable.storageEtag
      };
    } catch (error) {
      if (![
        PROFILE_MEDIA_STORE_ERROR_CODES.INVALID,
        PROFILE_MEDIA_STORE_ERROR_CODES.UNAVAILABLE
      ].includes(error?.code)) {
        throw error;
      }
      return {
        incomplete: true,
        publication: null,
        stableKind: null,
        storageEtag: null
      };
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
    try {
      if (mutation.type === "publish") {
        const written = await findAttemptedPublication(mutation);
        if (!written) return "superseded";
        if (mutation.previousPublication) {
          await mediaStore.publishRevision({
            ...createPublicationRestoreInput(mutation.previousPublication),
            expectedStorageEtag: written.storageEtag
          });
        } else {
          await mediaStore.unpublishCard({
            expectedStorageEtag: written.storageEtag,
            handle: mutation.handle,
            tombstoneId: createId("profile_media_tombstone"),
            unpublishedAt: toIsoString(now())
          });
        }
        return "succeeded";
      }

      if (!mutation.previousPublication) return "repair_required";
      const tombstone = await findOwnTombstone(mutation);
      if (!tombstone) return "superseded";
      await mediaStore.publishRevision({
        ...createPublicationRestoreInput(mutation.previousPublication),
        expectedStorageEtag: tombstone.storageEtag
      });
      return "succeeded";
    } catch {
      return "failed";
    }
  }

  async function findAttemptedPublication(mutation) {
    const stable = await mediaStore.inspectStableCard({ handle: mutation.handle });
    if (
      stable.kind !== PROFILE_MEDIA_STABLE_STATE_KINDS.PUBLICATION ||
      stable.publication.publicationId !== mutation.attemptedPublicationId
    ) {
      return null;
    }
    if (
      mutation.writtenStorageEtag &&
      stable.storageEtag !== mutation.writtenStorageEtag
    ) {
      return null;
    }
    return stable;
  }

  async function findOwnTombstone(mutation) {
    const stable = await mediaStore.inspectStableCard({ handle: mutation.handle });
    if (
      stable.kind !== PROFILE_MEDIA_STABLE_STATE_KINDS.UNPUBLISHED ||
      stable.tombstoneId !== mutation.tombstoneId
    ) {
      return null;
    }
    if (
      mutation.tombstoneStorageEtag &&
      stable.storageEtag !== mutation.tombstoneStorageEtag
    ) {
      return null;
    }
    return stable;
  }
}

function publicationMatchesCards(
  publication,
  owner,
  cards,
  presentationDigest
) {
  return Boolean(
    publication &&
    publication.contractVersion === PROFILE_MEDIA_STORE_CONTRACT_VERSION &&
    publication.ownerId === owner.id &&
    publication.handle === owner.handle &&
    publication.presentationDigest === presentationDigest &&
    PROFILE_MEDIA_SUPPORTED_THEMES.every((theme) =>
      PROFILE_MEDIA_SUPPORTED_LOCALES.every((locale) => {
        const representation = publication.representations?.[theme]?.[locale];
        return representation?.revision === cards[theme][locale].revision &&
          representation?.etag === cards[theme][locale].etag;
      })
    )
  );
}

function createStaticFallbackStyle(cardStyle, theme) {
  return normalizeCardStyle({
    ...cardStyle,
    effect: { preset: "none", version: 1 },
    theme
  });
}

function createVariantRepresentations(cards) {
  return Object.fromEntries(PROFILE_MEDIA_SUPPORTED_THEMES.map((theme) => [
    theme,
    Object.fromEntries(PROFILE_MEDIA_SUPPORTED_LOCALES.map((locale) => [
      locale,
      {
        etag: cards[theme][locale].etag,
        revision: cards[theme][locale].revision
      }
    ]))
  ]));
}

function createPublicationRestoreInput(publication) {
  const input = {
    handle: publication.handle,
    ownerId: publication.ownerId,
    publicationId: publication.publicationId,
    publishedAt: publication.publishedAt,
    representations: publication.representations
  };
  if (publication.contractVersion === PROFILE_MEDIA_STORE_CONTRACT_VERSION) {
    input.contractVersion = publication.contractVersion;
    input.format = publication.format;
    input.presentationDigest = publication.presentationDigest;
  }
  return input;
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
  if (
    !store ||
    typeof store.getOwnerById !== "function" ||
    typeof store.getLatestUsageByOwnerId !== "function" ||
    typeof store.atomic?.updateVisibility !== "function"
  ) {
    throw new TypeError(
      "structured store with reads and atomic.updateVisibility is required"
    );
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

function nextOwnerRevisionTimestamp(currentValue, nextValue) {
  const next = normalizeDate(nextValue);
  if (currentValue === undefined || currentValue === null) {
    return next.toISOString();
  }
  const current = normalizeDate(currentValue);
  return new Date(Math.max(
    next.getTime(),
    current.getTime() + 1
  )).toISOString();
}

function normalizeDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("expected a valid publication time");
  }
  return date;
}

function toIsoString(value) {
  return normalizeDate(value).toISOString();
}
