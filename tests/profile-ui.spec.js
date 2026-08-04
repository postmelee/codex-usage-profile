import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

const PROFILE_ROUTE = "/u/postmelee";
const SITES_PROFILE_ROUTE = "/?profile=postmelee";
const CARD_PNG = readFileSync(new URL(
  "../public/assets/codex-card-sample.png",
  import.meta.url
));
const STYLESHEET = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const HOME_CARD_SKELETON_HEATMAP_CELL_COUNT = 26 * 7;
const SUBMIT_COMMAND = "npx codex-usage-profile@latest submit";
const THEME_STORAGE_KEY = "codex-usage-profile:appearance";
const PROFILE_DAILY_USAGE_BUCKETS = Object.freeze([
  Object.freeze({ startDate: "2026-06-01", tokens: 50_000_000 }),
  Object.freeze({ startDate: "2026-06-04", tokens: 50_000_000 }),
  Object.freeze({ startDate: "2026-06-07", tokens: 25_000_000 }),
  Object.freeze({ startDate: "2026-06-11", tokens: 100_000_000 })
]);
const AUTH_OWNER = Object.freeze({
  avatarUrl: "/assets/postmelee-avatar.png",
  displayName: "postmelee",
  githubLogin: "postmelee",
  handle: "postmelee",
  id: "owner_1",
  visibility: "private"
});

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
});

test.describe("theme surfaces", () => {
  test("theme surfaces keep raw colors inside tokens and approved artwork", () => {
    const approvedArtworkSelectors = [
      ".avatar-fallback",
      ".avatar-face-top",
      ".avatar-face-mouth",
      ".avatar-face-teeth",
      ".plugin-icon",
      ".plugin-icon-face-top",
      ".plugin-icon-face-left",
      ".plugin-icon-face-right"
    ];
    const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    let componentCss = STYLESHEET.replace(/:root\s*\{[\s\S]*?\n\}/, "");
    for (const selector of approvedArtworkSelectors) {
      componentCss = componentCss.replace(
        new RegExp(`${escapeRegExp(selector)}\\s*\\{[^}]*\\}`, "g"),
        ""
      );
    }

    expect(STYLESHEET).toContain("--page-background:");
    expect(STYLESHEET).toContain("--surface-primary:");
    expect(STYLESHEET).toContain("--heatmap-level-4:");
    expect(STYLESHEET).toContain("--overlay-scrim:");
    expect(componentCss).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    expect(componentCss).not.toMatch(
      /var\(--(?:bg|surface|frame-border|text|muted|faint|line|line-strong|blue|cell-(?:empty|[1-4]))\)/
    );
  });

  test("theme surfaces resolve light colors across product routes", async ({ page }) => {
    await useThemePreference(page, "light");
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("public"),
      ok: true
    }));
    await page.route("**/api/settings/tokens", (route) => fulfillJson(route, {
      data: { tokens: [] },
      ok: true
    }));
    await page.route("**/api/settings/devices", (route) => fulfillJson(route, {
      data: { devices: [] },
      ok: true
    }));
    await mockCardImages(page);
    await mockPublicProfile(page);

    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(247, 247, 246)");
    await expect(page.locator(".home-view")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(page.locator(".profile-topbar")).toHaveCSS(
      "background-color",
      "rgba(255, 255, 255, 0.94)"
    );

    await page.goto("/settings");
    await expect(page.locator(".settings-view")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(page.locator(".settings-panel").first()).toHaveCSS("background-color", "rgb(255, 255, 255)");

    await page.goto("/?view=device&user_code=ABCD-1234");
    await expect(page.locator(".device-view")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(page.locator(".device-panel")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(page.locator(".device-form input")).toHaveCSS("background-color", "rgb(255, 255, 255)");

    await page.goto("/profile");
    await expect(page.locator(".card-profile-view")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(page.locator(".token-level-0").first()).toHaveCSS("background-color", "rgb(229, 229, 227)");
    await page.getByRole("grid", { name: "Daily token activity" })
      .locator('[data-date="2026-06-11"]')
      .hover();
    await expect(page.getByRole("tooltip")).toHaveCSS("background-color", "rgb(37, 37, 37)");
    await page.locator(".profile-card-account-state")
      .getByRole("button", { name: "Share", exact: true })
      .click();
    await expect(page.locator(".share-studio-action-icon").first())
      .toHaveCSS("background-color", "rgb(23, 23, 23)");
    await page.getByRole("button", { name: "Close Share Studio" }).click();

    await page.goto(SITES_PROFILE_ROUTE);
    await expect(page.locator(".public-profile-view")).toHaveCSS("background-color", "rgb(255, 255, 255)");

    await page.goto("/sites.html");
    await expect(page.locator(".home-view")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  });

  test("theme surfaces preserve the existing dark baseline", async ({ page }) => {
    await useThemePreference(page, "dark");
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("public"),
      ok: true
    }));
    await page.route("**/api/settings/tokens", (route) => fulfillJson(route, {
      data: { tokens: [] },
      ok: true
    }));
    await page.route("**/api/settings/devices", (route) => fulfillJson(route, {
      data: { devices: [] },
      ok: true
    }));
    await mockCardImages(page);

    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(0, 0, 0)");
    await expect(page.locator(".home-view")).toHaveCSS("background-color", "rgb(13, 13, 13)");
    await expect(page.locator(".profile-topbar")).toHaveCSS(
      "background-color",
      "rgba(23, 23, 23, 0.94)"
    );

    await page.goto("/settings");
    await expect(page.locator(".settings-view")).toHaveCSS("background-color", "rgb(13, 13, 13)");
    await expect(page.locator(".settings-panel").first()).toHaveCSS("background-color", "rgb(23, 23, 23)");

    await page.goto("/profile");
    await expect(page.locator(".token-level-0").first()).toHaveCSS("background-color", "rgb(36, 36, 36)");
    await page.getByRole("grid", { name: "Daily token activity" })
      .locator('[data-date="2026-06-11"]')
      .hover();
    await expect(page.getByRole("tooltip")).toHaveCSS("background-color", "rgb(63, 64, 66)");
    await page.locator(".profile-card-account-state")
      .getByRole("button", { name: "Share", exact: true })
      .click();
    await expect(page.locator(".share-studio-action-icon").first())
      .toHaveCSS("background-color", "rgb(244, 244, 244)");
  });
});

test.describe("Stage 2 locale surfaces", () => {
  test("locale shell follows Korean browser preferences", async ({ page }) => {
    await useKoreanLocale(page);
    await mockAnonymousAccount(page);
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await expect(page.locator(".profile-actions")).toHaveAttribute(
      "aria-label",
      "페이지 작업"
    );
    await expect(page.getByRole("link", { name: "로그인", exact: true }))
      .toBeVisible();
    await expect(page.getByRole("link", { name: "GitHub로 로그인" }))
      .toBeVisible();
  });

  test("locale onboarding localizes product and sample-only Sites copy", async ({ page }) => {
    await useKoreanLocale(page);
    const apiRequests = [];
    await page.route("**/api/**", (route) => {
      apiRequests.push(route.request().url());
      return route.abort();
    });
    await page.goto("/sites.html");

    await expect(page.getByRole("heading", { name: "빠른 시작" })).toBeVisible();
    await expect(page.getByText("터미널에서 실행", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "기기 승인" })).toBeVisible();
    await expect(page.getByRole("link", { name: "내 카드 만들기" })).toBeVisible();
    expect(apiRequests).toEqual([]);
  });

  test("locale device keeps approval state and guidance in Korean", async ({ page }) => {
    await useKoreanLocale(page);
    await mockAuthenticatedAccount(page);
    await page.route("**/api/auth/device/authorize", (route) => fulfillJson(route, {
      data: {
        approvedAt: "2026-07-31T00:00:00.000Z",
        exchangedAt: null,
        intent: "submit",
        status: "approved"
      },
      ok: true
    }));
    await page.goto("/?view=device&user_code=ABCD-1234");

    await expect(page.getByRole("heading", { level: 1, name: "기기 승인" }))
      .toBeVisible();
    await expect(page.getByLabel("사용자 코드")).toHaveValue("ABCD-1234");
    await page.getByRole("button", { name: "기기 승인", exact: true }).click();
    await expect(page.getByRole("button", { name: "기기 승인 완료" })).toBeDisabled();
    await expect(page.getByText(
      "인증이 완료되었습니다. 터미널로 돌아가 계속 진행하고 최종 제출 결과를 확인하세요.",
      { exact: true }
    )).toBeVisible();
  });

  test("locale settings localizes account and empty management states", async ({ page }) => {
    await useKoreanLocale(page);
    await mockAuthenticatedAccount(page);
    await page.route("**/api/settings/tokens", (route) => fulfillJson(route, {
      data: { tokens: [] },
      ok: true
    }));
    await page.route("**/api/settings/devices", (route) => fulfillJson(route, {
      data: { devices: [] },
      ok: true
    }));
    await page.goto("/settings");

    await expect(page.getByRole("heading", { level: 1, name: "설정" }))
      .toBeVisible();
    for (const sectionName of ["GitHub 계정", "API 토큰", "기기"]) {
      await expect(page.getByRole("heading", { level: 2, name: sectionName }))
        .toBeVisible();
    }
    await expect(page.getByText("API 토큰이 없습니다.", { exact: true })).toBeVisible();
    await expect(page.getByText("등록된 기기가 없습니다.", { exact: true })).toBeVisible();
  });
});

test.describe("Stage 3 locale surfaces", () => {
  test("locale profile keeps owner data while localizing summary and card", async ({ page }) => {
    await useKoreanLocale(page);
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("public"),
      ok: true
    }));
    await mockCardImages(page);
    await page.goto("/profile");

    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await expect(page.getByRole("heading", { level: 1, name: "postmelee" }))
      .toBeVisible();
    await expect(page.locator(".profile-header .avatar-shell"))
      .toHaveAttribute("aria-hidden", "true");
    await expect(page.getByText("누적 토큰", { exact: true })).toBeVisible();
    await expect(page.getByText("2.5억", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "내 Codex 카드" }))
      .toBeVisible();
    await expect(page.getByText("공개", { exact: true })).toBeVisible();
    const card = page.getByRole("img", { name: "내 Codex 사용량 카드" });
    await expect(card).toHaveAttribute("src", /[?&]locale=ko(?:&|$)/);

    await page.evaluate(() => {
      Object.defineProperty(navigator, "languages", {
        configurable: true,
        get: () => ["en-US"]
      });
      Object.defineProperty(navigator, "language", {
        configurable: true,
        get: () => "en-US"
      });
      globalThis.dispatchEvent(new Event("languagechange"));
    });

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1, name: "postmelee" }))
      .toBeVisible();
    await expect(page.getByText("Lifetime tokens", { exact: true })).toBeVisible();
    await expect(page.getByText("250M", { exact: true })).toBeVisible();
    await page.getByRole("grid", { name: "Daily token activity" })
      .locator('[data-date="2026-06-11"]')
      .hover();
    await expect(page.getByRole("tooltip")).toHaveText(
      "June 11, 2026 · 100M tokens"
    );
    const englishCard = page.getByRole("img", { name: "Your Codex usage card" });
    await expect(englishCard).not.toHaveAttribute("src", /[?&]locale=ko(?:&|$)/);
  });

  test("locale heatmap localizes modes, tooltips, exact count, and month labels", async ({ page }) => {
    await useKoreanLocale(page);
    await mockAuthenticatedAccount(page);
    await mockCardImages(page);
    await page.goto("/profile");

    const dailyGrid = page.getByRole("grid", { name: "일별 토큰 활동" });
    const latest = dailyGrid.locator('[data-date="2026-06-11"]');
    await latest.hover();
    await expect(page.getByRole("tooltip")).toHaveText(
      "2026년 6월 11일 · 1억 토큰"
    );
    const exactToggle = page.getByRole("checkbox", {
      name: "정확한 토큰 수 표시"
    });
    await exactToggle.check();
    await latest.hover();
    await expect(page.getByRole("tooltip")).toHaveText(
      "2026년 6월 11일 · 1억 토큰 (100,000,000)"
    );

    await page.getByRole("button", { name: "주간" }).click();
    await expect(page.getByRole("grid", { name: "주간 토큰 활동" })
      .getByRole("gridcell")).toHaveCount(52);
    await expect(page.locator(".month-labels")).toContainText("6월");
  });

  test("locale share uses the global Korean copy and localized card URL", async ({ page }) => {
    await useKoreanLocale(page);
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("public"),
      ok: true
    }));
    await mockCardImages(page);
    await page.goto("/profile");

    await page.locator(".profile-card-account-state")
      .getByRole("button", { name: "공유", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "활동 공유하기" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("공유 대상")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "이미지 URL 복사" })).toHaveAttribute(
      "title",
      /[?&]locale=ko(?:&|$)/
    );
    await expect(dialog.getByRole("button", { name: "공유 스튜디오 닫기" }))
      .toBeVisible();
  });
});

test.describe("Stage 4 locale contract", () => {
  test("unsupported browser locale falls back to English across active routes", async ({ page }) => {
    await useUnsupportedLocale(page);
    await mockAuthenticatedAccount(page);
    await mockCardImages(page);
    await page.route("**/api/settings/tokens", (route) => fulfillJson(route, {
      data: { tokens: [] },
      ok: true
    }));
    await page.route("**/api/settings/devices", (route) => fulfillJson(route, {
      data: { devices: [] },
      ok: true
    }));

    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { name: "Codex Usage Profile" }))
      .toBeVisible();
    await expect(page.getByRole("heading", { name: "Quickstart" })).toBeVisible();

    await page.goto("/settings");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1, name: "Settings" }))
      .toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "GitHub account" }))
      .toBeVisible();

    await page.goto("/?view=device&user_code=ABCD-1234");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1, name: "Authorize device" }))
      .toBeVisible();
    await expect(page.getByText(
      "Only approve a code you requested from the Codex Usage Profile CLI."
    )).toBeVisible();

    await page.unroute("**/api/profile");
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("public"),
      ok: true
    }));
    await page.goto("/profile");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator('dl[aria-label="Usage summary"]')).toBeVisible();
    await page.locator(".profile-card-account-state")
      .getByRole("button", { name: "Share", exact: true })
      .click();
    await expect(page.getByRole("dialog", { name: "Share activity" })).toBeVisible();
    await page.getByRole("button", { name: "Close Share Studio" }).click();

    await mockPublicProfile(page);
    await page.goto(PROFILE_ROUTE);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator('section[aria-label="Public Codex profile"]'))
      .toBeVisible();
    await expect(page.locator('dl[aria-label="Usage summary"]')).toBeVisible();
    await expect(page.getByText("Session cookie is required", { exact: true }))
      .toHaveCount(0);
  });

  test("public profile uses the Korean catalog without mixed accessible labels", async ({ page }) => {
    await useKoreanLocale(page);
    await mockAnonymousAccount(page);
    await mockPublicProfile(page);
    await mockCardImages(page);
    await page.goto(PROFILE_ROUTE);

    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await expect(page.locator('section[aria-label="공개 Codex 프로필"]'))
      .toBeVisible();
    await expect(page.locator('dl[aria-label="사용량 요약"]')).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "공유된 Codex 카드" }))
      .toBeVisible();
    await expect(page.getByText("Profile stats", { exact: true })).toHaveCount(0);
  });
});

