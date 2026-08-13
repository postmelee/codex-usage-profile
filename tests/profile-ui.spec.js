import { readFileSync } from "node:fs";

import { devices, expect, test } from "@playwright/test";

const PROFILE_ROUTE = "/u/postmelee";
const SITES_PROFILE_ROUTE = "/api/share/postmelee";
const OWNER_PROFILE_ROUTE = "/?view=profile";
const CARD_PNG = readFileSync(new URL(
  "../public/assets/codex-card-sample.png",
  import.meta.url
));
const STYLESHEET = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const HOME_CARD_SKELETON_HEATMAP_CELL_COUNT = 26 * 7;
const E2E_ORIGIN = process.env.PROFILE_E2E_ORIGIN ?? "http://127.0.0.1:5173";
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

test("card readiness releases reacquired same-source leases", async ({ page }) => {
  await page.route("**/__card-readiness/card.png", (route) => route.fulfill({
    body: CARD_PNG,
    contentType: "image/png",
    status: 200
  }));
  await page.goto(
    "/src/profile-ui/__tests__/fixtures/card-image-readiness.html"
  );
  const state = page.locator("#readiness-state");

  await expect(state).toHaveAttribute("data-status", "ready");
  const firstDisplaySrc = await state.getAttribute("data-display-src");
  expect(firstDisplaySrc).toMatch(/^blob:/);

  await page.evaluate(() => {
    globalThis.__cardImageReadinessHarness.setSource(null);
  });
  await expect(state).toHaveAttribute("data-status", "idle");
  await expect(state).toHaveAttribute("data-display-src", firstDisplaySrc);

  await page.evaluate(() => {
    const harness = globalThis.__cardImageReadinessHarness;
    harness.setSource(harness.cardSource);
  });
  await expect(state).toHaveAttribute("data-status", "ready");
  await expect(state).toHaveAttribute("data-display-src", firstDisplaySrc);

  const result = await page.evaluate(async () => {
    const harness = globalThis.__cardImageReadinessHarness;
    const cleared = harness.clear();
    harness.unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));
    return { cleared, revoked: [...harness.revokedObjectUrls] };
  });
  expect(result).toEqual({ cleared: 1, revoked: [firstDisplaySrc] });
});

