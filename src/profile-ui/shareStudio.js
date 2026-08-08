import { resolveShareLocale } from "./cardShare.js";
import { formatMessage } from "./i18n.js";

const SHARE_MESSAGE_IDS = Object.freeze({
  close: "share.close",
  copyImage: "share.copyImage",
  copyImageUrl: "share.copyImageUrl",
  copyShareLink: "share.copyShareLink",
  copyReadme: "share.copyReadme",
  destinations: "share.destinations",
  dismissInstructions: "share.dismissInstructions",
  dismissToast: "share.dismissToast",
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
  save: "share.save",
  saveAriaLabel: "share.saveAriaLabel",
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
  openComposer: "share.openComposer",
  shareInstructionsTitle: "share.shareInstructionsTitle"
});

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

export function buildPublicProfileShareUrl(origin, handle) {
  const normalizedHandle = normalizeHandle(handle);
  if (!normalizedHandle) return null;

  const url = normalizeHttpUrl(origin);
  if (!url) return null;

  // The canonical share target is the Open Graph route, so link previews on X,
  // Threads and KakaoTalk resolve the card image and description.
  url.pathname = `/u/${encodeURIComponent(normalizedHandle)}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function buildShareTargets(options = {}) {
  const profileUrl = normalizeHttpUrl(options.profileUrl)?.toString() ?? null;
  if (!profileUrl) return [];

  const copy = getShareStudioCopy(options.locale);
  return [
    createTarget({
      baseUrl: "https://x.com/intent/post",
      id: "x",
      label: copy.x,
      accessibleLabel: copy.shareX,
      params: {
        text: copy.socialText,
        url: profileUrl
      }
    }),
    createTarget({
      baseUrl: "https://www.threads.net/intent/post",
      id: "threads",
      label: copy.threads,
      accessibleLabel: copy.shareThreads,
      params: {
        text: copy.socialText,
        url: profileUrl
      }
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
}

function createTarget({ accessibleLabel, baseUrl, id, label, params }) {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return Object.freeze({
    accessibleLabel,
    href: url.toString(),
    id,
    label
  });
}

function normalizeHandle(value) {
  if (typeof value !== "string") return null;

  const handle = value.trim();
  if (
    handle === ""
    || handle.length > 100
    || /[\u0000-\u001f\u007f/?#]/.test(handle)
  ) {
    return null;
  }

  return handle;
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
