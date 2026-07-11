import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLocalizedCardUrl,
  buildProfileLoginHref,
  buildReadmeCardSnippet,
  resolveShareLocale
} from "../cardShare.js";

test("resolves supported share locales", () => {
  assert.equal(resolveShareLocale("ko-KR"), "ko");
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

test("builds GitHub login links that always return to the owner profile", () => {
  const client = {
    buildGitHubLoginUrl(options) {
      assert.deepEqual(options, { redirectTo: "/profile" });
      return "/login?redirect_to=%2Fprofile";
    }
  };
  assert.equal(buildProfileLoginHref(client), "/login?redirect_to=%2Fprofile");
  assert.equal(
    buildProfileLoginHref(null),
    "/api/auth/github/login?redirect_to=%2Fprofile"
  );
});