test.describe("Marketing mirror", () => {
  test("Marketing stays sample-only and matches the landing layout", async ({ page }, testInfo) => {
    const apiRequests = [];
    await page.route("**/api/**", (route) => {
      apiRequests.push(route.request().url());
      return route.abort();
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/sites.html");

    await expect(page.getByRole("heading", { name: "Codex usage profile" }))
      .toBeVisible();
    const card = page.getByRole("img", { name: "Sample Codex usage card" });
    await expect(card).toHaveAttribute("src", "/assets/codex-card-sample.png");
    await expect.poll(() => card.evaluate((image) => image.naturalWidth)).toBe(1497);
    await expect(page.locator(".home-card-media")).toHaveCSS("opacity", "1");
    await expect(page.getByRole("heading", { name: "Quickstart" })).toBeVisible();
    await expect(page.getByText("npx codex-usage-profile@latest submit", {
      exact: true
    })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create your card" })).toHaveAttribute(
      "href",
      "http://127.0.0.1:5173/"
    );
    const desktopCta = await page.getByRole("link", {
      name: "Create your card"
    }).boundingBox();
    expect(desktopCta).not.toBeNull();
    await expect(page.locator(".profile-topbar, .account-menu, .home-account-identity"))
      .toHaveCount(0);
    await expect(page.getByRole("link", { name: /sign in/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /settings/i })).toHaveCount(0);
    expect(apiRequests).toEqual([]);

    const markup = await page.locator(".home-view").innerHTML();
    for (const privateValue of [
      "owner_1",
      "meleeisdeveloping",
      "githubLogin",
      "tokenDigest"
    ]) {
      expect(markup).not.toContain(privateValue);
    }

    const desktopQuickstart = await page.getByRole("heading", {
      name: "Quickstart"
    }).boundingBox();
    expect(desktopQuickstart).not.toBeNull();
    expect(desktopQuickstart.y).toBeLessThan(900);
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("sites-marketing-desktop.png")
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.locator(".home-card-media")).toHaveCSS("opacity", "1");
    await expect(page.locator(".home-card-tilt")).toHaveAttribute(
      "data-tilt-enabled",
      "false"
    );
    await expect(page.locator("hover-tilt.home-card-tilt")).toHaveCount(0);
    const mobileCard = await page.locator(".home-card-tilt").boundingBox();
    const mobileCta = await page.getByRole("link", {
      name: "Create your card"
    }).boundingBox();
    expect(mobileCard).not.toBeNull();
    expect(mobileCta).not.toBeNull();
    expect(Math.round(mobileCta.width)).toBe(Math.round(desktopCta.width));
    expect(Math.round(mobileCta.height)).toBe(Math.round(desktopCta.height));
    const mobileHeroGap = await page.evaluate(() => {
      const hero = document.querySelector(".home-hero").getBoundingClientRect();
      const cta = document.querySelector(".marketing-app-action").getBoundingClientRect();
      return Math.round(hero.bottom - cta.bottom);
    });
    expect(mobileHeroGap).toBeGreaterThanOrEqual(36);
    expect(mobileHeroGap).toBeLessThanOrEqual(40);
    expect(await page.evaluate(
      () => document.body.scrollWidth > document.documentElement.clientWidth
    )).toBe(false);
    expect(await getClippedHomeElements(page)).toEqual([]);
    expect(apiRequests).toEqual([]);
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("sites-marketing-mobile.png")
    });
  });

  test("Marketing keeps shared visual metrics across product and Sites hosts", async ({ page }) => {
    for (const viewport of [
      { height: 900, width: 1280 },
      { height: 844, width: 390 }
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/sites.html");
      await expect(page.locator(".home-card-media")).toHaveCSS("opacity", "1");
      const sitesMetrics = await getMarketingMetrics(page);

      await mockAnonymousAccount(page);
      await page.goto("/");
      await expect(page.locator(".home-card-media")).toHaveCSS("opacity", "1");
      const productMetrics = await getMarketingMetrics(page);

      expect(productMetrics).toEqual(sitesMetrics);
      expect(productMetrics.card.right).toBeLessThanOrEqual(viewport.width);
      expect(productMetrics.quickstart.right).toBeLessThanOrEqual(viewport.width);
    }
  });
});

