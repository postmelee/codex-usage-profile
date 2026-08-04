import assert from "node:assert/strict";
import test from "node:test";

import {
  CARD_PRESENTATION_REGISTRY,
  CARD_STYLE_MAX_BYTES,
  DEFAULT_CARD_STYLE,
  createPresentationDigest,
  normalizeCardStyle,
  serializeCardStyle
} from "../presentation.js";

test("cardStyle defaults legacy records to canonical dark/none", () => {
  assert.deepEqual(normalizeCardStyle(undefined), DEFAULT_CARD_STYLE);
  assert.equal(
    serializeCardStyle(DEFAULT_CARD_STYLE),
    '{"effect":{"preset":"none","version":1},"schemaVersion":1,"theme":"dark"}'
  );
  assert.equal(CARD_PRESENTATION_REGISTRY.themes.light.staticRenderer, true);
  assert.equal(CARD_PRESENTATION_REGISTRY.effects.none.animatedExport, null);
});

test("cardStyle accepts the registered light presentation", async () => {
  const style = normalizeCardStyle({
    theme: "light",
    effect: { version: 1, preset: "none" },
    schemaVersion: 1
  });
  assert.deepEqual(style, {
    schemaVersion: 1,
    theme: "light",
    effect: { preset: "none", version: 1 }
  });
  assert.equal(await createPresentationDigest(style), await createPresentationDigest({
    effect: { preset: "none", version: 1 },
    schemaVersion: 1,
    theme: "light"
  }));
});

test("cardStyle rejects unknown versions, presets, fields and oversized JSON", () => {
  const base = structuredClone(DEFAULT_CARD_STYLE);
  assert.throws(
    () => normalizeCardStyle({ ...base, schemaVersion: 2 }),
    /schemaVersion/u
  );
  assert.throws(
    () => normalizeCardStyle({ ...base, theme: "system" }),
    /theme/u
  );
  assert.throws(
    () => normalizeCardStyle({
      ...base,
      effect: { preset: "beam.rotate", version: 1 }
    }),
    /effect/u
  );
  assert.throws(
    () => normalizeCardStyle({ ...base, css: "display:none" }),
    /unsupported fields/u
  );
  assert.throws(
    () => normalizeCardStyle({
      ...base,
      padding: "x".repeat(CARD_STYLE_MAX_BYTES)
    }),
    /maximum size/u
  );
  assert.throws(
    () => normalizeCardStyle(undefined, { defaultWhenMissing: false }),
    /required/u
  );
});
