import { resolveShareLocale } from "./cardShare.js";

const SHARE_STUDIO_COPY = Object.freeze({
  en: Object.freeze({
    close: "Close Share Studio",
    copyImageUrl: "Copy Image URL",
    copyReadme: "Copy README Markdown",
    imageUrl: "Image URL",
    imageUrlCopied: "Image URL copied",
    imageUrlCopyFailed: "Could not copy image URL",
    imageCopied: "Copied image",
    imageCopyFailed: "Failed to copy image",
    imageSaved: "Image saved",
    linkedin: "LinkedIn",
    makePrivate: "Make private",
    makingPrivate: "Making private",
    previewAlt: "Codex usage card preview",
    previewUnavailable: "Card preview is unavailable. Sharing options are still available.",
    reddit: "Reddit",
    readme: "README Markdown",
    readmeCopied: "README Markdown copied",
    readmeCopyFailed: "Could not copy README Markdown",
    save: "Save",
    saveAriaLabel: "Save PNG",
    copyImage: "Copy image",
    dismissInstructions: "Dismiss share instructions",
    dismissToast: "Dismiss notification",
    openComposer: "Open {platform} composer",
    pasteImage: "Paste image into the post",
    shareInstructionsTitle: "Share to {platform}",
    shareLinkedIn: "Share on LinkedIn",
    shareReddit: "Share on Reddit",
    shareX: "Share on X",
    socialText: "See my Codex usage activity.",
    title: "Share activity",
    x: "X"
  }),
  ko: Object.freeze({
    close: "공유 스튜디오 닫기",
    copyImageUrl: "이미지 URL 복사",
    copyReadme: "README Markdown 복사",
    imageUrl: "이미지 URL",
    imageUrlCopied: "이미지 URL을 복사했습니다",
    imageUrlCopyFailed: "이미지 URL을 복사하지 못했습니다",
    imageCopied: "이미지를 복사했습니다",
    imageCopyFailed: "이미지를 복사하지 못했습니다",
    imageSaved: "이미지가 저장되었습니다",
    linkedin: "LinkedIn",
    makePrivate: "비공개로 전환",
    makingPrivate: "비공개로 전환 중",
    previewAlt: "Codex 사용량 카드 미리보기",
    previewUnavailable: "카드 미리보기를 불러오지 못했습니다. 공유 기능은 계속 사용할 수 있습니다.",
    reddit: "Reddit",
    readme: "README Markdown",
    readmeCopied: "README Markdown을 복사했습니다",
    readmeCopyFailed: "README Markdown을 복사하지 못했습니다",
    save: "저장",
    saveAriaLabel: "PNG 저장",
    copyImage: "이미지 복사",
    dismissInstructions: "공유 안내 닫기",
    dismissToast: "알림 닫기",
    openComposer: "{platform} 작성 창 열기",
    pasteImage: "게시물에 이미지를 붙여넣으세요",
    shareInstructionsTitle: "{platform}에 공유",
    shareLinkedIn: "LinkedIn에 공유",
    shareReddit: "Reddit에 공유",
    shareX: "X에 공유",
    socialText: "나의 Codex 사용량 활동을 확인해 보세요.",
    title: "활동 공유하기",
    x: "X"
  })
});

export function getShareStudioCopy(locale = "en") {
  return SHARE_STUDIO_COPY[resolveShareLocale(locale)] ?? SHARE_STUDIO_COPY.en;
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