test.describe("Home and share card flow", () => {
  test("Home shows the sample card and sends anonymous users to GitHub login", async ({ page }, testInfo) => {
    await mockAnonymousAccount(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    await expect(page.locator(".profile-topbar")).toHaveCSS("height", "52px");
    await expect(page.locator(".profile-topbar-title")).toHaveAttribute("href", "/");
    await expect(page.locator(".profile-topbar-title")).toHaveCSS("font-size", "14px");
    await expect(page.locator(".profile-topbar-title")).toHaveCSS("font-weight", "700");
    await expect(page.locator(".profile-topbar-title")).toHaveText("Codex Usage");
    await expect(page.getByRole("heading", { name: "Codex usage profile" })).toBeVisible();
    await expect(page.getByText(
      "Keep one shareable card up to date with the Codex usage you submit."
    )).toBeVisible();
    await expect(page.getByRole("img", { name: "Sample Codex usage card" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in with GitHub" })).toHaveAttribute(
      "href",
      "/api/auth/github/login?redirect_to=%2F"
    );
    await expect(page.getByRole("heading", { name: "Quickstart" })).toBeVisible();
    await expect(page.getByRole("listitem")).toHaveCount(5);
    await expect(page.getByText("npx codex-usage-profile@latest submit")).toHaveCount(0);

    const topbarMetrics = await page.locator([
      ".profile-topbar-title",
      ".account-login-link"
    ].join(", ")).evaluateAll((elements) => elements.map((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        centerY: bounds.top + bounds.height / 2,
        height: bounds.height,
        lineHeight: getComputedStyle(element).lineHeight
      };
    }));
    const signInTextMetrics = await page.locator(".account-login-link span").evaluate((element) => ({
      clientHeight: element.clientHeight,
      lineHeight: getComputedStyle(element).lineHeight,
      scrollHeight: element.scrollHeight
    }));

    expect(topbarMetrics).toHaveLength(2);
    for (const metric of topbarMetrics) {
      expect(metric.height).toBe(28);
      expect(metric.lineHeight).toBe("20px");
      expect(Math.abs(metric.centerY - topbarMetrics[0].centerY)).toBeLessThanOrEqual(0.5);
    }
    expect(signInTextMetrics).toEqual({
      clientHeight: 20,
      lineHeight: "20px",
      scrollHeight: 20
    });

    const preview = page.getByRole("img", { name: "Sample Codex usage card" });
    await expect.poll(() => preview.evaluate((image) => image.naturalWidth)).toBe(1497);
    await expect(preview).toHaveCSS("aspect-ratio", "499 / 306");
    await expect(preview).toHaveCSS("opacity", "1");
    const tilt = page.locator("hover-tilt.home-card-tilt");
    await expect(tilt).toHaveAttribute("data-tilt-enabled", "true");
    await expect(tilt).toHaveAttribute("tilt-factor", "0.45");
    await expect(tilt).toHaveAttribute("tilt-factor-y", "0.35");
    await expect(tilt).toHaveAttribute("scale-factor", "1.018");
    await expect(tilt).toHaveAttribute("glare-intensity", "0.15");
    await expect.poll(() => tilt.evaluate(
      (element) => Boolean(element.shadowRoot?.querySelector("[part=container]"))
    )).toBe(true);
    await expect(page.locator(".home-card-beam")).toHaveAttribute("data-beam", /.+/);
    await expect(page.locator(".home-card-beam")).toHaveCSS("border-radius", "41px");
    const tiltBox = await tilt.boundingBox();
    expect(tiltBox).not.toBeNull();
    await page.mouse.move(tiltBox.x + tiltBox.width * 0.82, tiltBox.y + tiltBox.height * 0.2);
    await expect.poll(() => tilt.evaluate(
      (element) => element.shadowRoot?.querySelector("[part=container]")?.dataset.isActive
    )).toBe("true");
    const glare = page.locator(".home-card-glare");
    await expect.poll(() => glare.evaluate(
      (element) => Number.parseFloat(getComputedStyle(element).opacity)
    )).toBeGreaterThan(0.15);
    await expect.poll(() => glare.evaluate(
      (element) => Number.parseFloat(getComputedStyle(element).opacity)
    )).toBeLessThanOrEqual(0.22);
    await expect.poll(() => tilt.evaluate(
      (element) => getComputedStyle(element.shadowRoot?.querySelector("[part=tilt]")).borderRadius
    )).toBe("41px");
    await page.waitForTimeout(450);
    const quickstartBox = await page.getByRole("heading", { name: "Quickstart" }).boundingBox();
    expect(quickstartBox).not.toBeNull();
    expect(quickstartBox.y).toBeLessThan(900);
    await page.screenshot({ path: testInfo.outputPath("home-desktop.png") });
  });

  test("Home shows the signed-in GitHub identity and private card action", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          async writeText(value) {
            globalThis.__copiedHomeCommand = value;
          }
        }
      });
    });
    await mockAuthenticatedAccount(page);
    await mockCardImages(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    const ownerPreview = page.getByRole("img", { name: "Your Codex usage card" });
    await expect(ownerPreview).toHaveAttribute(
      "src",
      "/api/profile/card.png?locale=en"
    );
    await expect.poll(() => ownerPreview.evaluate((image) => image.naturalWidth)).toBe(1497);

    const accountState = page.locator(".home-account-state");
    await expect(accountState.getByRole("img", { name: "postmelee avatar" })).toBeVisible();
    await expect(accountState.getByText("postmelee", { exact: true })).toBeVisible();
    await expect(accountState.getByText("@postmelee", { exact: true })).toBeVisible();
    await expect(accountState.getByRole("button", { name: "Publish card" })).toBeEnabled();

    const command = "npx codex-usage-profile@latest submit";
    await expect(page.getByText(command, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Copy submit command" }).click();
    await expect(page.getByText("Command copied.", { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => globalThis.__copiedHomeCommand)).toBe(command);

    const homeMarkup = await page.locator(".home-view").innerHTML();
    for (const internalValue of [
      "owner_1",
      "tokenDigest",
      "deviceSecret",
      "storagePath",
      "cup_"
    ]) {
      expect(homeMarkup).not.toContain(internalValue);
    }
  });

  test("Home keeps loading and unavailable account states neutral", async ({ page }) => {
    let releaseAccount;
    const accountGate = new Promise((resolve) => {
      releaseAccount = resolve;
    });
    await page.route("**/api/auth/me", async (route) => {
      await accountGate;
      await fulfillJson(route, {
        error: { code: "unauthorized", message: "Session cookie is required" },
        ok: false
      }, 401);
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    await expect(page.getByText("Checking account", { exact: true })).toBeVisible();
    await expect(page.getByText("Checking your GitHub session", { exact: true })).toBeVisible();
    await expect(page.getByText("npx codex-usage-profile@latest submit")).toHaveCount(0);
    await expect(page.locator(".account-status-dot")).toHaveCSS("animation-name", "none");
    await expect(page.locator(".home-card-preview")).toHaveCSS("animation-name", "none");
    await expect(page.locator(".home-card-media")).toHaveCSS("animation-name", "none");
    await expect(page.locator(".home-card-beam")).toHaveCSS("animation-name", "none");
    await expect(page.locator(".home-card-tilt")).toHaveAttribute("data-tilt-enabled", "false");
    await expect(page.locator("hover-tilt.home-card-tilt")).toHaveCount(0);

    releaseAccount();
    await expect(page.getByRole("link", { name: "Sign in with GitHub" })).toBeVisible();

    await page.unrouteAll({ behavior: "wait" });
    await page.route("**/api/auth/me", (route) => fulfillJson(route, {
      error: { code: "service_unavailable", message: "Account lookup failed" },
      ok: false
    }, 503));
    await page.reload();

    await expect(page.locator(".home-account-state").getByText(
      "Account unavailable",
      { exact: true }
    )).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in unavailable" })).toBeVisible();
    await expect(page.locator(".profile-topbar").getByText(
      "Account unavailable",
      { exact: true }
    )).toHaveCount(0);
    await expect(page.getByText("Sign in is temporarily unavailable.", { exact: true }))
      .toBeVisible();
    await expect(page.getByText("npx codex-usage-profile@latest submit")).toHaveCount(0);
  });

  test("Home card transition decodes the anonymous operator card before showing it", async ({ page }) => {
    await mockAnonymousAccount(page);
    await page.route("**/u/postmelee/card.png*", (route) => route.fulfill({
      body: CARD_PNG,
      contentType: "image/png",
      status: 200
    }));

    await page.goto("/");

    const media = page.locator(".home-card-media");
    const operatorCard = page.getByRole("img", {
      name: "Codex usage card for @postmelee"
    });
    await expect(media).toHaveAttribute("data-card-status", "ready");
    await expect(media).toHaveAttribute("data-card-source-kind", "operator");
    await expect(media).toHaveAttribute("aria-busy", "false");
    await expect(operatorCard).toHaveAttribute(
      "src",
      "/u/postmelee/card.png?locale=en"
    );
    await expect.poll(() => operatorCard.evaluate((image) => image.naturalWidth))
      .toBe(1497);
  });

  for (const failureStatus of [404, 503]) {
    test(`Home card transition falls back safely when the operator card returns ${failureStatus}`, async ({ page }, testInfo) => {
      await mockAnonymousAccount(page);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.route("**/u/postmelee/card.png*", (route) => route.fulfill({
        body: "operator card unavailable",
        contentType: "text/plain",
        status: failureStatus
      }));

      await page.goto("/");

      const media = page.locator(".home-card-media");
      const sampleCard = page.getByRole("img", {
        name: "Sample Codex usage card"
      });
      await expect(media).toHaveAttribute("data-card-status", "fallback");
      await expect(media).toHaveAttribute("data-card-source-kind", "sample");
      await expect(media).toHaveAttribute("aria-busy", "false");
      await expect(sampleCard).toHaveAttribute(
        "src",
        "/assets/codex-card-sample.png"
      );
      await expect(page.locator(".home-card-skeleton")).toHaveCSS("opacity", "0");
      if (failureStatus === 503) {
        await page.screenshot({
          path: testInfo.outputPath("home-card-fallback-desktop.png")
        });
      }
    });
  }

  test("Home card transition keeps the operator card pending until the owner image decodes", async ({ page }, testInfo) => {
    let releaseProfile;
    let releaseOwnerImage;
    const profileGate = new Promise((resolve) => {
      releaseProfile = resolve;
    });
    const ownerImageGate = new Promise((resolve) => {
      releaseOwnerImage = resolve;
    });
    const ownerImageRequests = [];

    await page.route("**/api/auth/me", (route) => fulfillJson(route, {
      data: {
        owner: AUTH_OWNER,
        session: { id: "session_1", ownerId: AUTH_OWNER.id }
      },
      ok: true
    }));
    await page.route("**/api/profile", async (route) => {
      await profileGate;
      await fulfillJson(route, {
        data: ownerProfile("private"),
        ok: true
      });
    });
    await page.route("**/u/postmelee/card.png*", (route) => route.fulfill({
      body: CARD_PNG,
      contentType: "image/png",
      status: 200
    }));
    await page.route("**/api/profile/card.png*", async (route) => {
      ownerImageRequests.push(route.request().url());
      await ownerImageGate;
      await route.fulfill({
        body: CARD_PNG,
        contentType: "image/png",
        status: 200
      });
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const media = page.locator(".home-card-media");
    const skeleton = page.locator(".home-card-skeleton");
    const loadingStatus = page.getByTestId("home-card-loading-status");
    await expect(media).toHaveAttribute("data-card-status", "loading");
    await expect(media).toHaveAttribute("data-card-source-kind", "operator");
    await expect(media).toHaveAttribute("aria-busy", "true");
    await expect(skeleton).toHaveAttribute("data-active", "true");
    await expect(skeleton).toHaveCSS("opacity", "1");
    await expect(skeleton).toHaveCSS("transition-duration", "0s");
    await expectCardAccurateSkeleton(page);
    await expect(loadingStatus).toHaveText("Loading card preview");
    await expect(page.locator(".home-card-sample-identity")).toHaveCount(0);
    await expect(page.locator(".home-card-tilt"))
      .toHaveAttribute("data-tilt-enabled", "false");
    await expect(page.locator('img[src*="/api/profile/card.png"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Loading card" })).toBeDisabled();
    const loadingCardBox = await media.boundingBox();
    const loadingQuickstartBox = await page
      .getByRole("heading", { name: "Quickstart" })
      .boundingBox();
    await page.screenshot({
      path: testInfo.outputPath("home-card-loading-desktop.png")
    });

    releaseProfile();
    await expect(media).toHaveAttribute("data-card-status", "loading");
    await expect(page.locator('img[src*="/api/profile/card.png"]')).toHaveCount(0);
    await page.evaluate(() => {
      const mediaElement = document.querySelector(".home-card-media");
      let previousSource = mediaElement?.querySelector("img")?.getAttribute("src") ?? null;
      globalThis.__ownerCardDomCommits = 0;
      new MutationObserver(() => {
        const nextSource = mediaElement?.querySelector("img")?.getAttribute("src") ?? null;
        if (
          nextSource !== previousSource &&
          nextSource?.includes("/api/profile/card.png")
        ) {
          globalThis.__ownerCardDomCommits += 1;
        }
        previousSource = nextSource;
      }).observe(mediaElement, {
        attributeFilter: ["src"],
        attributes: true,
        childList: true,
        subtree: true
      });
    });

    releaseOwnerImage();
    const ownerCard = page.getByRole("img", {
      name: "Your Codex usage card"
    });
    await expect(ownerCard).toHaveAttribute(
      "src",
      "/api/profile/card.png?locale=en"
    );
    await expect(media).toHaveAttribute("data-card-source-kind", "owner");
    await expect(media).toHaveAttribute("data-card-status", "ready");
    await expect(media).toHaveAttribute("aria-busy", "false");
    await expect(skeleton).toHaveAttribute("data-active", "false");
    await expect(skeleton).toHaveCSS("opacity", "0");
    await expect(skeleton).toHaveCSS("transition-duration", "0.24s");
    await expect(loadingStatus).toHaveText("");
    await expect(page.getByRole("button", { name: "Publish card" })).toBeEnabled();
    await expect(page.locator('[data-card-source="true"]'))
      .toHaveAttribute("data-tilt-enabled", "true");
    await expect.poll(() => page.evaluate(
      () => globalThis.__ownerCardDomCommits
    )).toBe(1);
    expect(ownerImageRequests.length).toBeGreaterThanOrEqual(1);
    const readyCardBox = await media.boundingBox();
    const readyQuickstartBox = await page
      .getByRole("heading", { name: "Quickstart" })
      .boundingBox();
    expectRectNear(readyCardBox, loadingCardBox, 1);
    expect(Math.abs(readyQuickstartBox.y - loadingQuickstartBox.y))
      .toBeLessThanOrEqual(1);
    await page.screenshot({
      path: testInfo.outputPath("home-card-ready-desktop.png")
    });
  });

  test("Home card transition keeps a stable skeleton box on mobile", async ({ page }, testInfo) => {
    let releaseAccount;
    const accountGate = new Promise((resolve) => {
      releaseAccount = resolve;
    });
    await page.route("**/api/auth/me", async (route) => {
      await accountGate;
      await fulfillJson(route, {
        error: { code: "unauthorized", message: "Session cookie is required" },
        ok: false
      }, 401);
    });
    await page.route("**/u/postmelee/card.png*", (route) => route.fulfill({
      body: CARD_PNG,
      contentType: "image/png",
      status: 200
    }));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const media = page.locator(".home-card-media");
    const skeleton = page.locator(".home-card-skeleton");
    await expect(media).toHaveAttribute("data-card-status", "loading");
    await expect(media).toHaveAttribute("data-card-source-kind", "operator");
    await expect(skeleton).toHaveCSS("opacity", "1");
    await expectCardAccurateSkeleton(page);
    const loadingCardBox = await media.boundingBox();
    const loadingQuickstartBox = await page
      .getByRole("heading", { name: "Quickstart" })
      .boundingBox();
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("home-card-loading-mobile.png")
    });

    releaseAccount();
    await expect(media).toHaveAttribute("data-card-status", "ready");
    await expect(skeleton).toHaveCSS("opacity", "0");
    const readyCardBox = await media.boundingBox();
    const readyQuickstartBox = await page
      .getByRole("heading", { name: "Quickstart" })
      .boundingBox();
    expectRectNear(readyCardBox, loadingCardBox, 1);
    expect(Math.abs(readyQuickstartBox.y - loadingQuickstartBox.y))
      .toBeLessThanOrEqual(1);
    expect(await page.evaluate(
      () => document.body.scrollWidth > document.documentElement.clientWidth
    )).toBe(false);
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("home-card-ready-mobile.png")
    });
  });

  test("Home card transition removes shimmer and crossfade for reduced motion", async ({ page }, testInfo) => {
    let releaseAccount;
    const accountGate = new Promise((resolve) => {
      releaseAccount = resolve;
    });
    await page.route("**/api/auth/me", async (route) => {
      await accountGate;
      await fulfillJson(route, {
        error: { code: "unauthorized", message: "Session cookie is required" },
        ok: false
      }, 401);
    });
    await page.route("**/u/postmelee/card.png*", (route) => route.fulfill({
      body: CARD_PNG,
      contentType: "image/png",
      status: 200
    }));

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const media = page.locator(".home-card-media");
    const skeleton = page.locator(".home-card-skeleton");
    await expect(media).toHaveAttribute("data-card-status", "loading");
    await expect(skeleton).toHaveCSS("opacity", "1");
    await expect(skeleton).toHaveCSS("transition-duration", "0s");
    await expectCardAccurateSkeleton(page);
    await expect(page.locator(".home-card-tilt"))
      .toHaveAttribute("data-tilt-enabled", "false");
    const reducedLoadingStyles = await skeleton.evaluate((element) => ({
      animationName: getComputedStyle(element, "::after").animationName,
      overlayOpacity: getComputedStyle(element, "::after").opacity
    }));
    expect(reducedLoadingStyles).toEqual({
      animationName: "none",
      overlayOpacity: "0"
    });
    const loadingCardBox = await media.boundingBox();
    await page.screenshot({
      path: testInfo.outputPath("home-card-loading-reduced-motion.png")
    });

    releaseAccount();
    await expect(media).toHaveAttribute("data-card-status", "ready");
    await expect(skeleton).toHaveCSS("opacity", "0");
    await expect(skeleton).toHaveCSS("transition-duration", "0s");
    const readyCardBox = await media.boundingBox();
    expectRectNear(readyCardBox, loadingCardBox, 1);
    await page.screenshot({
      path: testInfo.outputPath("home-card-ready-reduced-motion.png")
    });
  });

  test("Home card transition ignores a stale owner image after logout", async ({ page }) => {
    let releaseOwnerImage;
    const ownerImageGate = new Promise((resolve) => {
      releaseOwnerImage = resolve;
    });

    await mockAuthenticatedAccount(page);
    await page.route("**/u/postmelee/card.png*", (route) => route.fulfill({
      body: CARD_PNG,
      contentType: "image/png",
      status: 200
    }));
    await page.route("**/api/profile/card.png*", async (route) => {
      await ownerImageGate;
      await route.fulfill({
        body: CARD_PNG,
        contentType: "image/png",
        status: 200
      });
    });
    await page.route("**/api/auth/logout", (route) => fulfillJson(route, {
      data: { session: null },
      ok: true
    }));

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".home-card-media"))
      .toHaveAttribute("data-card-status", "loading");
    await page.getByRole("button", {
      name: "Account menu for postmelee"
    }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
    await expect(page.locator('img[src*="/api/profile/card.png"]')).toHaveCount(0);

    releaseOwnerImage();
    const media = page.locator(".home-card-media");
    await expect(media).toHaveAttribute("data-card-source-kind", "operator");
    await expect(media).toHaveAttribute("data-card-status", "ready");
    await expect(page.locator('img[src*="/api/profile/card.png"]')).toHaveCount(0);
    const homeMarkup = await page.locator(".home-view").innerHTML();
    expect(homeMarkup).not.toContain("owner_1");
    expect(homeMarkup).not.toContain("/api/profile/card.png");
  });

  for (const failureStatus of [404, 503]) {
    test(`Home card transition uses the personalized sample when the owner card returns ${failureStatus}`, async ({ page }) => {
      await mockAuthenticatedAccount(page);
      await page.route("**/u/postmelee/card.png*", (route) => route.fulfill({
        body: CARD_PNG,
        contentType: "image/png",
        status: 200
      }));
      await page.route("**/api/profile/card.png*", (route) => route.fulfill({
        body: "owner card unavailable",
        contentType: "text/plain",
        status: failureStatus
      }));

      await page.goto("/");

      const media = page.locator(".home-card-media");
      await expect(media).toHaveAttribute("data-card-status", "fallback");
      await expect(media).toHaveAttribute("data-card-source-kind", "sample");
      await expect(page.getByRole("img", {
        name: "Sample Codex usage card"
      })).toHaveAttribute("src", "/assets/codex-card-sample.png");
      await expect(page.locator(".home-card-sample-identity")).toBeVisible();
      await expect(page.getByRole("button", { name: "Publish card" })).toBeEnabled();
      await expect(page.locator('img[src*="/api/profile/card.png"]')).toHaveCount(0);
    });
  }

  test("Home card transition fails closed when owner image decode rejects", async ({ page }) => {
    await page.addInitScript(() => {
      const originalDecode = HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode = function decode() {
        if (this.src.includes("/api/profile/card.png")) {
          return Promise.reject(new Error("synthetic decode failure"));
        }
        return originalDecode
          ? originalDecode.call(this)
          : Promise.resolve();
      };
    });
    await mockAuthenticatedAccount(page);
    await mockCardImages(page);

    await page.goto("/");

    const media = page.locator(".home-card-media");
    await expect(media).toHaveAttribute("data-card-status", "fallback");
    await expect(media).toHaveAttribute("data-card-source-kind", "sample");
    await expect(page.locator(".home-card-sample-identity")).toBeVisible();
    await expect(page.locator('img[src*="/api/profile/card.png"]')).toHaveCount(0);
    const storedValues = await page.evaluate(() => [
      ...Object.values(localStorage),
      ...Object.values(sessionStorage)
    ]);
    expect(JSON.stringify(storedValues)).not.toMatch(
      /owner_1|api\/profile\/card\.png|postmelee-avatar/
    );
  });

  test("Home preserves a manual command fallback when clipboard copy fails", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          async writeText() {
            throw new Error("Clipboard denied");
          }
        }
      });
    });
    await mockAuthenticatedAccount(page);
    await mockCardImages(page);
    await page.goto("/");

    const command = page.getByText("npx codex-usage-profile@latest submit", {
      exact: true
    });
    await page.getByRole("button", { name: "Copy submit command" }).click();

    await expect(page.getByText(
      "Copy failed. Select the command and copy it manually.",
      { exact: true }
    )).toBeVisible();
    await expect(command).toBeVisible();
    await expect(command).toHaveCSS("user-select", "text");
  });

  test("Home stays readable and keyboard accessible on mobile", async ({ page }, testInfo) => {
    await mockAuthenticatedAccount(page);
    await mockCardImages(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.locator(".profile-topbar")).toHaveCSS("height", "48px");
    const card = page.getByRole("img", { name: "Your Codex usage card" });
    await expect(card).toHaveCSS("opacity", "1");
    await expect(page.locator(".home-card-tilt")).toHaveAttribute("data-tilt-enabled", "false");
    await expect(page.locator("hover-tilt.home-card-tilt")).toHaveCount(0);
    const cardBox = await card.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(cardBox.x).toBeGreaterThanOrEqual(0);
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(
      () => document.body.scrollWidth > document.documentElement.clientWidth
    )).toBe(false);

    const quickstartHeading = page.getByRole("heading", { name: "Quickstart" });
    const initialQuickstartBox = await quickstartHeading.boundingBox();
    expect(initialQuickstartBox).not.toBeNull();
    expect(initialQuickstartBox.y).toBeLessThan(844);

    await quickstartHeading.scrollIntoViewIfNeeded();
    const commandBox = await page.locator(".home-command-row").boundingBox();
    expect(commandBox).not.toBeNull();
    expect(commandBox.x).toBeGreaterThanOrEqual(0);
    expect(commandBox.x + commandBox.width).toBeLessThanOrEqual(390);
    expect(await getClippedHomeElements(page)).toEqual([]);

    const landingMetrics = await getLandingScrollMetrics(page);
    expect(landingMetrics.frameHeight).toBeGreaterThanOrEqual(844);
    expect(landingMetrics.overflowY).toBe("visible");
    expect(landingMetrics.documentScrollHeight).toBeGreaterThan(landingMetrics.viewportHeight);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Codex Usage", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    const accountButton = page.getByRole("button", { name: "Account menu for postmelee" });
    await expect(accountButton).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Publish card" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Copy submit command" })).toBeFocused();

    await accountButton.click();
    await expect(page.getByRole("menuitem", { name: "Profile" })).toHaveAttribute(
      "href",
      "/profile"
    );
    await expect(page.getByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "href",
      "/?view=settings"
    );
    await page.screenshot({ path: testInfo.outputPath("home-mobile.png") });
  });

  test("account menu exposes Profile and supports keyboard focus", async ({ page }) => {
    await mockAuthenticatedAccount(page);
    await mockCardImages(page);
    await page.goto("/");

    const trigger = page.getByRole("button", { name: "Account menu for postmelee" });
    await trigger.focus();
    await page.keyboard.press("Enter");

    const profileItem = page.getByRole("menuitem", { name: "Profile" });
    const settingsItem = page.getByRole("menuitem", { name: "Settings" });
    const logoutItem = page.getByRole("menuitem", { name: "Log out" });
    const menuItems = page.getByRole("menuitem");

    await expect(menuItems).toHaveCount(3);
    await expect(menuItems.nth(0)).toHaveText("Profile");
    await expect(menuItems.nth(1)).toHaveText("Settings");
    await expect(menuItems.nth(2)).toHaveText("Log out");
    await expect(profileItem).toHaveAttribute("href", "/profile");
    await expect(settingsItem).toHaveAttribute("href", "/?view=settings");
    await expect(profileItem.locator('[data-account-icon="profile"]'))
      .toHaveClass(/lucide-user-round/);
    await expect(settingsItem.locator('[data-account-icon="settings"]'))
      .toHaveClass(/lucide-settings/);
    await expect(logoutItem.locator('[data-account-icon="logOut"]'))
      .toHaveClass(/lucide-log-out/);

    for (const [item, iconName] of [
      [profileItem, "profile"],
      [settingsItem, "settings"],
      [logoutItem, "logOut"]
    ]) {
      const iconBox = await item.locator(`[data-account-icon="${iconName}"]`).boundingBox();
      const textBox = await item.locator("span").boundingBox();
      expect(iconBox).not.toBeNull();
      expect(textBox).not.toBeNull();
      expect(Math.abs(
        iconBox.y + iconBox.height / 2 - (textBox.y + textBox.height / 2)
      )).toBeLessThanOrEqual(1);
    }
    await expect(profileItem).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await expect(settingsItem).toBeFocused();
    await page.keyboard.press("End");
    await expect(logoutItem).toBeFocused();
    await page.keyboard.press("Home");
    await expect(profileItem).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(logoutItem).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(page.getByRole("menu")).toHaveCount(0);

    await trigger.click();
    await expect(profileItem).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(settingsItem).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(logoutItem).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Publish card" })).toBeFocused();

    await trigger.click();
    await expect(profileItem).toBeFocused();
    await page.getByRole("heading", { name: "Codex usage profile" }).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
  });

  test("uses document scrolling across Home, Profile, and Settings surfaces", async ({ page }, testInfo) => {
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("private"),
      ok: true
    }));
    await page.route("**/api/settings/tokens", (route) => fulfillJson(route, {
      data: { tokens: [] },
      ok: true
    }));
    await page.route("**/api/settings/devices", (route) => fulfillJson(route, {
      data: { devices: [] },
      ok: true
    }));
    await mockPublicProfile(page);
    await mockCardImages(page);
    await page.setViewportSize({ width: 1280, height: 620 });

    await page.goto("/");
    await expect(page.locator(".home-card-preview")).toHaveCSS("opacity", "1");
    await expect(page.locator(".app-frame")).toHaveClass(/app-frame--fullscreen/);
    await expect(page.locator(".profile-shell")).toHaveClass(/profile-shell--fullscreen/);
    const landingMetrics = await getLandingScrollMetrics(page);
    expect(landingMetrics.frameHeight).toBeGreaterThanOrEqual(620);
    expect(landingMetrics.overflowY).toBe("visible");
    expect(landingMetrics.documentScrollHeight).toBeGreaterThan(landingMetrics.viewportHeight);
    const shortQuickstartBox = await page.getByRole("heading", { name: "Quickstart" }).boundingBox();
    expect(shortQuickstartBox).not.toBeNull();
    expect(shortQuickstartBox.y).toBeLessThan(620);
    await page.screenshot({ path: testInfo.outputPath("home-short-viewport.png") });

    for (const path of ["/profile", "/settings", PROFILE_ROUTE]) {
      await page.goto(path);
      await expect(page.locator(".app-frame")).toHaveClass(/app-frame--fullscreen/);
      await expect(page.locator(".profile-shell")).toHaveClass(/profile-shell--fullscreen/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      const metrics = await getLandingScrollMetrics(page);
      const titleMetrics = await page.locator(".profile-topbar-title").evaluate((title) => ({
        clientHeight: title.clientHeight,
        lineHeight: getComputedStyle(title).lineHeight,
        scrollHeight: title.scrollHeight
      }));

      expect(metrics.frameHeight).toBeGreaterThanOrEqual(metrics.viewportHeight);
      expect(metrics.overflowY).toBe("visible");
      expect(metrics.documentScrollHeight).toBeGreaterThan(metrics.viewportHeight);
      expect(titleMetrics.lineHeight).toBe("20px");
      expect(titleMetrics.clientHeight).toBeGreaterThanOrEqual(22);
      expect(titleMetrics.scrollHeight).toBeLessThanOrEqual(titleMetrics.clientHeight);
      expect(await page.evaluate(
        () => document.body.scrollWidth > document.documentElement.clientWidth
      )).toBe(false);
    }

    await expect(page.getByRole("link", { name: "Codex Usage", exact: true }))
      .toHaveAttribute("href", "/");
    await page.getByRole("button", { name: "Account menu for postmelee" }).click();
    await expect(page.getByRole("menuitem", { name: "Profile", exact: true }))
      .toHaveAttribute("href", "/profile");

    const scrollMetrics = await page.locator(".profile-shell").evaluate((shell) => {
      shell.scrollTop = 120;
      window.scrollTo(0, 120);
      return {
        documentScrollTop: window.scrollY,
        shellScrollTop: shell.scrollTop
      };
    });
    expect(scrollMetrics.shellScrollTop).toBe(0);
    expect(scrollMetrics.documentScrollTop).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath("public-profile-short-viewport.png") });
  });

  test("device approval prevents double submit and completes submit intent on desktop", async ({ page }) => {
    await mockAuthenticatedAccount(page);
    let authorizationRequests = 0;
    let releaseAuthorization;
    const authorizationGate = new Promise((resolve) => {
      releaseAuthorization = resolve;
    });
    await page.route("**/api/auth/device/authorize", async (route) => {
      authorizationRequests += 1;
      await authorizationGate;
      await fulfillJson(route, {
        data: {
          approvedAt: "2026-07-31T00:00:00.000Z",
          exchangedAt: null,
          intent: "submit",
          status: "approved"
        },
        ok: true
      });
    });
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.goto("/?view=device&user_code=ABCD-1234");
    const initialUrl = page.url();

    await expect(page.locator(".app-frame")).toHaveClass(/app-frame--fullscreen/);
    await expect(page.locator(".profile-shell")).toHaveClass(/profile-shell--fullscreen/);
    await expect(page.getByRole("link", { name: "Codex Usage" }))
      .toHaveAttribute("href", "/");
    await expect(page.getByRole("button", { name: "Share profile" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Authorize device" }))
      .toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator(".device-view")).toHaveCSS(
      "background-color",
      "rgb(13, 13, 13)"
    );
    await expect(page.locator(".device-panel")).toHaveCSS(
      "background-color",
      "rgb(23, 23, 23)"
    );
    await expect(page.getByText(
      "Enter the code shown in your terminal to connect the CLI.",
      { exact: true }
    )).toBeVisible();
    await expect(page.getByText(
      "Only approve a code you requested from the Codex Usage Profile CLI.",
      { exact: true }
    )).toBeVisible();
    await expect(page.getByRole("link", { name: "View setup guide" }))
      .toHaveAttribute("href", "/#quickstart");
    await expect(page.locator(".device-feedback")).toHaveCSS("min-height", "48px");
    await expect(page.getByLabel("User code")).toHaveValue("ABCD-1234");
    const approveButton = page.getByRole("button", { name: "Approve device" });
    await approveButton.evaluate((button) => {
      button.click();
      button.click();
    });
    await expect.poll(() => authorizationRequests).toBe(1);
    await expect(page.getByRole("button", { name: "Approving…" })).toBeDisabled();
    await expect(page.locator(".device-form")).toHaveAttribute("aria-busy", "true");

    releaseAuthorization();

    const approvedButton = page.getByRole("button", { name: "Device approved" });
    await expect(approvedButton).toBeDisabled();
    await expect(approvedButton.locator("[data-codex-check-circle]")).toHaveCount(1);
    await expect(page.getByLabel("User code")).toBeDisabled();
    await expect(page.getByText(
      "Authorization is complete. Return to your terminal to continue, and check the terminal for the final submission result.",
      { exact: true }
    )).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy command" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    await expect(page.getByRole("link", { name: "Profile" }))
      .toHaveAttribute("href", "/profile");
    await expect(page.locator(".device-success")).toHaveCSS(
      "animation-name",
      "device-success-enter"
    );
    expect(page.url()).toBe(initialUrl);
    expect(await page.evaluate(() => ({
      local: Object.keys(localStorage).length,
      session: Object.keys(sessionStorage).length
    }))).toEqual({ local: 0, session: 0 });
  });

  test("device approval shows local login command with keyboard and reduced motion", async ({ page }) => {
    await page.addInitScript(() => {
      let copyAttempt = 0;
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          async writeText(value) {
            copyAttempt += 1;
            if (copyAttempt === 1) {
              throw new Error("Clipboard denied");
            }
            globalThis.__copiedDeviceCommand = value;
          }
        }
      });
    });
    await mockAuthenticatedAccount(page);
    await page.route("**/api/auth/device/authorize", (route) => fulfillJson(route, {
      data: {
        approvedAt: "2026-07-31T00:00:00.000Z",
        exchangedAt: null,
        intent: "login",
        status: "approved"
      },
      ok: true
    }));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?view=device&user_code=ABCD-1234");
    const initialUrl = page.url();

    await expect(page.locator(".app-frame")).toHaveClass(/app-frame--fullscreen/);
    await expect(page.getByRole("button", { name: "Share profile" })).toHaveCount(0);
    const topbarBox = await page.locator(".profile-topbar").boundingBox();
    const panelBox = await page.locator(".device-panel").boundingBox();
    expect(topbarBox).not.toBeNull();
    expect(panelBox).not.toBeNull();
    expect(panelBox.y).toBeGreaterThanOrEqual(topbarBox.y + topbarBox.height + 40);

    await page.getByLabel("User code").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Approve device" })).toBeFocused();
    await page.keyboard.press("Enter");

    const command =
      "npx codex-usage-profile@latest submit --server http://127.0.0.1:5173";
    await expect(page.getByText(command, { exact: true })).toBeVisible();
    await expect(page.locator(".device-success")).toHaveCSS("animation-name", "none");
    await expect(page.getByText(command, { exact: true })).not.toContainText("ABCD-1234");

    const copyButton = page.getByRole("button", { name: "Copy command" });
    await copyButton.click();
    await expect(page.getByText(
      "Copy failed. Select the command and copy it manually.",
      { exact: true }
    )).toBeVisible();
    await copyButton.click();
    await expect(page.getByText("Command copied.", { exact: true })).toBeVisible();
    await expect.poll(
      () => page.evaluate(() => globalThis.__copiedDeviceCommand)
    ).toBe(command);

    expect(page.url()).toBe(initialUrl);
    expect(await page.evaluate(
      () => document.body.scrollWidth > document.documentElement.clientWidth
    )).toBe(false);
  });

  test("device approval common header keeps logout and auth state aligned", async ({ page }) => {
    let logoutRequests = 0;
    await mockAuthenticatedAccount(page);
    await page.route("**/api/auth/logout", (route) => {
      logoutRequests += 1;
      return fulfillJson(route, {
        data: { session: null },
        ok: true
      });
    });

    await page.goto("/?view=device&user_code=ABCD-1234");
    await page.getByRole("button", { name: "Account menu for postmelee" }).click();
    await expect(page.getByRole("menuitem", { name: "Profile", exact: true }))
      .toHaveAttribute("href", "/profile");
    await expect(page.getByRole("menuitem", { name: "Settings", exact: true }))
      .toHaveAttribute("href", "/?view=settings");
    await page.getByRole("menuitem", { name: "Log out" }).click();

    await expect(page.locator(".profile-shell")).toHaveAttribute(
      "data-auth-status",
      "anonymous"
    );
    await expect(page.locator(".device-view")).toHaveAttribute(
      "data-auth-status",
      "anonymous"
    );
    await expect(page.getByRole("link", { name: "Sign in", exact: true }))
      .toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in with GitHub" }))
      .toBeVisible();
    await expect(page.getByLabel("User code")).toHaveValue("ABCD-1234");
    expect(logoutRequests).toBe(1);
  });

  test("device approval treats exchanged legacy intent as terminal success", async ({ page }) => {
    await mockAuthenticatedAccount(page);
    await page.route("**/api/auth/device/authorize", (route) => fulfillJson(route, {
      data: {
        approvedAt: "2026-07-31T00:00:00.000Z",
        exchangedAt: "2026-07-31T00:00:01.000Z",
        intent: null,
        status: "exchanged"
      },
      ok: true
    }));
    await page.goto("/?view=device&user_code=WXYZ-9876");
    const initialUrl = page.url();

    await page.getByRole("button", { name: "Approve device" }).click();

    await expect(page.getByRole("button", { name: "Device approved" })).toBeDisabled();
    await expect(page.getByText(
      "Authorization is complete. Return to your terminal to continue.",
      { exact: true }
    )).toBeVisible();
    await expect(page.locator(".device-command-row")).toHaveCount(0);
    expect(page.url()).toBe(initialUrl);
  });

  test("device approval retries transient errors and locks terminal errors until edit", async ({ page }) => {
    await mockAuthenticatedAccount(page);
    const requestedCodes = [];
    await page.route("**/api/auth/device/authorize", async (route) => {
      const { userCode } = JSON.parse(route.request().postData() ?? "{}");
      requestedCodes.push(userCode);

      if (userCode === "ABCD-1234" && requestedCodes.length === 1) {
        await fulfillJson(route, {
          error: {
            code: "media_unavailable",
            message: "Approval temporarily unavailable"
          },
          ok: false
        }, 503);
        return;
      }
      if (userCode === "ABCD-1234") {
        await fulfillJson(route, {
          data: {
            approvedAt: "2026-07-31T00:00:00.000Z",
            exchangedAt: null,
            intent: "submit",
            status: "approved"
          },
          ok: true
        });
        return;
      }
      await fulfillJson(route, {
        error: {
          code: "invalid_request",
          message: "CLI login challenge cannot be approved"
        },
        ok: false
      }, 400);
    });

    await page.goto("/?view=device&user_code=ABCD-1234");
    await page.getByRole("button", { name: "Approve device" }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "Device approval is temporarily unavailable. Try again."
    );
    await expect(page.locator('[aria-live] [role="alert"]')).toHaveCount(0);
    await expect(page.getByLabel("User code")).toHaveAttribute("aria-invalid", "true");
    await page.getByRole("button", { name: "Retry approval" }).click();
    await expect(page.getByRole("button", { name: "Device approved" })).toBeDisabled();

    await page.goto("/?view=device&user_code=WXYZ-9876");
    await page.getByRole("button", { name: "Approve device" }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "This code is invalid or expired. Run the command again in your terminal and enter the new code."
    );
    await expect(page.getByRole("button", { name: "Enter a new code" })).toBeDisabled();
    const userCodeInput = page.getByLabel("User code");
    await expect(userCodeInput).toBeEnabled();
    await expect(userCodeInput).toBeFocused();
    expect(await userCodeInput.evaluate((input) => ({
      end: input.selectionEnd,
      start: input.selectionStart
    }))).toEqual({ end: 9, start: 0 });

    await userCodeInput.fill("QRST-2345");
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Approve device" })).toBeEnabled();
    expect(requestedCodes).toEqual(["ABCD-1234", "ABCD-1234", "WXYZ-9876"]);
  });

  test("card owner can publish and use every Share action", async ({ context, page }, testInfo) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    let visibility = "private";
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", async (route) => {
      if (route.request().method() === "PATCH") {
        visibility = JSON.parse(route.request().postData() ?? "{}").visibility;
      }
      await fulfillJson(route, {
        data: ownerProfile(visibility),
        ok: true
      });
    });
    await mockCardImages(page);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    await page.getByRole("button", { name: "Publish card" }).click();
    const shareButton = page.getByRole("button", { name: "Share", exact: true });
    await expect(shareButton).toBeEnabled();
    await expect(shareButton.locator("svg")).toHaveCount(0);
    const sourceCard = page.locator('[data-card-source="true"]');
    const sourceBox = await sourceCard.boundingBox();

    await shareButton.click();
    const dialog = page.getByRole("dialog", { name: "Share activity" });
    const backdrop = page.getByTestId("share-studio-backdrop");
    const motionCard = page.getByTestId("share-studio-card-motion");
    await expect(dialog).toBeVisible();
    await expect(motionCard).toHaveAttribute("data-motion-origin", "source");
    await expect(sourceCard).toHaveAttribute("data-share-transition-active", "true");
    await expect(sourceCard).toHaveCSS("opacity", "0");
    await expect.poll(
      () => page
        .getByRole("img", { name: "Codex usage card preview" })
        .evaluate((image) => image.naturalWidth)
    ).toBe(1497);
    await expect(backdrop).toHaveClass(/\bis-open\b/);
    await expect(sourceCard).toHaveCSS("opacity", "0");
    const sourceBoxWhileOpen = await sourceCard.boundingBox();
    expectRectNear(sourceBoxWhileOpen, sourceBox, 0.75);
    const animatedProperties = await motionCard.evaluate((element) => {
      const keyframes = element.getAnimations().flatMap(
        (animation) => animation.effect?.getKeyframes?.() ?? []
      );
      return [...new Set(keyframes.flatMap(
        (keyframe) => ["opacity", "transform"].filter((property) => property in keyframe)
      ))].sort();
    });
    expect(animatedProperties).toEqual(["opacity", "transform"]);
    await expect(page.getByRole("button", { name: "Close Share Studio" })).toBeFocused();
    await expect(page.locator(".app-frame")).toHaveAttribute("inert", "");
    await page.screenshot({ path: testInfo.outputPath("share-desktop.png") });
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("button", { name: "Make private" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Close Share Studio" })).toBeFocused();
    await backdrop.click({ position: { x: 12, y: 450 } });
    await expect(dialog).toBeVisible();
    await expect(backdrop).toHaveClass(/\bis-open\b/);

    const socialTargets = [
      ["Share on X", "X", "https://x.com", "/intent/post"],
      ["Share on LinkedIn", "LinkedIn", "https://www.linkedin.com", "/feed/"],
      ["Share on Reddit", "Reddit", "https://www.reddit.com", "/submit"]
    ];
    for (const [name, platform, origin, pathname] of socialTargets) {
      const button = page.getByRole("button", { name });
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("heading", { name: `Share to ${platform}` }))
        .toBeVisible();
      await expect(page.getByText("Paste image into the post", { exact: true }))
        .toBeVisible();
      await expect(page.locator(".share-studio-instructions")).toHaveCSS(
        "max-height",
        "none"
      );
      await expect(page.locator(".share-studio-instructions")).toHaveCSS(
        "clip-path",
        "inset(0px round 9px)"
      );
      const link = page.getByRole("link", { name: `Open ${platform} composer` });
      const href = new URL(await link.getAttribute("href"));
      expect(href.origin).toBe(origin);
      expect(href.pathname).toBe(pathname);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    await expect(page.locator('[data-brand-logo="x"]')).toHaveAttribute(
      "viewBox",
      "0 0 20 20"
    );
    await expect(page.locator('[data-brand-logo="linkedin"]')).toHaveAttribute(
      "viewBox",
      "0 0 20 20"
    );
    await expect(page.locator('[data-brand-logo="reddit"]')).toHaveAttribute(
      "viewBox",
      "0 0 20 20"
    );
    await page.screenshot({
      path: testInfo.outputPath("share-social-instructions.png")
    });
    await page.getByRole("button", { name: "Copy image", exact: true }).click();
    await expect(page.getByText("Copied image", { exact: true })).toBeVisible();
    expect(await page.evaluate(async () => {
      const [item] = await navigator.clipboard.read();
      return item.types;
    })).toContain("image/png");

    await page.getByRole("button", { name: "Copy Image URL" }).click();
    await expect(page.getByText("Image URL copied")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "http://127.0.0.1:5173/u/postmelee/card.png"
    );

    await page.getByRole("button", { name: "Copy README Markdown" }).click();
    await expect(page.getByText("README Markdown copied")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "![Codex usage profile](http://127.0.0.1:5173/u/postmelee/card.png)"
    );

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Save PNG" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("codex-usage-profile.png");
    await expect(page.getByText("Image saved", { exact: true })).toBeVisible();
    const successIcon = page.locator("[data-codex-check-circle]");
    await expect(successIcon).toHaveAttribute("viewBox", "0 0 20 21");
    await expect(successIcon).toHaveAttribute("width", "18");
    await expect(successIcon.locator("path")).toHaveCount(2);
    await page.screenshot({ path: testInfo.outputPath("share-save-toast.png") });

    await page.getByRole("button", { name: "Close Share Studio" }).click();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect.poll(
      () => page.evaluate(() => {
        const backdrop = document.querySelector('[data-testid="share-studio-backdrop"]');
        const motionCard = document.querySelector('[data-testid="share-studio-card-motion"]');
        return {
          backdropFilter: backdrop ? getComputedStyle(backdrop).backdropFilter : null,
          motionConnected: motionCard?.isConnected ?? false,
          phase: backdrop?.className ?? null
        };
      })
    ).toEqual({
      backdropFilter: "none",
      motionConnected: true,
      phase: "share-studio-backdrop is-handoff"
    });
    await expect(dialog).toBeHidden();
    await expect(shareButton).toBeFocused();
    await expect(page.locator(".app-frame")).not.toHaveAttribute("inert", "");
    await expect(sourceCard).not.toHaveAttribute("data-share-transition-active", "true");
    await expect(sourceCard).toHaveAttribute("data-tilt-enabled", "true");

    await shareButton.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await shareButton.click();
    await page.getByRole("button", { name: "Make private" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Publish card" })).toBeEnabled();
  });

  test("Share Studio keeps the reference composition at wide desktop", async ({ page }, testInfo) => {
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("public"),
      ok: true
    }));
    await mockCardImages(page);

    await page.setViewportSize({ width: 1512, height: 982 });
    await page.goto("/");
    await page.getByRole("button", { name: "Share", exact: true }).click();

    const backdrop = page.getByTestId("share-studio-backdrop");
    await expect(backdrop).toHaveClass(/\bis-open\b/);

    const titleBox = await page
      .getByRole("heading", { name: "Share activity" })
      .boundingBox();
    const cardBox = await page
      .getByTestId("share-studio-card-motion")
      .boundingBox();
    const actionsBox = await page
      .getByLabel("Share destinations")
      .boundingBox();
    const closeBox = await page
      .getByRole("button", { name: "Close Share Studio" })
      .boundingBox();

    expect(Math.abs(rectCenterX(cardBox) - 756)).toBeLessThanOrEqual(1);
    expect(Math.abs(rectCenterX(titleBox) - rectCenterX(cardBox))).toBeLessThanOrEqual(1);
    expect(Math.abs(rectCenterX(actionsBox) - rectCenterX(cardBox))).toBeLessThanOrEqual(1);
    expect(cardBox.width).toBeCloseTo(600, 0);
    expect(cardBox.height).toBeCloseTo((600 * 306) / 499, 0);
    expect(titleBox.y + titleBox.height).toBeLessThan(cardBox.y);
    expect(cardBox.y + cardBox.height).toBeLessThan(actionsBox.y);
    expect(closeBox.x + closeBox.width).toBeGreaterThan(1450);
    expect(closeBox.y).toBeLessThan(50);

    await page.screenshot({ path: testInfo.outputPath("share-wide-desktop.png") });
  });

  test("Share Studio renders the Korean third instruction step", async ({ page }, testInfo) => {
    await useKoreanLocale(page);
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("public"),
      ok: true
    }));
    await mockCardImages(page);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "공유", exact: true }).click();

    await expect(page.getByRole("dialog", { name: "활동 공유하기" })).toBeVisible();
    const redditButton = page.getByRole("button", { name: "Reddit에 공유" });
    await expect(redditButton).toHaveCSS("opacity", "1");
    await redditButton.click();
    await expect(
      page.getByText("게시물에 이미지를 붙여넣으세요", { exact: true })
    ).toBeVisible();
    const instructions = page.locator(".share-studio-instructions");
    const instructionMotion = await instructions.evaluate((element) => {
      const animation = element.getAnimations().find(
        (candidate) => candidate.animationName === "share-studio-instructions-in"
      );
      const timing = animation?.effect?.getTiming();
      const keyframes = animation?.effect?.getKeyframes() ?? [];
      const title = document.querySelector(".share-studio-title");
      const sampleLayout = (time) => {
        if (animation) animation.currentTime = time;
        const panelStyle = getComputedStyle(element);
        return {
          panelSpace: element.getBoundingClientRect().height
            + Number.parseFloat(panelStyle.marginTop),
          titleY: title?.getBoundingClientRect().y ?? Number.NaN
        };
      };
      animation?.pause();
      const layoutSamples = animation
        ? [sampleLayout(0), sampleLayout(80), sampleLayout(159)]
        : [];
      if (animation) animation.currentTime = 80;
      return {
        clipPaths: keyframes.map((keyframe) => keyframe.clipPath),
        duration: timing?.duration,
        easings: keyframes.map((keyframe) => keyframe.easing),
        layoutSamples,
        transforms: keyframes.map((keyframe) => keyframe.transform)
      };
    });
    expect(instructionMotion.duration).toBe(160);
    expect(instructionMotion.easings[0]).toBe("ease-out");
    expect(instructionMotion.clipPaths[0]).toContain("100%");
    expect(instructionMotion.clipPaths.at(-1)).toBe("inset(0px round 9px)");
    expect(instructionMotion.transforms[0]).toContain("-6px");
    expect(instructionMotion.layoutSamples).toHaveLength(3);
    const [openingStart, openingMiddle, openingEnd] = instructionMotion.layoutSamples;
    expect(openingStart.panelSpace).toBeLessThan(openingMiddle.panelSpace);
    expect(openingMiddle.panelSpace).toBeLessThan(openingEnd.panelSpace);
    expect(openingStart.titleY).toBeGreaterThan(openingMiddle.titleY);
    expect(openingMiddle.titleY).toBeGreaterThan(openingEnd.titleY);
    const panelProgress = (
      (openingMiddle.panelSpace - openingStart.panelSpace)
      / (openingEnd.panelSpace - openingStart.panelSpace)
    );
    const titleProgress = (
      (openingStart.titleY - openingMiddle.titleY)
      / (openingStart.titleY - openingEnd.titleY)
    );
    expect(Math.abs(panelProgress - titleProgress)).toBeLessThanOrEqual(0.03);
    await page.screenshot({
      path: testInfo.outputPath("share-korean-instructions-opening-synced.png")
    });
    await instructions.evaluate((element) => {
      element.getAnimations().find(
        (candidate) => candidate.animationName === "share-studio-instructions-in"
      )?.play();
    });
    await expect(instructions).toHaveCSS("max-height", "none");
    await expect(instructions).toHaveCSS("overflow", "visible");
    await expect(instructions).toHaveCSS("opacity", "1");
    await expect(instructions).toHaveCSS(
      "clip-path",
      "inset(0px round 9px)"
    );
    const instructionBounds = await instructions.evaluate((element) => {
      const panel = element.getBoundingClientRect();
      const thirdStep = element.querySelector(".share-studio-step-copy")
        ?.getBoundingClientRect();
      return {
        panelBottom: panel.bottom,
        thirdStepBottom: thirdStep?.bottom ?? Number.POSITIVE_INFINITY
      };
    });
    expect(instructionBounds.thirdStepBottom).toBeLessThanOrEqual(
      instructionBounds.panelBottom
    );
    await page.screenshot({
      path: testInfo.outputPath("share-korean-third-step.png")
    });

    await page.getByRole("button", { name: "공유 안내 닫기" }).click();
    await expect(instructions).toHaveClass(/\bis-closing\b/);
    const instructionExitMotion = await instructions.evaluate((element) => {
      const animation = element.getAnimations().find(
        (candidate) => candidate.animationName === "share-studio-instructions-out"
      );
      const timing = animation?.effect?.getTiming();
      const keyframes = animation?.effect?.getKeyframes() ?? [];
      return {
        clipPaths: keyframes.map((keyframe) => keyframe.clipPath),
        duration: timing?.duration,
        easings: keyframes.map((keyframe) => keyframe.easing),
        transforms: keyframes.map((keyframe) => keyframe.transform)
      };
    });
    expect(instructionExitMotion.duration).toBe(120);
    expect(instructionExitMotion.easings[0]).toBe("ease-in");
    expect(instructionExitMotion.clipPaths[0]).toBe("inset(0px round 9px)");
    expect(instructionExitMotion.clipPaths.at(-1)).toContain("100%");
    expect(instructionExitMotion.transforms.at(-1)).toContain("-6px");
    const instructionExitMidpoint = await instructions.evaluate((element) => {
      const animation = element.getAnimations().find(
        (candidate) => candidate.animationName === "share-studio-instructions-out"
      );
      animation?.pause();
      if (animation) animation.currentTime = 60;
      const style = getComputedStyle(element);
      return {
        clipPath: style.clipPath,
        opacity: Number.parseFloat(style.opacity)
      };
    });
    expect(instructionExitMidpoint.clipPath).not.toContain("100%");
    expect(instructionExitMidpoint.opacity).toBeGreaterThan(0);
    expect(instructionExitMidpoint.opacity).toBeLessThan(1);
    await page.screenshot({
      path: testInfo.outputPath("share-korean-instructions-closing.png")
    });
    await page.evaluate(() => {
      document.querySelector(".share-studio-instructions")?.getAnimations().find(
        (candidate) => candidate.animationName === "share-studio-instructions-out"
      )?.play();
    });
    await expect(instructions).toBeHidden();
    await expect(redditButton).toHaveAttribute("aria-expanded", "false");
  });

  test("Home keeps card actions disabled until usage is submitted", async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: { ...ownerProfile("private"), usage: null },
      ok: true
    }));
    await mockCardImages(page);
    await page.route("**/api/profile/card.png*", (route) => route.fulfill({
      body: JSON.stringify({
        error: { code: "not_found", message: "Card not found" },
        ok: false
      }),
      contentType: "application/json",
      status: 404
    }));
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Submit usage first" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Publish card" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Share", exact: true })).toHaveCount(0);
    await expect(page.locator(".home-card-sample-identity")).toBeVisible();
    await expect(page.locator(".home-card-sample-avatar")).toHaveAttribute(
      "src",
      AUTH_OWNER.avatarUrl
    );
    await expect(page.locator(".home-card-sample-copy strong")).toHaveText(
      AUTH_OWNER.displayName
    );
    await expect(page.locator(".home-card-sample-copy span")).toHaveText(
      `@${AUTH_OWNER.githubLogin}`
    );
    await page.screenshot({ path: testInfo.outputPath("home-no-usage.png") });
  });

  test("Share card dialog fits a mobile viewport without document overflow", async ({ page }, testInfo) => {
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("public"),
      ok: true
    }));
    await mockCardImages(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Share", exact: true }).click();

    await expect(page.getByRole("dialog", { name: "Share activity" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Make private" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Codex usage card preview" })).toHaveCSS(
      "aspect-ratio",
      "499 / 306"
    );
    await expect(page.getByTestId("share-studio-backdrop")).toHaveClass(/\bis-open\b/);
    await expect(page.locator(".share-studio-primary-action").first()).toHaveCSS(
      "opacity",
      "1"
    );
    const mobileTargets = await page.locator(".share-studio-primary-action")
      .evaluateAll((elements) => elements.map((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          bottom: bounds.bottom,
          height: bounds.height,
          left: bounds.left,
          right: bounds.right
        };
      }));
    expect(mobileTargets).toHaveLength(4);
    for (const target of mobileTargets) {
      expect(target.height).toBeGreaterThanOrEqual(44);
      expect(target.left).toBeGreaterThanOrEqual(0);
      expect(target.right).toBeLessThanOrEqual(390);
    }
    const compactActionLayout = await page.evaluate(() => {
      const actions = document.querySelector(".share-studio-primary-actions")
        .getBoundingClientRect();
      const card = document.querySelector(".share-studio-card-motion")
        .getBoundingClientRect();
      return {
        actionCenter: actions.left + (actions.width / 2),
        actionWidth: actions.width,
        cardCenter: card.left + (card.width / 2)
      };
    });
    expect(compactActionLayout.actionWidth).toBeLessThanOrEqual(280);
    expect(
      Math.abs(compactActionLayout.actionCenter - compactActionLayout.cardCenter)
    ).toBeLessThanOrEqual(1);
    const secondaryTargetHeights = await page
      .locator(".share-studio-secondary-action, .share-studio-privacy-action")
      .evaluateAll((elements) => elements.map(
        (element) => element.getBoundingClientRect().height
      ));
    expect(secondaryTargetHeights.every((height) => height >= 44)).toBe(true);
    await page.getByRole("button", { name: "Share on Reddit" }).click();
    await expect(page.getByRole("heading", { name: "Share to Reddit" })).toBeVisible();
    const instructions = page.locator(".share-studio-instructions");
    await expect(instructions).toHaveCSS("max-height", "none");
    await expect(instructions).toHaveCSS("opacity", "1");
    await expect(instructions).toHaveCSS("overflow", "visible");
    await expect(instructions).toHaveCSS(
      "clip-path",
      "inset(0px round 9px)"
    );
    const compactInstructions = await instructions.evaluate((element) => {
      const stepAction = element.querySelector(".share-studio-step-action");
      const touchExtension = getComputedStyle(stepAction, "::before");
      const rowBounds = Array.from(element.querySelectorAll("li")).map(
        (row) => row.getBoundingClientRect()
      );
      return {
        panelHeight: element.getBoundingClientRect().height,
        rowCenterGaps: rowBounds.slice(1).map((row, index) => (
          (row.top + (row.height / 2))
          - (rowBounds[index].top + (rowBounds[index].height / 2))
        )),
        rowHeights: rowBounds.map((row) => row.height),
        stepActionHeight: stepAction.getBoundingClientRect().height,
        stepFontSize: getComputedStyle(stepAction).fontSize,
        titleFontSize: getComputedStyle(element.querySelector("h3")).fontSize,
        touchBottom: touchExtension.bottom,
        touchTop: touchExtension.top
      };
    });
    expect(compactInstructions.panelHeight).toBeLessThanOrEqual(180);
    expect(compactInstructions.rowHeights).toEqual([32, 32, 32]);
    expect(compactInstructions.rowCenterGaps).toEqual([44, 44]);
    expect(compactInstructions.stepActionHeight).toBeLessThanOrEqual(30);
    expect(compactInstructions.stepFontSize).toBe("13px");
    expect(compactInstructions.titleFontSize).toBe("13px");
    expect(compactInstructions.touchTop).toBe("-8px");
    expect(compactInstructions.touchBottom).toBe("-8px");
    expect(await page.evaluate(
      () => document.body.scrollWidth > document.documentElement.clientWidth
    )).toBe(false);
    await instructions.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath("share-mobile-with-instructions.png")
    });
  });

  test("Share Studio settles after resize and fits a short desktop", async ({ page }, testInfo) => {
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("public"),
      ok: true
    }));
    await mockCardImages(page);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const shareButton = page.getByRole("button", { name: "Share", exact: true });
    await shareButton.click();
    await expect(page.getByRole("dialog", { name: "Share activity" })).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 620 });
    const motionCard = page.getByTestId("share-studio-card-motion");
    await expect(motionCard).toHaveAttribute("data-motion-fallback", "viewport-change");
    await expect(motionCard).toHaveAttribute("data-motion-origin", "target");
    await expect(page.getByTestId("share-studio-backdrop")).toHaveClass(/\bis-open\b/);

    const shortLayout = await page.evaluate(() => {
      const bounds = (selector) => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return {
          bottom: rect.bottom,
          height: rect.height,
          top: rect.top,
          width: rect.width
        };
      };
      return {
        actions: bounds(".share-studio-primary-actions"),
        card: bounds(".share-studio-card-motion"),
        close: bounds(".share-studio-close"),
        horizontalOverflow:
          document.body.scrollWidth > document.documentElement.clientWidth,
        secondary: bounds(".share-studio-secondary")
      };
    });
    expect(shortLayout.card.width).toBeLessThan(600);
    expect(shortLayout.card.height).toBeLessThanOrEqual(306);
    expect(shortLayout.actions.bottom).toBeLessThanOrEqual(620);
    expect(shortLayout.secondary.bottom).toBeLessThanOrEqual(620);
    expect(shortLayout.close.top).toBeGreaterThanOrEqual(0);
    expect(shortLayout.close.bottom).toBeLessThanOrEqual(620);
    expect(shortLayout.horizontalOverflow).toBe(false);
    await expect(page.locator(".share-studio-primary-action").first())
      .toHaveCSS("opacity", "1");
    await expect(page.locator(".share-studio-secondary")).toHaveCSS("opacity", "1");
    await page.screenshot({ path: testInfo.outputPath("share-studio-short.png") });

    await page.getByRole("button", { name: "Share on Reddit" }).click();
    const thirdStep = page.getByText("Paste image into the post", { exact: true });
    await thirdStep.scrollIntoViewIfNeeded();
    await expect(thirdStep).toBeVisible();

    await page.getByRole("button", { name: "Close Share Studio" }).click();
    await page.setViewportSize({ width: 1180, height: 620 });
    await expect(page.getByRole("dialog", { name: "Share activity" })).toBeHidden();
    await expect(shareButton).toBeFocused();
    await expect(page.locator(".app-frame")).not.toHaveAttribute("inert", "");
    await expect(page.locator('[data-card-source="true"]')).toHaveCSS("opacity", "1");
  });

  test("Share Studio removes spatial motion when reduced motion is requested", async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("public"),
      ok: true
    }));
    await mockCardImages(page);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const shareButton = page.getByRole("button", { name: "Share", exact: true });
    await shareButton.click();

    const backdrop = page.getByTestId("share-studio-backdrop");
    const motionCard = page.getByTestId("share-studio-card-motion");
    await expect(backdrop).toHaveClass(/\bis-open\b/);
    await expect(motionCard).toHaveAttribute("data-motion-origin", "target");
    await expect(backdrop).toHaveCSS("backdrop-filter", "none");
    const reducedMotion = await backdrop.evaluate((element) => ({
      actionIconTransition: getComputedStyle(
        element.querySelector(".share-studio-action-icon")
      ).transitionDuration,
      spatialKeyframes: element.getAnimations({ subtree: true }).flatMap(
        (animation) => (animation.effect?.getKeyframes?.() ?? []).flatMap(
          (keyframe) => keyframe.transform && keyframe.transform !== "none"
            ? [keyframe.transform]
            : []
        )
      )
    }));
    expect(reducedMotion.actionIconTransition).toBe("0s");
    expect(reducedMotion.spatialKeyframes).toEqual([]);

    await page.getByRole("button", { name: "Share on Reddit" }).click();
    const instructions = page.locator(".share-studio-instructions");
    await expect(instructions).toBeVisible();
    await expect(instructions).toHaveCSS("opacity", "1");
    const instructionKeyframes = await instructions.evaluate((element) => (
      element.getAnimations().flatMap(
        (animation) => animation.effect?.getKeyframes?.() ?? []
      )
    ));
    expect(instructionKeyframes.every(
      (keyframe) => !keyframe.transform || keyframe.transform === "none"
    )).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("share-studio-reduced-motion.png")
    });

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Share activity" })).toBeHidden();
    await expect(shareButton).toBeFocused();
  });

  test("Share Studio keeps actions usable when preview and clipboard fail", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          write: async () => {
            throw new Error("Clipboard denied");
          },
          writeText: async () => {
            throw new Error("Clipboard denied");
          }
        }
      });
    });
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("public"),
      ok: true
    }));
    await page.route("**/api/profile/card.png*", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.has("v")) {
        await route.fulfill({
          body: JSON.stringify({
            error: { code: "unavailable", message: "Preview unavailable" },
            ok: false
          }),
          contentType: "application/json",
          status: 503
        });
        return;
      }
      await route.fulfill({
        body: CARD_PNG,
        contentType: "image/png",
        status: 200
      });
    });
    await page.route("**/u/postmelee/card.png*", (route) => route.fulfill({
      body: CARD_PNG,
      contentType: "image/png",
      status: 200
    }));

    await page.goto("/");
    const shareButton = page.getByRole("button", { name: "Share", exact: true });
    await shareButton.click();
    const dialog = page.getByRole("dialog", { name: "Share activity" });
    await expect(dialog).toBeVisible();
    await expect(page.getByText(
      "Card preview is unavailable. Sharing options are still available.",
      { exact: true }
    )).toBeVisible();
    const fallbackTitleBox = await page
      .getByRole("heading", { name: "Share activity" })
      .boundingBox();
    expect(fallbackTitleBox.top ?? fallbackTitleBox.y).toBeGreaterThanOrEqual(0);
    await expect(page.getByTestId("share-studio-card-motion"))
      .toHaveAttribute("data-motion-fallback", "preview-error");
    await expect(page.locator(".share-studio-primary-action")).toHaveCount(4);

    await page.getByRole("button", { name: "Share on Reddit" }).click();
    const composer = page.getByRole("link", { name: "Open Reddit composer" });
    await expect(composer).toHaveAttribute("target", "_blank");
    await page.getByRole("button", { name: "Copy image", exact: true }).click();
    await expect(page.getByText("Failed to copy image", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Copy Image URL" }).click();
    await expect(page.getByText("Could not copy image URL", { exact: true }))
      .toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Save PNG" }).click();
    expect((await downloadPromise).suggestedFilename()).toBe(
      "codex-usage-profile.png"
    );
    await page.screenshot({
      path: testInfo.outputPath("share-studio-preview-failure.png")
    });

    await page.getByRole("button", { name: "Close Share Studio" }).click();
    await expect(dialog).toBeHidden();
    await expect(shareButton).toBeFocused();
  });

  test("Share Studio exposes and guards the making-private state", async ({ page }) => {
    let patchRequests = 0;
    let releasePatch;
    let signalPatchStarted;
    const patchRelease = new Promise((resolve) => {
      releasePatch = resolve;
    });
    const patchStarted = new Promise((resolve) => {
      signalPatchStarted = resolve;
    });
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", async (route) => {
      if (route.request().method() === "PATCH") {
        patchRequests += 1;
        signalPatchStarted();
        await patchRelease;
        await fulfillJson(route, {
          data: ownerProfile("private"),
          ok: true
        });
        return;
      }
      await fulfillJson(route, {
        data: ownerProfile("public"),
        ok: true
      });
    });
    await mockCardImages(page);

    await page.goto("/");
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await page.getByRole("button", { name: "Make private" }).click();
    await patchStarted;

    const pendingButton = page.getByRole("button", { name: "Making private" });
    await expect(pendingButton).toBeDisabled();
    await pendingButton.click({ force: true });
    expect(patchRequests).toBe(1);
    releasePatch();

    await expect(page.getByRole("dialog", { name: "Share activity" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Publish card" })).toBeEnabled();
  });

  test("Share Studio falls back cleanly for invalid and detached source cards", async ({ page }) => {
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("public"),
      ok: true
    }));
    await mockCardImages(page);

    await page.goto("/");
    const shareButton = page.getByRole("button", { name: "Share", exact: true });
    const sourceCard = page.locator('[data-card-source="true"]');
    await expect(sourceCard).toHaveAttribute("data-tilt-enabled", "true");
    await sourceCard.evaluate((element) => {
      element.getBoundingClientRect = () => ({
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        x: 0,
        y: 0
      });
    });

    await shareButton.click();
    const dialog = page.getByRole("dialog", { name: "Share activity" });
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("share-studio-card-motion"))
      .toHaveAttribute("data-motion-origin", "target");

    await sourceCard.evaluate((element) => element.remove());
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(shareButton).toBeFocused();
    await expect(page.locator(".app-frame")).not.toHaveAttribute("inert", "");
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  });
});

