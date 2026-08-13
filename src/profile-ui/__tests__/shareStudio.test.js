import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPublicProfileShareUrl,
  buildShareTargets,
  formatShareStudioPlatformMessage,
  getShareStudioCopy,
  isMobileShareEnvironment
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
    "https://profiles.example.test/api/share/postmelee"
  );
  assert.equal(buildPublicProfileShareUrl("javascript:alert(1)", "postmelee"), null);
  assert.equal(buildPublicProfileShareUrl("https://profiles.example.test", "../owner"), null);
  assert.equal(buildPublicProfileShareUrl("https://profiles.example.test", ""), null);
});

test("detects mobile share environments without viewport heuristics", () => {
  const cases = [
    {
      expected: true,
      label: "UA-CH mobile",
      navigatorLike: {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        userAgentData: { mobile: true }
      }
    },
    {
      expected: false,
      label: "UA-CH desktop remains authoritative over a mobile-looking UA",
      navigatorLike: {
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
        userAgentData: { mobile: false }
      }
    },
    {
      expected: true,
      label: "iPhone UA fallback",
      navigatorLike: {
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"
      }
    },
    {
      expected: true,
      label: "iPod UA fallback",
      navigatorLike: {
        userAgent: "Mozilla/5.0 (iPod touch; CPU iPhone OS 17_0 like Mac OS X)"
      }
    },
    {
      expected: true,
      label: "iPad UA fallback",
      navigatorLike: {
        userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)"
      }
    },
    {
      expected: true,
      label: "Android UA fallback",
      navigatorLike: {
        userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro)"
      }
    },
    {
      expected: true,
      label: "iPadOS desktop-class UA fallback",
      navigatorLike: {
        maxTouchPoints: 5,
        platform: "MacIntel",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)"
      }
    },
    {
      expected: false,
      label: "Mac desktop",
      navigatorLike: {
        maxTouchPoints: 0,
        platform: "MacIntel",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)"
      }
    },
    {
      expected: false,
      label: "touch-capable Windows desktop",
      navigatorLike: {
        maxTouchPoints: 10,
        platform: "Win32",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    },
    { expected: false, label: "partial navigator", navigatorLike: {} },
    { expected: false, label: "missing navigator", navigatorLike: null }
  ];

  for (const { expected, label, navigatorLike } of cases) {
    assert.equal(isMobileShareEnvironment(navigatorLike), expected, label);
  }
});

test("builds allowlisted external share composition URLs", () => {
  const profileUrl = "https://profiles.example.test/u/postmelee";
  const targets = buildShareTargets({ locale: "ko-KR", profileUrl });

  assert.deepEqual(targets.map(({ id, label }) => ({ id, label })), [
    { id: "x", label: "X" },
    { id: "threads", label: "Threads" },
    { id: "linkedin", label: "LinkedIn" },
    { id: "facebook", label: "Facebook" },
    { id: "reddit", label: "Reddit" }
  ]);

  const [x, threads, linkedIn, facebook, reddit] = targets
    .map((target) => new URL(target.href));
  assert.equal(x.origin, "https://x.com");
  assert.equal(x.pathname, "/intent/tweet");
  assert.equal(x.searchParams.get("text"), "나의 Codex 사용량 활동을 확인해 보세요.");
  assert.equal(x.searchParams.get("url"), profileUrl);
  assert.deepEqual([...x.searchParams.keys()].sort(), ["text", "url"]);

  assert.equal(threads.origin, "https://www.threads.net");
  assert.equal(threads.pathname, "/intent/post");
  assert.equal(threads.searchParams.get("url"), profileUrl);
  assert.deepEqual([...threads.searchParams.keys()].sort(), ["text", "url"]);

  // Facebook's sharer only accepts the link; prefilled text is not allowed.
  assert.equal(facebook.origin, "https://www.facebook.com");
  assert.equal(facebook.pathname, "/sharer/sharer.php");
  assert.equal(facebook.searchParams.get("u"), profileUrl);
  assert.deepEqual([...facebook.searchParams.keys()], ["u"]);

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

test("limits mobile share targets without changing narrow desktop defaults", () => {
  const profileUrl = "https://profiles.example.test/u/postmelee";

  assert.deepEqual(
    buildShareTargets({ locale: "en", mobile: true, profileUrl })
      .map(({ id }) => id),
    ["x", "threads", "reddit"]
  );
  assert.deepEqual(
    buildShareTargets({ locale: "en", mobile: false, profileUrl })
      .map(({ id }) => id),
    ["x", "threads", "linkedin", "facebook", "reddit"]
  );
  assert.deepEqual(
    buildShareTargets({ locale: "en", profileUrl }).map(({ id }) => id),
    ["x", "threads", "linkedin", "facebook", "reddit"]
  );
});

test("serializes Threads spaces as percent escapes and preserves literal plus signs", () => {
  for (const locale of ["en-US", "ko-KR"]) {
    const profileUrl = "https://profiles.example.test/u/activity+plus";
    const threads = buildShareTargets({ locale, profileUrl })
      .find(({ id }) => id === "threads");
    const copy = getShareStudioCopy(locale);
    const url = new URL(threads.href);

    assert.ok(
      threads.href.includes(`text=${encodeURIComponent(copy.socialText)}`),
      `${locale} text uses %20 serialization`
    );
    assert.doesNotMatch(
      threads.href,
      /[?&]text=[^&]*\+/,
      `${locale} text does not contain form-encoded spaces`
    );
    assert.match(threads.href, /url=[^&]*activity%2Bplus/);
    assert.equal(url.searchParams.get("text"), copy.socialText);
    assert.equal(url.searchParams.get("url"), profileUrl);
  }
});

test("rejects non-http and missing public profile targets", () => {
  assert.deepEqual(buildShareTargets({ profileUrl: null }), []);
  assert.deepEqual(buildShareTargets({ profileUrl: "data:text/plain,hello" }), []);
  assert.deepEqual(buildShareTargets({ profileUrl: "/u/postmelee" }), []);
});
