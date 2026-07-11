import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

const PROFILE_ROUTE = "/u/meleeisdeveloping";
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
    await expect(page.getByRole("img", { name: "Sample Codex usage card" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in with GitHub" })).toHaveAttribute(
      "href",
      "/api/auth/github/login?redirect_to=%2Fprofile"
    );

    const preview = page.getByRole("img", { name: "Sample Codex usage card" });
    await expect.poll(() => preview.evaluate((image) => image.naturalWidth)).toBe(998);
    await expect(preview).toHaveCSS("aspect-ratio", "499 / 306");
    await page.screenshot({ path: testInfo.outputPath("home-desktop.png") });
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

test.describe("Codex profile UI", () => {
  test("renders the desktop profile with the Codex-like action row", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1512, height: 982 });
    await page.goto(PROFILE_ROUTE);

    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "postmelee" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Share profile" })).toBeVisible();
    await expect(page.getByText("Private")).toHaveCount(0);
    await expect(page.getByText("Edit")).toHaveCount(0);

    const avatarLoaded = await page.locator(".avatar-shell img").evaluate(
      (image) => image.complete && image.naturalWidth > 0
    );
    expect(avatarLoaded).toBe(true);

    const bodyHasHorizontalOverflow = await page.evaluate(
      () => document.body.scrollWidth > document.documentElement.clientWidth
    );
    expect(bodyHasHorizontalOverflow).toBe(false);

    await expect.poll(async () => page.locator(".token-grid-wrap").evaluate((wrap) => {
      const grid = wrap.querySelector(".token-grid");

      return grid.getBoundingClientRect().width;
    })).toBeGreaterThan(850);

    const desktopHeatmapMetrics = await page.locator(".token-grid-wrap").evaluate((wrap) => {
      const grid = wrap.querySelector(".token-grid");
      const firstCell = grid.querySelector("[data-token-cell]");
      const gridRect = grid.getBoundingClientRect();

      return {
        cellWidth: firstCell.getBoundingClientRect().width,
        gridWidth: gridRect.width,
        maxScrollLeft: wrap.scrollWidth - wrap.clientWidth,
        wrapWidth: wrap.clientWidth
      };
    });

    expect(desktopHeatmapMetrics.cellWidth).toBeGreaterThan(13);
    expect(desktopHeatmapMetrics.gridWidth).toBeGreaterThan(850);
    expect(Math.abs(desktopHeatmapMetrics.gridWidth - desktopHeatmapMetrics.wrapWidth)).toBeLessThanOrEqual(1);
    expect(desktopHeatmapMetrics.maxScrollLeft).toBeLessThanOrEqual(1);

    await page.screenshot({ path: testInfo.outputPath("desktop.png") });
  });

  test("keeps mobile layout readable without document overflow", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PROFILE_ROUTE);

    await expect(page.getByRole("button", { name: "Share profile" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Token activity" })).toBeVisible();

    const bodyHasHorizontalOverflow = await page.evaluate(
      () => document.body.scrollWidth > document.documentElement.clientWidth
    );
    expect(bodyHasHorizontalOverflow).toBe(false);

    await page.screenshot({ path: testInfo.outputPath("mobile.png") });
  });

  test("keeps fixed heatmap cell geometry before the mobile breakpoint", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 900, height: 982 });
    await page.goto(PROFILE_ROUTE);

    const metrics = await page.locator(".token-grid-wrap").evaluate((wrap) => {
      const grid = wrap.querySelector(".token-grid");
      const cells = Array.from(grid.querySelectorAll("[data-token-cell]"));
      const first = cells[0].getBoundingClientRect();
      const secondRow = cells[1].getBoundingClientRect();
      const secondColumn = cells[7].getBoundingClientRect();
      const gridRect = grid.getBoundingClientRect();

      return {
        cellHeight: first.height,
        cellWidth: first.width,
        columnGap: secondColumn.left - first.right,
        gridWidth: gridRect.width,
        maxScrollLeft: wrap.scrollWidth - wrap.clientWidth,
        rowGap: secondRow.top - first.bottom,
        scrollLeft: wrap.scrollLeft,
        wrapWidth: wrap.clientWidth
      };
    });

    expect(Math.round(metrics.cellWidth)).toBe(13);
    expect(Math.round(metrics.cellHeight)).toBe(13);
    expect(Math.round(metrics.columnGap)).toBe(3);
    expect(Math.round(metrics.rowGap)).toBe(3);
    expect(Math.round(metrics.gridWidth)).toBe(829);

    if (metrics.maxScrollLeft > 0) {
      expect(Math.abs(metrics.scrollLeft - metrics.maxScrollLeft)).toBeLessThanOrEqual(1);
    }

    await page.screenshot({ path: testInfo.outputPath("tablet-heatmap.png") });
  });

  test("keeps the latest heatmap columns visible after the viewport narrows", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 982 });
    await page.goto(PROFILE_ROUTE);

    await page.setViewportSize({ width: 390, height: 844 });

    await expect.poll(async () => (
      page.locator(".token-grid-wrap").evaluate((wrap) => {
        const maxScrollLeft = wrap.scrollWidth - wrap.clientWidth;

        return Math.round(maxScrollLeft - wrap.scrollLeft);
      })
    )).toBeLessThanOrEqual(1);
  });

  test("switches heatmap modes and exposes the daily tooltip text", async ({ page }) => {
    await page.setViewportSize({ width: 1512, height: 982 });
    await page.goto(PROFILE_ROUTE);

    await expect(page.locator(".token-grid")).toHaveAttribute("data-heatmap-mode", "daily");

    const emptyDay = page.locator('[data-token-cell][data-date="2025-07-20"]');
    await expect(emptyDay).toHaveAttribute("data-tooltip", "0 tokens on Jul 20, 2025");
    await emptyDay.hover();
    await expect(page.locator(".token-tooltip")).toBeVisible();

    await page.getByRole("button", { name: "Weekly" }).click();
    await expect(page.locator(".token-grid")).toHaveAttribute("data-heatmap-mode", "weekly");

    await page.getByRole("button", { name: "Cumulative" }).click();
    await expect(page.locator(".token-grid")).toHaveAttribute("data-heatmap-mode", "cumulative");
  });

  test("keeps the mobile heatmap tooltip inside the viewport near the right edge", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PROFILE_ROUTE);

    const scrollMetrics = await page.locator(".token-grid-wrap").evaluate((element) => {
      return {
        maxScrollLeft: element.scrollWidth - element.clientWidth,
        scrollLeft: element.scrollLeft
      };
    });
    expect(scrollMetrics.scrollLeft).toBeGreaterThan(0);
    expect(Math.abs(scrollMetrics.scrollLeft - scrollMetrics.maxScrollLeft)).toBeLessThanOrEqual(1);

    await page.locator('[data-token-cell][data-date="2026-06-06"]').hover();

    const tooltip = page.locator(".token-tooltip");
    await expect(tooltip).toBeVisible();

    const tooltipBox = await tooltip.boundingBox();
    expect(tooltipBox).not.toBeNull();
    expect(tooltipBox.x).toBeGreaterThanOrEqual(0);
    expect(tooltipBox.x + tooltipBox.width).toBeLessThanOrEqual(390);

    await page.screenshot({ path: testInfo.outputPath("mobile-tooltip.png") });
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