test.describe("Profile and Settings canvases", () => {
  test("owner Profile keeps Share Studio functional on the fullscreen canvas", async ({ page }) => {
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("public"),
      ok: true
    }));
    await mockCardImages(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/profile");

    await expect(page.locator(".app-frame")).toHaveClass(/app-frame--fullscreen/);
    await expect(page.locator(".profile-shell")).toHaveClass(/profile-shell--fullscreen/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "postmelee" }))
      .toBeVisible();
    await expect(page.locator(".profile-heading")).toHaveCSS("text-align", "center");
    await expect(page.getByRole("heading", { level: 2, name: "Your Codex card" }))
      .toBeVisible();
    await expect(page.getByText("Public", { exact: true })).toBeVisible();

    await expect(page.getByRole("button", { name: "Share profile" })).toHaveCount(0);
    const sourceCard = page.locator(
      '.profile-card-section [data-card-source="true"]'
    );
    await expect(sourceCard).toHaveAttribute("data-tilt-enabled", "true");
    await expect(sourceCard.locator(".home-card-beam")).toBeVisible();
    await expect(sourceCard.locator(".home-card-glare")).toBeVisible();
    await expect(page.locator(".card-profile-preview")).toHaveCount(0);
    const sourceCardBox = await sourceCard.boundingBox();
    expect(sourceCardBox).not.toBeNull();
    expect(Math.round(sourceCardBox.width)).toBe(600);

    const shareButton = page.locator(".profile-card-account-state")
      .getByRole("button", { name: "Share", exact: true });
    await expect(shareButton).toBeEnabled();
    await shareButton.click();
    const dialog = page.getByRole("dialog", { name: "Share activity" });
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("share-studio-card-motion"))
      .toHaveAttribute("data-motion-origin", "source");
    await expect(sourceCard).toHaveAttribute("data-share-transition-active", "true");
    await expect(page.locator(".app-frame")).toHaveAttribute("inert", "");
    await page.getByRole("button", { name: "Close Share Studio" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator(".app-frame")).not.toHaveAttribute("inert", "");
    await expect(shareButton).toBeFocused();
  });

  test("Token activity owner supports daily hover and keyboard roving", async ({ page }) => {
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("private"),
      ok: true
    }));
    await mockCardImages(page);
    await page.goto("/profile");

    const grid = page.getByRole("grid", { name: "Daily token activity" });
    await expect(grid).toBeVisible();
    await expect(grid.locator(".token-cell")).toHaveCount(364);

    const latest = grid.locator('[data-date="2026-06-11"]');
    const exactToggle = page.getByRole("checkbox", {
      name: "Show exact token count"
    });
    await expect(exactToggle).not.toBeChecked();
    await expect(latest).toHaveAttribute("tabindex", "0");
    await latest.hover();
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toHaveText("June 11, 2026 · 100M tokens");
    await exactToggle.check();
    await expect(tooltip).toHaveCount(0);
    await latest.hover();
    await expect(tooltip).toHaveText(
      "June 11, 2026 · 100M tokens (100,000,000)"
    );
    await expect(tooltip).toHaveAttribute("data-positioned", "true");

    await latest.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(grid.locator('[data-date="2026-06-04"]')).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(tooltip).toHaveCount(0);
  });

  test("Profile heatmap switches weekly and cumulative without duplicate targets", async ({ page }) => {
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("private"),
      ok: true
    }));
    await mockCardImages(page);
    await page.goto("/profile");

    await page.getByRole("button", { name: "Weekly" }).click();
    const weeklyGrid = page.getByRole("grid", { name: "Weekly token activity" });
    await expect(weeklyGrid.getByRole("gridcell")).toHaveCount(52);
    const currentWeek = weeklyGrid.locator('[data-start-date="2026-06-07"]');
    await currentWeek.hover();
    await expect(page.getByRole("tooltip")).toHaveText(
      "Jun 7, 2026–Jun 11, 2026 · 125M tokens"
    );

    await page.getByRole("button", { name: "Cumulative" }).click();
    const cumulativeGrid = page.getByRole("grid", {
      name: "Cumulative token activity"
    });
    await expect(cumulativeGrid.getByRole("gridcell")).toHaveCount(52);
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await cumulativeGrid.locator('[data-start-date="2026-06-07"]').hover();
    await expect(page.getByRole("tooltip")).toHaveText(
      "Through June 11, 2026 · 225M tokens"
    );
  });

  test("anonymous owner Profile aligns sign-in state with profile content start", async ({ page }) => {
    await mockAnonymousAccount(page);
    await page.goto("/profile");

    await expect(page.getByRole("heading", { level: 1, name: "Sign in required" }))
      .toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in with GitHub" }))
      .toBeVisible();

    const desktopTopOffset = await page.evaluate(() => {
      const message = document.querySelector(".card-profile-message").getBoundingClientRect();
      const topbar = document.querySelector(".profile-topbar").getBoundingClientRect();
      return Math.round(message.top - topbar.bottom);
    });
    expect(desktopTopOffset).toBe(72);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileTopOffset = await page.evaluate(() => {
      const message = document.querySelector(".card-profile-message").getBoundingClientRect();
      const topbar = document.querySelector(".profile-topbar").getBoundingClientRect();
      return Math.round(message.top - topbar.bottom);
    });
    expect(mobileTopOffset).toBe(48);
  });

  test("owner Profile loading, empty, and error states keep one visual heading", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(globalThis.navigator, "clipboard", {
        configurable: true,
        value: {
          async writeText(value) {
            globalThis.__copiedProfileCommand = value;
          }
        }
      });
    });
    await mockAuthenticatedAccount(page);
    let releaseProfile;
    const profileGate = new Promise((resolve) => {
      releaseProfile = resolve;
    });
    await page.route("**/api/profile", async (route) => {
      await profileGate;
      await fulfillJson(route, {
        data: { ...ownerProfile("private"), usage: null },
        ok: true
      });
    });

    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Loading profile" }))
      .toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const loadingTopOffset = await page.evaluate(() => {
      const message = document.querySelector(".card-profile-message").getBoundingClientRect();
      const topbar = document.querySelector(".profile-topbar").getBoundingClientRect();
      return Math.round(message.top - topbar.bottom);
    });
    expect(loadingTopOffset).toBe(72);

    releaseProfile();
    await expect(page.getByRole("heading", {
      level: 1,
      name: "No usage submitted yet"
    })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByText(
      "Submit your local Codex usage once to create your card. Run the same command whenever you want to update it."
    )).toBeVisible();
    await expect(page.getByText(SUBMIT_COMMAND, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "View setup guide" }))
      .toHaveAttribute("href", "/#quickstart");
    await expect(page.getByText(
      "Only aggregated usage is submitted. Prompts, responses, credentials, and local session files stay on your device."
    )).toBeVisible();

    const emptyState = page.locator(".card-profile-empty");
    const commandRow = emptyState.locator(".home-command-row");
    const copyButton = commandRow.getByRole("button", { name: "Copy submit command" });
    await expect(copyButton.locator(".icon")).toBeVisible();

    const desktopTopOffset = await page.evaluate(() => {
      const empty = document.querySelector(".card-profile-empty").getBoundingClientRect();
      const topbar = document.querySelector(".profile-topbar").getBoundingClientRect();
      return Math.round(empty.top - topbar.bottom);
    });
    expect(desktopTopOffset).toBe(72);

    const commandBox = await commandRow.locator("code").boundingBox();
    const copyBox = await copyButton.boundingBox();
    expect(commandBox).not.toBeNull();
    expect(copyBox).not.toBeNull();
    expect(copyBox.x).toBeGreaterThan(commandBox.x);

    await copyButton.click();
    await expect(page.getByRole("status")).toHaveText(
      "Command copied."
    );
    await expect.poll(() => page.evaluate(() => globalThis.__copiedProfileCommand))
      .toBe(SUBMIT_COMMAND);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileTopOffset = await page.evaluate(() => {
      const empty = document.querySelector(".card-profile-empty").getBoundingClientRect();
      const topbar = document.querySelector(".profile-topbar").getBoundingClientRect();
      return Math.round(empty.top - topbar.bottom);
    });
    expect(mobileTopOffset).toBe(48);
    expect(await page.evaluate(
      () => document.body.scrollWidth > document.documentElement.clientWidth
    )).toBe(false);

    await page.unroute("**/api/profile");
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      error: { code: "service_unavailable", message: "Profile lookup failed" },
      ok: false
    }, 503));
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Profile unavailable" }))
      .toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const unavailableTopOffset = await page.evaluate(() => {
      const message = document.querySelector(".card-profile-message").getBoundingClientRect();
      const topbar = document.querySelector(".profile-topbar").getBoundingClientRect();
      return Math.round(message.top - topbar.bottom);
    });
    expect(unavailableTopOffset).toBe(48);
  });

  test("Settings keeps semantic sections and representative mutations", async ({ page }) => {
    let createRequests = 0;
    let renameRequests = 0;
    await mockAuthenticatedAccount(page);
    await page.route("**/api/settings/tokens", (route) => {
      if (route.request().method() === "POST") {
        createRequests += 1;
        return fulfillJson(route, {
          data: {
            token: "cup_raw_token",
            tokenRecord: { id: "token_2", label: "CI token" }
          },
          ok: true
        }, 201);
      }
      return fulfillJson(route, {
        data: { tokens: [{ id: "token_1", label: "Existing token" }] },
        ok: true
      });
    });
    await page.route("**/api/settings/devices", (route) => fulfillJson(route, {
      data: {
        devices: [{
          customName: "Office Mac",
          deviceKey: "machine-1",
          displayName: "Office Mac",
          id: "device_1"
        }]
      },
      ok: true
    }));
    await page.route("**/api/settings/devices/device_1", (route) => {
      renameRequests += 1;
      return fulfillJson(route, {
        data: {
          device: {
            customName: "Desk Mac",
            deviceKey: "machine-1",
            displayName: "Desk Mac",
            id: "device_1"
          }
        },
        ok: true
      });
    });

    await page.goto("/settings");

    await expect(page.locator(".app-frame")).toHaveClass(/app-frame--fullscreen/);
    await expect(page.locator(".settings-view")).toHaveCSS(
      "background-color",
      "rgb(13, 13, 13)"
    );
    await expect(page.locator(".settings-panel").first()).toHaveCSS(
      "background-color",
      "rgb(23, 23, 23)"
    );
    await expect(page.getByRole("heading", { level: 1, name: "Settings" }))
      .toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    for (const sectionName of ["GitHub account", "API Tokens", "Devices"]) {
      await expect(page.getByRole("heading", { level: 2, name: sectionName }))
        .toBeVisible();
    }

    await page.getByRole("button", { name: "Create token" }).click();
    await expect(page.getByText("cup_raw_token", { exact: true })).toBeVisible();
    expect(createRequests).toBe(1);

    await page.getByRole("button", { name: "Rename" }).click();
    await page.getByRole("textbox", { name: "Device name" }).fill("Desk Mac");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Desk Mac", { exact: true })).toBeVisible();
    expect(renameRequests).toBe(1);
  });

  test("anonymous Settings keeps Settings as the page heading", async ({ page }) => {
    await mockAnonymousAccount(page);
    await page.goto("/settings");

    await expect(page.getByRole("heading", { level: 1, name: "Settings" }))
      .toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Sign in required" }))
      .toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in with GitHub" }))
      .toHaveAttribute("href", "/api/auth/github/login?redirect_to=%2Fsettings");
  });

  test("owner Profile and Settings stay readable on mobile", async ({ page }) => {
    await mockAuthenticatedAccount(page);
    await page.route("**/api/settings/tokens", (route) => fulfillJson(route, {
      data: { tokens: [] },
      ok: true
    }));
    await page.route("**/api/settings/devices", (route) => fulfillJson(route, {
      data: { devices: [] },
      ok: true
    }));
    await mockCardImages(page);
    await page.setViewportSize({ width: 390, height: 844 });

    for (const path of ["/profile", "/settings"]) {
      await page.goto(path);
      const pageHeading = page.getByRole("heading", { level: 1 });
      const topbar = page.locator(".profile-topbar");
      await expect(pageHeading).toHaveCount(1);
      await expect(pageHeading).toBeVisible();

      const headingBox = await pageHeading.boundingBox();
      const topbarBox = await topbar.boundingBox();
      expect(headingBox).not.toBeNull();
      expect(topbarBox).not.toBeNull();
      expect(headingBox.y).toBeGreaterThanOrEqual(topbarBox.y + topbarBox.height);
      expect(await page.evaluate(
        () => document.body.scrollWidth > document.documentElement.clientWidth
      )).toBe(false);
    }
  });
});

