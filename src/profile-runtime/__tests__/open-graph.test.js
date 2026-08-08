import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PROFILE_OPEN_GRAPH_LOCALE,
  PROFILE_OPEN_GRAPH_SITE_NAME,
  PROFILE_SOCIAL_IMAGE_HEIGHT,
  PROFILE_SOCIAL_IMAGE_WIDTH,
  buildProfileOpenGraphDocument,
  buildPublicProfileUrl,
  buildSocialImageUrl,
  injectProfileOpenGraphHead,
  renderProfileOpenGraphHead,
  resolveProfileOpenGraphLocale,
  toRevisionToken
} from "../open-graph.js";

const ORIGIN = "https://profiles.example.test";
const UPLOADED_AT = "2026-06-11T09:05:00.000Z";
const INDEX_HTML = [
  "<!doctype html>",
  "<html lang=\"en\">",
  "  <head>",
  "    <meta charset=\"UTF-8\" />",
  "    <meta name=\"description\" content=\"placeholder\" />",
  "    <title>Codex Usage Profile</title>",
  "  </head>",
  "  <body><div id=\"root\"></div></body>",
  "</html>"
].join("\n");

function createProfile(overrides = {}) {
  return {
    cardLocale: "ko",
    handle: "postmelee",
    imageRevisionAt: UPLOADED_AT,
    ...overrides
  };
}

function readTag(document, key) {
  return document.metaTags.find((tag) => tag.key === key)?.content ?? null;
}

test("builds handle specific Open Graph tags for a public profile", () => {
  const document = buildProfileOpenGraphDocument({
    handle: "postmelee",
    origin: ORIGIN,
    profile: createProfile()
  });

  assert.equal(document.title, "postmelee's Codex card · Codex Usage Profile");
  assert.equal(document.canonicalUrl, `${ORIGIN}/u/postmelee`);
  assert.equal(readTag(document, "og:type"), "website");
  assert.equal(readTag(document, "og:title"), "postmelee's Codex card");
  assert.equal(readTag(document, "og:url"), `${ORIGIN}/u/postmelee`);
  assert.equal(readTag(document, "og:site_name"), PROFILE_OPEN_GRAPH_SITE_NAME);
  assert.equal(
    readTag(document, "og:image"),
    `${ORIGIN}/u/postmelee/social.png?v=1781168700000`
  );
  assert.equal(
    readTag(document, "og:image:width"),
    String(PROFILE_SOCIAL_IMAGE_WIDTH)
  );
  assert.equal(
    readTag(document, "og:image:height"),
    String(PROFILE_SOCIAL_IMAGE_HEIGHT)
  );
  assert.equal(readTag(document, "twitter:card"), "summary_large_image");
  assert.equal(
    readTag(document, "twitter:image"),
    readTag(document, "og:image")
  );
});

test("uses the operator social image on fallback when a handle is configured", () => {
  const document = buildProfileOpenGraphDocument({
    fallbackImageHandle: "postmelee",
    handle: "ghost",
    origin: ORIGIN,
    profile: null
  });

  assert.equal(document.title, PROFILE_OPEN_GRAPH_SITE_NAME);
  assert.equal(
    readTag(document, "og:image"),
    `${ORIGIN}/u/postmelee/social.png`
  );
  assert.equal(
    readTag(document, "og:image:width"),
    String(PROFILE_SOCIAL_IMAGE_WIDTH)
  );
  assert.equal(readTag(document, "twitter:card"), "summary_large_image");
  assert.equal(
    readTag(document, "twitter:image"),
    readTag(document, "og:image")
  );
});

test("omits the image and downgrades the twitter card without a fallback handle", () => {
  const document = buildProfileOpenGraphDocument({
    handle: "ghost",
    origin: ORIGIN,
    profile: null
  });

  assert.equal(document.title, PROFILE_OPEN_GRAPH_SITE_NAME);
  assert.equal(document.canonicalUrl, `${ORIGIN}/`);
  assert.equal(readTag(document, "og:title"), PROFILE_OPEN_GRAPH_SITE_NAME);
  assert.equal(readTag(document, "og:image"), null);
  assert.equal(readTag(document, "twitter:image"), null);
  assert.equal(readTag(document, "twitter:card"), "summary");
});

test("private and missing handles produce identical fallback tags", () => {
  const missing = buildProfileOpenGraphDocument({
    handle: "ghost",
    origin: ORIGIN,
    profile: null
  });
  const privateProfile = buildProfileOpenGraphDocument({
    handle: "postmelee",
    origin: ORIGIN,
    profile: null
  });

  assert.deepEqual(
    renderProfileOpenGraphHead(privateProfile),
    renderProfileOpenGraphHead(missing)
  );
});

test("resolves the text locale from the query before the saved card locale", () => {
  const requested = buildProfileOpenGraphDocument({
    handle: "postmelee",
    origin: ORIGIN,
    profile: createProfile({ cardLocale: "en" }),
    requestedLocale: "ko"
  });
  const saved = buildProfileOpenGraphDocument({
    handle: "postmelee",
    origin: ORIGIN,
    profile: createProfile({ cardLocale: "ko" })
  });
  const unsupported = buildProfileOpenGraphDocument({
    handle: "postmelee",
    origin: ORIGIN,
    profile: createProfile({ cardLocale: "en" }),
    requestedLocale: "fr"
  });

  assert.equal(requested.locale, "ko");
  assert.equal(readTag(requested, "og:locale"), "ko_KR");
  assert.equal(readTag(requested, "og:locale:alternate"), "en_US");
  assert.equal(saved.locale, "ko");
  assert.equal(unsupported.locale, "en");
});

