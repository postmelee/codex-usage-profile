import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const PUBLIC_READMES = Object.freeze([
  Object.freeze({
    label: "GitHub README",
    url: new URL("../../README.md", import.meta.url)
  }),
  Object.freeze({
    label: "npm README",
    url: new URL(
      "../../packages/codex-usage-profile-cli/README.md",
      import.meta.url
    )
  })
]);

const INTERNAL_TERMS = Object.freeze([
  /\bstage5\b/i,
  /\bunpublished\b/i,
  /\b(?:release|deployment) candidate\b/i,
  /\bproduction migration\b/i,
  /\bGate\s+[A-Z](?:\d+)?\b/,
  /custom service origins?/i,
  /--server\b/i,
  /CODEX_USAGE_PROFILE_URL/
]);

test("public READMEs keep internal deployment details out of the user journey", async () => {
  for (const surface of PUBLIC_READMES) {
    const markdown = await readFile(surface.url, "utf8");
    for (const pattern of INTERNAL_TERMS) {
      assert.equal(
        pattern.test(markdown),
        false,
        `${surface.label} contains internal copy matching ${pattern}`
      );
    }
    assert.match(
      markdown,
      /https:\/\/codex-usage-profile\.meleeisdeveloping\.chatgpt\.site/
    );
    assert.match(markdown, /npx codex-usage-profile@latest submit/);
  }
});

test("npm README discloses the optional star prompt without an implementation section", async () => {
  const markdown = await readFile(PUBLIC_READMES[1].url, "utf8");
  assert.match(
    markdown,
    /Declining does not affect submission, and the prompt is skipped in CI and non-interactive runs\./
  );
  assert.equal(markdown.includes("## Optional GitHub Star Prompt"), false);
});