test.describe("theme surfaces", () => {
  test("Task #96 light Profile Skeleton uses a site-theme palette", async ({ page }) => {
    await useThemePreference(page, "light");
    await mockAnonymousAccount(page);
    await page.route("**/api/profiles/public/postmelee", () => new Promise(() => {}));
    await page.goto(PROFILE_ROUTE, { waitUntil: "domcontentloaded" });

    const loadingSkeleton = page.getByTestId("public-profile-loading-skeleton");
    const pagePlaceholder = loadingSkeleton.locator(".profile-loading-shimmer").first();
    const cardPlaceholder = loadingSkeleton.locator(".home-card-skeleton");
    await expect(loadingSkeleton).toHaveAttribute("aria-busy", "true");

    const palette = await pagePlaceholder.evaluate((element) => {
      const background = getComputedStyle(element).backgroundColor;
      const channels = background.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      return {
        background,
        lightness: channels.slice(0, 3).reduce((sum, value) => sum + value, 0) / 3,
        sheen: getComputedStyle(element, "::after").backgroundImage
      };
    });
    expect(palette.lightness).toBeGreaterThan(180);
    expect(palette.sheen).not.toContain("rgba(255, 255, 255");

    await expect(cardPlaceholder).toHaveCSS("background-color", "rgb(24, 24, 24)");

    const loadingSurfaces = loadingSkeleton.locator([
      ".profile-loading-shimmer",
      ".profile-loading-stats",
      ".profile-loading-card"
    ].join(", "));
    await expectThemeSurfaceTransition(page, loadingSurfaces, {
      toggleName: "Switch to dark theme"
    });
  });

  test("Task #96 card Skeleton follows the card theme instead of the site theme", async ({ page }) => {
    await useThemePreference(page, "dark");
    await mockAnonymousAccount(page);
    await mockPublicProfile(page);
    await page.route("**/u/postmelee/card.png*", () => new Promise(() => {}));
    await page.goto(SITES_PROFILE_ROUTE, { waitUntil: "domcontentloaded" });

    const publicCard = page.locator(
      ".public-profile-stage .profile-card-section .home-card-media"
    );
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(publicCard).toHaveAttribute("data-card-theme", "light");
    await expect(publicCard.locator(".home-card-skeleton"))
      .toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(publicCard.locator(".home-card-skeleton-avatar"))
      .toHaveCSS("background-color", "rgb(238, 238, 238)");
  });

  test("Task #96 owner draft switches the card Skeleton palette independently", async ({ page }) => {
    await useThemePreference(page, "light");
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("public"),
      ok: true
    }));
    await page.route("**/api/profile/card.png*", () => new Promise(() => {}));
    await page.goto(OWNER_PROFILE_ROUTE, { waitUntil: "domcontentloaded" });

    const ownerCard = page.locator(".profile-card-section .home-card-media");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(ownerCard).toHaveAttribute("data-card-theme", "dark");
    await expect(ownerCard.locator(".home-card-skeleton"))
      .toHaveCSS("background-color", "rgb(24, 24, 24)");

    await page.getByRole("radio", { name: "Light" }).click();
    await expect(ownerCard).toHaveAttribute("data-card-theme", "light");
    await expect(ownerCard.locator(".home-card-skeleton"))
      .toHaveCSS("background-color", "rgb(255, 255, 255)");
  });

  test("Task #96 semantic primary text stays inside one theme transition window", async ({ page }) => {
    await useThemePreference(page, "dark");
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("public"),
      ok: true
    }));
    await mockCardImages(page);
    await page.goto("/");

    const homeTargets = page.locator([
      ".home-quickstart-heading h2",
      ".home-quickstart-steps h3",
      ".home-account-identity strong"
    ].join(", "));
    await expect(homeTargets.first()).toBeVisible();
    await expectSemanticThemeTransition(page, homeTargets, {
      finalColor: "rgb(23, 23, 23)",
      toggleName: "Switch to light theme"
    });

    await page.goto(OWNER_PROFILE_ROUTE);
    const profileTargets = page.locator([
      ".profile-heading h1",
      ".profile-heading h2",
      ".profile-stage h2"
    ].join(", "));
    await expect(profileTargets.first()).toBeVisible();
    await expectSemanticThemeTransition(page, profileTargets, {
      finalColor: "rgb(23, 23, 23)",
      toggleName: "Switch to light theme"
    });
  });

  test("Task #96 Home dividers and anonymous access share the theme surface transition", async ({ page }) => {
    await useThemePreference(page, "dark");
    await mockAnonymousAccount(page);
    await page.goto("/");

    const surfaceTargets = page.locator([
      ".home-quickstart-access",
      ".home-quickstart-steps li"
    ].join(", "));
    await expect(surfaceTargets.first()).toBeVisible();
    await expectThemeSurfaceTransition(page, surfaceTargets, {
      toggleName: "Switch to light theme"
    });
  });

  test("Task #96 Home avatar surface shares the theme transition", async ({ page }) => {
    await useThemePreference(page, "dark");
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("public"),
      ok: true
    }));
    await mockCardImages(page);
    await page.goto("/");

    const avatar = page.locator(".home-account-identity > img, .home-account-identity > span");
    await expect(avatar).toBeVisible();
    await expectThemeSurfaceTransition(page, avatar, {
      toggleName: "Switch to light theme"
    });
  });

  test("Task #96 theme text and heatmap keep one stable transition timeline", async ({ page }) => {
    await useThemePreference(page, "dark");
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("public"),
      ok: true
    }));
    await mockCardImages(page);
    await page.goto(OWNER_PROFILE_ROUTE);

    const heading = page.locator(".profile-heading h1");
    const heatmap = page.locator(".token-cell.token-level-4").first();
    await expect(heading).toBeVisible();
    await expect(heatmap).toBeVisible();

    await expectStableThemeTimeline(page, heading, heatmap, {
      heading: "rgb(23, 23, 23)",
      heatmap: "rgb(40, 116, 179)",
      toggleName: "Switch to light theme"
    });
    await expectStableThemeTimeline(page, heading, heatmap, {
      heading: "rgb(242, 242, 242)",
      heatmap: "rgb(140, 195, 255)",
      toggleName: "Switch to dark theme"
    });
  });

  test("Task #96 theme swap avoids dense heatmap and inactive Skeleton animation fan-out", async ({ page }) => {
    await useThemePreference(page, "dark");
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("public"),
      ok: true
    }));
    await mockCardImages(page);

    await page.goto("/");
    await expect(page.locator(".home-card-media"))
      .toHaveAttribute("data-card-status", "ready");
    await expect(page.locator(".home-card-skeleton")).toHaveCount(0);
    await page.getByRole("switch", { name: "Switch to light theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme-animating", "");
    const homeAnimationCount = await page.evaluate(() => (
      document.getAnimations().filter((animation) => (
        animation.playState !== "finished"
      )).length
    ));
    expect(homeAnimationCount).toBeLessThan(160);
    await expect(page.locator("html")).not.toHaveAttribute("data-theme-animating", "");

    await page.goto(OWNER_PROFILE_ROUTE);
    await expect(page.locator(".token-cell").first()).toBeVisible();
    await expect(page.locator(".profile-card-section .home-card-skeleton"))
      .toHaveCount(0);
    await page.getByRole("switch").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme-animating", "");
    const profileAnimationContract = await page.evaluate(() => ({
      heatmapCellCount: document.querySelectorAll(".token-cell").length,
      heatmap: Array.from(document.querySelectorAll(".token-cell")).reduce(
        (sum, element) => sum + element.getAnimations().length,
        0
      ),
      total: document.getAnimations().filter((animation) => (
        animation.playState !== "finished"
      )).length
    }));
    expect(profileAnimationContract.heatmap)
      .toBe(profileAnimationContract.heatmapCellCount);
    expect(profileAnimationContract.total).toBeLessThan(560);
  });

  test("Task #96 reduced motion changes semantic text without a transition window", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await useThemePreference(page, "dark");
    await mockAnonymousAccount(page);
    await page.goto("/");

    const targets = page.locator([
      ".home-quickstart-heading h2",
      ".home-quickstart-steps h3"
    ].join(", "));
    await page.getByRole("switch", { name: "Switch to light theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("html")).not.toHaveAttribute("data-theme-animating", "");
    expect(await targets.evaluateAll((elements) => elements.map((element) => {
      const style = getComputedStyle(element);
      return { color: style.color, duration: style.transitionDuration };
    }))).toEqual(Array.from({ length: await targets.count() }, () => ({
      color: "rgb(23, 23, 23)",
      duration: "0s"
    })));
  });

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
    await expect(page.locator(".home-quickstart"))
      .toHaveCSS("background-color", "rgb(243, 243, 242)");
    await expect(page.locator(".home-command-row"))
      .toHaveCSS("background-color", "rgb(255, 255, 255)");

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
    await expect(page.getByRole("tooltip")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(page.getByRole("tooltip")).toHaveCSS("color", "rgb(48, 48, 48)");
    await expect(page.getByRole("tooltip")).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0.12)");
    await page.locator(".profile-card-account-state")
      .getByRole("button", { name: "Share profile", exact: true })
      .click();
    await expect(page.locator(".share-studio-action-icon").first())
      .toHaveCSS("background-color", "rgb(23, 23, 23)");
    await page.getByRole("button", { name: "Close Share Studio" }).click();

    await page.goto(SITES_PROFILE_ROUTE);
    await dismissCardIntro(page);
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
    await expect(page.locator(".home-quickstart"))
      .toHaveCSS("background-color", "rgb(21, 21, 21)");
    await expect(page.locator(".home-command-row"))
      .toHaveCSS("background-color", "rgb(17, 17, 17)");

    await page.goto("/settings");
    await expect(page.locator(".settings-view")).toHaveCSS("background-color", "rgb(13, 13, 13)");
    await expect(page.locator(".settings-panel").first()).toHaveCSS("background-color", "rgb(23, 23, 23)");

    await page.goto("/profile");
    await expect(page.locator(".token-level-0").first()).toHaveCSS("background-color", "rgb(36, 36, 36)");
    await page.getByRole("grid", { name: "Daily token activity" })
      .locator('[data-date="2026-06-11"]')
      .hover();
    await expect(page.getByRole("tooltip")).toHaveCSS("background-color", "rgb(63, 64, 66)");
    await expect(page.getByRole("tooltip")).toHaveCSS("color", "rgb(242, 242, 242)");
    await expect(page.getByRole("tooltip")).toHaveCSS(
      "border-top-color",
      "rgba(255, 255, 255, 0.14)"
    );
    await page.locator(".profile-card-account-state")
      .getByRole("button", { name: "Share profile", exact: true })
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
  test("locale profile localizes UI while preserving the saved card language", async ({ page }) => {
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
    await expect(card).toHaveAttribute("src", /^blob:/);
    await expect(page.locator(".profile-card-section .home-card-media"))
      .toHaveAttribute("data-card-source-url", /[?&]locale=en(?:&|$)/);

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
    await expect(englishCard).toHaveAttribute("src", /^blob:/);
    await expect(page.locator(".profile-card-section .home-card-media"))
      .toHaveAttribute("data-card-source-url", /[?&]locale=en(?:&|$)/);
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
      data: {
        ...ownerProfile("public"),
        cardLocale: "ko",
        selectedPublicCardUrl: `${E2E_ORIGIN}/u/postmelee/card.png?theme=dark&locale=ko`
      },
      ok: true
    }));
    await mockCardImages(page);
    await page.goto("/profile");

    await page.locator(".profile-card-account-state")
      .getByRole("button", { name: "프로필 공유", exact: true })
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
      .getByRole("button", { name: "Share profile", exact: true })
      .click();
    await expect(page.getByRole("dialog", { name: "Share activity" })).toBeVisible();
    await page.getByRole("button", { name: "Close Share Studio" }).click();

    await mockPublicProfile(page);
    await page.goto(PROFILE_ROUTE);
    await dismissCardIntro(page);
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
    await dismissCardIntro(page);

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
      `${E2E_ORIGIN}/`
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
    await expect(page.locator(".profile-topbar-title")).toHaveText("Codex Usage Profile");
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
    const cardFrame = await page.locator(".home-card-beam").evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        radius: Number.parseFloat(getComputedStyle(element).borderTopLeftRadius),
        width: bounds.width
      };
    });
    expect(cardFrame.radius).toBeCloseTo(cardFrame.width * 32 / 499, 1);
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
      (element) => Number.parseFloat(
        getComputedStyle(element.shadowRoot?.querySelector("[part=tilt]")).borderRadius
      )
    )).toBeCloseTo(cardFrame.radius, 1);
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
    await expect(ownerPreview).toHaveAttribute("src", /^blob:/);
    await expect(page.locator(".home-card-media")).toHaveAttribute(
      "data-card-source-url",
      "/api/profile/card.png?locale=en&theme=dark"
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

  test("Task #92 mobile anonymous header keeps Sign in fully visible", async ({
    browser
  }, testInfo) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
      baseURL: E2E_ORIGIN
    });
    const page = await context.newPage();

    try {
      await page.emulateMedia({ colorScheme: "dark" });
      await mockAnonymousAccount(page);
      await mockCardImages(page);
      await page.goto("/");

      const signIn = page.getByRole("link", { name: "Sign in", exact: true });
      await expect(signIn).toBeVisible();
      await expect(page.locator(".profile-topbar-github span")).toBeHidden();
      const layout = await page.locator(".profile-topbar").evaluate((topbar) => {
        const bounds = (selector) => {
          const element = topbar.querySelector(selector);
          const rect = element?.getBoundingClientRect();
          return rect ? { left: rect.left, right: rect.right } : null;
        };
        const signInText = topbar.querySelector(".account-login-link span");
        return {
          actions: bounds(".profile-actions"),
          leading: bounds(".profile-topbar-leading"),
          signIn: bounds(".account-login-link"),
          signInTextFits: signInText
            ? signInText.scrollWidth <= signInText.clientWidth
            : false,
          topbar: {
            left: topbar.getBoundingClientRect().left,
            right: topbar.getBoundingClientRect().right
          }
        };
      });

      expect(layout.signInTextFits).toBe(true);
      expect(layout.actions.right).toBeLessThanOrEqual(layout.topbar.right);
      expect(layout.signIn.right).toBeLessThanOrEqual(layout.topbar.right);
      expect(layout.leading.right).toBeLessThanOrEqual(layout.actions.left);
      expect(await page.evaluate(
        () => document.body.scrollWidth > document.documentElement.clientWidth
      )).toBe(false);
      await page.screenshot({ path: testInfo.outputPath("home-mobile-anonymous-header.png") });
    } finally {
      await context.close();
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
    await expect(operatorCard).toHaveAttribute("src", /^blob:/);
    await expect(media).toHaveAttribute(
      "data-card-source-url",
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
      await expect(sampleCard).toHaveAttribute("src", /^blob:/);
      await expect(media).toHaveAttribute(
        "data-card-source-url",
        "/assets/codex-card-sample.png"
      );
      await expect(page.locator(".home-card-skeleton")).toHaveCount(0);
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
          nextSource?.startsWith("blob:") &&
          mediaElement?.dataset.cardSourceKind === "owner"
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
    await expect(ownerCard).toHaveAttribute("src", /^blob:/);
    await expect(media).toHaveAttribute(
      "data-card-source-url",
      "/api/profile/card.png?locale=en&theme=dark"
    );
    await expect(media).toHaveAttribute("data-card-source-kind", "owner");
    await expect(media).toHaveAttribute("data-card-status", "ready");
    await expect(media).toHaveAttribute("aria-busy", "false");
    await expect(skeleton).toHaveCount(0);
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
    await expect(skeleton).toHaveCount(0);
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
    await expect(skeleton).toHaveCount(0);
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
      })).toHaveAttribute("src", /^blob:/);
      await expect(media).toHaveAttribute(
        "data-card-source-url",
        "/assets/codex-card-sample.png"
      );
      await expect(page.locator(".home-card-sample-identity")).toBeVisible();
      await expect(page.getByRole("button", { name: "Publish card" })).toBeEnabled();
      await expect(page.locator('img[src*="/api/profile/card.png"]')).toHaveCount(0);
    });
  }

  test("Home card transition fails closed when owner image decode rejects", async ({ page }) => {
    await page.addInitScript(() => {
      const blobSources = new WeakMap();
      const objectUrlSources = new Map();
      const originalFetch = globalThis.fetch.bind(globalThis);
      globalThis.fetch = async function fetch(input, init) {
        const response = await originalFetch(input, init);
        const source = typeof input === "string" ? input : input.url;
        const originalBlob = response.blob.bind(response);
        Object.defineProperty(response, "blob", {
          configurable: true,
          value: async () => {
            const blob = await originalBlob();
            blobSources.set(blob, source);
            return blob;
          }
        });
        return response;
      };
      const originalCreateObjectUrl = URL.createObjectURL.bind(URL);
      URL.createObjectURL = function createObjectURL(blob) {
        const value = originalCreateObjectUrl(blob);
        objectUrlSources.set(value, blobSources.get(blob));
        return value;
      };
      const originalDecode = HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode = function decode() {
        if (objectUrlSources.get(this.src)?.includes("/api/profile/card.png")) {
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
    await expect(page.getByRole("link", { name: "Codex Usage Profile", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Open the project on GitHub" }))
      .toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("switch", { name: "Switch to light theme" }))
      .toBeFocused();
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
      OWNER_PROFILE_ROUTE
    );
    await expect(page.getByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "href",
      "/?view=settings"
    );
    await page.screenshot({ path: testInfo.outputPath("home-mobile.png") });
  });

  test("Task #92 mobile account menu preserves touch activation after null blur", async ({
    browser
  }, testInfo) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
      baseURL: E2E_ORIGIN
    });
    const page = await context.newPage();

    try {
      let logoutRequests = 0;
      await page.emulateMedia({ colorScheme: "dark" });
      await mockAuthenticatedAccount(page);
      await mockSettingsData(page);
      await mockCardImages(page);
      await page.route("**/api/auth/logout", (route) => {
        logoutRequests += 1;
        return fulfillJson(route, {
          data: { session: null },
          ok: true
        });
      });
      await page.goto("/");

      const diagnostics = [];
      for (const destination of [
        { href: OWNER_PROFILE_ROUTE, label: "Profile" },
        { href: "/?view=settings", label: "Settings" }
      ]) {
        await page.getByRole("button", {
          name: "Account menu for postmelee"
        }).tap();
        const item = page.getByRole("menuitem", { name: destination.label });
        await expect(item).toBeVisible();
        diagnostics.push(await preserveMenuTouchActivation(page, item));
        await item.tap();
        await expect(page).toHaveURL(`${E2E_ORIGIN}${destination.href}`);
        await page.goto("/");
      }

      await page.getByRole("button", {
        name: "Account menu for postmelee"
      }).tap();
      const logoutItem = page.getByRole("menuitem", { name: "Log out" });
      diagnostics.push(await preserveMenuTouchActivation(page, logoutItem));
      await logoutItem.tap();
      await expect(page.getByRole("link", { name: "Sign in", exact: true }))
        .toBeVisible();
      expect(logoutRequests).toBe(1);

      await testInfo.attach("task-92-mobile-account-menu.json", {
        body: Buffer.from(JSON.stringify(diagnostics, null, 2)),
        contentType: "application/json"
      });
    } finally {
      await context.close();
    }
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
    await expect(profileItem).toHaveAttribute("href", OWNER_PROFILE_ROUTE);
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

    for (const path of [OWNER_PROFILE_ROUTE, "/profile", "/settings", PROFILE_ROUTE]) {
      await page.goto(path);
      await dismissCardIntro(page);
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

    await expect(page.getByRole("link", { name: "Codex Usage Profile", exact: true }))
      .toHaveAttribute("href", "/");
    await page.getByRole("button", { name: "Account menu for postmelee" }).click();
    await expect(page.getByRole("menuitem", { name: "Profile", exact: true }))
      .toHaveAttribute("href", OWNER_PROFILE_ROUTE);

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
    await expect(page.getByRole("link", { name: "Codex Usage Profile", exact: true }))
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
    await expect(page.getByRole("link", { name: "Profile", exact: true }))
      .toHaveAttribute("href", OWNER_PROFILE_ROUTE);
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
      `npx codex-usage-profile@latest submit --server ${E2E_ORIGIN}`;
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
      .toHaveAttribute("href", OWNER_PROFILE_ROUTE);
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
    let publicPreviewFetches = 0;
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
    await mockCardImages(page, {
      onPublicCardRequest(request) {
        if (
          request.resourceType() === "fetch" &&
          request.url().includes("theme=dark")
        ) {
          publicPreviewFetches += 1;
        }
      }
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    await page.getByRole("button", { name: "Publish card" }).click();
    const shareButton = page.getByRole("button", { name: "Share", exact: true });
    await expect(shareButton).toBeEnabled();
    await expect(shareButton.locator("svg")).toHaveCount(0);
    const sourceCard = page.locator('[data-card-source="true"]');
    const sourceBeam = sourceCard.locator(".home-card-beam");
    await expect(sourceCard).toBeVisible();
    await expect(sourceBeam).toHaveAttribute("data-active", "");
    await expect.poll(() => sourceBeam.evaluate((element) => (
      element.getAnimations().find((animation) => (
        animation.animationName.includes("beam-fade-in")
      ))?.playState ?? null
    ))).toBe("finished");
    const sourceBox = await sourceCard.boundingBox();

    await shareButton.click();
    const dialog = page.getByRole("dialog", { name: "Share activity" });
    const backdrop = page.getByTestId("share-studio-backdrop");
    const motionCard = page.getByTestId("share-studio-card-motion");
    await expect(dialog).toBeVisible();
    await expect(motionCard).toHaveAttribute("data-motion-origin", "source");
    await expect(sourceCard).toHaveAttribute("data-share-transition-active", "true");
    await expect(sourceBeam).toHaveAttribute("data-active", "");
    expect(await sourceBeam.evaluate((element) => (
      getComputedStyle(element).animationPlayState
        .split(",")
        .every((state) => state.trim() === "paused")
    ))).toBe(true);
    await expect(sourceCard).toHaveCSS("opacity", "0");
    await expect.poll(
      () => page
        .getByRole("img", { name: "Codex usage card preview" })
        .evaluate((image) => image.naturalWidth)
    ).toBe(1497);
    expect(publicPreviewFetches).toBe(1);
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
    // Social destinations open the composer directly with the share link.
    for (const [name, , origin, pathname] of socialTargets) {
      const link = page.getByRole("link", { name });
      const href = new URL(await link.getAttribute("href"));
      expect(href.origin).toBe(origin);
      expect(href.pathname).toBe(pathname);
      expect(href.search).toContain("postmelee");
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    await expect(page.locator(".share-studio-instructions")).toHaveCount(0);
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
      path: testInfo.outputPath("share-social-destinations.png")
    });

    await page.getByRole("button", { name: "Copy share link" }).click();
    await expect(page.getByText("Share link copied")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `${E2E_ORIGIN}/api/share/postmelee`
    );

    await page.getByRole("button", { name: "Copy Image URL" }).click();
    await expect(page.getByText("Image URL copied")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `${E2E_ORIGIN}/u/postmelee/card.png?theme=dark`
    );

    await page.getByRole("button", { name: "Copy README Markdown" }).click();
    await expect(page.getByText("README Markdown copied")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `![Codex usage profile](${E2E_ORIGIN}/u/postmelee/card.png?theme=dark)`
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
    await expect(sourceBeam).toHaveAttribute("data-active", "");
    expect(await sourceBeam.evaluate((element) => (
      getComputedStyle(element).animationPlayState
        .split(",")
        .every((state) => state.trim() === "running")
    ))).toBe(true);
    expect(await sourceBeam.evaluate((element) => (
      element.getAnimations().filter((animation) => (
        animation.animationName.includes("beam-fade-in")
        && animation.playState === "running"
      )).length
    ))).toBe(0);

    await shareButton.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("img", { name: "Codex usage card preview" }))
      .toHaveAttribute("src", /^blob:/);
    expect(publicPreviewFetches).toBe(1);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await shareButton.click();
    await page.getByRole("button", { name: "Make private" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Publish card" })).toBeEnabled();
  });

  test("Share Studio hands off the decoded source while the public target loads", async ({ page }) => {
    let publicPreviewFetches = 0;
    let releasePublicCard;
    const publicCardGate = new Promise((resolve) => {
      releasePublicCard = resolve;
    });
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("public"),
      ok: true
    }));
    await page.route("**/api/profile/card.png*", (route) => route.fulfill({
      body: CARD_PNG,
      contentType: "image/png",
      status: 200
    }));
    await page.route("**/u/postmelee/card.png*", async (route) => {
      if (!route.request().url().includes("theme=dark")) {
        await route.fulfill({
          body: CARD_PNG,
          contentType: "image/png",
          status: 200
        });
        return;
      }
      if (route.request().resourceType() === "fetch") publicPreviewFetches += 1;
      await publicCardGate;
      await route.fulfill({
        body: CARD_PNG,
        contentType: "image/png",
        status: 200
      }).catch(() => {});
    });

    await page.goto("/");
    const sourceCard = page.locator('[data-card-source="true"]');
    const sourceImage = sourceCard.getByRole("img", { name: "Your Codex usage card" });
    await expect(sourceImage).toHaveAttribute("src", /^blob:/);
    const sourceBlobUrl = await sourceImage.getAttribute("src");
    const sourcePresentation = await sourceCard.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        borderRadius: getComputedStyle(element).borderTopLeftRadius,
        height: bounds.height,
        width: bounds.width
      };
    });

    await page.getByRole("button", { name: "Share", exact: true }).click();
    const backdrop = page.getByTestId("share-studio-backdrop");
    const motionCard = page.getByTestId("share-studio-card-motion");
    const motionImage = motionCard.getByRole("img", {
      name: "Codex usage card preview"
    });
    const skeleton = motionCard.locator(".home-card-skeleton");

    await expect(motionCard).toHaveAttribute("data-share-preview-source", "source");
    await expect(motionCard).toHaveAttribute("data-share-target-status", "loading");
    await expect(motionCard).toHaveAttribute("data-motion-origin", "source");
    await expect(motionCard).toHaveAttribute("data-motion-mode", "scale");
    await expect(motionImage).toHaveAttribute("src", sourceBlobUrl);
    await expect(motionImage).toHaveClass(/\bis-handoff-source\b/);
    await expect(skeleton).toHaveCount(0);
    await expect(backdrop).toHaveClass(/\bis-open\b/);
    expect(publicPreviewFetches).toBe(1);
    const targetPresentation = await motionCard.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const firstTransform = element.getAnimations().flatMap(
        (animation) => animation.effect?.getKeyframes?.() ?? []
      ).find((keyframe) => keyframe.transform)?.transform ?? "none";
      const matrix = new DOMMatrixReadOnly(firstTransform);
      const image = element.querySelector(".share-card-preview");
      return {
        borderRadius: getComputedStyle(element).borderTopLeftRadius,
        height: bounds.height,
        imageFilter: image ? getComputedStyle(image).filter : null,
        scaleX: Math.round(matrix.a * 1000) / 1000,
        scaleY: Math.round(matrix.d * 1000) / 1000,
        width: bounds.width
      };
    });
    expect(targetPresentation).toMatchObject({
      borderRadius: sourcePresentation.borderRadius,
      imageFilter: "none",
      scaleX: 1,
      scaleY: 1
    });
    expect(targetPresentation.width).toBeCloseTo(sourcePresentation.width, 0);
    expect(targetPresentation.height).toBeCloseTo(sourcePresentation.height, 0);

    releasePublicCard();
    await expect(motionCard).toHaveAttribute("data-share-target-status", "ready");
    await expect(motionCard).toHaveAttribute("data-share-preview-source", "public");
    await expect(motionImage).toHaveClass(/\bis-public-target\b/);
    await expect(motionImage).toHaveClass(/\bis-warm-handoff-target\b/);
    await expect(motionImage).toHaveCSS("animation-name", "none");
    await expect(motionImage).toHaveCSS("opacity", "1");
    await expect(motionImage).toHaveAttribute("src", /^blob:/);
    await expect.poll(() => motionImage.getAttribute("src")).not.toBe(sourceBlobUrl);
    expect(publicPreviewFetches).toBe(1);

    const handoffPhase = page.waitForFunction(() => (
      document.querySelector('[data-testid="share-studio-backdrop"]')
        ?.classList.contains("is-handoff") ?? false
    ));
    await page.getByRole("button", { name: "Close Share Studio" }).click();
    await expect(motionImage).toHaveAttribute("src", sourceBlobUrl);
    await handoffPhase;
    expect(await sourceCard.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        opacity: style.opacity,
        transitionDuration: style.transitionDuration,
        transitionProperty: style.transitionProperty
      };
    })).toEqual({
      opacity: "1",
      transitionDuration: "0s",
      transitionProperty: "none"
    });
  });

  test("Share Studio restores the source when closed before the public target is ready", async ({ page }) => {
    let releasePublicCard;
    const publicCardGate = new Promise((resolve) => {
      releasePublicCard = resolve;
    });
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("public"),
      ok: true
    }));
    await page.route("**/api/profile/card.png*", (route) => route.fulfill({
      body: CARD_PNG,
      contentType: "image/png",
      status: 200
    }));
    await page.route("**/u/postmelee/card.png*", async (route) => {
      if (!route.request().url().includes("theme=dark")) {
        await route.fulfill({
          body: CARD_PNG,
          contentType: "image/png",
          status: 200
        });
        return;
      }
      await publicCardGate;
      await route.fulfill({
        body: CARD_PNG,
        contentType: "image/png",
        status: 200
      }).catch(() => {});
    });

    await page.goto("/");
    const sourceCard = page.locator('[data-card-source="true"]');
    const shareButton = page.getByRole("button", { name: "Share", exact: true });
    await shareButton.click();
    const dialog = page.getByRole("dialog", { name: "Share activity" });
    const motionCard = page.getByTestId("share-studio-card-motion");
    await expect(motionCard).toHaveAttribute("data-share-preview-source", "source");
    await expect(motionCard).toHaveAttribute("data-share-target-status", "loading");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(sourceCard).not.toHaveAttribute("data-share-transition-active", "true");
    await expect(sourceCard).toHaveCSS("opacity", "1");
    await expect(shareButton).toBeFocused();

    releasePublicCard();
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

  test("Task #92 mobile Share Studio rejects an unsafe source scale", async ({
    browser
  }, testInfo) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
      baseURL: E2E_ORIGIN
    });
    const page = await context.newPage();

    try {
      await page.emulateMedia({ colorScheme: "dark" });
      await mockAuthenticatedAccount(page);
      await page.route("**/api/profile", (route) => fulfillJson(route, {
        data: ownerProfile("public"),
        ok: true
      }));
      await mockCardImages(page);
      await page.goto("/");

      const sourceCard = page.locator('[data-card-source="true"]');
      await expect(sourceCard).toBeVisible();
      const syntheticSource = await sourceCard.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const synthetic = {
          bottom: rect.top + (rect.height * 3.2),
          height: rect.height * 3.2,
          left: rect.left,
          right: rect.left + (rect.width * 3.2),
          top: rect.top,
          width: rect.width * 3.2,
          x: rect.x,
          y: rect.y
        };
        element.getBoundingClientRect = () => ({
          ...synthetic,
          toJSON: () => synthetic
        });
        return synthetic;
      });

      await page.getByRole("button", { name: "Share", exact: true }).tap();
      const motionCard = page.getByTestId("share-studio-card-motion");
      await expect(page.getByRole("dialog", { name: "Share activity" })).toBeVisible();
      await expect(page.getByTestId("share-studio-backdrop")).toHaveClass(/\bis-open\b/);

      const diagnostic = await motionCard.evaluate((element, sourceRect) => {
        const dynamicViewportProbe = document.createElement("div");
        dynamicViewportProbe.style.cssText = [
          "height:1px",
          "pointer-events:none",
          "position:fixed",
          "visibility:hidden",
          "width:100dvw"
        ].join(";");
        document.body.append(dynamicViewportProbe);
        const keyframes = element.getAnimations().flatMap(
          (animation) => animation.effect?.getKeyframes?.() ?? []
        );
        const firstTransform = keyframes.find(
          (keyframe) => keyframe.transform && keyframe.transform !== "none"
        )?.transform ?? "none";
        const matrix = new DOMMatrixReadOnly(firstTransform);
        const target = element.getBoundingClientRect();
        const viewport = {
          height: globalThis.visualViewport?.height ?? globalThis.innerHeight,
          width: globalThis.visualViewport?.width ?? globalThis.innerWidth
        };
        const start = {
          bottom: target.top + matrix.f + (target.height * matrix.d),
          left: target.left + matrix.e,
          right: target.left + matrix.e + (target.width * matrix.a),
          top: target.top + matrix.f
        };
        const result = {
          firstTransform,
          layoutViewport: {
            clientWidth: document.documentElement.clientWidth,
            dynamicWidth: dynamicViewportProbe.getBoundingClientRect().width,
            innerWidth: globalThis.innerWidth,
            screenWidth: globalThis.screen.width
          },
          motionMode: element.dataset.motionMode,
          motionOrigin: element.dataset.motionOrigin,
          scaleX: Math.round(matrix.a * 1000) / 1000,
          scaleY: Math.round(matrix.d * 1000) / 1000,
          sourceRect,
          start,
          target: {
            height: target.height,
            left: target.left,
            top: target.top,
            width: target.width
          },
          viewport,
          withinViewport: (
            start.left >= 0 &&
            start.top >= 0 &&
            start.right <= viewport.width &&
            start.bottom <= viewport.height
          )
        };
        dynamicViewportProbe.remove();
        return result;
      }, syntheticSource);
      await testInfo.attach("task-92-mobile-card-handoff.json", {
        body: Buffer.from(JSON.stringify(diagnostic, null, 2)),
        contentType: "application/json"
      });

      expect(diagnostic).toMatchObject({
        motionMode: "target",
        motionOrigin: "target",
        scaleX: 1,
        scaleY: 1,
        withinViewport: true
      });
    } finally {
      await context.close();
    }
  });

  test("Task #92 mobile Share Studio preserves the source card geometry", async ({
    browser
  }) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
      baseURL: E2E_ORIGIN
    });
    const page = await context.newPage();

    try {
      await page.emulateMedia({ colorScheme: "dark" });
      await mockAuthenticatedAccount(page);
      await page.route("**/api/profile", (route) => fulfillJson(route, {
        data: ownerProfile("public"),
        ok: true
      }));
      await mockCardImages(page);
      await page.goto("/");

      const sourceCard = page.locator('[data-card-source="true"]');
      await expect(sourceCard).toBeVisible();
      const source = await sourceCard.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const media = element.querySelector(".home-card-media");
        return {
          borderRadius: getComputedStyle(element).borderTopLeftRadius,
          height: bounds.height,
          left: bounds.left,
          mediaRadius: media
            ? Number.parseFloat(getComputedStyle(media).borderTopLeftRadius)
            : null,
          top: bounds.top,
          width: bounds.width
        };
      });

      await page.getByRole("button", { name: "Share", exact: true }).tap();
      const motionCard = page.getByTestId("share-studio-card-motion");
      await expect(page.getByTestId("share-studio-backdrop")).toHaveClass(/\bis-open\b/);
      await expect(motionCard).toHaveAttribute("data-motion-origin", "source");
      await expect(motionCard).toHaveAttribute("data-motion-mode", "translate");

      const target = await motionCard.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const firstTransform = element.getAnimations().flatMap(
          (animation) => animation.effect?.getKeyframes?.() ?? []
        ).find((keyframe) => keyframe.transform)?.transform ?? "none";
        const matrix = new DOMMatrixReadOnly(firstTransform);
        const image = element.querySelector(".share-card-preview");
        const media = element.querySelector(".home-card-media");
        return {
          borderRadius: getComputedStyle(element).borderTopLeftRadius,
          height: bounds.height,
          imageFilter: image ? getComputedStyle(image).filter : null,
          mediaRadius: media
            ? Number.parseFloat(getComputedStyle(media).borderTopLeftRadius)
            : null,
          scaleX: Math.round(matrix.a * 1000) / 1000,
          scaleY: Math.round(matrix.d * 1000) / 1000,
          startLeft: bounds.left + matrix.e,
          startTop: bounds.top + matrix.f,
          width: bounds.width
        };
      });

      expect(target).toMatchObject({
        borderRadius: source.borderRadius,
        imageFilter: "none",
        scaleX: 1,
        scaleY: 1
      });
      expect(target.width).toBeCloseTo(source.width, 0);
      expect(target.height).toBeCloseTo(source.height, 0);
      expect(source.mediaRadius).toBeCloseTo(source.width * 32 / 499, 1);
      expect(target.mediaRadius).toBeCloseTo(target.width * 32 / 499, 1);
      expect(target.mediaRadius).toBeCloseTo(source.mediaRadius, 1);
      expect(target.startLeft).toBeCloseTo(source.left, 0);
      expect(target.startTop).toBeCloseTo(source.top, 0);

      await page.getByRole("button", { name: "Close Share Studio" }).tap();
      const closing = await motionCard.evaluate((element) => {
        const transforms = element.getAnimations().flatMap(
          (animation) => animation.effect?.getKeyframes?.() ?? []
        ).map((keyframe) => keyframe.transform).filter(Boolean);
        const matrix = new DOMMatrixReadOnly(transforms.at(-1) ?? "none");
        return {
          scaleX: Math.round(matrix.a * 1000) / 1000,
          scaleY: Math.round(matrix.d * 1000) / 1000
        };
      });
      expect(closing).toEqual({ scaleX: 1, scaleY: 1 });
      await expect(page.getByRole("dialog", { name: "Share activity" })).toBeHidden();
      await expect(sourceCard).toHaveCSS("opacity", "1");
    } finally {
      await context.close();
    }
  });

  test("Task #96 mobile Share Studio moves from a partially visible source", async ({
    browser
  }) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
      baseURL: E2E_ORIGIN
    });
    const page = await context.newPage();

    try {
      await page.emulateMedia({ colorScheme: "dark" });
      await mockAuthenticatedAccount(page);
      await page.route("**/api/profile", (route) => fulfillJson(route, {
        data: ownerProfile("public"),
        ok: true
      }));
      await mockCardImages(page);
      await page.goto("/");

      const sourceCard = page.locator('[data-card-source="true"]');
      await expect(sourceCard).toBeVisible();
      const source = await sourceCard.evaluate((element) => {
        const initial = element.getBoundingClientRect();
        document.scrollingElement.scrollBy(
          0,
          initial.top + (initial.height / 2)
        );
        const clipped = element.getBoundingClientRect();
        const viewportTop = globalThis.visualViewport?.offsetTop ?? 0;
        const viewportHeight = globalThis.visualViewport?.height
          ?? globalThis.innerHeight;
        const visibleHeight = Math.max(
          0,
          Math.min(clipped.bottom, viewportTop + viewportHeight)
            - Math.max(clipped.top, viewportTop)
        );
        return {
          height: clipped.height,
          left: clipped.left,
          top: clipped.top,
          visibleRatio: visibleHeight / clipped.height,
          width: clipped.width
        };
      });
      expect(source.visibleRatio).toBeGreaterThanOrEqual(0.45);
      expect(source.visibleRatio).toBeLessThanOrEqual(0.55);

      await page.getByRole("button", { name: "Share", exact: true })
        .evaluate((button) => button.click());
      const motionCard = page.getByTestId("share-studio-card-motion");
      await expect(page.getByRole("dialog", { name: "Share activity" })).toBeVisible();
      await expect(motionCard).toHaveAttribute("data-motion-origin", "source");
      await expect(motionCard).toHaveAttribute("data-motion-mode", "translate");
      await expect(page.getByTestId("share-studio-backdrop")).toHaveClass(/\bis-open\b/);

      const opening = await motionCard.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const firstTransform = element.getAnimations().flatMap(
          (animation) => animation.effect?.getKeyframes?.() ?? []
        ).find((keyframe) => keyframe.transform)?.transform ?? "none";
        const matrix = new DOMMatrixReadOnly(firstTransform);
        return {
          scaleX: Math.round(matrix.a * 1000) / 1000,
          scaleY: Math.round(matrix.d * 1000) / 1000,
          startLeft: bounds.left + matrix.e,
          startTop: bounds.top + matrix.f
        };
      });
      expect(opening).toMatchObject({ scaleX: 1, scaleY: 1 });
      expect(opening.startLeft).toBeCloseTo(source.left, 0);
      expect(opening.startTop).toBeCloseTo(source.top, 0);

      await page.getByRole("button", { name: "Close Share Studio" }).tap();
      await expect(motionCard).toHaveAttribute("data-motion-mode", "translate");
      await expect(page.getByRole("dialog", { name: "Share activity" })).toBeHidden();
      await expect(sourceCard).toHaveCSS("opacity", "1");
    } finally {
      await context.close();
    }
  });

  test("Task #96 Share handoff resumes one paused BorderBeam without a new fade", async ({ page }) => {
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("public"),
      ok: true
    }));
    await mockCardImages(page);
    await page.goto("/");

    const sourceCard = page.locator('[data-card-source="true"]');
    const sourceBeam = sourceCard.locator(".home-card-beam");
    const shareButton = page.getByRole("button", { name: "Share", exact: true });
    await expect(sourceBeam).toHaveAttribute("data-active", "");
    await expect.poll(() => sourceBeam.evaluate((element) => (
      element.getAnimations().find((animation) => (
        animation.animationName.includes("beam-fade-in")
      ))?.playState ?? null
    ))).toBe("finished");

    await shareButton.click();
    const dialog = page.getByRole("dialog", { name: "Share activity" });
    await expect(dialog).toBeVisible();
    await expect(sourceCard).toHaveAttribute("data-share-transition-active", "true");
    await expect(sourceBeam).toHaveAttribute("data-active", "");
    expect(await sourceBeam.evaluate((element) => (
      getComputedStyle(element).animationPlayState
        .split(",")
        .every((state) => state.trim() === "paused")
    ))).toBe(true);

    await page.getByRole("button", { name: "Close Share Studio" }).click();
    await expect(dialog).toBeHidden();
    await expect(sourceCard).not.toHaveAttribute("data-share-transition-active", "true");
    await expect(sourceBeam).toHaveAttribute("data-active", "");
    expect(await sourceBeam.evaluate((element) => (
      getComputedStyle(element).animationPlayState
        .split(",")
        .every((state) => state.trim() === "running")
    ))).toBe(true);
    expect(await sourceBeam.evaluate((element) => (
      element.getAnimations().filter((animation) => (
        animation.animationName.includes("beam-fade-in")
        && animation.playState === "running"
      )).length
    ))).toBe(0);
  });

  test("Task #96 Share Studio rebases a local canonical card URL without crashing", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => {
      const profile = ownerProfile("public");
      profile.publicCardUrl = "http://192.168.12.7:5177/u/postmelee/card.png";
      profile.selectedPublicCardUrl = (
        "http://192.168.12.7:5177/u/postmelee/card.png?theme=dark"
      );
      return fulfillJson(route, { data: profile, ok: true });
    });
    await mockCardImages(page);
    await page.goto("/");

    await page.getByRole("button", { name: "Share", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Share activity" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Codex usage card preview" }))
      .toBeVisible();
    expect(pageErrors).toEqual([]);
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
    expect(mobileTargets).toHaveLength(6);
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
    await expect(page.locator(".share-studio-instructions")).toHaveCount(0);

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

    const redditLink = page.getByRole("link", { name: "Share on Reddit" });
    await redditLink.scrollIntoViewIfNeeded();
    await expect(redditLink).toBeVisible();

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

    await expect(page.locator(".share-studio-instructions")).toHaveCount(0);

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
    await page.route("**/api/profile/card.png*", (route) => route.fulfill({
      body: CARD_PNG,
      contentType: "image/png",
      status: 200
    }));
    await page.route("**/u/postmelee/card.png*", (route) => route.fulfill({
      body: JSON.stringify({
        error: { code: "unavailable", message: "Preview unavailable" },
        ok: false
      }),
      contentType: "application/json",
      status: 503
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
    const motionCard = page.getByTestId("share-studio-card-motion");
    await expect(motionCard).toHaveAttribute("data-share-preview-source", "source");
    await expect(motionCard).toHaveAttribute("data-share-target-status", "error");
    await expect(motionCard).not.toHaveAttribute("data-motion-fallback", "preview-error");
    await expect(motionCard.getByRole("img", { name: "Codex usage card preview" }))
      .toHaveAttribute("src", /^blob:/);
    await expect(page.locator(".share-studio-primary-action")).toHaveCount(6);

    const composer = page.getByRole("link", { name: "Share on Reddit" });
    await expect(composer).toHaveAttribute("target", "_blank");
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
  test("owner Profile share button keeps Share Studio accessible on the fullscreen canvas", async ({ page }) => {
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

    await expect(page.locator(".profile-topbar")
      .getByRole("button", { name: "Share profile" }))
      .toHaveCount(0);
    const shareButton = page.locator(".profile-card-account-state")
      .getByRole("button", { name: "Share profile" });
    await expect(shareButton).toHaveText("Share");
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
    await page.goto(OWNER_PROFILE_ROUTE);

    await expect(page.getByRole("heading", { level: 1, name: "Sign in required" }))
      .toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in with GitHub" }))
      .toHaveAttribute(
        "href",
        "/api/auth/github/login?redirect_to=%2F%3Fview%3Dprofile"
      );

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
    const ownerLoadingSkeleton = page.getByTestId("owner-profile-loading-skeleton");
    await expect(ownerLoadingSkeleton).toHaveAttribute("aria-busy", "true");
    await expect(ownerLoadingSkeleton)
      .toHaveAttribute("data-profile-loading-surface", "owner");
    await expect(ownerLoadingSkeleton.locator("[data-skeleton-part=stat]"))
      .toHaveCount(5);
    await expect(ownerLoadingSkeleton.locator("[data-skeleton-part=activity-row]"))
      .toHaveCount(7);
    await expect(ownerLoadingSkeleton.locator(".home-card-skeleton"))
      .toHaveAttribute("data-active", "true");
    await expect(page.locator(".card-profile-message")).toHaveCount(0);
    const loadingTopOffset = await page.evaluate(() => {
      const message = document.querySelector(".profile-loading-skeleton").getBoundingClientRect();
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

  test("owner Profile loading geometry matches ready content and reveals together in place", async ({ page }) => {
    await mockAuthenticatedAccount(page);
    let releaseProfile;
    const profileGate = new Promise((resolve) => {
      releaseProfile = resolve;
    });
    await page.route("**/api/profile", async (route) => {
      await profileGate;
      await fulfillJson(route, {
        data: ownerProfile("public"),
        ok: true
      });
    });
    await mockCardImages(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/profile", { waitUntil: "domcontentloaded" });

    const loadingGeometry = await readProfileGeometry(page, "loading");
    releaseProfile();
    await expect(page.locator(".card-profile-stage.profile-content-reveal"))
      .toBeVisible();

    const revealMotion = await page.evaluate(() => [
      ".profile-header",
      ".profile-stats",
      ".token-activity",
      ".profile-card-section"
    ].map((selector) => {
      const style = getComputedStyle(document.querySelector(selector));
      return {
        animationDelay: style.animationDelay,
        animationDuration: style.animationDuration,
        animationName: style.animationName,
        transform: style.transform
      };
    }));
    expect(revealMotion.map((motion) => motion.animationName))
      .toEqual(Array(4).fill("profile-content-enter"));
    expect(revealMotion.map((motion) => motion.animationDelay))
      .toEqual(Array(4).fill("0s"));
    expect(new Set(revealMotion.map((motion) => motion.animationDuration)))
      .toEqual(new Set(["0.36s"]));
    expect(revealMotion.map((motion) => motion.transform))
      .toEqual(Array(4).fill("none"));

    await page.waitForTimeout(520);
    const readyGeometry = await readProfileGeometry(page, "ready");
    expectProfileGeometryToMatch(loadingGeometry, readyGeometry);

    const settledMotion = await page.evaluate(() => [
      ".profile-header",
      ".profile-stats",
      ".token-activity",
      ".profile-card-section"
    ].map((selector) => {
      const style = getComputedStyle(document.querySelector(selector));
      return {
        opacity: style.opacity,
        transform: style.transform
      };
    }));
    expect(settledMotion).toEqual(Array(4).fill({
      opacity: "1",
      transform: "none"
    }));
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

      if (path === "/profile") {
        const cardFrame = await page.locator(
          ".profile-card-section .home-card-media"
        ).evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return {
            radius: Number.parseFloat(getComputedStyle(element).borderTopLeftRadius),
            width: bounds.width
          };
        });
        expect(cardFrame.radius).toBeCloseTo(cardFrame.width * 32 / 499, 1);
      }
    }
  });
});

test.describe("Settings appearance control", () => {
  test("appearance panel layout keeps its legend inside the bordered panel", async ({ page }) => {
    await mockAuthenticatedAccount(page);
    await mockSettingsData(page);
    await page.goto("/settings");

    const panel = page.locator(".settings-appearance");
    const fieldset = panel.locator(".settings-appearance-fieldset");
    const title = panel.locator(".settings-appearance-title");
    await expect(page.getByRole("group", { name: "Appearance" })).toBeVisible();
    await expect(fieldset).toHaveCSS("border-top-width", "0px");

    const panelBox = await panel.boundingBox();
    const titleBox = await title.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(titleBox).not.toBeNull();
    expect(titleBox.x).toBeGreaterThan(panelBox.x + 10);
    expect(titleBox.y).toBeGreaterThan(panelBox.y + 10);
    expect(titleBox.x + titleBox.width).toBeLessThan(panelBox.x + panelBox.width);
    expect(titleBox.y + titleBox.height).toBeLessThan(panelBox.y + panelBox.height);
  });

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
    await restoredPage.goto(`${E2E_ORIGIN}/settings`);
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

  test("card appearance saves owner theme and language and exposes the selected theme URL", async ({ page }) => {
    await page.addInitScript((storageKey) => {
      if (localStorage.getItem(storageKey) === null) {
        localStorage.setItem(storageKey, "light");
      }
    }, THEME_STORAGE_KEY);
    await mockAuthenticatedAccount(page);
    let profile = ownerProfile("public");
    let savedPayload = null;
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: profile,
      ok: true
    }));
    await page.route("**/api/profile/card-settings", async (route) => {
      savedPayload = route.request().postDataJSON();
      profile = {
        ...profile,
        cardLocale: savedPayload.cardLocale,
        cardStyle: savedPayload.cardStyle,
        selectedPublicCardUrl: `${E2E_ORIGIN}/u/postmelee/card.png?locale=${savedPayload.cardLocale}&theme=${savedPayload.cardStyle.theme}`
      };
      await fulfillJson(route, { data: profile, ok: true });
    });
    await mockCardImages(page);

    await page.goto("/");
    await expect(page.locator(".home-card-preview")).toHaveAttribute("src", /^blob:/);
    await expect(page.locator(".home-card-media")).toHaveAttribute(
      "data-card-source-url",
      /\/api\/profile\/card\.png\?locale=en&theme=dark/
    );

    await page.goto("/profile");
    await expect(page.locator(".profile-card-section .home-card-media"))
      .toHaveAttribute(
        "data-card-source-url",
        /\/api\/profile\/card\.png\?locale=en&theme=dark/
      );
    const darkCard = page.locator('input[name="card-theme"][value="dark"]');
    const lightCard = page.locator('input[name="card-theme"][value="light"]');
    const englishCard = page.locator('input[name="card-locale"][value="en"]');
    const koreanCard = page.locator('input[name="card-locale"][value="ko"]');
    await expect(darkCard).toBeChecked();
    await expect(englishCard).toBeChecked();

    await lightCard.check();
    await koreanCard.check();
    await expect(page.locator(".profile-card-section .home-card-media"))
      .toHaveAttribute(
        "data-card-source-url",
        /\/api\/profile\/card\.png\?locale=ko&theme=light/
      );
    await page.getByRole("button", { name: "Save card settings" }).click();
    await expect.poll(() => savedPayload).toEqual({
      cardLocale: "ko",
      cardStyle: {
        effect: { preset: "none", version: 1 },
        schemaVersion: 1,
        theme: "light"
      }
    });
    await expect(page.getByRole("button", { name: "Save card settings" }))
      .toBeDisabled();
    await expect(page.locator(".card-style-settings-status"))
      .toHaveText("Card settings saved.");

    await page.reload();
    await expect(lightCard).toBeChecked();
    await expect(koreanCard).toBeChecked();
    await expect(page.locator(".profile-card-section .home-card-media"))
      .toHaveAttribute(
        "data-card-source-url",
        /\/api\/profile\/card\.png\?locale=ko&theme=light/
      );

    await darkCard.check();
    await englishCard.check();
    await expect(page.getByRole("button", { name: "Save & share" }))
      .toBeEnabled();
    await page.getByRole("button", { name: "Save & share" }).click();
    await expect.poll(() => savedPayload).toEqual({
      cardLocale: "en",
      cardStyle: {
        effect: { preset: "none", version: 1 },
        schemaVersion: 1,
        theme: "dark"
      }
    });
    const shareStudio = page.getByRole("dialog", { name: "Share activity" });
    await expect(shareStudio).toBeVisible();
    await expect(shareStudio.locator(".home-card-media"))
      .toHaveAttribute(
        "data-card-source-url",
        `${E2E_ORIGIN}/u/postmelee/card.png?theme=dark`
      );
    await expect(shareStudio.getByRole("img", { name: "Codex usage card preview" }))
      .toHaveAttribute("src", /^blob:/);
    await expect(shareStudio.getByRole("button", { name: "Copy image URL" }))
      .toHaveAttribute("title", /[?&]theme=dark(?:&|$)/);
    await expect(shareStudio.getByRole("button", { name: "Copy image URL" }))
      .not.toHaveAttribute("title", /[?&]locale=/);
  });

  test("card appearance keeps the last decoded preview until the latest draft is ready", async ({ page }) => {
    let releaseDraftCards;
    const draftCardGate = new Promise((resolve) => {
      releaseDraftCards = resolve;
    });
    const previewRequests = [];
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile/card.png*", async (route) => {
      const url = route.request().url();
      previewRequests.push(url);
      if (!url.includes("locale=en&theme=dark")) {
        await draftCardGate;
      }
      await route.fulfill({
        body: CARD_PNG,
        contentType: "image/png",
        status: 200
      }).catch(() => {});
    });

    await page.goto("/profile");

    const media = page.locator(".profile-card-section .home-card-media");
    const preview = media.locator("img");
    const skeleton = media.locator(".home-card-skeleton");
    await expect(media).toHaveAttribute("data-card-status", "ready");
    await expect(media).toHaveAttribute(
      "data-card-source-url",
      /\/api\/profile\/card\.png\?locale=en&theme=dark/
    );
    const initialBlobUrl = await preview.getAttribute("src");
    expect(initialBlobUrl).toMatch(/^blob:/);

    await page.locator('input[name="card-theme"][value="light"]').check();
    await page.locator('input[name="card-locale"][value="ko"]').check();
    await expect(media).toHaveAttribute("data-card-status", "loading");
    await expect(media).toHaveAttribute("aria-busy", "true");
    await expect(media).toHaveAttribute(
      "data-card-source-url",
      /\/api\/profile\/card\.png\?locale=en&theme=dark/
    );
    await expect(preview).toHaveAttribute("src", initialBlobUrl);
    await expect(skeleton).toHaveAttribute("data-active", "true");
    await expect(skeleton).toHaveCSS("opacity", "1");

    releaseDraftCards();
    await expect(media).toHaveAttribute("data-card-status", "ready");
    await expect(media).toHaveAttribute(
      "data-card-source-url",
      /\/api\/profile\/card\.png\?locale=ko&theme=light/
    );
    await expect(preview).toHaveAttribute("src", /^blob:/);
    await expect.poll(() => preview.getAttribute("src")).not.toBe(initialBlobUrl);
    await expect(skeleton).toHaveCount(0);
    expect(previewRequests.some(
      (url) => url.includes("locale=ko&theme=light")
    )).toBe(true);
  });

  test("card appearance keeps the draft available after a save failure", async ({ page }) => {
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("public"),
      ok: true
    }));
    await page.route("**/api/profile/card-settings", (route) => fulfillJson(route, {
      error: { code: "media_unavailable", message: "Unavailable" },
      ok: false
    }, 503));
    await mockCardImages(page);
    await page.goto("/profile");

    const lightCard = page.locator('input[name="card-theme"][value="light"]');
    await lightCard.check();
    const saveAndShare = page.getByRole("button", { name: "Save & share" });
    await saveAndShare.click();

    await expect(page.locator(".card-style-settings-status")).toHaveText(
      "Could not save card settings. Try again."
    );
    await expect(page.getByRole("dialog", { name: "Share activity" }))
      .toHaveCount(0);
    await expect(lightCard).toBeChecked();
    await expect(saveAndShare).toBeEnabled();
  });
});

