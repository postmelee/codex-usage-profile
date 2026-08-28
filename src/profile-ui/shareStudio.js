import {
  buildCanonicalCardUrl,
  buildLocalizedCardUrl,
  resolveShareLocale
} from "./cardShare.js";
import {
  buildPublicShareUrl,
  parsePublicShareRevision,
  resolvePublicShareRevision
} from "../profile-shared/public-share-url.js";
import { formatMessage } from "./i18n.js";

const SHARE_MESSAGE_IDS = Object.freeze({
  attachGif: "share.attachGif",
  close: "share.close",
  copyImage: "share.copyImage",
  copyImageUrl: "share.copyImageUrl",
  copyShareLink: "share.copyShareLink",
  copyReadme: "share.copyReadme",
  destinations: "share.destinations",
  dismissInstructions: "share.dismissInstructions",
  dismissToast: "share.dismissToast",
  format: "share.format",
  formatGif: "share.formatGif",
  formatPng: "share.formatPng",
  gifAttachmentHint: "share.gifAttachmentHint",
  gifEncodeFailed: "share.gifEncodeFailed",
  gifInvalidOutput: "share.gifInvalidOutput",
  gifSaved: "share.gifSaved",
  gifSourceFailed: "share.gifSourceFailed",
  gifTimedOut: "share.gifTimedOut",
  gifTooLarge: "share.gifTooLarge",
  gifUnsupported: "share.gifUnsupported",
  imageCopied: "share.imageCopied",
  imageCopyFailed: "share.imageCopyFailed",
  imageSaved: "share.imageSaved",
  imageUrl: "share.imageUrl",
  imageUrlCopied: "share.imageUrlCopied",
  imageUrlCopyFailed: "share.imageUrlCopyFailed",
  makePrivate: "share.makePrivate",
  makingPrivate: "share.makingPrivate",
  pasteImage: "share.pasteImage",
  previewAlt: "share.previewAlt",
  previewUnavailable: "share.previewUnavailable",
  readme: "share.readme",
  readmeCopied: "share.readmeCopied",
  readmeCopyFailed: "share.readmeCopyFailed",
  retryGif: "share.retryGif",
  save: "share.save",
  saveAriaLabel: "share.saveAriaLabel",
  saveGif: "share.saveGif",
  saveGifAriaLabel: "share.saveGifAriaLabel",
  shareFacebook: "share.shareFacebook",
  shareLinkedIn: "share.shareLinkedIn",
  shareLink: "share.shareLink",
  shareLinkCopied: "share.shareLinkCopied",
  shareLinkCopyFailed: "share.shareLinkCopyFailed",
  shareReddit: "share.shareReddit",
  shareThreads: "share.shareThreads",
  shareX: "share.shareX",
  socialText: "share.socialText",
  title: "share.title"
});

const SHARE_PLATFORM_MESSAGE_IDS = Object.freeze({
  generatingGif: "share.generatingGif",
  openComposer: "share.openComposer",
  shareInstructionsTitle: "share.shareInstructionsTitle"
});

const GIF_EXPORT_ERROR_COPY_KEYS = Object.freeze({
  encode_failed: "gifEncodeFailed",
  invalid_output: "gifInvalidOutput",
  source_failed: "gifSourceFailed",
  timed_out: "gifTimedOut",
  too_large: "gifTooLarge",
  unsupported: "gifUnsupported"
});

const GIF_SHARE_TARGET_IDS = new Set(["x", "reddit"]);

export function getShareStudioCopy(locale = "en") {
  const normalizedLocale = resolveShareLocale(locale);
  return Object.freeze({
    ...Object.fromEntries(Object.entries(SHARE_MESSAGE_IDS).map(([key, id]) => (
      [key, formatMessage(normalizedLocale, id)]
    ))),
    facebook: "Facebook",
    linkedin: "LinkedIn",
    reddit: "Reddit",
    threads: "Threads",
    x: "X"
  });
}

export function formatShareStudioPlatformMessage(locale, key, platform) {
  const messageId = SHARE_PLATFORM_MESSAGE_IDS[key];
  if (!messageId) {
    throw new TypeError(`Unsupported Share Studio platform message: ${key}`);
  }
  if (typeof platform !== "string" || platform.trim() === "") {
    throw new TypeError("Share Studio platform must be a non-empty string");
  }

  return formatMessage(resolveShareLocale(locale), messageId, {
    platform: platform.trim()
  });
}

export function formatShareStudioGifProgress(locale, progress) {
  const normalizedProgress = Number.isFinite(progress)
    ? Math.min(1, Math.max(0, progress))
    : 0;
  return formatMessage(
    resolveShareLocale(locale),
    SHARE_PLATFORM_MESSAGE_IDS.generatingGif,
    { percent: Math.round(normalizedProgress * 100) }
  );
}

export function getShareStudioGifErrorCopy(copy, errorCode) {
  const key = GIF_EXPORT_ERROR_COPY_KEYS[errorCode] ?? "gifEncodeFailed";
  return copy?.[key] ?? "";
}

export function shouldShowAnimatedGifPreview(options = {}) {
  return options.format === "gif"
    && options.status === "ready"
    && typeof options.blobUrl === "string"
    && options.blobUrl.startsWith("blob:")
    && options.prefersReducedMotion !== true;
}

