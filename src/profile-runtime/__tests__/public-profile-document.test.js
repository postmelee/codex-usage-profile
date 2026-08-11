import assert from "node:assert/strict";
import test from "node:test";

import {
  PUBLIC_PROFILE_DOCUMENT_CACHE_CONTROL,
  createPublicProfileDocumentHandler,
  isPublicProfileDocumentRequest,
  readPublicProfileDocumentHandle,
  readPublicProfileDocumentRequestHandle
} from "../public-profile-document.js";

const BASE_URL = "https://profiles.example.test";
const UPLOADED_AT = "2026-06-11T09:05:00.000Z";
const INDEX_HTML = [
  "<!doctype html>",
  "<html lang=\"en\">",
  "  <head>",
  "    <meta charset=\"UTF-8\" />",
  "    <title>Codex Usage Profile</title>",
  "  </head>",
  "  <body><div id=\"root\"></div></body>",
  "</html>"
].join("\n");

function createHandler(overrides = {}) {
  return createPublicProfileDocumentHandler({
    loadIndexHtml: async () => INDEX_HTML,
    resolveProfile: async (handle) => (
      handle === "postmelee"
        ? { cardLocale: "ko", handle: "postmelee", uploadedAt: UPLOADED_AT }
        : null
    ),
    ...overrides
  });
}

test("reads the handle from public profile document paths", () => {
  assert.equal(readPublicProfileDocumentHandle("/u/postmelee"), "postmelee");
  assert.equal(readPublicProfileDocumentHandle("/u/postmelee/"), "postmelee");
  assert.equal(readPublicProfileDocumentHandle("/u/foo%20bar"), "foo bar");
  assert.equal(readPublicProfileDocumentHandle("/u/postmelee/card.png"), null);
  assert.equal(readPublicProfileDocumentHandle("/u/"), null);
  assert.equal(readPublicProfileDocumentHandle("/profile"), null);
  assert.equal(readPublicProfileDocumentHandle("/u/%zz"), null);
});

test("reads the handle from the Sites-compatible profile query", () => {
  assert.equal(
    readPublicProfileDocumentRequestHandle(
      new Request(`${BASE_URL}/?profile=postmelee`)
    ),
    "postmelee"
  );
  assert.equal(
    readPublicProfileDocumentRequestHandle(
      new Request(`${BASE_URL}/?locale=ko&profile=foo%20bar`)
    ),
    "foo bar"
  );
  assert.equal(
    readPublicProfileDocumentRequestHandle(
      new Request(`${BASE_URL}/?profile=one&profile=two`)
    ),
    null
  );
  assert.equal(
    readPublicProfileDocumentRequestHandle(
      new Request(`${BASE_URL}/settings?profile=postmelee`)
    ),
    null
  );
  assert.equal(
    readPublicProfileDocumentRequestHandle(
      new Request(`${BASE_URL}/?profile=foo%2Fbar`)
    ),
    null
  );
});

test("reads the handle from the Worker-routed API share path", () => {
  assert.equal(
    readPublicProfileDocumentRequestHandle(
      new Request(`${BASE_URL}/api/share/postmelee`)
    ),
    "postmelee"
  );
  assert.equal(
    readPublicProfileDocumentRequestHandle(
      new Request(`${BASE_URL}/api/share/foo%20bar/`)
    ),
    "foo bar"
  );
  assert.equal(
    readPublicProfileDocumentRequestHandle(
      new Request(`${BASE_URL}/api/share/one/more`)
    ),
    null
  );
  assert.equal(
    readPublicProfileDocumentRequestHandle(
      new Request(`${BASE_URL}/api/share/foo%2Fbar`)
    ),
    null
  );
});

test("matches only GET and HEAD document requests", () => {
  assert.equal(
    isPublicProfileDocumentRequest(new Request(`${BASE_URL}/u/postmelee`)),
    true
  );
  assert.equal(
    isPublicProfileDocumentRequest(
      new Request(`${BASE_URL}/u/postmelee`, { method: "HEAD" })
    ),
    true
  );
  assert.equal(
    isPublicProfileDocumentRequest(
      new Request(`${BASE_URL}/u/postmelee`, { method: "POST" })
    ),
    false
  );
  assert.equal(
    isPublicProfileDocumentRequest(
      new Request(`${BASE_URL}/u/postmelee/card.png`)
    ),
    false
  );
  assert.equal(
    isPublicProfileDocumentRequest(
      new Request(`${BASE_URL}/?profile=postmelee`)
    ),
    true
  );
  assert.equal(
    isPublicProfileDocumentRequest(
      new Request(`${BASE_URL}/?profile=postmelee`, { method: "POST" })
    ),
    false
  );
  assert.equal(
    isPublicProfileDocumentRequest(
      new Request(`${BASE_URL}/api/share/postmelee`)
    ),
    true
  );
  assert.equal(
    isPublicProfileDocumentRequest(
      new Request(`${BASE_URL}/api/share/postmelee`, { method: "HEAD" })
    ),
    true
  );
  assert.equal(
    isPublicProfileDocumentRequest(
      new Request(`${BASE_URL}/api/share/postmelee`, { method: "POST" })
    ),
    false
  );
});

test("returns null for requests it does not own", async () => {
  const handler = createHandler();

  assert.equal(await handler(new Request(`${BASE_URL}/`)), null);
  assert.equal(await handler(new Request(`${BASE_URL}/profile`)), null);
  assert.equal(
    await handler(new Request(`${BASE_URL}/u/postmelee/card.png`)),
    null
  );
  assert.equal(
    await handler(new Request(`${BASE_URL}/u/postmelee`, { method: "POST" })),
    null
  );
});