test.describe("Public profile", () => {
  test("public profile intro uses the Sites owner profile route", async ({ page }) => {
    await mockAnonymousAccount(page);
    await mockPublicProfile(page);
    await mockCardImages(page);
    await page.goto(PROFILE_ROUTE);

    await expect(page.locator(".public-card-intro-actions .primary-command"))
      .toHaveAttribute(
        "href",
        "/api/auth/github/login?redirect_to=%2F%3Fview%3Dprofile"
      );
  });

  test("public profile intro links authenticated users to their owner profile", async ({ page }) => {
    await mockAuthenticatedAccount(page);
    await mockPublicProfile(page);
    await mockCardImages(page);
    await page.goto(PROFILE_ROUTE);

    await expect(page.locator(".public-card-intro-actions .primary-command"))
      .toHaveAttribute("href", OWNER_PROFILE_ROUTE);
  });

  test("public profile waits for one decoded card before starting the intro motion", async ({ page }) => {
    let releaseCard;
    let cardRequests = 0;
    const cardGate = new Promise((resolve) => {
      releaseCard = resolve;
    });
    await mockAnonymousAccount(page);
    await mockPublicProfile(page);
    await page.route("**/u/postmelee/card.png*", async (route) => {
      cardRequests += 1;
      await cardGate;
      await route.fulfill({
        body: CARD_PNG,
        contentType: "image/png",
        status: 200
      });
    });

    await page.goto(PROFILE_ROUTE, { waitUntil: "domcontentloaded" });

    const intro = page.getByTestId("public-card-intro-backdrop");
    const motionCard = page.getByTestId("public-card-intro-card");
    const media = motionCard.locator(".home-card-media");
    const skeleton = motionCard.locator(".home-card-skeleton");
    await expect(intro).toHaveClass(/\bis-preparing\b/);
    await expect(media).toHaveAttribute("data-card-status", "loading");
    await expect(media).toHaveAttribute("aria-busy", "true");
    await expect(skeleton).toHaveAttribute("data-active", "true");
    await expect(skeleton).toHaveCSS("opacity", "1");
    await expect(motionCard.getByRole("img")).toHaveCount(0);
    expect(await motionCard.evaluate((element) => element.getAnimations().length))
      .toBe(0);

    releaseCard();
    const card = motionCard.getByRole("img", {
      name: "Codex usage card for Post Melee"
    });
    await expect(media).toHaveAttribute("data-card-status", "ready");
    await expect(media).toHaveAttribute("aria-busy", "false");
    await expect(card).toHaveAttribute("src", /^blob:/);
    await expect.poll(() => card.evaluate((image) => image.naturalWidth)).toBe(1497);
    await expect.poll(() => motionCard.evaluate((element) => (
      element.getAnimations().flatMap(
        (animation) => animation.effect?.getKeyframes?.() ?? []
      ).some((keyframe) => keyframe.transform?.includes("rotateY"))
    ))).toBe(true);
    await expect(intro).toHaveClass(/\bis-open\b/);
    // React Strict Mode intentionally replays effects in the E2E dev build.
    // Both replays still feed one readiness resource shared by the intro and
    // resting card, and neither <img> performs another network request.
    expect(cardRequests).toBeGreaterThanOrEqual(1);
    expect(cardRequests).toBeLessThanOrEqual(2);
  });

  test("public profile intro removes spatial motion for reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockAnonymousAccount(page);
    await mockPublicProfile(page);
    await mockCardImages(page);

    await page.goto(PROFILE_ROUTE);

    const intro = page.getByTestId("public-card-intro-backdrop");
    const motionCard = page.getByTestId("public-card-intro-card");
    await expect(intro).toHaveClass(/\bis-open\b/);
    const transforms = await motionCard.evaluate((element) => (
      element.getAnimations().flatMap(
        (animation) => animation.effect?.getKeyframes?.() ?? []
      ).flatMap((keyframe) => keyframe.transform ? [keyframe.transform] : [])
    ));
    expect(transforms).toEqual([]);
  });

  test("Task #96 public intro closes into its offscreen card without opacity replay", async ({ page }) => {
    let cardRequests = 0;
    page.on("request", (request) => {
      if (request.url().includes("/u/postmelee/card.png")) cardRequests += 1;
    });
    await mockAnonymousAccount(page);
    await mockPublicProfile(page);
    await mockCardImages(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PROFILE_ROUTE);

    const intro = page.getByTestId("public-card-intro-backdrop");
    const sourceCard = page.locator(
      ".public-profile-view .profile-card-preview-stage .home-card-tilt"
    );
    await expect(intro).toHaveClass(/\bis-open\b/);
    await expect(sourceCard).toHaveCSS("opacity", "0");
    const requestsBeforeClose = cardRequests;

    await page.evaluate(() => {
      globalThis.__publicIntroCloseSamples = [];

      function sampleCloseMotion() {
        const backdrop = document.querySelector(
          "[data-testid='public-card-intro-backdrop']"
        );
        const card = document.querySelector("[data-testid='public-card-intro-card']");
        if (!card) return;

        const style = getComputedStyle(card);
        const matrix = new DOMMatrixReadOnly(style.transform);
        globalThis.__publicIntroCloseSamples.push({
          mode: card.dataset.motionMode,
          opacity: Number.parseFloat(style.opacity),
          phase: backdrop?.className ?? "detached",
          scaleX: matrix.a,
          scaleY: matrix.d,
          translateX: matrix.e,
          translateY: matrix.f
        });
        requestAnimationFrame(sampleCloseMotion);
      }

      requestAnimationFrame(sampleCloseMotion);
    });

    await page.locator(".public-card-intro-close").click();
    await expect(intro).toHaveCount(0);
    await expect(sourceCard).toHaveCSS("opacity", "1");

    const samples = await page.evaluate(
      () => globalThis.__publicIntroCloseSamples ?? []
    );
    const closeSamples = samples.filter(({ phase }) => (
      phase.includes("is-closing") || phase.includes("is-handoff")
    ));
    expect(closeSamples.length).toBeGreaterThan(3);
    expect(closeSamples.some(({ mode }) => mode === "translate")).toBe(true);
    expect(closeSamples.some(({ translateX, translateY }) => (
      Math.hypot(translateX, translateY) > 40
    ))).toBe(true);
    const closingDistances = closeSamples
      .filter(({ phase }) => phase.includes("is-closing"))
      .map(({ translateX, translateY }) => Math.hypot(translateX, translateY));
    const finalClosingDistance = Math.max(...closingDistances);
    const firstVisibleMovement = closingDistances.find((distance) => distance > 1);
    expect(firstVisibleMovement / finalClosingDistance).toBeLessThan(0.25);
    expect(closeSamples.every(({ scaleX, scaleY }) => (
      Math.abs(scaleX - 1) < 0.02 && Math.abs(scaleY - 1) < 0.02
    ))).toBe(true);
    for (let index = 1; index < closeSamples.length; index += 1) {
      expect(closeSamples[index].opacity - closeSamples[index - 1].opacity)
        .toBeLessThan(0.2);
    }
    expect(cardRequests).toBe(requestsBeforeClose);
  });

  test("public profile renders the API-backed GitHub identity and selected public card", async ({ page }, testInfo) => {
    await mockAnonymousAccount(page);
    await mockPublicProfile(page);
    await mockCardImages(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(SITES_PROFILE_ROUTE);
    await dismissCardIntro(page);

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
    await expect(page.locator(".profile-card-section .home-card-media"))
      .toHaveAttribute(
        "data-card-source-url",
        `${E2E_ORIGIN}/u/postmelee/card.png?theme=light&locale=ko`
      );
    await expect(card).toHaveAttribute("src", /^blob:/);
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
    await dismissCardIntro(page);

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
    await dismissCardIntro(page);

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
    const loadingSkeleton = page.getByTestId("public-profile-loading-skeleton");
    await expect(loadingSkeleton).toHaveAttribute("aria-busy", "true");
    await expect(loadingSkeleton)
      .toHaveAttribute("data-profile-loading-surface", "public");
    await expect(loadingSkeleton.locator(
      ".public-profile-loading-stats > [data-skeleton-part=stat]"
    ))
      .toHaveCount(5);
    await expect(loadingSkeleton.locator(".public-profile-loading-activity"))
      .toBeVisible();
    await expect(loadingSkeleton.locator("[data-skeleton-part=activity-row]"))
      .toHaveCount(7);
    await expect(loadingSkeleton.locator(".home-card-media"))
      .toHaveAttribute("data-card-status", "loading");
    await expect(loadingSkeleton.locator(".home-card-skeleton"))
      .toHaveAttribute("data-active", "true");
    await expect(page.locator(".profile-state-indicator")).toHaveCount(0);
    const skeletonMotion = await loadingSkeleton.evaluate((element) => ({
      pageAnimation: getComputedStyle(element, "::after").animationName,
      shimmerAnimations: Array.from(
        element.querySelectorAll(".profile-loading-shimmer")
      ).map((placeholder) => getComputedStyle(placeholder, "::after").animationName)
    }));
    expect(skeletonMotion.pageAnimation).toBe("none");
    expect(skeletonMotion.shimmerAnimations.length).toBeGreaterThan(10);
    expect(new Set(skeletonMotion.shimmerAnimations)).toEqual(
      new Set(["home-card-skeleton-progress"])
    );
    // Scoped to the profile region: the footer carries a constant author
    // credit, which is identical on every page and reveals nothing about the
    // handle being loaded.
    await expect(
      page.locator(".public-profile-view").getByText("postmelee", { exact: false })
    ).toHaveCount(0);

    releaseResponse();
    await dismissCardIntro(page);
    await expect(page.getByRole("heading", {
      level: 1,
      name: "Post Melee"
    }))
      .toBeVisible();
    await expect(page.locator(".public-profile-stage.profile-content-reveal"))
      .toBeVisible();
  });

  test("profile loading Skeleton stops decorative motion for reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockAnonymousAccount(page);
    await page.route("**/api/profiles/public/postmelee", () => new Promise(() => {}));
    await page.goto(PROFILE_ROUTE, { waitUntil: "domcontentloaded" });

    const loadingSkeleton = page.getByTestId("public-profile-loading-skeleton");
    await expect(loadingSkeleton).toHaveAttribute("aria-busy", "true");
    const reducedMotion = await loadingSkeleton.evaluate((element) => ({
      cardShimmer: getComputedStyle(
        element.querySelector(".home-card-skeleton"),
        "::after"
      ).animationName,
      placeholderShimmers: Array.from(
        element.querySelectorAll(".profile-loading-shimmer")
      ).map((placeholder) => ({
        animationName: getComputedStyle(placeholder, "::after").animationName,
        opacity: getComputedStyle(placeholder, "::after").opacity
      }))
    }));
    expect(reducedMotion.cardShimmer).toBe("none");
    expect(reducedMotion.placeholderShimmers.every((style) => (
      style.animationName === "none" && style.opacity === "0"
    ))).toBe(true);
  });

  test("profile content reveal settles immediately for reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockAnonymousAccount(page);
    await mockPublicProfile(page);
    await mockCardImages(page);
    await page.goto(PROFILE_ROUTE);
    await dismissCardIntro(page);

    const reducedReveal = await page.evaluate(() => [
      ".profile-header",
      ".profile-stats",
      ".token-activity",
      ".profile-card-section"
    ].map((selector) => {
      const style = getComputedStyle(document.querySelector(selector));
      return {
        animationName: style.animationName,
        opacity: style.opacity,
        transform: style.transform
      };
    }));
    expect(reducedReveal).toEqual(Array(4).fill({
      animationName: "none",
      opacity: "1",
      transform: "none"
    }));
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
      name: "This card cannot be shown"
    }))
      .toBeVisible();
    await expect(page.getByText(
      "The link may be wrong, or the card may not be published yet."
    ))
      .toBeVisible();
    await expect(page.getByRole("link", { name: "Create your Codex card" }))
      .toHaveAttribute(
        "href",
        "/api/auth/github/login?redirect_to=%2F%3Fview%3Dprofile"
      );
    await expect(page.getByText("private-or-missing", { exact: false })).toHaveCount(0);
    await expect(page.locator(".home-card-preview")).toHaveCount(0);
  });
});