test.describe("Settings appearance control", () => {
  test("appearance control remains available across account states and locales", async ({ page }) => {
    await useKoreanLocale(page);
    await mockAnonymousAccount(page);
    await page.goto("/settings");

    const appearance = page.getByRole("group", { name: "화면 모드" });
    await expect(appearance).toBeVisible();
    await expect(appearance.getByRole("radio", { name: /시스템/ }))
      .toBeChecked();
    await expect(appearance.getByRole("radio")).toHaveCount(3);
    for (const radio of await appearance.getByRole("radio").all()) {
      await expect(radio).toBeEnabled();
    }
    await expect(page.getByRole("heading", { name: "로그인 필요" }))
      .toBeVisible();

    await page.unroute("**/api/auth/me");
    await page.route("**/api/auth/me", (route) => fulfillJson(route, {
      error: { code: "service_unavailable", message: "Account unavailable" },
      ok: false
    }, 503));
    await page.reload();
    await expect(page.getByRole("group", { name: "화면 모드" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "계정을 사용할 수 없음" }))
      .toBeVisible();
  });

  test("theme preference applies immediately and persists across contexts", async ({ browser, page }) => {
    await mockAuthenticatedAccount(page);
    await mockSettingsData(page);
    await page.goto("/settings");

    const appearance = page.getByRole("group", { name: "Appearance" });
    const light = appearance.getByRole("radio", { name: /Light/ });
    await light.check();
    await expect(light).toBeChecked();
    await expect(page.locator("html"))
      .toHaveAttribute("data-theme-preference", "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY))
      .toBe("light");

    await page.reload();
    await expect(page.getByRole("radio", { name: /Light/ })).toBeChecked();

    const storageState = await page.context().storageState();
    const restoredContext = await browser.newContext({
      colorScheme: "dark",
      storageState
    });
    const restoredPage = await restoredContext.newPage();
    await mockAuthenticatedAccount(restoredPage);
    await mockSettingsData(restoredPage);
    await restoredPage.goto("http://127.0.0.1:5173/settings");
    await expect(restoredPage.getByRole("radio", { name: /Light/ }))
      .toBeChecked();
    await expect(restoredPage.locator("html")).toHaveAttribute("data-theme", "light");
    await restoredContext.close();

    const system = page.getByRole("radio", { name: /System/ });
    await system.check();
    await expect(system).toBeChecked();
    expect(await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY))
      .toBeNull();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(system).toBeChecked();
  });

  test("appearance control supports keyboard theme preference selection", async ({ page }) => {
    await mockAuthenticatedAccount(page);
    await mockSettingsData(page);
    await page.goto("/settings");

    const system = page.getByRole("radio", { name: /System/ });
    const light = page.getByRole("radio", { name: /Light/ });
    const dark = page.getByRole("radio", { name: /Dark/ });
    await system.focus();
    await page.keyboard.press("ArrowRight");
    await expect(light).toBeFocused();
    await expect(light).toBeChecked();
    await expect(page.locator('.settings-appearance-option:has(input[value="light"])'))
      .toHaveCSS("outline-style", "solid");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.keyboard.press("ArrowRight");
    await expect(dark).toBeFocused();
    await expect(dark).toBeChecked();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("themed card preview follows the resolved owner theme", async ({ page }) => {
    await page.addInitScript((storageKey) => {
      if (localStorage.getItem(storageKey) === null) {
        localStorage.setItem(storageKey, "light");
      }
    }, THEME_STORAGE_KEY);
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("public"),
      ok: true
    }));
    await mockCardImages(page);

    await page.goto("/");
    await expect(page.locator(".home-card-preview")).toHaveAttribute(
      "src",
      /\/api\/profile\/card\.png\?locale=en&theme=light/
    );
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await expect(page.locator(".share-studio-card")).toHaveAttribute(
      "src",
      /\/api\/profile\/card\.png\?locale=en&theme=light/
    );
    await page.getByRole("button", { name: "Close Share Studio" }).click();

    await page.goto("/profile");
    await expect(page.locator(".profile-card-section .home-card-preview"))
      .toHaveAttribute(
        "src",
        /\/api\/profile\/card\.png\?locale=en&theme=light/
      );

    await page.goto("/settings");
    await mockSettingsData(page);
    await page.getByRole("radio", { name: /Dark/ }).check();
    await page.goto("/profile");
    await expect(page.locator(".profile-card-section .home-card-preview"))
      .toHaveAttribute(
        "src",
        /\/api\/profile\/card\.png\?locale=en&theme=dark/
      );
  });
});

