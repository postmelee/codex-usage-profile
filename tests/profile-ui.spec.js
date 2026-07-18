import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

const PROFILE_ROUTE = "/u/postmelee";
const CARD_PNG = readFileSync(new URL(
  "../public/assets/codex-card-sample.png",
  import.meta.url
));
const AUTH_OWNER = Object.freeze({
  avatarUrl: "/assets/postmelee-avatar.png",
  displayName: "postmelee",
  githubLogin: "postmelee",
  handle: "postmelee",
  id: "owner_1",
  visibility: "private"
});

test.describe("Home and share card flow", () => {
  test("Home shows the sample card and sends anonymous users to GitHub login", async ({ page }, testInfo) => {
    await mockAnonymousAccount(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

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
      ".profile-topbar h1",
      ".profile-navigation a",
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

    expect(topbarMetrics).toHaveLength(3);
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
    await expect.poll(() => preview.evaluate((image) => image.naturalWidth)).toBe(998);
    await expect(preview).toHaveCSS("aspect-ratio", "499 / 306");
    await page.screenshot({ path: testInfo.outputPath("home-desktop.png") });
  });

  test("Home shows the signed-in GitHub identity and owner profile entry", async ({ page }) => {
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
    await expect.poll(() => ownerPreview.evaluate((image) => image.naturalWidth)).toBe(998);

    const accountState = page.locator(".home-account-state");
    await expect(accountState.getByRole("img", { name: "postmelee avatar" })).toBeVisible();
    await expect(accountState.getByText("postmelee", { exact: true })).toBeVisible();
    await expect(accountState.getByText("@postmelee", { exact: true })).toBeVisible();
    await expect(accountState.getByRole("link", { name: "View profile" })).toHaveAttribute(
      "href",
      "/profile"
    );

    const command = "npx codex-usage-profile@latest submit";
    await expect(page.getByText(command, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Copy submit command" }).click();
    await expect(page.getByText("Command copied.", { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => globalThis.__copiedHomeCommand)).toBe(command);
  });

  test("keeps Home Profile and Settings inside the frame with internal scrolling", async ({ page }, testInfo) => {
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

    for (const path of ["/", "/profile", "/settings", PROFILE_ROUTE]) {
      await page.goto(path);
      const metrics = await getFrameScrollMetrics(page);
      const titleMetrics = await page.locator(".profile-topbar h1").evaluate((title) => ({
        clientHeight: title.clientHeight,
        lineHeight: getComputedStyle(title).lineHeight,
        scrollHeight: title.scrollHeight
      }));

      expect(metrics.frameBottom).toBeLessThanOrEqual(metrics.viewportHeight);
      expect(metrics.frameHeight).toBeLessThanOrEqual(metrics.viewportHeight - 72 + 1);
      expect(metrics.overflowY).toBe("auto");
      expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
      expect(titleMetrics.lineHeight).toBe("20px");
      expect(titleMetrics.clientHeight).toBeGreaterThanOrEqual(22);
      expect(titleMetrics.scrollHeight).toBeLessThanOrEqual(titleMetrics.clientHeight);
    }

    const primaryNavigation = page.getByRole("navigation", { name: "Primary" });
    await expect(primaryNavigation.getByRole("link", { name: "Home", exact: true }))
      .toHaveAttribute("href", "/");
    await expect(primaryNavigation.getByRole("link", { name: "Profile", exact: true }))
      .toHaveAttribute("href", "/profile");

    const internalScrollTop = await page.locator(".profile-shell").evaluate((shell) => {
      shell.scrollTop = 120;
      return shell.scrollTop;
    });
    expect(internalScrollTop).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath("public-profile-short-viewport.png") });
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
    await page.goto("/profile");

    const shareButton = page.getByRole("button", { name: "Share profile" });
    await expect(page.getByRole("heading", { name: "Your Codex card" })).toBeVisible();
    await expect(shareButton).toBeDisabled();
    await expect(page.getByText("Private", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Publish card" }).click();
    await expect(page.getByText("Public", { exact: true })).toBeVisible();
    await expect(shareButton).toBeEnabled();

    await shareButton.click();
    const dialog = page.getByRole("dialog", { name: "Share card" });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("button", { name: "Close share dialog" })).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath("share-desktop.png") });
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("link", { name: "Save PNG" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Close share dialog" })).toBeFocused();

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

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(shareButton).toBeFocused();
  });

  test("Share card dialog fits a mobile viewport without document overflow", async ({ page }, testInfo) => {
    await mockAuthenticatedAccount(page);
    await page.route("**/api/profile", (route) => fulfillJson(route, {
      data: ownerProfile("public"),
      ok: true
    }));
    await mockCardImages(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/profile");
    await page.getByRole("button", { name: "Share profile" }).click();

    await expect(page.getByRole("dialog", { name: "Share card" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Codex usage card preview" })).toHaveCSS(
      "aspect-ratio",
      "499 / 306"
    );
    expect(await page.evaluate(
      () => document.body.scrollWidth > document.documentElement.clientWidth
    )).toBe(false);
    await page.screenshot({ path: testInfo.outputPath("share-mobile.png") });
  });
});

test.describe("Public profile", () => {
  test("public profile renders the API-backed GitHub identity and stable card", async ({ page }, testInfo) => {
    await mockAnonymousAccount(page);
    await mockPublicProfile(page);
    await mockCardImages(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(PROFILE_ROUTE);

    await expect(page.getByRole("heading", { name: "Codex card for Post Melee" }))
      .toBeVisible();
    await expect(page.getByText("@postmelee", { exact: true })).toBeVisible();
    await expect(page.getByText("Public", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Share profile" })).toHaveCount(0);

    const card = page.getByRole("img", { name: "Codex usage card for Post Melee" });
    await expect(card).toHaveAttribute(
      "src",
      "http://127.0.0.1:5173/u/postmelee/card.png"
    );
    await expect(card).toHaveCSS("aspect-ratio", "499 / 306");
    await expect.poll(() => card.evaluate((image) => image.naturalWidth)).toBe(998);

    await expect(page.getByText("Activity insights", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Most used plugins", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Token activity", { exact: true })).toHaveCount(0);
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

    await expect(page.getByRole("heading", { name: "Loading public profile" }))
      .toBeVisible();
    await expect(page.getByText("postmelee", { exact: false })).toHaveCount(0);

    releaseResponse();
    await expect(page.getByRole("heading", { name: "Codex card for Post Melee" }))
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

    await expect(page.getByRole("heading", { name: "Profile unavailable" }))
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
      capturedAt: "2026-07-14T00:00:00.000Z",
      uploadedAt: "2026-07-14T00:01:00.000Z",
      usage: {
        dailyUsageBuckets: [],
        summary: {
          currentStreakDays: 10,
          lifetimeTokens: 15_090_000_000,
          longestStreakDays: 49,
          longestTaskDurationMs: 6_780_000,
          peakDailyTokens: 700_000_000
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
    usage: { uploadedAt: "2026-06-11T00:01:00.000Z" },
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

async function getFrameScrollMetrics(page) {
  return page.locator(".app-frame").evaluate((frame) => {
    const shell = frame.querySelector(".profile-shell");
    const frameRect = frame.getBoundingClientRect();

    return {
      clientHeight: shell.clientHeight,
      frameBottom: frameRect.bottom,
      frameHeight: frameRect.height,
      overflowY: getComputedStyle(shell).overflowY,
      scrollHeight: shell.scrollHeight,
      viewportHeight: window.innerHeight
    };
  });
}