// The intro modal covers the public profile on every entry and makes the page
// inert, so tests that assert on the profile itself dismiss it first. The close
// control is matched by class so the helper works in every locale.
async function dismissCardIntro(page) {
  const intro = page.getByTestId("public-card-intro-backdrop");
  await intro.waitFor({ state: "attached", timeout: 5000 }).catch(() => {});
  if (await intro.count() === 0) return;
  await page.locator(".public-card-intro-close").click();
  await expect(intro).toHaveCount(0);
}

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

async function preserveMenuTouchActivation(page, item) {
  await item.evaluate((element) => {
    element.blur();
    element.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: "touch"
    }));
  });
  await page.waitForTimeout(20);

  const diagnostic = await page.evaluate(() => ({
    activeElement: document.activeElement?.tagName ?? null,
    menuCount: document.querySelectorAll("#account-menu-popover").length,
    url: globalThis.location.href
  }));
  expect(diagnostic).toMatchObject({ menuCount: 1 });
  return diagnostic;
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

async function expectSemanticThemeTransition(page, targets, {
  finalColor,
  toggleName
}) {
  const initialColors = await targets.evaluateAll((elements) => (
    elements.map((element) => getComputedStyle(element).color)
  ));
  await page.getByRole("switch", { name: toggleName }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-animating", "");

  const transitionContract = await targets.evaluateAll((elements) => (
    elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        duration: style.transitionDuration,
        property: style.transitionProperty
      };
    })
  ));
  expect(transitionContract.every(({ duration, property }) => (
    duration.split(", ").includes("0.24s") && property.includes("color")
  ))).toBe(true);

  await page.waitForTimeout(120);
  const midpointColors = await targets.evaluateAll((elements) => (
    elements.map((element) => getComputedStyle(element).color)
  ));
  expect(midpointColors.every((color, index) => (
    color !== initialColors[index] && color !== finalColor
  ))).toBe(true);

  await expect(page.locator("html")).not.toHaveAttribute("data-theme-animating", "");
  await expect.poll(async () => targets.evaluateAll((elements) => (
    elements.map((element) => getComputedStyle(element).color)
  ))).toEqual(Array.from({ length: await targets.count() }, () => finalColor));

  await page.waitForTimeout(80);
  await expect.poll(async () => targets.evaluateAll((elements) => (
    elements.map((element) => getComputedStyle(element).color)
  ))).toEqual(Array.from({ length: await targets.count() }, () => finalColor));
}