test.describe("Public profile", () => {
  test("public profile renders the API-backed GitHub identity and stable card", async ({ page }, testInfo) => {
    await mockAnonymousAccount(page);
    await mockPublicProfile(page);
    await mockCardImages(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(SITES_PROFILE_ROUTE);

    await expect(page.getByRole("heading", {
      level: 1,
      name: "Post Melee"
    }))
      .toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator(".app-frame")).toHaveClass(/app-frame--fullscreen/);
    await expect(page.getByText("@postmelee", { exact: true })).toBeVisible();
    await expect(page.locator(".profile-heading")).toHaveCSS("text-align", "center");
    await expect(page.getByText("Public", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Share profile" })).toHaveCount(0);

    const card = page.getByRole("img", { name: "Codex usage card for Post Melee" });
    await expect(card).toHaveAttribute(
      "src",
      "http://127.0.0.1:5173/u/postmelee/card.png"
    );
    await expect(card).toHaveCSS("aspect-ratio", "499 / 306");
    await expect.poll(() => card.evaluate((image) => image.naturalWidth)).toBe(1497);

    await expect(page.getByText("Activity insights", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Most used plugins", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Token activity", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Shared Codex card" }))
      .toBeVisible();
    const publicMarkup = await page.locator(".public-profile-view").innerHTML();
    for (const internalValue of [
      "owner_1",
      "providerUserId",
      "contentDigest",
      "tokenDigest",
      "/Users/"
    ]) {
      expect(publicMarkup).not.toContain(internalValue);
    }
    expect(await page.evaluate(
      () => document.body.scrollWidth > document.documentElement.clientWidth
    )).toBe(false);
    await page.screenshot({ path: testInfo.outputPath("public-profile-desktop.png") });
  });

  test("public profile keeps the card readable on mobile without horizontal overflow", async ({ page }, testInfo) => {
    await mockAnonymousAccount(page);
    await mockPublicProfile(page);
    await mockCardImages(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PROFILE_ROUTE);

    const card = page.getByRole("img", { name: "Codex usage card for Post Melee" });
    await expect(card).toBeVisible();
    const cardBox = await card.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(cardBox.x).toBeGreaterThanOrEqual(0);
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(
      () => document.body.scrollWidth > document.documentElement.clientWidth
    )).toBe(false);
    await page.screenshot({ path: testInfo.outputPath("public-profile-mobile.png") });
  });

  test("Profile heatmap public touch toggles and stays inside mobile page", async ({ page }) => {
    await mockAnonymousAccount(page);
    await mockPublicProfile(page);
    await mockCardImages(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PROFILE_ROUTE);

    const target = page.getByRole("grid", { name: "Daily token activity" })
      .locator('[data-date="2026-06-11"]');
    await target.dispatchEvent("pointerdown", { pointerType: "touch" });
    await target.dispatchEvent("pointerup", { pointerType: "touch" });
    await expect(page.getByRole("tooltip")).toHaveText(
      "June 11, 2026 · 100M tokens"
    );

    await page.locator(".profile-topbar").dispatchEvent("pointerdown", {
      pointerType: "touch"
    });
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    expect(await page.evaluate(
      () => document.body.scrollWidth > document.documentElement.clientWidth
    )).toBe(false);
  });

  test("public profile moves from a neutral loading state to ready", async ({ page }) => {
    await mockAnonymousAccount(page);
    let releaseResponse;
    const responseGate = new Promise((resolve) => {
      releaseResponse = resolve;
    });
    await page.route("**/api/profiles/public/postmelee", async (route) => {
      await responseGate;
      await fulfillJson(route, { data: publicProfile(), ok: true });
    });
    await mockCardImages(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(PROFILE_ROUTE);

    await expect(page.getByRole("heading", {
      level: 1,
      name: "Loading public profile"
    }))
      .toBeVisible();
    await expect(page.getByText("postmelee", { exact: false })).toHaveCount(0);

    releaseResponse();
    await expect(page.getByRole("heading", {
      level: 1,
      name: "Post Melee"
    }))
      .toBeVisible();
  });

  test("public profile uses one identity-free unavailable state", async ({ page }) => {
    await mockAnonymousAccount(page);
    await page.route("**/api/profiles/public/private-or-missing", (route) => (
      fulfillJson(route, {
        error: { code: "not_found", message: "Card not found" },
        ok: false
      }, 404)
    ));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/u/private-or-missing");

    await expect(page.getByRole("heading", {
      level: 1,
      name: "Profile unavailable"
    }))
      .toBeVisible();
    await expect(page.getByText("This public profile is not available."))
      .toBeVisible();
    await expect(page.getByText("private-or-missing", { exact: false })).toHaveCount(0);
    await expect(page.locator(".public-profile-card")).toHaveCount(0);
  });
});

async function mockAnonymousAccount(page) {
  await page.route("**/api/auth/me", (route) => fulfillJson(route, {
    error: { code: "unauthorized", message: "Session cookie is required" },
    ok: false
  }, 401));
}

async function mockAuthenticatedAccount(page) {
  await page.route("**/api/auth/me", (route) => fulfillJson(route, {
    data: {
      owner: AUTH_OWNER,
      session: { id: "session_1", ownerId: AUTH_OWNER.id }
    },
    ok: true
  }));
  await page.route("**/api/profile", (route) => fulfillJson(route, {
    data: ownerProfile("private"),
    ok: true
  }));
}

async function mockSettingsData(page) {
  await page.route("**/api/settings/tokens", (route) => fulfillJson(route, {
    data: { tokens: [] },
    ok: true
  }));
  await page.route("**/api/settings/devices", (route) => fulfillJson(route, {
    data: { devices: [] },
    ok: true
  }));
}

async function useThemePreference(page, preference) {
  await page.addInitScript(({ storageKey, value }) => {
    if (value === "system") {
      localStorage.removeItem(storageKey);
      return;
    }
    localStorage.setItem(storageKey, value);
  }, { storageKey: THEME_STORAGE_KEY, value: preference });
}

async function useKoreanLocale(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      get: () => ["ko-KR", "en-US"]
    });
    Object.defineProperty(navigator, "language", {
      configurable: true,
      get: () => "ko-KR"
    });
  });
}

