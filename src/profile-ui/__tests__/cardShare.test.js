import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLocalizedCardUrl,
  buildProfileLoginHref,
  buildReadmeCardSnippet,
  resolveShareLocale,
  resolveShareTheme
} from "../cardShare.js";

test("resolves supported share locales", () => {
  assert.equal(resolveShareLocale("ko-KR"), "ko");
  assert.equal(resolveShareLocale("KO_kr"), "ko");
  assert.equal(resolveShareLocale("en-US"), "en");
  assert.equal(resolveShareLocale("ja-JP"), "en");
});

test("builds localized image URLs and README snippets", () => {
  const korean = buildLocalizedCardUrl(
    "https://profiles.example.test/u/postmelee/card.png",
    "ko-KR"
  );
  assert.equal(
    korean,
    "https://profiles.example.test/u/postmelee/card.png?locale=ko"
  );
  assert.equal(
    buildLocalizedCardUrl(korean, "en"),
    "https://profiles.example.test/u/postmelee/card.png"
  );
  assert.equal(
    buildReadmeCardSnippet(korean),
    `![Codex usage profile](${korean})`
  );
});

test("normalizes selected card theme and locale independently", () => {
  const base = "https://profiles.example.test/u/postmelee/card.png";
  assert.equal(resolveShareTheme("light"), "light");
  assert.equal(resolveShareTheme("dark"), "dark");
  assert.equal(resolveShareTheme("unsupported"), "dark");
  assert.equal(
    buildLocalizedCardUrl(`${base}?locale=ko&theme=light`, "en", "dark"),
    `${base}?theme=dark`
  );
  assert.equal(
    buildLocalizedCardUrl(`${base}?theme=dark`, "ko", "light"),
    `${base}?theme=light&locale=ko`
  );
  assert.equal(
    buildLocalizedCardUrl("/u/postmelee/card.png", "ko", "light"),
    "/u/postmelee/card.png?theme=light&locale=ko"
  );
});

test("preserves legacy queryless dark URLs and rejects unsafe schemes", () => {
  assert.equal(
    buildLocalizedCardUrl("https://profiles.example.test/u/postmelee/card.png", "en"),
    "https://profiles.example.test/u/postmelee/card.png"
  );
  assert.equal(buildLocalizedCardUrl("javascript:alert(1)", "en", "dark"), null);
  assert.equal(buildLocalizedCardUrl("data:image/png;base64,abc", "en"), null);
});

test("builds GitHub login links that always return to the owner profile", () => {
  const client = {
    buildGitHubLoginUrl(options) {
      assert.deepEqual(options, { redirectTo: "/?view=profile" });
      return "/login?redirect_to=%2F%3Fview%3Dprofile";
    }
  };
  assert.equal(
    buildProfileLoginHref(client),
    "/login?redirect_to=%2F%3Fview%3Dprofile"
  );
  assert.equal(
    buildProfileLoginHref(null),
    "/api/auth/github/login?redirect_to=%2F%3Fview%3Dprofile"
  );
});
