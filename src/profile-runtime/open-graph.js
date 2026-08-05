export const PROFILE_OPEN_GRAPH_SITE_NAME = "Codex Usage Profile";
export const PROFILE_OPEN_GRAPH_LOCALES = Object.freeze(["en", "ko"]);
export const DEFAULT_PROFILE_OPEN_GRAPH_LOCALE = "en";
export const PROFILE_SOCIAL_IMAGE_WIDTH = 1200;
export const PROFILE_SOCIAL_IMAGE_HEIGHT = 630;
export const PROFILE_SOCIAL_IMAGE_TYPE = "image/png";

const OPEN_GRAPH_LOCALE_TAGS = Object.freeze({
  en: "en_US",
  ko: "ko_KR"
});

const SERVICE_DESCRIPTIONS = Object.freeze({
  en: "Create and share your Codex usage card on Codex Usage Profile.",
  ko: "Codex Usage Profile에서 내 사용량 카드를 만들고 공유하세요."
});

const UNSUPPORTED_HANDLE_RE = new RegExp("[\\u0000-\\u001f\\u007f/?#]");
const HEAD_CLOSE_RE = /<\/head\s*>/i;
const TITLE_RE = /<title\b[^>]*>[\s\S]*?<\/title\s*>/gi;
const DESCRIPTION_META_RE =
  /<meta\b[^>]*\bname\s*=\s*["']description["'][^>]*>/gi;

export function resolveProfileOpenGraphLocale(requested, fallback) {
  if (PROFILE_OPEN_GRAPH_LOCALES.includes(requested)) return requested;
  if (PROFILE_OPEN_GRAPH_LOCALES.includes(fallback)) return fallback;
  return DEFAULT_PROFILE_OPEN_GRAPH_LOCALE;
}

export function buildProfileOpenGraphDocument(options = {}) {
  const handle = normalizeHandle(options.handle);
  const origin = normalizeOrigin(options.origin);
  const profile = normalizeProfileSummary(options.profile);
  const locale = resolveProfileOpenGraphLocale(
    options.requestedLocale,
    profile?.cardLocale
  );
  const description = SERVICE_DESCRIPTIONS[locale];

  if (!profile) {
    const fallbackUrl = new URL("/", origin).toString();
    const fallbackHandle = normalizeOptionalHandle(options.fallbackImageHandle);
    return freezeDocument({
      canonicalUrl: fallbackUrl,
      description,
      locale,
      metaTags: buildFallbackMetaTags({
        canonicalUrl: fallbackUrl,
        description,
        imageAlt: locale === "ko"
          ? "Codex 사용량 카드 예시"
          : "Sample Codex usage card",
        imageUrl: fallbackHandle
          ? buildSocialImageUrl(origin, fallbackHandle)
          : null,
        locale
      }),
      title: PROFILE_OPEN_GRAPH_SITE_NAME
    });
  }

  const canonicalUrl = buildPublicProfileUrl(origin, profile.handle);
  const imageUrl = buildSocialImageUrl(
    origin,
    profile.handle,
    profile.uploadedAt
  );
  const socialTitle = `${profile.handle}'s Codex card`;
  const imageAlt = locale === "ko"
    ? `${profile.handle}의 Codex 사용량 카드`
    : `${profile.handle}'s Codex usage card`;

  return freezeDocument({
    canonicalUrl,
    description,
    locale,
    metaTags: buildProfileMetaTags({
      canonicalUrl,
      description,
      imageAlt,
      imageUrl,
      locale,
      socialTitle
    }),
    title: `${socialTitle} · ${PROFILE_OPEN_GRAPH_SITE_NAME}`
  });
}

export function renderProfileOpenGraphHead(document, options = {}) {
  const head = requireDocument(document);
  const indent = typeof options.indent === "string" ? options.indent : "    ";

  const lines = [
    `<title>${escapeHtmlText(head.title)}</title>`,
    `<link rel="canonical" href="${escapeHtmlAttribute(head.canonicalUrl)}" />`,
    `<meta name="description" content="${escapeHtmlAttribute(head.description)}" />`,
    ...head.metaTags.map((tag) => (
      `<meta ${tag.attribute}="${escapeHtmlAttribute(tag.key)}" ` +
      `content="${escapeHtmlAttribute(tag.content)}" />`
    ))
  ];

  return lines.map((line) => `${indent}${line}`).join("\n");
}

export function injectProfileOpenGraphHead(html, document, options = {}) {
  if (typeof html !== "string" || html.trim() === "") {
    throw new TypeError("html must be a non-empty string");
  }
  if (!HEAD_CLOSE_RE.test(html)) {
    throw new TypeError("html must contain a closing head tag");
  }

  const head = renderProfileOpenGraphHead(document, options);
  const stripped = html
    .replace(TITLE_RE, "")
    .replace(DESCRIPTION_META_RE, "");

  return stripped.replace(HEAD_CLOSE_RE, (match) => `${head}\n  ${match}`);
}

function buildProfileMetaTags(input) {
  return Object.freeze([
    metaTag("property", "og:site_name", PROFILE_OPEN_GRAPH_SITE_NAME),
    metaTag("property", "og:type", "website"),
    metaTag("property", "og:url", input.canonicalUrl),
    metaTag("property", "og:title", input.socialTitle),
    metaTag("property", "og:description", input.description),
    metaTag("property", "og:image", input.imageUrl),
    metaTag("property", "og:image:secure_url", input.imageUrl),
    metaTag("property", "og:image:type", PROFILE_SOCIAL_IMAGE_TYPE),
    metaTag("property", "og:image:width", String(PROFILE_SOCIAL_IMAGE_WIDTH)),
    metaTag("property", "og:image:height", String(PROFILE_SOCIAL_IMAGE_HEIGHT)),
    metaTag("property", "og:image:alt", input.imageAlt),
    ...buildLocaleTags(input.locale),
    metaTag("name", "twitter:card", "summary_large_image"),
    metaTag("name", "twitter:title", input.socialTitle),
    metaTag("name", "twitter:description", input.description),
    metaTag("name", "twitter:image", input.imageUrl),
    metaTag("name", "twitter:image:alt", input.imageAlt)
  ]);
}

function buildFallbackMetaTags(input) {
  const imageTags = input.imageUrl
    ? [
      metaTag("property", "og:image", input.imageUrl),
      metaTag("property", "og:image:secure_url", input.imageUrl),
      metaTag("property", "og:image:type", PROFILE_SOCIAL_IMAGE_TYPE),
      metaTag("property", "og:image:width", String(PROFILE_SOCIAL_IMAGE_WIDTH)),
      metaTag("property", "og:image:height", String(PROFILE_SOCIAL_IMAGE_HEIGHT)),
      metaTag("property", "og:image:alt", input.imageAlt)
    ]
    : [];

  return Object.freeze([
    metaTag("property", "og:site_name", PROFILE_OPEN_GRAPH_SITE_NAME),
    metaTag("property", "og:type", "website"),
    metaTag("property", "og:url", input.canonicalUrl),
    metaTag("property", "og:title", PROFILE_OPEN_GRAPH_SITE_NAME),
    metaTag("property", "og:description", input.description),
    ...imageTags,
    ...buildLocaleTags(input.locale),
    metaTag(
      "name",
      "twitter:card",
      input.imageUrl ? "summary_large_image" : "summary"
    ),
    metaTag("name", "twitter:title", PROFILE_OPEN_GRAPH_SITE_NAME),
    metaTag("name", "twitter:description", input.description),
    ...(input.imageUrl
      ? [
        metaTag("name", "twitter:image", input.imageUrl),
        metaTag("name", "twitter:image:alt", input.imageAlt)
      ]
      : [])
  ]);
}

function buildLocaleTags(locale) {
  const alternates = PROFILE_OPEN_GRAPH_LOCALES
    .filter((candidate) => candidate !== locale)
    .map((candidate) => metaTag(
      "property",
      "og:locale:alternate",
      OPEN_GRAPH_LOCALE_TAGS[candidate]
    ));

  return [
    metaTag("property", "og:locale", OPEN_GRAPH_LOCALE_TAGS[locale]),
    ...alternates
  ];
}

export function buildPublicProfileUrl(origin, handle) {
  const normalizedHandle = normalizeHandle(handle);
  return new URL(
    `/u/${encodeURIComponent(normalizedHandle)}`,
    normalizeOrigin(origin)
  ).toString();
}

export function buildSocialImageUrl(origin, handle, uploadedAt) {
  const url = new URL(`${buildPublicProfileUrl(origin, handle)}/social.png`);
  if (uploadedAt !== undefined && uploadedAt !== null) {
    url.searchParams.set("v", String(toRevisionToken(uploadedAt)));
  }
  return url.toString();
}

export function toRevisionToken(uploadedAt) {
  const time = new Date(uploadedAt).getTime();
  if (!Number.isFinite(time)) {
    throw new TypeError("uploadedAt must be a valid date");
  }
  return Math.floor(time / 1000);
}

function metaTag(attribute, key, content) {
  return Object.freeze({ attribute, content, key });
}

function freezeDocument(document) {
  return Object.freeze({
    canonicalUrl: document.canonicalUrl,
    description: document.description,
    locale: document.locale,
    metaTags: document.metaTags,
    title: document.title
  });
}

function requireDocument(document) {
  if (
    !document ||
    typeof document !== "object" ||
    typeof document.title !== "string" ||
    typeof document.canonicalUrl !== "string" ||
    typeof document.description !== "string" ||
    !Array.isArray(document.metaTags)
  ) {
    throw new TypeError("document must be an Open Graph document");
  }
  return document;
}

function normalizeProfileSummary(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("profile must be an object");
  }

  return Object.freeze({
    cardLocale: PROFILE_OPEN_GRAPH_LOCALES.includes(value.cardLocale)
      ? value.cardLocale
      : DEFAULT_PROFILE_OPEN_GRAPH_LOCALE,
    handle: normalizeHandle(value.handle),
    uploadedAt: value.uploadedAt
  });
}

function normalizeOptionalHandle(value) {
  if (value === undefined || value === null || value === "") return null;
  try {
    return normalizeHandle(value);
  } catch {
    return null;
  }
}

function normalizeHandle(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError("handle must be a non-empty string");
  }

  const handle = value.trim();
  if (handle.length > 100 || UNSUPPORTED_HANDLE_RE.test(handle)) {
    throw new TypeError("handle contains unsupported characters");
  }

  return handle;
}

function normalizeOrigin(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError("origin must be an absolute http or https URL");
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new TypeError("origin must be an absolute http or https URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError("origin must be an absolute http or https URL");
  }

  return url.origin;
}

function escapeHtmlText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtmlAttribute(value) {
  return escapeHtmlText(value).replaceAll("\"", "&quot;");
}
