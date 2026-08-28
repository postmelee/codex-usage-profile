import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createCanvas, loadImage } from "@napi-rs/canvas";

import {
  CARD_OUTPUT_HEIGHT,
  CARD_OUTPUT_WIDTH,
  CARD_RENDERER_VERSION,
  renderProfileCardPng
} from "../renderer.js";
import {
  WORKER_CARD_RENDERER_VERSION,
  createWorkerProfileCardRenderer,
  createWorkerProfileCardSvg
} from "../worker-renderer.js";
import {
  createProfileCardSourceDigest
} from "../service-core.js";
import {
  SOCIAL_OUTPUT_HEIGHT,
  SOCIAL_OUTPUT_SCALE,
  SOCIAL_OUTPUT_WIDTH,
  SOCIAL_LIGHT_BORDER_COLOR,
  SOCIAL_LIGHT_CANVAS_COLOR,
  computeSocialCanvasLayout
} from "../social-canvas.js";
import { CARD_THEME_PALETTES } from "../theme.js";
import { buildCardViewModel } from "../view-model.js";
import {
  SAMPLE_CARD_TODAY_ISO,
  sampleAccountUsageReadResult,
  sampleCardOwner
} from "../fixtures/sample-account-usage.js";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const avatar = readFileSync(new URL(
  "../../../public/assets/postmelee-avatar.png",
  import.meta.url
));
const renderWorkerPng = createWorkerProfileCardRenderer({
  fontBuffers: [
    readFileSync(new URL("../assets/noto-sans-kr-korean-400.bin", import.meta.url)),
    readFileSync(new URL("../assets/noto-sans-kr-korean-600.bin", import.meta.url)),
    readFileSync(new URL("../assets/noto-sans-kr-latin-400.bin", import.meta.url)),
    readFileSync(new URL("../assets/noto-sans-kr-latin-600.bin", import.meta.url))
  ],
  wasmModule: readFileSync(new URL(
    "../../../node_modules/@resvg/resvg-wasm/index_bg.wasm",
    import.meta.url
  ))
});

test("renders deterministic 1497x918 en and ko PNGs without filesystem font lookup", async () => {
  for (const locale of ["en", "ko"]) {
    const viewModel = createViewModel(locale);
    const first = await renderWorkerPng(viewModel, { avatarSource: avatar });
    const second = await renderWorkerPng(viewModel, { avatarSource: avatar });
    const image = await loadImage(first);

    assert.equal(Buffer.from(first).subarray(0, 8).equals(PNG_SIGNATURE), true);
    assert.equal(image.width, CARD_OUTPUT_WIDTH);
    assert.equal(image.height, CARD_OUTPUT_HEIGHT);
    assert.deepEqual(first, second);
    assert.equal(digest(first), digest(second));
  }
});