async function useUnsupportedLocale(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      get: () => ["ja-JP", "fr-FR"]
    });
    Object.defineProperty(navigator, "language", {
      configurable: true,
      get: () => "ja-JP"
    });
  });
}

function expectRectNear(actual, expected, tolerance) {
  expect(actual).not.toBeNull();
  expect(expected).not.toBeNull();
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.width - expected.width)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.height - expected.height)).toBeLessThanOrEqual(tolerance);
}

async function expectCardAccurateSkeleton(page) {
  const skeleton = page.locator(".home-card-skeleton");
  const heatmap = skeleton.locator(".home-card-skeleton-heatmap");
  const cells = heatmap.locator(".home-card-skeleton-heatmap-cell");
  const stats = skeleton.locator(".home-card-skeleton-stat");

  await expect(skeleton).toHaveAttribute("aria-hidden", "true");
  await expect(heatmap).toHaveAttribute("data-column-count", "26");
  await expect(heatmap).toHaveAttribute("data-row-count", "7");
  await expect(cells).toHaveCount(HOME_CARD_SKELETON_HEATMAP_CELL_COUNT);
  await expect(stats).toHaveCount(4);
  await expect(skeleton.locator(".home-card-skeleton-stat-value")).toHaveCount(4);
  await expect(skeleton.locator(".home-card-skeleton-stat-label")).toHaveCount(4);
  await expect(skeleton.locator(".home-card-skeleton-avatar")).toHaveCount(1);
  await expect(skeleton.locator(".home-card-skeleton-display-name"))
    .toHaveCount(1);
  await expect(skeleton.locator(".home-card-skeleton-username")).toHaveCount(1);
  await expect(skeleton.locator(".home-card-skeleton-brand"))
    .toHaveText("Codex");
  await expect(skeleton).toHaveText("Codex");

  const contract = await skeleton.evaluate((element) => {
    const skeletonRect = element.getBoundingClientRect();
    const avatar = element.querySelector(".home-card-skeleton-avatar");
    const displayName = element.querySelector(
      ".home-card-skeleton-display-name"
    );
    const username = element.querySelector(".home-card-skeleton-username");
    const brand = element.querySelector(".home-card-skeleton-brand");
    const heatmapElement = element.querySelector(".home-card-skeleton-heatmap");
    const statsElement = element.querySelector(".home-card-skeleton-stats");
    const statElements = Array.from(
      element.querySelectorAll(".home-card-skeleton-stat")
    );
    const cellElements = Array.from(
      element.querySelectorAll(".home-card-skeleton-heatmap-cell")
    );
    const avatarRect = avatar.getBoundingClientRect();
    const displayNameRect = displayName.getBoundingClientRect();
    const usernameRect = username.getBoundingClientRect();
    const brandRect = brand.getBoundingClientRect();
    const heatmapRect = heatmapElement.getBoundingClientRect();
    const statsRect = statsElement.getBoundingClientRect();
    const cellRects = cellElements.map((cell) => cell.getBoundingClientRect());
    const percent = (value, dimension) => (
      Math.round((value / dimension) * 10000) / 100
    );
    const relativeRect = (rect) => ({
      heightPercent: percent(rect.height, skeletonRect.height),
      leftPercent: percent(
        rect.left - skeletonRect.left,
        skeletonRect.width
      ),
      topPercent: percent(
        rect.top - skeletonRect.top,
        skeletonRect.height
      ),
      widthPercent: percent(rect.width, skeletonRect.width)
    });

    return {
      avatar: {
        ...relativeRect(avatarRect),
        borderRadius: getComputedStyle(avatar).borderRadius,
        color: getComputedStyle(avatar).backgroundColor
      },
      brand: {
        ...relativeRect(brandRect),
        animationName: getComputedStyle(brand).animationName,
        centerXPercent: percent(
          brandRect.left - skeletonRect.left + (brandRect.width / 2),
          skeletonRect.width
        ),
        color: getComputedStyle(brand).color,
        text: brand.textContent,
        zIndex: getComputedStyle(brand).zIndex
      },
      cellAnimationNames: Array.from(new Set(
        cellElements.map((cell) => getComputedStyle(cell).animationName)
      )),
      cellColors: Array.from(new Set(
        cellElements.map((cell) => getComputedStyle(cell).backgroundColor)
      )),
      maxCellAspectDelta: Math.max(...cellRects.map(
        (rect) => Math.abs(rect.width - rect.height)
      )),
      identity: {
        displayName: relativeRect(displayNameRect),
        displayNameText: displayName.textContent,
        username: relativeRect(usernameRect),
        usernameText: username.textContent
      },
      shimmerZIndex: getComputedStyle(element, "::after").zIndex,
      positions: {
        headerBottom: Math.max(
          avatarRect.bottom,
          displayNameRect.bottom,
          usernameRect.bottom,
          brandRect.bottom
        ),
        heatmapBottom: heatmapRect.bottom,
        heatmapHeightPercent: percent(heatmapRect.height, skeletonRect.height),
        heatmapLeftPercent: percent(
          heatmapRect.left - skeletonRect.left,
          skeletonRect.width
        ),
        heatmapTop: heatmapRect.top,
        heatmapTopPercent: percent(
          heatmapRect.top - skeletonRect.top,
          skeletonRect.height
        ),
        heatmapWidthPercent: percent(heatmapRect.width, skeletonRect.width),
        statsTop: statsRect.top,
        statsTopPercent: percent(
          statsRect.top - skeletonRect.top,
          skeletonRect.height
        )
      },
      statDividerColors: statElements.slice(1).map(
        (stat) => getComputedStyle(stat).borderLeftColor
      ),
      statDividerWidths: statElements.slice(1).map(
        (stat) => getComputedStyle(stat).borderLeftWidth
      )
    };
  });

  expect(contract.cellColors).toEqual(["rgb(47, 47, 47)"]);
  expect(contract.cellAnimationNames).toEqual(["none"]);
  expect(contract.maxCellAspectDelta).toBeLessThanOrEqual(1);
  expect(contract.avatar.color).toBe("rgb(47, 47, 47)");
  expect(contract.avatar.borderRadius).toBe("50%");
  expect(contract.avatar.leftPercent).toBeCloseTo(7.21, 1);
  expect(contract.avatar.topPercent).toBeCloseTo(11.76, 1);
  expect(contract.avatar.widthPercent).toBeCloseTo(8.82, 1);
  expect(contract.avatar.heightPercent).toBeCloseTo(14.38, 1);
  expect(contract.identity.displayName.leftPercent).toBeCloseTo(19.24, 1);
  expect(contract.identity.username.leftPercent).toBeCloseTo(19.24, 1);
  expect(contract.identity.displayNameText).toBe("");
  expect(contract.identity.usernameText).toBe("");
  expect(contract.brand.text).toBe("Codex");
  expect(contract.brand.color).toBe("rgb(174, 174, 174)");
  expect(contract.brand.animationName).toBe("none");
  expect(contract.brand.centerXPercent).toBeCloseTo(88.08, 1);
  expect(contract.brand.widthPercent).toBeCloseTo(11.42, 1);
  expect(contract.brand.zIndex).toBe("2");
  expect(contract.shimmerZIndex).toBe("1");
  expect(contract.positions.headerBottom)
    .toBeLessThan(contract.positions.heatmapTop);
  expect(contract.positions.heatmapBottom)
    .toBeLessThan(contract.positions.statsTop);
  expect(contract.positions.heatmapLeftPercent).toBeCloseTo(6.41, 1);
  expect(contract.positions.heatmapTopPercent).toBeCloseTo(31.37, 1);
  expect(contract.positions.heatmapWidthPercent).toBeCloseTo(87.17, 1);
  expect(contract.positions.heatmapHeightPercent).toBeCloseTo(37.58, 1);
  expect(contract.positions.statsTopPercent).toBeCloseTo(76.47, 1);
  expect(contract.statDividerColors).toEqual([
    "rgb(36, 36, 36)",
    "rgb(36, 36, 36)",
    "rgb(36, 36, 36)"
  ]);
  expect(contract.statDividerWidths).toEqual(["1px", "1px", "1px"]);
}

