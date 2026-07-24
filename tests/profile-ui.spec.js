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
    await expect(page.getByRole("menuitem", { name: "Profile" })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "href",
      "/?view=settings"
    );
    await page.screenshot({ path: testInfo.outputPath("home-mobile.png") });
  });

  test("uses document scrolling on Home and keeps app surfaces framed", async ({ page }, testInfo) => {
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
      const metrics = await getFrameScrollMetrics(page);
      const titleMetrics = await page.locator(".profile-topbar-title").evaluate((title) => ({
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
      .toHaveCount(0);

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
    await page.goto("/");

    await page.getByRole("button", { name: "Publish card" }).click();
    const shareButton = page.getByRole("button", { name: "Share", exact: true });
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

    await shareButton.click();
    await page.getByRole("button", { name: "Make private" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Publish card" })).toBeEnabled();
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

    await expect(page.getByRole("dialog", { name: "Share card" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Make private" })).toBeVisible();
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
    await expect.poll(() => card.evaluate((image) => image.naturalWidth)).toBe(1497);

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
  await page.route("**/api/profile", (route) => fulfillJson(route, {
    data: ownerProfile("private"),
    ok: true
  }));
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
