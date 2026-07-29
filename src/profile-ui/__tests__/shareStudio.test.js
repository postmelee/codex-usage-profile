import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPublicProfileShareUrl,
  buildShareTargets,
  getShareStudioCopy
} from "../shareStudio.js";

test("resolves Korean and English Share Studio copy", () => {
  assert.equal(getShareStudioCopy("ko-KR").title, "활동 공유하기");
  assert.equal(
    getShareStudioCopy("ko-KR").pasteImage,
    "게시물에 이미지를 붙여넣으세요"
  );
  assert.equal(getShareStudioCopy("en-US").title, "Share activity");
  assert.equal(getShareStudioCopy("ja-JP").title, "Share activity");
});

test("builds the canonical Sites public profile URL", () => {
  assert.equal(
    buildPublicProfileShareUrl(
      "https://profiles.example.test/ignored?view=settings",
      "postmelee"
    ),
    "https://profiles.example.test/?profile=postmelee"
  );
  assert.equal(buildPublicProfileShareUrl("javascript:alert(1)", "postmelee"), null);
  assert.equal(buildPublicProfileShareUrl("https://profiles.example.test", "../owner"), null);
  assert.equal(buildPublicProfileShareUrl("https://profiles.example.test", ""), null);
});

test("builds allowlisted external share composition URLs", () => {
  const profileUrl = "https://profiles.example.test/?profile=postmelee";
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
  assert.deepEqual([...x.searchParams.keys()], ["text"]);

  assert.equal(linkedIn.origin, "https://www.linkedin.com");
  assert.equal(linkedIn.pathname, "/feed/");
  assert.equal(linkedIn.searchParams.get("shareActive"), "true");
  assert.equal(
    linkedIn.searchParams.get("text"),
    "나의 Codex 사용량 활동을 확인해 보세요."
  );
  assert.deepEqual([...linkedIn.searchParams.keys()].sort(), ["shareActive", "text"]);

  assert.equal(reddit.origin, "https://www.reddit.com");
  assert.equal(reddit.pathname, "/submit");
  assert.equal(
    reddit.searchParams.get("title"),
    "나의 Codex 사용량 활동을 확인해 보세요."
  );
  assert.deepEqual([...reddit.searchParams.keys()], ["title"]);
});

test("rejects non-http and missing public profile targets", () => {
  assert.deepEqual(buildShareTargets({ profileUrl: null }), []);
  assert.deepEqual(buildShareTargets({ profileUrl: "data:text/plain,hello" }), []);
  assert.deepEqual(buildShareTargets({ profileUrl: "/?profile=postmelee" }), []);
});