test("keeps the image url independent of the requested locale", () => {
  const korean = buildProfileOpenGraphDocument({
    handle: "postmelee",
    origin: ORIGIN,
    profile: createProfile({ cardLocale: "en" }),
    requestedLocale: "ko"
  });
  const english = buildProfileOpenGraphDocument({
    handle: "postmelee",
    origin: ORIGIN,
    profile: createProfile({ cardLocale: "en" }),
    requestedLocale: "en"
  });

  assert.equal(readTag(korean, "og:image"), readTag(english, "og:image"));
  assert.match(readTag(korean, "og:image"), /social\.png\?v=\d+$/);
});

test("changes the image URL for a millisecond settings revision", () => {
  const before = buildProfileOpenGraphDocument({
    handle: "postmelee",
    origin: ORIGIN,
    profile: createProfile({ imageRevisionAt: UPLOADED_AT })
  });
  const after = buildProfileOpenGraphDocument({
    handle: "postmelee",
    origin: ORIGIN,
    profile: createProfile({
      imageRevisionAt: "2026-06-11T09:05:00.001Z"
    })
  });

  assert.notEqual(readTag(after, "og:image"), readTag(before, "og:image"));
});

test("escapes html special characters in rendered tags", () => {
  const document = buildProfileOpenGraphDocument({
    handle: "a\"b&c",
    origin: ORIGIN,
    profile: createProfile({ handle: "a\"b&c" })
  });
  const head = renderProfileOpenGraphHead(document);
  const titleLine = head
    .split("\n")
    .find((line) => line.includes("property=\"og:title\""));

  assert.equal(
    titleLine.trim(),
    "<meta property=\"og:title\" content=\"a&quot;b&amp;c&#39;s Codex card\" />"
      .replace("&#39;", "'")
  );
});

test("renders ampersands in urls as entities", () => {
  const document = {
    canonicalUrl: `${ORIGIN}/u/postmelee`,
    description: "d",
    locale: "en",
    metaTags: [
      { attribute: "property", content: `${ORIGIN}/a?x=1&y=2`, key: "og:image" }
    ],
    title: "t"
  };

  assert.ok(renderProfileOpenGraphHead(document).includes("x=1&amp;y=2"));
});

test("injects tags into head and replaces the existing title and description", () => {
  const document = buildProfileOpenGraphDocument({
    handle: "postmelee",
    origin: ORIGIN,
    profile: createProfile()
  });
  const html = injectProfileOpenGraphHead(INDEX_HTML, document);

  assert.equal(html.match(/<title>/g).length, 1);
  assert.ok(html.includes("<title>postmelee's Codex card"));
  assert.ok(!html.includes("content=\"placeholder\""));
  assert.ok(html.includes("property=\"og:image\""));
  assert.ok(html.indexOf("og:image") < html.indexOf("</head>"));
  assert.ok(html.includes("<div id=\"root\"></div>"));
});

test("rejects html without a closing head tag", () => {
  const document = buildProfileOpenGraphDocument({
    handle: "postmelee",
    origin: ORIGIN,
    profile: createProfile()
  });

  assert.throws(
    () => injectProfileOpenGraphHead("<html><body></body></html>", document),
    TypeError
  );
});

test("builds urls for handles that need encoding", () => {
  assert.equal(
    buildPublicProfileUrl(ORIGIN, "foo-bar"),
    `${ORIGIN}/u/foo-bar`
  );
  assert.equal(
    buildSocialImageUrl(ORIGIN, "foo bar", UPLOADED_AT),
    `${ORIGIN}/u/foo%20bar/social.png?v=1781168700000`
  );
});

test("rejects unsupported handles and origins", () => {
  assert.throws(() => buildPublicProfileUrl(ORIGIN, "a/b"), TypeError);
  assert.throws(() => buildPublicProfileUrl(ORIGIN, "a?b"), TypeError);
  assert.throws(() => buildPublicProfileUrl(ORIGIN, ""), TypeError);
  assert.throws(() => buildPublicProfileUrl("ftp://x.test", "a"), TypeError);
});

test("converts a revision date into a millisecond precision token", () => {
  assert.equal(toRevisionToken(UPLOADED_AT), 1781168700000);
  assert.notEqual(
    toRevisionToken("2026-06-11T09:05:00.001Z"),
    toRevisionToken(UPLOADED_AT)
  );
  assert.throws(() => toRevisionToken("not-a-date"), TypeError);
});

test("resolves locales with a documented default", () => {
  assert.equal(resolveProfileOpenGraphLocale("ko", "en"), "ko");
  assert.equal(resolveProfileOpenGraphLocale(null, "ko"), "ko");
  assert.equal(
    resolveProfileOpenGraphLocale(null, null),
    DEFAULT_PROFILE_OPEN_GRAPH_LOCALE
  );
});