function rectCenterX(rect) {
  return rect.x + (rect.width / 2);
}

async function getClippedHomeElements(page) {
  return page.locator([
    ".profile-topbar-title",
    ".profile-navigation a",
    ".home-heading h1",
    ".home-heading p",
    ".home-account-identity strong",
    ".home-account-identity small",
    ".home-command-row code",
    ".home-quickstart-steps h3",
    ".home-quickstart-steps p",
    ".primary-command",
    ".secondary-command"
  ].join(", ")).evaluateAll((elements) => elements.flatMap((element) => {
    const horizontalClipping = element.scrollWidth > element.clientWidth + 1;
    const verticalClipping = element.scrollHeight > element.clientHeight + 1;

    return horizontalClipping || verticalClipping
      ? [`${element.tagName.toLowerCase()}.${element.className}`]
      : [];
  }));
}

async function getMarketingMetrics(page) {
  return page.evaluate(() => {
    const card = document.querySelector(".home-card-tilt");
    const description = document.querySelector(".home-heading p");
    const quickstart = document.querySelector(".home-quickstart-inner");
    const title = document.querySelector(".home-heading h1");
    if (!card || !description || !quickstart || !title) {
      throw new Error("Marketing layout is incomplete");
    }

    const box = (element) => {
      const bounds = element.getBoundingClientRect();
      return {
        height: Math.round(bounds.height * 100) / 100,
        right: Math.round(bounds.right * 100) / 100,
        width: Math.round(bounds.width * 100) / 100
      };
    };
    const text = (element) => ({
      ...box(element),
      fontSize: getComputedStyle(element).fontSize,
      lineHeight: getComputedStyle(element).lineHeight
    });
    const horizontalBox = (element) => {
      const { right, width } = box(element);
      return { right, width };
    };

    return {
      card: box(card),
      description: text(description),
      quickstart: horizontalBox(quickstart),
      title: text(title)
    };
  });
}

async function mockCardImages(page) {
  const fulfillPng = (route) => route.fulfill({
    body: CARD_PNG,
    contentType: "image/png",
    status: 200
  });
  await page.route("**/api/profile/card.png*", fulfillPng);
  await page.route("**/u/postmelee/card.png*", fulfillPng);
}

async function mockPublicProfile(page) {
  await page.route("**/api/profiles/public/postmelee", (route) => fulfillJson(route, {
    data: publicProfile(),
    ok: true
  }));
}

function publicProfile() {
  return {
    owner: {
      avatarUrl: "https://avatars.githubusercontent.com/u/12345",
      displayName: "Post Melee",
      githubLogin: "postmelee",
      handle: "postmelee"
    },
    publicCardUrl: "http://127.0.0.1:5173/u/postmelee/card.png",
    usage: {
      capturedAt: "2026-06-11T00:00:00.000Z",
      uploadedAt: "2026-06-11T00:01:00.000Z",
      usage: {
        dailyUsageBuckets: PROFILE_DAILY_USAGE_BUCKETS,
        summary: {
          currentStreakDays: 5,
          lifetimeTokens: 250_000_000,
          longestStreakDays: 49,
          longestRunningTurnSec: 6_030,
          peakDailyTokens: 100_000_000
        }
      }
    },
    visibility: "public"
  };
}

function ownerProfile(visibility) {
  return {
    owner: { ...AUTH_OWNER, visibility },
    publicCardUrl: "http://127.0.0.1:5173/u/postmelee/card.png",
    usage: {
      capturedAt: "2026-06-11T00:00:00.000Z",
      uploadedAt: "2026-06-11T00:01:00.000Z",
      usage: {
        dailyUsageBuckets: PROFILE_DAILY_USAGE_BUCKETS,
        summary: {
          currentStreakDays: 5,
          lifetimeTokens: 250_000_000,
          longestRunningTurnSec: 6_030,
          longestStreakDays: 49,
          peakDailyTokens: 100_000_000
        }
      }
    },
    visibility
  };
}

async function fulfillJson(route, body, status = 200) {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    status
  });
}

async function getLandingScrollMetrics(page) {
  return page.locator(".app-frame").evaluate((frame) => {
    const shell = frame.querySelector(".profile-shell");
    const frameRect = frame.getBoundingClientRect();

    return {
      documentScrollHeight: document.documentElement.scrollHeight,
      frameHeight: frameRect.height,
      overflowY: getComputedStyle(shell).overflowY,
      viewportHeight: window.innerHeight
    };
  });
}