test("serves the injected document for a public profile", async () => {
  const handler = createHandler();
  const response = await handler(
    new Request(`${BASE_URL}/api/share/postmelee`)
  );
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("content-type"),
    "text/html; charset=utf-8"
  );
  assert.equal(
    response.headers.get("cache-control"),
    PUBLIC_PROFILE_DOCUMENT_CACHE_CONTROL
  );
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.ok(body.includes("property=\"og:title\""));
  assert.ok(body.includes(`${BASE_URL}/api/share/postmelee`));
  assert.ok(body.includes(`${BASE_URL}/u/postmelee/social.png?v=`));
  assert.ok(body.includes("<div id=\"root\"></div>"));
});

test("accepts the minimal store resolver summary", async () => {
  const handler = createHandler({
    resolveProfile: async () => ({
      cardLocale: "ko",
      handle: "postmelee",
      imageRevisionAt: UPLOADED_AT
    })
  });
  const body = await (
    await handler(new Request(`${BASE_URL}/api/share/postmelee`))
  ).text();

  assert.ok(body.includes("postmelee's Codex card"));
  assert.ok(body.includes(`/u/postmelee/social.png?v=${Date.parse(UPLOADED_AT)}`));
});

test("keeps documents distinct per handle", async () => {
  const handler = createPublicProfileDocumentHandler({
    loadIndexHtml: async () => INDEX_HTML,
    resolveProfile: async (handle) => ({
      cardLocale: "en",
      handle,
      uploadedAt: UPLOADED_AT
    })
  });

  const first = await (
    await handler(new Request(`${BASE_URL}/api/share/alice`))
  ).text();
  const second = await (
    await handler(new Request(`${BASE_URL}/api/share/bob`))
  ).text();

  assert.ok(first.includes("alice's Codex card"));
  assert.ok(second.includes("bob's Codex card"));
  assert.notEqual(first, second);
});

test("falls back to site tags for private and missing handles", async () => {
  const handler = createHandler();
  const missing = await (
    await handler(new Request(`${BASE_URL}/api/share/ghost`))
  ).text();
  const privateProfile = await (
    await handler(new Request(`${BASE_URL}/api/share/hidden`))
  ).text();

  assert.equal(missing, privateProfile);
  assert.ok(missing.includes("<title>Codex Usage Profile</title>"));
  assert.ok(missing.includes("/assets/codex-social-sample.png"));
  assert.ok(!missing.includes("/u/postmelee/social.png"));
  assert.ok(!missing.includes("/u/ghost/social.png"));
  assert.ok(!missing.includes("/u/hidden/social.png"));
  assert.ok(missing.includes("content=\"summary_large_image\""));
});

test("keeps profile metadata but falls back when personalized social media is unavailable", async () => {
  const handler = createHandler({
    resolveProfile: async () => ({
      cardLocale: "ko",
      handle: "postmelee",
      imageRevisionAt: UPLOADED_AT,
      socialImageAvailable: false
    })
  });
  const body = await (
    await handler(new Request(`${BASE_URL}/api/share/postmelee`))
  ).text();

  assert.ok(body.includes("postmelee's Codex card"));
  assert.ok(body.includes(`${BASE_URL}/api/share/postmelee`));
  assert.ok(body.includes(`${BASE_URL}/assets/codex-social-sample.png`));
  assert.ok(!body.includes("/u/postmelee/social.png"));
});

test("falls back to site tags when the profile lookup fails", async () => {
  const handler = createHandler({
    resolveProfile: async () => {
      throw new Error("D1 unavailable");
    }
  });
  const response = await handler(new Request(`${BASE_URL}/u/postmelee`));

  assert.equal(response.status, 200);
  assert.ok((await response.text()).includes("<title>Codex Usage Profile</title>"));
});

test("ignores profiles without a usable image revision date", async () => {
  const handler = createHandler({
    resolveProfile: async () => ({
      cardLocale: "en",
      handle: "postmelee",
      imageRevisionAt: "not-a-date"
    })
  });
  const body = await (
    await handler(new Request(`${BASE_URL}/u/postmelee`))
  ).text();

  assert.ok(body.includes("<title>Codex Usage Profile</title>"));
});

test("omits the body for HEAD requests", async () => {
  const handler = createHandler();
  const response = await handler(
    new Request(`${BASE_URL}/api/share/postmelee`, { method: "HEAD" })
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "");
  assert.equal(
    response.headers.get("cache-control"),
    PUBLIC_PROFILE_DOCUMENT_CACHE_CONTROL
  );
});

test("uses publicBaseUrl for absolute tag urls when provided", async () => {
  const handler = createHandler({ publicBaseUrl: "https://canonical.test" });
  const body = await (
    await handler(new Request(`${BASE_URL}/u/postmelee`))
  ).text();

  assert.ok(body.includes("https://canonical.test/u/postmelee/social.png?v="));
  assert.ok(!body.includes(`${BASE_URL}/u/postmelee/social.png`));
});

test("returns null when the index document cannot be injected", async () => {
  const handler = createHandler({
    loadIndexHtml: async () => "<html><body>no head</body></html>"
  });

  assert.equal(await handler(new Request(`${BASE_URL}/u/postmelee`)), null);
});

test("returns null when the index document is unavailable", async () => {
  const handler = createHandler({ loadIndexHtml: async () => "" });

  assert.equal(await handler(new Request(`${BASE_URL}/u/postmelee`)), null);
});

test("requires the loader and resolver dependencies", () => {
  assert.throws(
    () => createPublicProfileDocumentHandler({ resolveProfile: async () => null }),
    TypeError
  );
  assert.throws(
    () => createPublicProfileDocumentHandler({ loadIndexHtml: async () => "" }),
    TypeError
  );
});
