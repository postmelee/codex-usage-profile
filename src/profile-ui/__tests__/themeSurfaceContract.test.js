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

test("Task #96 primary headings own their semantic text color", {
  todo: "Stage 2 assigns semantic color directly to inherited headings"
}, async () => {
  const stylesheet = await readFile(STYLESHEET_PATH, "utf8");
  const selectors = [
    ".home-quickstart-heading h2",
    ".home-quickstart-steps h3",
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

test("Task #96 page Skeleton uses site-theme tokens", {
  todo: "Stage 3 separates page Skeleton tokens from dark card tokens"
}, async () => {
  const stylesheet = await readFile(STYLESHEET_PATH, "utf8");
  const shimmerRule = findRule(stylesheet, ".profile-loading-shimmer");
  const sheenRule = findRule(stylesheet, ".profile-loading-shimmer::after");

  assert.match(shimmerRule, /background:\s*var\(--page-skeleton-base\)\s*;/);
  assert.match(sheenRule, /var\(--page-skeleton-sheen-edge\)/);
  assert.match(sheenRule, /var\(--page-skeleton-sheen-center\)/);
  assert.doesNotMatch(shimmerRule, /--card-preview-placeholder/);
  assert.doesNotMatch(sheenRule, /--skeleton-sheen-(?:edge|center)/);
});

test("Task #96 card Skeleton exposes an explicit card-theme variant", {
  todo: "Stage 3 keeps card Skeleton palette independent from site theme"
}, async () => {
  const stylesheet = await readFile(STYLESHEET_PATH, "utf8");

  assert.match(stylesheet, /\.home-card-media\[data-card-theme=["']light["']\]\s*\{/);
  assert.match(
    findRule(stylesheet, '.home-card-media[data-card-theme="light"]'),
    /--card-preview-background:/
  );
});

function findRule(stylesheet, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = stylesheet.match(new RegExp(
    `(?:^|\\n)(?:[^{}]+,\\s*\\n)*\\s*${escapedSelector}(?:,\\s*\\n[^{}]+)*\\s*\\{([^}]*)\\}`,
    "m"
  ));
  assert.ok(match, `Missing CSS rule for ${selector}`);
  return match[1];
}
