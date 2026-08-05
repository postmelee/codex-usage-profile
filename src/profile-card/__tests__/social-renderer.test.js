import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createCanvas, loadImage } from "@napi-rs/canvas";

import { renderProfileSocialCardPng } from "../renderer.js";
import {
  SOCIAL_CANVAS_HEIGHT,
  SOCIAL_CANVAS_WIDTH,
  computeSocialCanvasLayout
} from "../social-canvas.js";
import { CARD_THEME_PALETTES } from "../theme.js";
import { buildCardViewModel } from "../view-model.js";
import {
  SAMPLE_CARD_TODAY_ISO,
  sampleAccountUsageReadResult,
  sampleCardOwner
} from "../fixtures/sample-account-usage.js";
import {
  createWorkerProfileCardSvg,
  createWorkerProfileSocialCardSvg
} from "../worker-renderer.js";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const AVATAR_SOURCE = readFileSync(
  new URL("../../../public/assets/postmelee-avatar.png", import.meta.url)
);

function createViewModel(locale = "ko") {
  return buildCardViewModel({
    locale,
    owner: sampleCardOwner,
    todayIso: SAMPLE_CARD_TODAY_ISO,
    usage: sampleAccountUsageReadResult
  });
}

test("renders the social card as a 1200x630 PNG", async () => {
  const png = await renderProfileSocialCardPng(createViewModel(), {
    avatarSource: AVATAR_SOURCE
  });

  assert.equal(png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE), true);

  const image = await loadImage(png);
  assert.equal(image.width, SOCIAL_CANVAS_WIDTH);
  assert.equal(image.height, SOCIAL_CANVAS_HEIGHT);
});

test("keeps the safe area filled with the theme background", async () => {
  const layout = computeSocialCanvasLayout();
  const png = await renderProfileSocialCardPng(createViewModel(), {
    avatarSource: AVATAR_SOURCE,
    theme: "light"
  });
  const image = await loadImage(png);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);

  const expected = rgba(CARD_THEME_PALETTES.light.background);
  assert.deepEqual(readPixel(context, 4, 4), expected);
  assert.deepEqual(
    readPixel(context, layout.canvasWidth - 4, layout.canvasHeight - 4),
    expected
  );
  assert.deepEqual(
    readPixel(context, Math.round(layout.cardX / 2), layout.canvasHeight / 2),
    expected
  );
});

test("draws card content inside the placed card area", async () => {
  const layout = computeSocialCanvasLayout();
  const png = await renderProfileSocialCardPng(createViewModel(), {
    avatarSource: AVATAR_SOURCE,
    theme: "dark"
  });
  const image = await loadImage(png);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);

  const heatmapX = Math.round(layout.cardX + (layout.scale * 40));
  const heatmapY = Math.round(layout.cardY + (layout.scale * 150));
  const background = rgba(CARD_THEME_PALETTES.dark.background);

  assert.notDeepEqual(readPixel(context, heatmapX, heatmapY), background);
});

test("renders deterministic bytes for the same input", async () => {
  const first = await renderProfileSocialCardPng(createViewModel(), {
    avatarSource: AVATAR_SOURCE
  });
  const second = await renderProfileSocialCardPng(createViewModel(), {
    avatarSource: AVATAR_SOURCE
  });

  assert.equal(Buffer.from(first).equals(Buffer.from(second)), true);
});

test("worker social svg uses the shared canvas layout", () => {
  const layout = computeSocialCanvasLayout();
  const svg = createWorkerProfileSocialCardSvg(createViewModel(), {
    theme: "dark"
  });

  assert.ok(svg.startsWith(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.canvasWidth}"`
  ));
  assert.ok(svg.includes(
    ` height="${layout.canvasHeight}" viewBox="0 0 ${layout.canvasWidth}`
  ));
  assert.ok(svg.includes(
    `<g transform="translate(${layout.cardX} ${layout.cardY}) scale(${layout.scale})">`
  ));
  assert.ok(svg.endsWith("</g></svg>"));
});

test("worker social svg reuses the card body markup unchanged", () => {
  const viewModel = createViewModel();
  const card = createWorkerProfileCardSvg(viewModel, { theme: "dark" });
  const social = createWorkerProfileSocialCardSvg(viewModel, { theme: "dark" });
  const body = card
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "");

  assert.ok(social.includes(body));
});

test("worker card svg keeps its original dimensions", () => {
  const svg = createWorkerProfileCardSvg(createViewModel(), { theme: "dark" });

  assert.ok(svg.includes('width="499"'));
  assert.ok(svg.includes('height="306" viewBox="0 0 499 306"'));
  assert.ok(svg.endsWith("</svg>"));
});

function readPixel(context, x, y) {
  const { data } = context.getImageData(Math.round(x), Math.round(y), 1, 1);
  return [data[0], data[1], data[2], data[3]];
}

function rgba(hex) {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
    255
  ];
}