test("reuses the native view model information and keeps locale text in Worker SVG", () => {
  const english = createViewModel("en");
  const korean = createViewModel("ko");
  const englishSvg = createWorkerProfileCardSvg(english);
  const koreanSvg = createWorkerProfileCardSvg(korean);

  for (const value of [
    english.header.displayName,
    english.header.username,
    ...english.stats.flatMap((stat) => [stat.value, stat.label])
  ]) {
    assert.match(englishSvg, new RegExp(escapeRegExp(value)));
  }
  assert.match(koreanSvg, /누적 토큰/);
  assert.match(koreanSvg, /현재 연속 기록/);
  assert.match(koreanSvg, /7일/);
  assert.doesNotMatch(koreanSvg, /href="data:image/);
});

test("keeps native and Worker dimensions while selecting a distinct renderer digest", async () => {
  const viewModel = createViewModel("ko");
  const native = await renderProfileCardPng(viewModel, { avatarSource: avatar });
  const worker = await renderWorkerPng(viewModel, { avatarSource: avatar });
  const [nativeImage, workerImage] = await Promise.all([
    loadImage(native),
    loadImage(worker)
  ]);

  assert.deepEqual(
    [nativeImage.width, nativeImage.height],
    [workerImage.width, workerImage.height]
  );
  assert.notEqual(digest(native), digest(worker));

  const baseDigestOptions = {
    locale: "ko",
    owner: sampleCardOwner,
    usage: sampleAccountUsageReadResult,
    usageRecord: {
      capturedAt: "2026-07-24T00:00:00.000Z",
      uploadedAt: "2026-07-24T00:00:01.000Z"
    }
  };
  const previousDigest = createProfileCardSourceDigest({
    ...baseDigestOptions,
    rendererVersion: "codex-share-card-2-resvg-wasm-1"
  });
  const nativeDigest = createProfileCardSourceDigest({
    ...baseDigestOptions,
    rendererVersion: CARD_RENDERER_VERSION
  });
  const workerDigest = createProfileCardSourceDigest({
    ...baseDigestOptions,
    rendererVersion: WORKER_CARD_RENDERER_VERSION
  });

  assert.equal(WORKER_CARD_RENDERER_VERSION, "codex-share-card-3-resvg-wasm-1");
  assert.notEqual(previousDigest, workerDigest);
  assert.notEqual(nativeDigest, workerDigest);
});

test("embeds supported avatar bytes and falls back for invalid image bytes", () => {
  const viewModel = createViewModel("en");
  const embedded = createWorkerProfileCardSvg(viewModel, {
    avatarSource: avatar
  });
  const fallback = createWorkerProfileCardSvg(viewModel, {
    avatarSource: Buffer.from("not-an-image")
  });

  assert.match(embedded, /href="data:image\/png;base64,/);
  assert.doesNotMatch(fallback, /href="data:image/);
  assert.match(fallback, />p<\/text>/i);
});

test("uses the same semantic light palette in Worker SVG", () => {
  const viewModel = buildCardViewModel({
    locale: "en",
    owner: sampleCardOwner,
    theme: "light",
    todayIso: SAMPLE_CARD_TODAY_ISO,
    usage: sampleAccountUsageReadResult
  });
  const svg = createWorkerProfileCardSvg(viewModel);

  for (const color of [
    CARD_THEME_PALETTES.light.background,
    CARD_THEME_PALETTES.light.primary,
    CARD_THEME_PALETTES.light.secondary,
    CARD_THEME_PALETTES.light.divider,
    ...CARD_THEME_PALETTES.light.heatmap
  ]) {
    assert.match(svg, new RegExp(escapeRegExp(color)));
  }
  assert.doesNotMatch(svg, /#181818|#2f2f2f/);
});

test("renders the Worker light social surface without changing dark padding", async () => {
  const viewModel = createViewModel("en");
  const [lightPng, darkPng] = await Promise.all([
    renderWorkerPng.renderSocial(viewModel, {
      avatarSource: avatar,
      theme: "light"
    }),
    renderWorkerPng.renderSocial(viewModel, {
      avatarSource: avatar,
      theme: "dark"
    })
  ]);
  const [light, dark] = await Promise.all([
    loadImage(lightPng),
    loadImage(darkPng)
  ]);
  const layout = computeSocialCanvasLayout();
  const lightContext = imageContext(light);
  const darkContext = imageContext(dark);

  assert.deepEqual([light.width, light.height], [SOCIAL_OUTPUT_WIDTH, SOCIAL_OUTPUT_HEIGHT]);
  assert.deepEqual([dark.width, dark.height], [SOCIAL_OUTPUT_WIDTH, SOCIAL_OUTPUT_HEIGHT]);
  assert.deepEqual(readSocialPixel(lightContext, 4, 4), rgba(SOCIAL_LIGHT_CANVAS_COLOR));
  assert.deepEqual(
    readSocialPixel(lightContext, layout.cardX + 0.5, layout.canvasHeight / 2),
    rgba(SOCIAL_LIGHT_BORDER_COLOR)
  );
  assert.equal(readSocialPixel(darkContext, 4, 4)[3], 0);
  assert.equal(
    readSocialPixel(darkContext, layout.cardX / 2, layout.canvasHeight / 2)[3],
    0
  );
  const lightBounds = findBounds(lightContext, (data, offset) => !matchesRgba(
    data,
    offset,
    rgba(SOCIAL_LIGHT_CANVAS_COLOR)
  ));
  const darkBounds = findBounds(darkContext, (data, offset) => (
    data[offset + 3] >= 128
  ));

  assert.deepEqual(lightBounds, darkBounds);
  assert.deepEqual(
    lightBounds,
    { maxX: 2159, maxY: 1218, minX: 240, minY: 41 }
  );
});

test("keeps Worker standalone alpha geometry identical across themes", async () => {
  const viewModel = createViewModel("ko");
  const [lightPng, darkPng] = await Promise.all([
    renderWorkerPng(viewModel, { avatarSource: avatar, theme: "light" }),
    renderWorkerPng(viewModel, { avatarSource: avatar, theme: "dark" })
  ]);
  const [light, dark] = await Promise.all([
    loadImage(lightPng),
    loadImage(darkPng)
  ]);
  const lightContext = imageContext(light);
  const darkContext = imageContext(dark);

  assert.deepEqual([light.width, light.height], [dark.width, dark.height]);
  assert.equal(countAlphaDifferences(lightContext, darkContext), 0);
  assert.notDeepEqual(
    readOutputPixel(lightContext, 748, 459),
    readOutputPixel(darkContext, 748, 459)
  );
});

function createViewModel(locale) {
  return buildCardViewModel({
    locale,
    owner: sampleCardOwner,
    todayIso: SAMPLE_CARD_TODAY_ISO,
    usage: sampleAccountUsageReadResult
  });
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("base64url");
}

function imageContext(image) {
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  return context;
}

function readSocialPixel(context, x, y) {
  const { data } = context.getImageData(
    Math.round(x * SOCIAL_OUTPUT_SCALE),
    Math.round(y * SOCIAL_OUTPUT_SCALE),
    1,
    1
  );
  return [data[0], data[1], data[2], data[3]];
}

function readOutputPixel(context, x, y) {
  const { data } = context.getImageData(x, y, 1, 1);
  return [data[0], data[1], data[2], data[3]];
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

function findBounds(context, includesPixel) {
  const { height, width } = context.canvas;
  const { data } = context.getImageData(0, 0, width, height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = ((y * width) + x) * 4;
      if (!includesPixel(data, offset)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { maxX, maxY, minX, minY };
}

function matchesRgba(data, offset, expected) {
  return data[offset] === expected[0] &&
    data[offset + 1] === expected[1] &&
    data[offset + 2] === expected[2] &&
    data[offset + 3] === expected[3];
}

function rgba(hex) {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
    255
  ];
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
