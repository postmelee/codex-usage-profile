import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPublicProfileShareUrl,
  buildShareTargets,
  formatShareStudioPlatformMessage,
  getShareStudioCopy
} from "../shareStudio.js";

test("resolves Korean and English Share Studio copy", () => {
  assert.equal(getShareStudioCopy("ko-KR").title, "활동 공유하기");
  assert.equal(
    getShareStudioCopy("ko-KR").pasteImage,
    "게시물에 이미지를 붙여넣으세요"
  );
  assert.equal(getShareStudioCopy("en-US").title, "Share activity");
  assert.equal(
    getShareStudioCopy("en-US").previewUnavailable,
    "Card preview is unavailable. Sharing options are still available."
  );
  assert.equal(getShareStudioCopy("ja-JP").title, "Share activity");
});

test("formats platform messages once for every locale and share target", () => {
  const expectations = {
    en: {
      openComposer: (platform) => `Open ${platform} composer`,
      shareInstructionsTitle: (platform) => `Share to ${platform}`
    },
    ko: {
      openComposer: (platform) => `${platform} 작성 창 열기`,
      shareInstructionsTitle: (platform) => `${platform}에 공유`
    }
  };

  for (const [locale, messages] of Object.entries(expectations)) {
    for (const platform of ["X", "LinkedIn", "Reddit"]) {
      for (const [key, expected] of Object.entries(messages)) {
        const message = formatShareStudioPlatformMessage(locale, key, platform);
        assert.equal(message, expected(platform));
        assert.doesNotMatch(message, /\{platform\}/);
      }
    }
  }
});

test("rejects unsupported platform message keys and invalid labels", () => {
  assert.throws(
    () => formatShareStudioPlatformMessage("en", "title", "X"),
    /Unsupported Share Studio platform message/
  );
  assert.throws(
    () => formatShareStudioPlatformMessage("en", "openComposer", " "),
    /non-empty string/
  );
});

test("builds the canonical Sites public profile URL", () => {
  assert.equal(
    buildPublicProfileShareUrl(
      "https://profiles.example.test/ignored?view=settings",
      "postmelee"
    ),
    "https://profiles.example.test/u/postmelee"
  );
  assert.equal(buildPublicProfileShareUrl("javascript:alert(1)", "postmelee"), null);
  assert.equal(buildPublicProfileShareUrl("https://profiles.example.test", "../owner"), null);
  assert.equal(buildPublicProfileShareUrl("https://profiles.example.test", ""), null);
});

test("builds allowlisted external share composition URLs", () => {
  const profileUrl = "https://profiles.example.test/u/postmelee";
  const targets = buildShareTargets({ locale: "ko-KR", profileUrl });

  assert.deepEqual(targets.map(({ id, label }) => ({ id, label })), [
    { id: "x", label: "X" },
    { id: "linkedin", label: "LinkedIn" },
    { id: "reddit", label: "Reddit" }
  ]);

  const [x, linkedIn, reddit] = targets.map((target) => new URL(target.href));
  assert.equal(x.origin, "https://x.com");
  assert.equal(x.pathname, "/intent/post");
  assert.equal(x.searchParams.get("text"), "나의 Codex 사용량 활동을 확인해 보세요.");
  assert.equal(x.searchParams.get("url"), profileUrl);
  assert.deepEqual([...x.searchParams.keys()].sort(), ["text", "url"]);

  assert.equal(linkedIn.origin, "https://www.linkedin.com");
  assert.equal(linkedIn.pathname, "/feed/");
  assert.equal(linkedIn.searchParams.get("shareActive"), "true");
  assert.equal(
    linkedIn.searchParams.get("text"),
    "나의 Codex 사용량 활동을 확인해 보세요."
  );
  assert.equal(linkedIn.searchParams.get("shareUrl"), profileUrl);
  assert.deepEqual(
    [...linkedIn.searchParams.keys()].sort(),
    ["shareActive", "shareUrl", "text"]
  );

  assert.equal(reddit.origin, "https://www.reddit.com");
  assert.equal(reddit.pathname, "/submit");
  assert.equal(
    reddit.searchParams.get("title"),
    "나의 Codex 사용량 활동을 확인해 보세요."
  );
  assert.equal(reddit.searchParams.get("url"), profileUrl);
  assert.deepEqual([...reddit.searchParams.keys()].sort(), ["title", "url"]);
});

test("rejects non-http and missing public profile targets", () => {
  assert.deepEqual(buildShareTargets({ profileUrl: null }), []);
  assert.deepEqual(buildShareTargets({ profileUrl: "data:text/plain,hello" }), []);
  assert.deepEqual(buildShareTargets({ profileUrl: "/u/postmelee" }), []);
});
