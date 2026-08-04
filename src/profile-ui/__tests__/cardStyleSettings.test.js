import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SOURCE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("card appearance exposes independent native theme and language controls", async () => {
  const source = await readFile(join(SOURCE_ROOT, "CardStyleSettings.jsx"), "utf8");

  assert.match(source, /<fieldset className="card-style-option-group">/u);
  assert.match(source, /const THEME_OPTIONS = Object\.freeze\(\["dark", "light"\]\)/u);
  assert.match(source, /const LOCALE_OPTIONS = Object\.freeze\(\["en", "ko"\]\)/u);
  assert.match(source, /name="card-theme"/u);
  assert.match(source, /name="card-locale"/u);
  assert.match(source, /type="radio"/u);
  assert.match(source, /href="\/\?view=settings"/u);
});

test("profile preview and save use draft card settings without site theme coupling", async () => {
  const source = await readFile(join(SOURCE_ROOT, "CardProfilePage.jsx"), "utf8");

  assert.match(source, /locale: draftLocale/u);
  assert.match(source, /theme: draftStyle\?\.theme \?\? "dark"/u);
  assert.match(source, /client\.updateCardSettings\(draftStyle, draftLocale\)/u);
  assert.doesNotMatch(source, /useTheme/u);
});

test("profile share saves dirty card settings before opening Share Studio", async () => {
  const source = await readFile(join(SOURCE_ROOT, "CardProfilePage.jsx"), "utf8");

  assert.match(source, /async function openShare\(\)/u);
  assert.match(source, /const nextProfile = await saveCardSettings\(\)/u);
  assert.match(source, /if \(!nextProfile\) return/u);
  assert.match(source, /profile\.card\.settings\.saveAndShare/u);
  assert.match(source, /disabled=\{isSubmitting \|\| cardSettingsSaving\}/u);
});

test("home owner card and share studio use the saved card selection", async () => {
  const source = await readFile(join(SOURCE_ROOT, "HomePage.jsx"), "utf8");

  assert.match(source, /const cardLocale = profile\?\.cardLocale \?\? "en"/u);
  assert.match(source, /const cardTheme = profile\?\.cardStyle\?\.theme \?\? "dark"/u);
  assert.match(source, /publicCardUrl=\{profile\?\.selectedPublicCardUrl/u);
  assert.doesNotMatch(source, /useTheme/u);
});

test("share studio keeps product copy locale separate from saved card locale", async () => {
  const source = await readFile(join(SOURCE_ROOT, "ShareStudio.jsx"), "utf8");

  assert.match(source, /getShareStudioCopy\(locale\)/u);
  assert.match(source, /buildLocalizedCardUrl\(publicCardUrl, cardLocale \?\? locale\)/u);
});
