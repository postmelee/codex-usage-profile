import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createCanvas, loadImage } from "@napi-rs/canvas";

import { renderProfileSocialCardPng } from "../renderer.js";
import {
  SOCIAL_CANVAS_HEIGHT,
  SOCIAL_CANVAS_WIDTH,
  SOCIAL_OUTPUT_HEIGHT,
  SOCIAL_OUTPUT_SCALE,
  SOCIAL_OUTPUT_WIDTH,
  SOCIAL_LIGHT_BORDER_COLOR,
  SOCIAL_LIGHT_CANVAS_COLOR,
  computeSocialCanvasLayout,
  getSocialCanvasSurface
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

test("renders the social card at twice the 1200x630 layout", async () => {
  const png = await renderProfileSocialCardPng(createViewModel(), {
    avatarSource: AVATAR_SOURCE
  });

  assert.equal(png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE), true);

  const image = await loadImage(png);
  assert.equal(image.width, SOCIAL_OUTPUT_WIDTH);
  assert.equal(image.height, SOCIAL_OUTPUT_HEIGHT);
  assert.equal(SOCIAL_OUTPUT_WIDTH, SOCIAL_CANVAS_WIDTH * SOCIAL_OUTPUT_SCALE);
  assert.equal(SOCIAL_OUTPUT_HEIGHT, SOCIAL_CANVAS_HEIGHT * SOCIAL_OUTPUT_SCALE);
});

test("fills only the light social padding with the neutral canvas", async () => {
  const layout = computeSocialCanvasLayout();
  const png = await renderProfileSocialCardPng(createViewModel(), {
    avatarSource: AVATAR_SOURCE,
    theme: "light"
  });
  const context = await drawToContext(png);
  const background = rgba(SOCIAL_LIGHT_CANVAS_COLOR);

  assert.deepEqual(readPixel(context, 4, 4), background);
  assert.deepEqual(
    readPixel(context, layout.canvasWidth - 4, layout.canvasHeight - 4),
    background
  );
  assert.deepEqual(
    readPixel(context, Math.round(layout.cardX / 2), layout.canvasHeight / 2),
    background
  );
});

test("draws the light outline inside the unchanged card bounds", async () => {
  const layout = computeSocialCanvasLayout();
  const surface = getSocialCanvasSurface("light", layout);
  const png = await renderProfileSocialCardPng(createViewModel(), {
    avatarSource: AVATAR_SOURCE,
    theme: "light"
  });
  const context = await drawToContext(png);

  assert.deepEqual(
    readPixel(context, layout.cardX + 1, layout.cardY + 1),
    rgba(SOCIAL_LIGHT_CANVAS_COLOR)
  );
  assert.deepEqual(
    readPixel(
      context,
      surface.outline.x,
      layout.canvasHeight / 2
    ),
    rgba(SOCIAL_LIGHT_BORDER_COLOR)
  );
  assert.deepEqual(
    readPixel(context, layout.cardX + 2, layout.canvasHeight / 2),
    rgba(CARD_THEME_PALETTES.light.background)
  );
  assert.deepEqual(
    findChangedBounds(context, rgba(SOCIAL_LIGHT_CANVAS_COLOR)),
    { maxX: 2159, maxY: 1218, minX: 240, minY: 41 }
  );
});

test("keeps dark social padding and rounded corners transparent", async () => {
  const layout = computeSocialCanvasLayout();
  const png = await renderProfileSocialCardPng(createViewModel(), {
    avatarSource: AVATAR_SOURCE,
    theme: "dark"
  });
  const context = await drawToContext(png);

  assert.equal(readPixel(context, 4, 4)[3], 0);
  assert.equal(readPixel(context, layout.cardX / 2, layout.canvasHeight / 2)[3], 0);
  assert.equal(readPixel(context, layout.cardX + 1, layout.cardY + 1)[3], 0);
  assert.equal(
    readPixel(
      context,
      layout.cardX + layout.cardWidth - 2,
      layout.cardY + layout.cardHeight - 2
    )[3],
    0
  );
});

test("draws card content inside the placed card area", async () => {
  const layout = computeSocialCanvasLayout();
  const png = await renderProfileSocialCardPng(createViewModel(), {
    avatarSource: AVATAR_SOURCE,
    theme: "dark"
  });
  const context = await drawToContext(png);

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
  assert.ok(!/<svg[^>]*><rect/.test(svg));
});

test("worker light social svg orders the surface, card, and outline", () => {
  const layout = computeSocialCanvasLayout();
  const surface = getSocialCanvasSurface("light", layout);
  const svg = createWorkerProfileSocialCardSvg(createViewModel(), {
    theme: "light"
  });
  const background = `<rect width="${layout.canvasWidth}"` +
    ` height="${layout.canvasHeight}" fill="${SOCIAL_LIGHT_CANVAS_COLOR}"/>`;
  const group = `<g transform="translate(${layout.cardX} ${layout.cardY})` +
    ` scale(${layout.scale})">`;
  const outline = `<rect x="${surface.outline.x}" y="${surface.outline.y}"` +
    ` width="${surface.outline.width}" height="${surface.outline.height}"` +
    ` rx="${surface.outline.radius}" fill="none"` +
    ` stroke="${SOCIAL_LIGHT_BORDER_COLOR}" stroke-width="1"/>`;

  assert.ok(svg.indexOf(background) > 0);
  assert.ok(svg.indexOf(group) > svg.indexOf(background));
  assert.ok(svg.indexOf(outline) > svg.indexOf(group));
  assert.ok(svg.endsWith(`${outline}</svg>`));
});

test("worker social svg reuses the card body markup unchanged", () => {
  for (const theme of ["dark", "light"]) {
    const viewModel = createViewModel();
    const card = createWorkerProfileCardSvg(viewModel, { theme });
    const social = createWorkerProfileSocialCardSvg(viewModel, { theme });
    const body = card
      .replace(/^<svg[^>]*>/, "")
      .replace(/<\/svg>$/, "");

    assert.ok(social.includes(body));
  }
});

test("worker card svg keeps its original dimensions", () => {
  const svg = createWorkerProfileCardSvg(createViewModel(), { theme: "dark" });

  assert.ok(svg.includes('width="499"'));
  assert.ok(svg.includes('height="306" viewBox="0 0 499 306"'));
  assert.ok(svg.endsWith("</svg>"));
});

async function drawToContext(png) {
  const image = await loadImage(png);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  return context;
}

// Coordinates are layout units; the rendered PNG is SOCIAL_OUTPUT_SCALE times
// larger, so reads are mapped into output pixels here.
function readPixel(context, x, y) {
  const { data } = context.getImageData(
    Math.round(x * SOCIAL_OUTPUT_SCALE),
    Math.round(y * SOCIAL_OUTPUT_SCALE),
    1,
    1
  );
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

function findChangedBounds(context, background) {
  const { height, width } = context.canvas;
  const { data } = context.getImageData(0, 0, width, height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = ((y * width) + x) * 4;
      if (
        data[offset] === background[0] &&
        data[offset + 1] === background[1] &&
        data[offset + 2] === background[2] &&
        data[offset + 3] === background[3]
      ) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  return { maxX, maxY, minX, minY };
}
