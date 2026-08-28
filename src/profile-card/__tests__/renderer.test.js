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
const AVATAR_SOURCE = readFileSync(
  new URL("../../../public/assets/postmelee-avatar.png", import.meta.url)
);

test("renders the Codex share card as a 1497x918 PNG", async () => {
  const viewModel = buildCardViewModel({
    locale: "ko",
    owner: sampleCardOwner,
    todayIso: SAMPLE_CARD_TODAY_ISO,
    usage: sampleAccountUsageReadResult
  });
  const png = await renderProfileCardPng(viewModel, {
    avatarSource: AVATAR_SOURCE
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

test("keeps native standalone alpha geometry identical across themes", async () => {
  const viewModel = buildCardViewModel({
    locale: "ko",
    owner: sampleCardOwner,
    todayIso: SAMPLE_CARD_TODAY_ISO,
    usage: sampleAccountUsageReadResult
  });
  const [lightPng, darkPng] = await Promise.all([
    renderProfileCardPng(viewModel, {
      avatarSource: AVATAR_SOURCE,
      theme: "light"
    }),
    renderProfileCardPng(viewModel, {
      avatarSource: AVATAR_SOURCE,
      theme: "dark"
    })
  ]);
  const [lightContext, darkContext] = await Promise.all([
    drawToContext(lightPng),
    drawToContext(darkPng)
  ]);

  assert.deepEqual(
    [lightContext.canvas.width, lightContext.canvas.height],
    [darkContext.canvas.width, darkContext.canvas.height]
  );
  assert.equal(countAlphaDifferences(lightContext, darkContext), 0);
  assert.notDeepEqual(
    readLogicalPixel(lightContext, 249.5, 153),
    readLogicalPixel(darkContext, 249.5, 153)
  );
});

async function drawToContext(png) {
  const image = await loadImage(png);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  return context;
}

function countAlphaDifferences(left, right) {
  const leftData = left.getImageData(
    0,
    0,
    left.canvas.width,
    left.canvas.height
  ).data;
  const rightData = right.getImageData(
    0,
    0,
    right.canvas.width,
    right.canvas.height
  ).data;
  let differences = 0;

  for (let offset = 3; offset < leftData.length; offset += 4) {
    if (leftData[offset] !== rightData[offset]) differences += 1;
  }
  return differences;
}

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
