export const README_CARD_DEFAULT_WIDTH = "50%";

const README_CARD_ALT = "Codex usage profile";

export function buildReadmeCardSnippet(cardUrl, shareUrl) {
  const normalizedCardUrl = normalizeHttpUrl(cardUrl);
  const normalizedShareUrl = normalizeHttpUrl(shareUrl);
  if (!normalizedCardUrl || !normalizedShareUrl) return null;

  return `<a href="${escapeHtmlAttribute(normalizedShareUrl)}">`
    + `<img width="${README_CARD_DEFAULT_WIDTH}" `
    + `src="${escapeHtmlAttribute(normalizedCardUrl)}" `
    + `alt="${README_CARD_ALT}" /></a>`;
}

function normalizeHttpUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return null;

  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:")
      || url.username
      || url.password
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function escapeHtmlAttribute(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
