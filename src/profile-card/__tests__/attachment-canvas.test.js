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
  PROFILE_ATTACHMENT_HEIGHT,
  PROFILE_ATTACHMENT_PRESET,
  PROFILE_ATTACHMENT_RADIUS,
  PROFILE_ATTACHMENT_WIDTH,
  drawProfileAttachmentCanvas,
  getProfileAttachmentSurface
} from "../attachment-canvas.js";
import { renderProfileCardPng } from "../renderer.js";
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

test("Task #150 fixes the attachment canvas at the approved 2x geometry", () => {
  assert.deepEqual(PROFILE_ATTACHMENT_PRESET, {
    height: 612,
    logicalHeight: 306,
    logicalRadius: 32,
    logicalWidth: 499,
    radius: 64,
    scale: 2,
    sourceMaxBytes: 10_000_000,
    version: 1,
    width: 998
  });
  assert.equal(PROFILE_ATTACHMENT_WIDTH / PROFILE_ATTACHMENT_HEIGHT, 499 / 306);
  assert.equal(PROFILE_ATTACHMENT_RADIUS, 64);
});

test("Task #150 uses opaque theme surfaces without changing source geometry", async () => {
  const outputs = [];

  for (const theme of ["dark", "light"]) {
    const sourcePng = await renderProfileCardPng(createViewModel(theme), {
      avatarSource: avatar,
      theme
    });
    const source = await loadImage(sourcePng);
    const output = createCanvas(
      PROFILE_ATTACHMENT_WIDTH,
      PROFILE_ATTACHMENT_HEIGHT
    );
    const outputContext = output.getContext("2d");
    const surface = drawProfileAttachmentCanvas(outputContext, source, {
      theme
    });
    const control = createCanvas(
      PROFILE_ATTACHMENT_WIDTH,
      PROFILE_ATTACHMENT_HEIGHT
    );
    const controlContext = control.getContext("2d");
    controlContext.imageSmoothingEnabled = true;
    controlContext.imageSmoothingQuality = "high";
    controlContext.drawImage(
      source,
      0,
      0,
      PROFILE_ATTACHMENT_WIDTH,
      PROFILE_ATTACHMENT_HEIGHT
    );

    assertAllPixelsOpaque(outputContext, theme);
    assert.deepEqual(
      readPixel(outputContext, 0, 0),
      theme === "dark"
        ? [24, 24, 24, 255]
        : [243, 245, 247, 255]
    );
    assertPixelsClose(
      getInteriorPixels(outputContext),
      getInteriorPixels(controlContext),
      `${theme} content geometry`
    );

    if (theme === "light") {
      assert.deepEqual(surface, {
        backgroundColor: "#F3F5F7",
        outline: {
          color: "#D0D7DE",
          height: 610,
          radius: 63,
          width: 996,
          x: 1,
          y: 1
        },
        outlineWidth: 2,
        theme: "light"
      });
      assert.deepEqual(
        readPixel(outputContext, PROFILE_ATTACHMENT_WIDTH / 2, 1),
        [208, 215, 222, 255]
      );
    } else {
      assert.equal(surface.outline, null);
    }

    outputs.push([`attachment-${theme}.png`, await output.encode("png")]);
  }

  const outputDirectory = process.env.PROFILE_ATTACHMENT_VISUAL_OUTPUT_DIR;
  if (outputDirectory) {
    await mkdir(resolve(outputDirectory), { recursive: true });
    await Promise.all(outputs.map(([name, png]) => (
      writeFile(resolve(outputDirectory, name), png)
    )));
  }
});

test("rejects invalid attachment canvas inputs", () => {
  assert.throws(
    () => drawProfileAttachmentCanvas({}, {}),
    /Canvas 2D context/
  );
  const canvas = createCanvas(
    PROFILE_ATTACHMENT_WIDTH,
    PROFILE_ATTACHMENT_HEIGHT
  );
  assert.throws(
    () => drawProfileAttachmentCanvas(canvas.getContext("2d"), null),
    /source image is required/
  );
  const wrongSize = createCanvas(499, 306);
  assert.throws(
    () => drawProfileAttachmentCanvas(wrongSize.getContext("2d"), {}),
    /must be 998x612/
  );
});

function createViewModel(theme) {
  return buildCardViewModel({
    locale: "en",
    owner: sampleCardOwner,
    theme,
    todayIso: SAMPLE_CARD_TODAY_ISO,
    usage: sampleAccountUsageReadResult
  });
}

function assertAllPixelsOpaque(context, label) {
  const pixels = context.getImageData(
    0,
    0,
    PROFILE_ATTACHMENT_WIDTH,
    PROFILE_ATTACHMENT_HEIGHT
  ).data;
  let minimumAlpha = 255;
  let maximumAlpha = 0;
  for (let offset = 3; offset < pixels.length; offset += 4) {
    minimumAlpha = Math.min(minimumAlpha, pixels[offset]);
    maximumAlpha = Math.max(maximumAlpha, pixels[offset]);
  }
  assert.equal(minimumAlpha, 255, `${label} minimum alpha`);
  assert.equal(maximumAlpha, 255, `${label} maximum alpha`);
}

function getInteriorPixels(context) {
  return Array.from(context.getImageData(
    72,
    72,
    PROFILE_ATTACHMENT_WIDTH - 144,
    PROFILE_ATTACHMENT_HEIGHT - 144
  ).data);
}

function assertPixelsClose(actual, expected, label) {
  assert.equal(actual.length, expected.length, label);
  let maximumDelta = 0;
  let squaredError = 0;
  let comparedChannels = 0;
  for (let offset = 0; offset < actual.length; offset += 4) {
    assert.equal(actual[offset + 3], expected[offset + 3], `${label} alpha`);
    for (let channel = 0; channel < 3; channel += 1) {
      const delta = Math.abs(
        actual[offset + channel] - expected[offset + channel]
      );
      maximumDelta = Math.max(maximumDelta, delta);
      squaredError += delta * delta;
      comparedChannels += 1;
    }
  }
  assert.ok(maximumDelta <= 3, `${label} maximum RGB delta ${maximumDelta}`);
  assert.ok(
    Math.sqrt(squaredError / comparedChannels) < 0.1,
    `${label} RGB RMSE`
  );
}

function readPixel(context, x, y) {
  return Array.from(context.getImageData(x, y, 1, 1).data);
}
