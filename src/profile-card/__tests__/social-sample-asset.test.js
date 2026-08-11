import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadImage } from "@napi-rs/canvas";

import { renderProfileSocialCardPng } from "../renderer.js";
import {
  SOCIAL_OUTPUT_HEIGHT,
  SOCIAL_OUTPUT_WIDTH
} from "../social-canvas.js";
import { buildCardViewModel } from "../view-model.js";
import {
  SAMPLE_CARD_TODAY_ISO,
  sampleAccountUsageReadResult,
  sampleCardOwner
} from "../fixtures/sample-account-usage.js";

const AVATAR_URL = new URL(
  "../../../public/assets/postmelee-avatar.png",
  import.meta.url
);
const SAMPLE_URL = new URL(
  "../../../public/assets/codex-social-sample.png",
  import.meta.url
);

test("packaged social sample is the deterministic 2400x1260 renderer output", async () => {
  const [actual, avatarSource] = await Promise.all([
    readFile(SAMPLE_URL),
    readFile(AVATAR_URL)
  ]);
  const viewModel = buildCardViewModel({
    locale: "ko",
    owner: sampleCardOwner,
    todayIso: SAMPLE_CARD_TODAY_ISO,
    usage: sampleAccountUsageReadResult
  });
  const expected = await renderProfileSocialCardPng(viewModel, {
    avatarSource,
    theme: "dark"
  });
  const image = await loadImage(actual);

  assert.equal(actual.equals(expected), true);
  assert.equal(image.width, SOCIAL_OUTPUT_WIDTH);
  assert.equal(image.height, SOCIAL_OUTPUT_HEIGHT);
  assert.equal(image.width, 2400);
  assert.equal(image.height, 1260);
});
