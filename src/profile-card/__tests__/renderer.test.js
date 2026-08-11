import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createCanvas, loadImage } from "@napi-rs/canvas";

import {
  CARD_COLORS,
  CARD_OUTPUT_HEIGHT,
  CARD_OUTPUT_SCALE,
  CARD_OUTPUT_WIDTH,
  renderProfileCardPng
} from "../renderer.js";
import { CARD_THEME_PALETTES } from "../theme.js";
import { buildCardViewModel } from "../view-model.js";
import {
  SAMPLE_CARD_TODAY_ISO,
  sampleAccountUsageReadResult,
  sampleCardOwner
} from "../fixtures/sample-account-usage.js";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

test("renders the Codex share card as a 1497x918 PNG", async () => {
  const viewModel = buildCardViewModel({
    locale: "ko",
    owner: sampleCardOwner,
    todayIso: SAMPLE_CARD_TODAY_ISO,
    usage: sampleAccountUsageReadResult
  });
  const png = await renderProfileCardPng(viewModel, {
    avatarSource: readFileSync(new URL("../../../public/assets/postmelee-avatar.png", import.meta.url))
  });

  assert.equal(png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE), true);

  const image = await loadImage(png);
  assert.equal(image.width, CARD_OUTPUT_WIDTH);
  assert.equal(image.height, CARD_OUTPUT_HEIGHT);

  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);

  assert.deepEqual(readLogicalPixel(context, 249.5, 153), rgba(CARD_COLORS.background));
  assert.equal(readLogicalPixel(context, 0, 0)[3], 0);
  assert.deepEqual(readLogicalPixel(context, 39, 103), rgba("#2f2f2f"));
  assert.deepEqual(readLogicalPixel(context, 308.5, 187.5), rgba("#339cff"));
  assert.deepEqual(readLogicalPixel(context, 140.5, 250), rgba(CARD_COLORS.divider));
  assert.notDeepEqual(readLogicalPixel(context, 57, 57), rgba(CARD_COLORS.background));
  assert.notDeepEqual(readLogicalPixel(context, 79, 58), rgba(CARD_COLORS.background));
  assert.deepEqual(readLogicalPixel(context, 81, 58), rgba(CARD_COLORS.background));
  assert.deepEqual(readLogicalPixel(context, 385, 58), rgba(CARD_COLORS.background));
  assert.deepEqual(readLogicalPixel(context, 442.5, 49.5), rgba(CARD_COLORS.secondary));
});

test("keeps long translated labels inside fixed stat columns", async () => {
  const viewModel = buildCardViewModel({
    owner: {
      ...sampleCardOwner,
      displayName: "A very long international display name that must fit"
    },
    todayIso: SAMPLE_CARD_TODAY_ISO,
    usage: sampleAccountUsageReadResult
  });
  viewModel.stats = viewModel.stats.map((stat) => ({
    ...stat,
    label: "Extremely long localized statistic label"
  }));

  const png = await renderProfileCardPng(viewModel);
  const image = await loadImage(png);

  assert.equal(image.width, CARD_OUTPUT_WIDTH);
  assert.equal(image.height, CARD_OUTPUT_HEIGHT);
});

test("renders the owner preview with the selected light palette", async () => {
  const viewModel = buildCardViewModel({
    locale: "en",
    owner: sampleCardOwner,
    theme: "light",
    todayIso: SAMPLE_CARD_TODAY_ISO,
    usage: sampleAccountUsageReadResult
  });
  const png = await renderProfileCardPng(viewModel);
  const image = await loadImage(png);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);

  assert.deepEqual(
    readLogicalPixel(context, 249.5, 153),
    rgba(CARD_THEME_PALETTES.light.background)
  );
  assert.deepEqual(
    readLogicalPixel(context, 39, 103),
    rgba(CARD_THEME_PALETTES.light.heatmap[0])
  );
  assert.deepEqual(
    readLogicalPixel(context, 140.5, 250),
    rgba(CARD_THEME_PALETTES.light.divider)
  );
});

function readPixel(context, x, y) {
  return Array.from(context.getImageData(x, y, 1, 1).data);
}

function readLogicalPixel(context, x, y) {
  return readPixel(
    context,
    Math.round(x * CARD_OUTPUT_SCALE),
    Math.round(y * CARD_OUTPUT_SCALE)
  );
}

function rgba(hex) {
  const normalized = hex.slice(1);
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
    255
  ];
}
