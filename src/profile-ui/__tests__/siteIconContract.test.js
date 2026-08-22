import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const HTML_FILES = ["index.html", "sites.html"];
const ICON_LINKS = [
  '<link rel="icon" href="/favicon.ico" />',
  '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />',
  '<link rel="icon" type="image/png" sizes="512x512" href="/site-icon-512.png" />',
  '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />'
];

test("all browser entry documents declare the production Site icons", async () => {
  for (const file of HTML_FILES) {
    const html = await readFile(new URL(`../../../${file}`, import.meta.url), "utf8");
    for (const link of ICON_LINKS) {
      assert.equal(html.includes(link), true, `${file} is missing ${link}`);
    }
  }
});

test("favicon assets use the expected formats and square dimensions", async () => {
  const ico = await readFile(new URL("../../../public/favicon.ico", import.meta.url));
  assert.deepEqual([...ico.subarray(0, 6)], [0, 0, 1, 0, 1, 0]);

  for (const [file, size] of [
    ["favicon-32x32.png", 32],
    ["apple-touch-icon.png", 180],
    ["site-icon-512.png", 512]
  ]) {
    const png = await readFile(new URL(`../../../public/${file}`, import.meta.url));
    assert.deepEqual(
      [...png.subarray(0, 8)],
      [137, 80, 78, 71, 13, 10, 26, 10]
    );
    assert.equal(png.readUInt32BE(16), size, `${file} width`);
    assert.equal(png.readUInt32BE(20), size, `${file} height`);
  }
});

test("sample-only marketing artifact copies and verifies only the approved icons", async () => {
  const [config, plugin, verifier] = await Promise.all([
    readFile(new URL("../../../vite.sites.config.js", import.meta.url), "utf8"),
    readFile(new URL("../../../build/sites-vite-plugin.js", import.meta.url), "utf8"),
    readFile(
      new URL("../../../scripts/verify-marketing-artifact.mjs", import.meta.url),
      "utf8"
    )
  ]);

  assert.match(config, /publicDir:\s*false/);
  for (const file of [
    "apple-touch-icon.png",
    "favicon-32x32.png",
    "favicon.ico",
    "site-icon-512.png"
  ]) {
    assert.equal(plugin.includes(`"${file}"`), true, `plugin omits ${file}`);
    assert.equal(
      verifier.includes(`"client/${file}"`),
      true,
      `verifier omits client/${file}`
    );
  }
});
