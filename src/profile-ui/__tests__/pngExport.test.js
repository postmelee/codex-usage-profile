import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createCanvas,
  loadImage
} from "@napi-rs/canvas";

import {
  PROFILE_ATTACHMENT_HEIGHT,
  PROFILE_ATTACHMENT_WIDTH
} from "../../profile-card/attachment-canvas.js";
import { renderProfileCardPng } from "../../profile-card/renderer.js";
import { buildCardViewModel } from "../../profile-card/view-model.js";
import {
  SAMPLE_CARD_TODAY_ISO,
  sampleAccountUsageReadResult,
  sampleCardOwner
} from "../../profile-card/fixtures/sample-account-usage.js";
import {
  PNG_EXPORT_ERROR_CODES,
  buildPngExportSourceKey,
  createProfileAttachmentPngBlob,
  normalizePngExportSourceUrl
} from "../pngExport.js";

const ORIGIN = "https://profiles.example.test";
const avatar = readFileSync(new URL(
  "../../../public/assets/postmelee-avatar.png",
  import.meta.url
));

test("builds a theme, locale, revision, and preset scoped PNG key", () => {
  assert.deepEqual(
    JSON.parse(buildPngExportSourceKey({
      cardLocale: "KO",
      cardTheme: "LIGHT",
      selectedImageUrl: "/u/postmelee/card.png?theme=light&locale=ko",
      shareRevision: "1788327000000"
    })),
    {
      cardLocale: "ko",
      cardTheme: "light",
      presetVersion: 1,
      selectedImageUrl: "/u/postmelee/card.png?theme=light&locale=ko",
      shareRevision: 1788327000000
    }
  );
});

test("Task #150 creates opaque 998x612 dark and light PNG blobs", async () => {
  for (const theme of ["dark", "light"]) {
    const source = await renderProfileCardPng(createViewModel(theme), {
      avatarSource: avatar,
      theme
    });
    let closed = 0;
    const blob = await createProfileAttachmentPngBlob({
      cardTheme: theme,
      sourceUrl: `/u/postmelee/card.png?theme=${theme}`
    }, createNapiDependencies(source, {
      onClose() { closed += 1; }
    }));

    assert.equal(blob.type, "image/png");
    assert.ok(blob.size > 0);
    assert.equal(closed, 1);

    const image = await loadImage(Buffer.from(await blob.arrayBuffer()));
    assert.equal(image.width, PROFILE_ATTACHMENT_WIDTH);
    assert.equal(image.height, PROFILE_ATTACHMENT_HEIGHT);
    const canvas = createCanvas(image.width, image.height);
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    assertAllPixelsOpaque(context, theme);
    assert.deepEqual(
      readPixel(context, 0, 0),
      theme === "dark"
        ? [24, 24, 24, 255]
        : [243, 245, 247, 255]
    );
  }
});

test("keeps PNG source loading same-origin and bounded", async () => {
  assert.equal(
    normalizePngExportSourceUrl("/u/postmelee/card.png", ORIGIN).toString(),
    `${ORIGIN}/u/postmelee/card.png`
  );
  for (const value of [
    "https://evil.example/card.png",
    "//evil.example/card.png",
    "/u/../private/card.png",
    "/u/%252e%252e/private/card.png",
    "/u/postmelee/card.png#fragment"
  ]) {
    assert.throws(
      () => normalizePngExportSourceUrl(value, ORIGIN),
      hasCode(PNG_EXPORT_ERROR_CODES.SOURCE_FAILED),
      value
    );
  }

  await assert.rejects(
    () => createProfileAttachmentPngBlob({
      cardTheme: "dark",
      sourceUrl: "/u/postmelee/card.png"
    }, {
      ...createNapiDependencies(Uint8Array.of(1)),
      async fetchImpl() {
        return new Response("not png", {
          headers: { "content-type": "text/plain" }
        });
      }
    }),
    hasCode(PNG_EXPORT_ERROR_CODES.SOURCE_FAILED)
  );

  await assert.rejects(
    () => createProfileAttachmentPngBlob({
      cardTheme: "dark",
      sourceUrl: "/u/postmelee/card.png"
    }, {
      ...createNapiDependencies(Uint8Array.of(1)),
      async fetchImpl() {
        return new Response(new Uint8Array(10_000_001), {
          headers: { "content-type": "image/png" }
        });
      }
    }),
    hasCode(PNG_EXPORT_ERROR_CODES.SOURCE_FAILED)
  );
});

test("closes decoded images when PNG encoding fails", async () => {
  const source = await renderProfileCardPng(createViewModel("dark"), {
    avatarSource: avatar
  });
  let closed = 0;
  await assert.rejects(
    () => createProfileAttachmentPngBlob({
      cardTheme: "dark",
      sourceUrl: "/u/postmelee/card.png"
    }, {
      ...createNapiDependencies(source, {
        onClose() { closed += 1; }
      }),
      async encodeCanvas() {
        throw new Error("synthetic encode failure");
      }
    }),
    hasCode(PNG_EXPORT_ERROR_CODES.ENCODE_FAILED)
  );
  assert.equal(closed, 1);
});

test("propagates abort without converting it to a PNG export failure", async () => {
  const controller = new AbortController();
  controller.abort(new DOMException("cancelled", "AbortError"));
  await assert.rejects(
    () => createProfileAttachmentPngBlob({
      cardTheme: "dark",
      signal: controller.signal,
      sourceUrl: "/u/postmelee/card.png"
    }, createNapiDependencies(Uint8Array.of(1))),
    (error) => error?.name === "AbortError"
  );
});

function createNapiDependencies(sourcePng, options = {}) {
  return {
    createCanvas: (width, height) => createCanvas(width, height),
    async decodeImage(blob) {
      const source = await loadImage(Buffer.from(await blob.arrayBuffer()));
      return {
        close: options.onClose,
        source
      };
    },
    async encodeCanvas(canvas) {
      return new Blob([await canvas.encode("png")], { type: "image/png" });
    },
    async fetchImpl(url, init) {
      assert.equal(url, `${ORIGIN}/u/postmelee/card.png${url.includes("?") ? url.slice(url.indexOf("?")) : ""}`);
      assert.equal(init.cache, "no-cache");
      assert.equal(init.credentials, "same-origin");
      return new Response(sourcePng, {
        headers: { "content-type": "image/png" }
      });
    },
    origin: ORIGIN
  };
}

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
  for (let offset = 3; offset < pixels.length; offset += 4) {
    assert.equal(pixels[offset], 255, `${label} alpha at ${offset / 4}`);
  }
}

function readPixel(context, x, y) {
  return Array.from(context.getImageData(x, y, 1, 1).data);
}

function hasCode(code) {
  return (error) => error?.pngExportCode === code;
}
