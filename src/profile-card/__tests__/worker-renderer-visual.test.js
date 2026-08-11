import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  createCanvas,
  loadImage
} from "@napi-rs/canvas";

import {
  CARD_COLORS,
  CARD_OUTPUT_HEIGHT,
  CARD_OUTPUT_WIDTH,
  renderProfileCardPng
} from "../renderer.js";
import {
  createWorkerProfileCardRenderer
} from "../worker-renderer.js";
import { buildCardViewModel } from "../view-model.js";
import {
  SAMPLE_CARD_TODAY_ISO,
  sampleAccountUsageReadResult,
  sampleCardOwner
} from "../fixtures/sample-account-usage.js";

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

test("representative native and Worker cards preserve readable content regions", async () => {
  const outputs = [];
  for (const locale of ["en", "ko"]) {
    const viewModel = createViewModel(locale);
    outputs.push(
      [`native-${locale}.png`, await renderProfileCardPng(viewModel, {
        avatarSource: avatar
      })],
      [`worker-${locale}.png`, await renderWorkerPng(viewModel, {
        avatarSource: avatar
      })]
    );
  }
  outputs.push([
    "worker-avatar-fallback.png",
    await renderWorkerPng(createViewModel("ko"), { avatarSource: null })
  ]);

  for (const [name, png] of outputs) {
    const image = await loadImage(png);
    assert.equal(image.width, CARD_OUTPUT_WIDTH, name);
    assert.equal(image.height, CARD_OUTPUT_HEIGHT, name);
    assertCardRegions(image, name);
  }

  const outputDirectory = process.env.PROFILE_CARD_VISUAL_OUTPUT_DIR;
  if (outputDirectory) {
    await mkdir(resolve(outputDirectory), { recursive: true });
    await Promise.all(outputs.map(([name, png]) => (
      writeFile(resolve(outputDirectory, name), png)
    )));
  }
});

function createViewModel(locale) {
  return buildCardViewModel({
    locale,
    owner: locale === "ko"
      ? { ...sampleCardOwner, displayName: "로컬 사용자" }
      : sampleCardOwner,
    todayIso: SAMPLE_CARD_TODAY_ISO,
    usage: sampleAccountUsageReadResult
  });
}

function assertCardRegions(image, label) {
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);

  assert.equal(readPixel(context, 0, 0)[3], 0, label);
  assert.deepEqual(
    readPixel(context, 749, 459),
    rgba(CARD_COLORS.background),
    label
  );
  assert.notDeepEqual(
    readPixel(context, 174, 174),
    rgba(CARD_COLORS.background),
    label
  );
  assert.ok(
    countNonBackgroundPixels(context, {
      x: 250,
      y: 700,
      width: 1000,
      height: 130
    }) > 2_000,
    `${label} must contain stat text and dividers`
  );
}

function countNonBackgroundPixels(context, area) {
  const data = context.getImageData(
    area.x,
    area.y,
    area.width,
    area.height
  ).data;
  const background = rgba(CARD_COLORS.background);
  let count = 0;
  for (let index = 0; index < data.length; index += 4) {
    if (
      data[index] !== background[0] ||
      data[index + 1] !== background[1] ||
      data[index + 2] !== background[2]
    ) {
      count += 1;
    }
  }
  return count;
}

function readPixel(context, x, y) {
  return Array.from(context.getImageData(x, y, 1, 1).data);
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
