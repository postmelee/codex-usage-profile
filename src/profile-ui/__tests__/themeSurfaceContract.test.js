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

test("Task #96 theme transitions stay scoped away from dense content", async () => {
  const stylesheet = await readFile(STYLESHEET_PATH, "utf8");

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
  assert.match(marketing, /if \(!active && !retained\) \{\s*return null;/);
});

function findRule(stylesheet, selector) {
  const bodies = Array.from(stylesheet.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    .filter((match) => match[1].split(",").some((candidate) => (
      candidate.trim() === selector
    )))
    .map((match) => match[2]);
  assert.ok(bodies.length > 0, `Missing CSS rule for ${selector}`);
  return bodies.join("\n");
}
