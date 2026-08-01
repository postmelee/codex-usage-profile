import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { loadImage } from "@napi-rs/canvas";

import {
  CARD_OUTPUT_HEIGHT,
  CARD_OUTPUT_WIDTH,
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
  assert.notEqual(
    createProfileCardSourceDigest(baseDigestOptions),
    createProfileCardSourceDigest({
      ...baseDigestOptions,
      rendererVersion: WORKER_CARD_RENDERER_VERSION
    })
  );
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
