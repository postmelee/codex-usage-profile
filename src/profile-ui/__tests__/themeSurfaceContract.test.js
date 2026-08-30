import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);
const STYLESHEET_PATH = join(PROJECT_ROOT, "src", "styles.css");
const SOURCE_PATHS = Object.freeze({
  cardProfile: join(PROJECT_ROOT, "src", "profile-ui", "CardProfilePage.jsx"),
  home: join(PROJECT_ROOT, "src", "profile-ui", "HomePage.jsx"),
  loading: join(PROJECT_ROOT, "src", "profile-ui", "ProfileLoadingSkeleton.jsx"),
  marketing: join(PROJECT_ROOT, "src", "profile-marketing", "MarketingLanding.jsx"),
  publicIntro: join(PROJECT_ROOT, "src", "profile-ui", "PublicCardIntro.jsx"),
  publicProfile: join(PROJECT_ROOT, "src", "profile-ui", "PublicProfilePage.jsx"),
  shareStudio: join(PROJECT_ROOT, "src", "profile-ui", "ShareStudio.jsx")
});

test("Task #96 primary headings own their semantic text color", async () => {
  const stylesheet = await readFile(STYLESHEET_PATH, "utf8");
  const selectors = [
    ".home-quickstart-heading h2",
    ".home-quickstart-steps h3",
    ".home-account-identity strong",
    ".device-header h1",
    ".profile-heading h1",
    ".profile-heading h2",
    ".profile-stage h2"
  ];

  for (const selector of selectors) {
    assert.match(
      findRule(stylesheet, selector),
      /color:\s*var\(--text-primary\)\s*;/,
      `${selector} must own --text-primary instead of inheriting it`
    );
  }
});

test("Task #96 page Skeleton uses site-theme tokens", async () => {
  const stylesheet = await readFile(STYLESHEET_PATH, "utf8");
  const shimmerRule = findRule(stylesheet, ".profile-loading-shimmer");
  const sheenRule = findRule(stylesheet, ".profile-loading-shimmer::after");

  assert.match(shimmerRule, /background:\s*var\(--page-skeleton-base\)\s*;/);
  assert.match(sheenRule, /var\(--page-skeleton-sheen-edge\)/);
  assert.match(sheenRule, /var\(--page-skeleton-sheen-center\)/);
  assert.doesNotMatch(shimmerRule, /--card-preview-placeholder/);
  assert.doesNotMatch(sheenRule, /--skeleton-sheen-(?:edge|center)/);
});