async function expectThemeSurfaceTransition(page, targets, { toggleName }) {
  await page.getByRole("switch", { name: toggleName }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-animating", "");

  const contracts = await targets.evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    return {
      duration: style.transitionDuration.split(", "),
      property: style.transitionProperty.split(", ")
    };
  }));
  expect(contracts.length).toBeGreaterThan(0);
  expect(contracts.every(({ duration, property }) => (
    duration.includes("0.24s")
    && property.includes("background-color")
    && property.includes("border-color")
  )), JSON.stringify(contracts, null, 2)).toBe(true);

  await expect(page.locator("html")).not.toHaveAttribute("data-theme-animating", "");
}

async function readThemeColors(page, heading, heatmap) {
  return page.evaluate(({ headingElement, heatmapElement }) => {
    const readTransition = (element, property) => {
      const animation = element.getAnimations().find((candidate) => (
        candidate.effect?.getKeyframes().some((frame) => property in frame)
      ));
      const frames = animation?.effect?.getKeyframes() ?? [];
      return {
        currentTime: Number(animation?.currentTime ?? 0),
        duration: Number(animation?.effect?.getTiming().duration ?? 0),
        startColor: frames[0]?.[property] ?? ""
      };
    };

    return {
      heading: getComputedStyle(headingElement).color,
      headingAnimation: readTransition(headingElement, "color"),
      heatmap: getComputedStyle(heatmapElement).backgroundColor,
      heatmapAnimation: readTransition(heatmapElement, "backgroundColor")
    };
  }, {
    headingElement: await heading.elementHandle(),
    heatmapElement: await heatmap.elementHandle()
  });
}

