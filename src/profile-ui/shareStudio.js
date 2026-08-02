import { resolveShareLocale } from "./cardShare.js";
import { formatMessage } from "./i18n.js";

const SHARE_MESSAGE_IDS = Object.freeze({
  close: "share.close",
  copyImage: "share.copyImage",
  copyImageUrl: "share.copyImageUrl",
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
  openComposer: "share.openComposer",
  pasteImage: "share.pasteImage",
  previewAlt: "share.previewAlt",
  previewUnavailable: "share.previewUnavailable",
  readme: "share.readme",
  readmeCopied: "share.readmeCopied",
  readmeCopyFailed: "share.readmeCopyFailed",
  save: "share.save",
  saveAriaLabel: "share.saveAriaLabel",
  shareInstructionsTitle: "share.shareInstructionsTitle",
  shareLinkedIn: "share.shareLinkedIn",
  shareReddit: "share.shareReddit",
  shareX: "share.shareX",
  socialText: "share.socialText",
  title: "share.title"
});

export function getShareStudioCopy(locale = "en") {
  const normalizedLocale = resolveShareLocale(locale);
  return Object.freeze({
    ...Object.fromEntries(Object.entries(SHARE_MESSAGE_IDS).map(([key, id]) => (
      [key, formatMessage(normalizedLocale, id, { platform: "{platform}" })]
    ))),
    linkedin: "LinkedIn",
    reddit: "Reddit",
    x: "X"
  });
}

export function buildPublicProfileShareUrl(origin, handle) {
  const normalizedHandle = normalizeHandle(handle);
  if (!normalizedHandle) return null;

  const url = normalizeHttpUrl(origin);
  if (!url) return null;

  url.pathname = "/";
  url.search = "";
  url.hash = "";
  url.searchParams.set("profile", normalizedHandle);
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
        text: copy.socialText
      }
    }),
    createTarget({
      baseUrl: "https://www.linkedin.com/feed/",
      id: "linkedin",
      label: copy.linkedin,
      accessibleLabel: copy.shareLinkedIn,
      params: {
        shareActive: "true",
        text: copy.socialText
      }
    }),
    createTarget({
      baseUrl: "https://www.reddit.com/submit",
      id: "reddit",
      label: copy.reddit,
      accessibleLabel: copy.shareReddit,
      params: {
        title: copy.socialText
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