export function resolveShareStudioGifSourceUrl(options = {}) {
  for (const value of [
    options.warmSourceUrl,
    options.previewImageUrl,
    options.selectedImageUrl
  ]) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return null;
}

export function resolveShareStudioCardUrls(options = {}) {
  const copyImageUrl = buildCanonicalCardUrl(options.publicCardUrl);
  if (!copyImageUrl) {
    return Object.freeze({ copyImageUrl: null, selectedImageUrl: null });
  }

  const selectedImageUrl = buildLocalizedCardUrl(
    options.selectedPublicCardUrl,
    options.cardLocale ?? options.locale,
    options.cardTheme
  ) ?? buildLocalizedCardUrl(
    copyImageUrl,
    options.cardLocale ?? options.locale,
    options.cardTheme
  );
  return Object.freeze({ copyImageUrl, selectedImageUrl });
}

export function buildPublicProfileShareUrl(origin, handle, options = {}) {
  let revision;
  try {
    if (
      Object.prototype.hasOwnProperty.call(options, "shareRevision") &&
      options.shareRevision !== undefined
    ) {
      revision = parsePublicShareRevision(options.shareRevision);
      if (revision === null) {
        throw new TypeError("shareRevision must be a canonical safe integer token");
      }
    } else {
      revision = resolvePublicShareRevision(
        options?.ownerUpdatedAt,
        options?.usageUploadedAt
      );
    }
  } catch {
    // Legacy profiles and malformed timestamps keep the fixed share route.
    revision = undefined;
  }

  try {
    // ChatGPT Sites dispatches the API prefix to the Worker, while the root
    // query is served as a static asset before dynamic metadata can run.
    return buildPublicShareUrl(origin, handle, revision);
  } catch {
    return null;
  }
}

export function resolveShareStudioProfileUrls(origin, handle, options = {}) {
  return Object.freeze({
    readmeProfileUrl: buildPublicProfileShareUrl(origin, handle),
    shareProfileUrl: buildPublicProfileShareUrl(origin, handle, options)
  });
}

export function isMobileShareEnvironment(navigatorLike) {
  if (!navigatorLike || typeof navigatorLike !== "object") return false;

  const userAgentDataMobile = navigatorLike.userAgentData?.mobile;
  if (typeof userAgentDataMobile === "boolean") {
    return userAgentDataMobile;
  }

  const userAgent = typeof navigatorLike.userAgent === "string"
    ? navigatorLike.userAgent
    : "";
  if (/\b(?:Android|iPad|iPhone|iPod)\b/i.test(userAgent)) {
    return true;
  }

  return navigatorLike.platform === "MacIntel"
    && Number(navigatorLike.maxTouchPoints) > 1;
}

export function buildShareTargets(options = {}) {
  const profileUrl = normalizeHttpUrl(options.profileUrl)?.toString() ?? null;
  if (!profileUrl) return [];

  const copy = getShareStudioCopy(options.locale);
  const targets = [
    createTarget({
      baseUrl: "https://x.com/intent/tweet",
      id: "x",
      label: copy.x,
      accessibleLabel: copy.shareX,
      params: {
        text: `${copy.socialText}\n${profileUrl}`
      }
    }),
    createTarget({
      // The Threads iOS app shows the raw query verbatim, so form-encoded
      // spaces reach the composer as literal plus signs. X and Reddit decode
      // "+" as a space, so only Threads needs the percent-escaped form.
      baseUrl: "https://www.threads.net/intent/post",
      id: "threads",
      label: copy.threads,
      accessibleLabel: copy.shareThreads,
      params: {
        text: copy.socialText,
        url: profileUrl
      },
      serializeSpacesAsPercent20: true
    }),
    createTarget({
      baseUrl: "https://www.linkedin.com/feed/",
      id: "linkedin",
      label: copy.linkedin,
      accessibleLabel: copy.shareLinkedIn,
      params: {
        shareActive: "true",
        shareUrl: profileUrl,
        text: copy.socialText
      }
    }),
    createTarget({
      // Facebook's sharer only accepts the link; prefilled text is not allowed.
      baseUrl: "https://www.facebook.com/sharer/sharer.php",
      id: "facebook",
      label: copy.facebook,
      accessibleLabel: copy.shareFacebook,
      params: {
        u: profileUrl
      }
    }),
    createTarget({
      baseUrl: "https://www.reddit.com/submit",
      id: "reddit",
      label: copy.reddit,
      accessibleLabel: copy.shareReddit,
      params: {
        title: copy.socialText,
        url: profileUrl
      }
    })
  ];

  const formatTargets = options.format === "gif"
    ? targets.filter(({ id }) => GIF_SHARE_TARGET_IDS.has(id))
    : targets;

  return options.mobile === true
    ? formatTargets.filter(({ id }) => id !== "linkedin" && id !== "facebook")
    : formatTargets;
}

function createTarget({
  accessibleLabel,
  baseUrl,
  id,
  label,
  params,
  serializeSpacesAsPercent20 = false
}) {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  if (serializeSpacesAsPercent20) {
    url.search = url.search.replaceAll("+", "%20");
  }

  return Object.freeze({
    accessibleLabel,
    href: url.toString(),
    id,
    label
  });
}

function normalizeHttpUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