async function expectStableThemeTimeline(page, heading, heatmap, {
  heading: finalHeading,
  heatmap: finalHeatmap,
  toggleName
}) {
  const initial = await readThemeColors(page, heading, heatmap);
  await page.getByRole("switch", { name: toggleName }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-animating", "");

  const samples = [];
  for (const delay of [40, 80, 80]) {
    await page.waitForTimeout(delay);
    samples.push(await readThemeColors(page, heading, heatmap));
  }

  const activeHeadingSamples = samples.filter(({ headingAnimation }) => (
    headingAnimation.duration > 0
  ));
  const activeHeatmapSamples = samples.filter(({ heatmapAnimation }) => (
    heatmapAnimation.duration > 0
  ));
  expect(activeHeadingSamples.length).toBeGreaterThanOrEqual(2);
  expect(activeHeadingSamples.every(({ headingAnimation }) => (
    headingAnimation.duration === 240
    && headingAnimation.startColor === initial.heading
  )), JSON.stringify({ initial, samples }, null, 2)).toBe(true);
  expect(activeHeadingSamples.map(({ headingAnimation }) => headingAnimation.currentTime))
    .toEqual([...activeHeadingSamples]
      .map(({ headingAnimation }) => headingAnimation.currentTime)
      .sort((left, right) => left - right));
  expect(activeHeatmapSamples.length).toBeGreaterThanOrEqual(2);
  expect(activeHeatmapSamples.every(({ heatmapAnimation }) => (
    heatmapAnimation.duration === 240
    && heatmapAnimation.startColor === initial.heatmap
  )), JSON.stringify({ initial, samples }, null, 2)).toBe(true);

  await expect.poll(async () => readThemeColors(page, heading, heatmap), {
    timeout: 360
  }).toMatchObject({
    heading: finalHeading,
    heatmap: finalHeatmap
  });
  await expect(page.locator("html")).not.toHaveAttribute("data-theme-animating", "");
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

async function mockCardImages(page, options = {}) {
  const fulfillPng = (route) => route.fulfill({
    body: CARD_PNG,
    contentType: "image/png",
    status: 200
  });
  await page.route("**/api/profile/card.png*", fulfillPng);
  await page.route("**/u/postmelee/card.png*", (route) => {
    options.onPublicCardRequest?.(route.request());
    return fulfillPng(route);
  });
}

async function mockPublicProfile(page) {
  await page.route("**/api/profiles/public/postmelee", (route) => fulfillJson(route, {
    data: publicProfile(),
    ok: true
  }));
}

function publicProfile() {
  return {
    cardLocale: "ko",
    cardStyle: {
      effect: { preset: "none", version: 1 },
      schemaVersion: 1,
      theme: "light"
    },
    owner: {
      avatarUrl: "https://avatars.githubusercontent.com/u/12345",
      displayName: "Post Melee",
      githubLogin: "postmelee",
      handle: "postmelee"
    },
    publicCardUrl: `${E2E_ORIGIN}/u/postmelee/card.png`,
    selectedPublicCardUrl: `${E2E_ORIGIN}/u/postmelee/card.png?locale=ko&theme=light`,
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
  const cardStyle = {
    effect: { preset: "none", version: 1 },
    schemaVersion: 1,
    theme: "dark"
  };
  return {
    cardLocale: "en",
    cardStyle,
    owner: { ...AUTH_OWNER, visibility },
    publicCardUrl: `${E2E_ORIGIN}/u/postmelee/card.png`,
    publicCardUrls: {
      dark: `${E2E_ORIGIN}/u/postmelee/card.png?theme=dark`,
      light: `${E2E_ORIGIN}/u/postmelee/card.png?theme=light`
    },
    publicCardVariantUrls: {
      en: {
        dark: `${E2E_ORIGIN}/u/postmelee/card.png?theme=dark`,
        light: `${E2E_ORIGIN}/u/postmelee/card.png?theme=light`
      },
      ko: {
        dark: `${E2E_ORIGIN}/u/postmelee/card.png?locale=ko&theme=dark`,
        light: `${E2E_ORIGIN}/u/postmelee/card.png?locale=ko&theme=light`
      }
    },
    selectedPublicCardUrl: `${E2E_ORIGIN}/u/postmelee/card.png?theme=dark`,
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

async function readProfileGeometry(page, state) {
  const selectors = state === "loading"
    ? {
        activity: ".profile-loading-activity",
        avatar: ".profile-loading-avatar",
        card: ".profile-loading-card",
        cardHeading: ".profile-loading-card-header",
        cardPreview: ".profile-loading-card .home-card-tilt",
        grid: ".profile-loading-activity-grid",
        handle: ".profile-loading-handle",
        name: ".profile-loading-name",
        option: ".profile-loading-activity-option",
        stats: ".profile-loading-stats"
      }
    : {
        activity: ".token-activity",
        avatar: ".avatar-shell",
        card: ".profile-card-section",
        cardHeading: ".card-profile-heading",
        cardPreview: ".profile-card-section .home-card-tilt",
        grid: ".token-grid",
        handle: ".profile-heading p",
        name: ".profile-heading h1",
        option: ".token-activity-options",
        stats: ".profile-stats"
      };

  return page.evaluate((geometrySelectors) => Object.fromEntries(
    Object.entries(geometrySelectors).map(([key, selector]) => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return [key, {
        height: rect.height,
        top: rect.top
      }];
    })
  ), selectors);
}

function expectProfileGeometryToMatch(loading, ready) {
  for (const key of Object.keys(loading)) {
    expect(Math.abs(loading[key].top - ready[key].top), `${key} top`).toBeLessThanOrEqual(2);
    if (key === "card") continue;
    expect(
      Math.abs(loading[key].height - ready[key].height),
      `${key} height`
    ).toBeLessThanOrEqual(2);
  }
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
