import { expect, test } from "@playwright/test";

const PROFILE_ROUTE = "/u/meleeisdeveloping";

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

  test("switches heatmap modes and exposes the daily tooltip text", async ({ page }) => {
    await page.setViewportSize({ width: 1512, height: 982 });
    await page.goto(PROFILE_ROUTE);

    await expect(page.locator(".token-grid")).toHaveAttribute("data-heatmap-mode", "daily");

    const emptyDay = page.locator('[data-token-cell][data-date="2025-07-20"]');
    await expect(emptyDay).toHaveAttribute("data-tooltip", "0 tokens on Jul 20, 2025");
    await emptyDay.hover();
    await expect(emptyDay.locator(".token-tooltip")).toBeVisible();

    await page.getByRole("button", { name: "Weekly" }).click();
    await expect(page.locator(".token-grid")).toHaveAttribute("data-heatmap-mode", "weekly");

    await page.getByRole("button", { name: "Cumulative" }).click();
    await expect(page.locator(".token-grid")).toHaveAttribute("data-heatmap-mode", "cumulative");
  });
});