test("Task #96 card Skeleton exposes an explicit card-theme variant", async () => {
  const stylesheet = await readFile(STYLESHEET_PATH, "utf8");

  assert.match(stylesheet, /\.home-card-media\[data-card-theme=["']light["']\]\s*\{/);
  assert.match(
    findRule(stylesheet, '.home-card-media[data-card-theme="light"]'),
    /--card-preview-background:/
  );
});

test("Task #96 every shared card frame receives an explicit card theme", async () => {
  const sources = Object.fromEntries(await Promise.all(
    Object.entries(SOURCE_PATHS).map(async ([name, path]) => [
      name,
      await readFile(path, "utf8")
    ])
  ));

  assert.match(
    sources.marketing,
    /data-card-theme=\{normalizeCardTheme\(cardTheme\)\}/
  );
  assert.match(sources.home, /cardTheme=\{visibleCardSource\?\.kind/);
  assert.match(sources.cardProfile, /cardTheme=\{props\.cardSettingsState\.draftStyle/);
  assert.match(sources.publicProfile, /cardTheme=\{profile\.cardStyle\?\.theme/);
  assert.match(sources.publicIntro, /cardTheme=\{cardTheme\}/);
  assert.match(sources.shareStudio, /cardTheme=\{cardTheme\}/);
  assert.match(sources.loading, /cardTheme="dark"/);
});

test("Task #146 BorderBeam and card frame share one normalized card theme", async () => {
  const marketing = await readFile(SOURCE_PATHS.marketing, "utf8");

  assert.match(
    marketing,
    /const resolvedCardTheme = normalizeCardTheme\(cardTheme\);/
  );
  assert.match(
    marketing,
    /<BorderBeam[\s\S]*?theme=\{resolvedCardTheme\}[\s\S]*?<CardImageFrame[\s\S]*?cardTheme=\{resolvedCardTheme\}/
  );
  assert.match(
    marketing,
    /brightness=\{PROFILE_CARD_BORDER_BEAM_PRESET\.brightness\}[\s\S]*?colorVariant=\{PROFILE_CARD_BORDER_BEAM_PRESET\.colorVariant\}[\s\S]*?duration=\{PROFILE_CARD_BORDER_BEAM_PRESET\.durationSeconds\}[\s\S]*?size=\{PROFILE_CARD_BORDER_BEAM_PRESET\.size\}[\s\S]*?strength=\{PROFILE_CARD_BORDER_BEAM_PRESET\.strength\}/
  );
});

test("Task #96 theme transitions stay scoped away from dense content", async () => {
  const stylesheet = await readFile(STYLESHEET_PATH, "utf8");
  const surfaceAllowlist = findThemeSurfaceAllowlist(stylesheet);
  const requiredSurfaceSelectors = [
    ".account-status-dot",
    ".home-account-identity > img",
    ".home-account-identity > span",
    ".home-quickstart-access",
    ".home-quickstart-status",
    ".home-quickstart-steps li",
    ".profile-loading-shimmer",
    ".profile-loading-stats",
    ".profile-loading-stat + .profile-loading-stat::before",
    ".profile-loading-card",
    ".settings-token-list",
    ".settings-token-row"
  ];

  assert.doesNotMatch(
    stylesheet,
    /:root\[data-theme-animating\]\s+\*(?=\s*[,\{])/,
    "theme transitions must not fan out through a universal selector"
  );
  assert.match(
    stylesheet,
    /:root\[data-theme-animating\]\s+:where\([\s\S]*?\.home-quickstart-heading h2[\s\S]*?\.profile-heading h1[\s\S]*?\)\s*\{\s*transition:\s*color 240ms ease !important;/
  );
  assert.doesNotMatch(
    stylesheet,
    /:root\[data-theme-animating\]\s+\.token-cell\s*\{\s*transition:\s*none !important;/,
    "heatmap palette changes must retain their smooth background transition"
  );
  assert.match(
    findRule(stylesheet, ".token-cell"),
    /transition:\s*background-color 100ms cubic-bezier\(0\.2, 0, 0, 1\);/
  );
  for (const selector of requiredSurfaceSelectors) {
    assert.ok(
      surfaceAllowlist.includes(selector),
      `${selector} must participate in the bounded theme surface transition`
    );
  }
});

test("Task #96 inactive card Skeleton stops shimmer and leaves the DOM", async () => {
  const stylesheet = await readFile(STYLESHEET_PATH, "utf8");
  const marketing = await readFile(SOURCE_PATHS.marketing, "utf8");

  assert.doesNotMatch(
    findRule(stylesheet, ".home-card-skeleton::after"),
    /animation:\s*home-card-skeleton-progress/
  );
  assert.match(
    findRule(stylesheet, '.home-card-skeleton[data-active="true"]::after'),
    /animation:\s*home-card-skeleton-progress 1\.6s linear infinite;/
  );
  assert.match(marketing, /HOME_CARD_SKELETON_EXIT_DURATION_MS = 240/);
});

test("Task #96 Share handoff pauses the existing BorderBeam without restarting it", async () => {
  const stylesheet = await readFile(STYLESHEET_PATH, "utf8");
  const marketing = await readFile(SOURCE_PATHS.marketing, "utf8");

  assert.match(
    marketing,
    /<BorderBeam[\s\S]*?active=\{!busy && !prefersReducedMotion\}/
  );
  assert.doesNotMatch(
    marketing,
    /<BorderBeam[\s\S]*?active=\{[^}]*transitionSuspended[^}]*\}/
  );
  assert.match(
    stylesheet,
    /\.home-card-tilt\[data-share-transition-active="true"\] \.home-card-beam[\s\S]*?animation-play-state:\s*paused !important;/
  );
});

test("Task #96 card readiness preserves one Share source host", async () => {
  const marketing = await readFile(SOURCE_PATHS.marketing, "utf8");

  assert.match(
    marketing,
    /<hover-tilt[\s\S]*?data-tilt-enabled=\{enabled \? "true" : "false"\}/
  );
  assert.doesNotMatch(
    marketing,
    /if \(!enabled \|\| !ready\)[\s\S]*?<div[\s\S]*?home-card-tilt/
  );
  assert.match(marketing, /tilt-factor=\{enabled \? "0\.45" : "0"\}/);
  assert.match(marketing, /scale-factor=\{enabled \? "1\.018" : "1"\}/);
});

function findRule(stylesheet, selector) {
  let cursor = 0;
  const bodies = [];

  while (cursor < stylesheet.length) {
    const openingBrace = stylesheet.indexOf("{", cursor);
    if (openingBrace < 0) {
      break;
    }

    let depth = 1;
    let closingBrace = openingBrace + 1;
    while (closingBrace < stylesheet.length && depth > 0) {
      if (stylesheet[closingBrace] === "{") {
        depth += 1;
      } else if (stylesheet[closingBrace] === "}") {
        depth -= 1;
      }
      closingBrace += 1;
    }

    const heading = stylesheet
      .slice(cursor, openingBrace)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .trim();
    if (
      !heading.includes(":where(")
      && heading.split(",").some((candidate) => candidate.trim() === selector)
    ) {
      bodies.push(stylesheet.slice(openingBrace + 1, closingBrace - 1));
    }
    cursor = closingBrace;
  }

  assert.ok(bodies.length > 0, `Missing top-level CSS rule for ${selector}`);
  return bodies.join("\n");
}

function findThemeSurfaceAllowlist(stylesheet) {
  const match = stylesheet.match(
    /:root\[data-theme-animating\]\s+:where\(([\s\S]*?)\)\s*\{\s*transition:\s*background-color 240ms ease,\s*border-color 240ms ease !important;/
  );
  assert.ok(match, "Missing bounded theme surface transition rule");
  return match[1].split(",").map((selector) => selector.trim());
}
