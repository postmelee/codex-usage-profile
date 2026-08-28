import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createCanvas, loadImage } from "@napi-rs/canvas";

import {
  GIF_EXPORT_PRESET_VERSION,
  PROFILE_GIF_PRESET
} from "../../profile-card/gif-animation.js";
import { assertProfileGifContract } from "../../profile-card/gif-binary.js";
import { encodeProfileCardGif } from "../../profile-card/gif-encoder.js";
import { renderProfileCardPng } from "../../profile-card/renderer.js";
import { buildCardViewModel } from "../../profile-card/view-model.js";
import {
  SAMPLE_CARD_TODAY_ISO,
  sampleAccountUsageReadResult,
  sampleCardOwner
} from "../../profile-card/fixtures/sample-account-usage.js";
import {
  GIF_EXPORT_ERROR_CODES,
  GIF_EXPORT_STATUSES,
  buildGifExportSourceKey,
  createGifExportController,
  isBrowserGifExportSupported
} from "../gifExport.js";
import {
  normalizeWorkerSourceUrl,
  runGifExportWorkerJob
} from "../gifExport.worker.js";

let validGifBytes;

test("builds a canonical versioned source key and checks browser capabilities", () => {
  const sourceKey = buildGifExportSourceKey({
    cardLocale: "KO",
    cardTheme: "LIGHT",
    selectedImageUrl: "/u/postmelee/card.png?theme=light&locale=ko",
    shareRevision: 42
  });
  assert.deepEqual(JSON.parse(sourceKey), {
    cardLocale: "ko",
    cardTheme: "light",
    presetVersion: 1,
    selectedImageUrl: "/u/postmelee/card.png?theme=light&locale=ko",
    shareRevision: 42
  });
  assert.equal(buildGifExportSourceKey({
    selectedImageUrl: "/card.png"
  }), buildGifExportSourceKey({
    cardLocale: "en",
    cardTheme: "dark",
    selectedImageUrl: "/card.png",
    shareRevision: null
  }));
  assert.throws(
    () => buildGifExportSourceKey({
      selectedImageUrl: "/card.png",
      shareRevision: "42"
    }),
    /shareRevision/
  );

  const supportedEnvironment = {
    Blob,
    OffscreenCanvas: class {},
    URL: { createObjectURL() {}, revokeObjectURL() {} },
    Worker: class {},
    createImageBitmap() {}
  };
  assert.equal(isBrowserGifExportSupported(supportedEnvironment), true);
  assert.equal(isBrowserGifExportSupported({
    ...supportedEnvironment,
    OffscreenCanvas: undefined
  }), false);

  const unsupportedHarness = createControllerHarness({
    isSupported: () => false
  });
  unsupportedHarness.controller.generate({
    sourceKey: "source-a",
    sourceUrl: "/card.png"
  });
  assert.equal(unsupportedHarness.workers.length, 0);
  assert.equal(
    unsupportedHarness.controller.getSnapshot().errorCode,
    GIF_EXPORT_ERROR_CODES.UNSUPPORTED
  );
});

test("locks duplicate generation and reuses one validated ready Blob URL", () => {
  const harness = createControllerHarness();
  const notifications = [];
  harness.controller.subscribe(() => {
    notifications.push(harness.controller.getSnapshot().status);
  });

  harness.controller.generate({
    sourceKey: "source-a",
    sourceUrl: "/u/postmelee/card.png?theme=dark"
  });
  assert.equal(harness.workers.length, 1);
  assert.deepEqual(harness.workers[0].posted[0], {
    jobId: "gif-1",
    presetVersion: GIF_EXPORT_PRESET_VERSION,
    sourceKey: "source-a",
    sourceUrl: "/u/postmelee/card.png?theme=dark",
    type: "generate"
  });
  assert.equal(harness.controller.getSnapshot().status, GIF_EXPORT_STATUSES.GENERATING);

  harness.controller.generate({
    sourceKey: "source-a",
    sourceUrl: "/u/postmelee/card.png?theme=dark"
  });
  assert.equal(harness.workers.length, 1);

  harness.workers[0].emitMessage({
    completedFrames: 4,
    jobId: "gif-1",
    sourceKey: "source-a",
    totalFrames: 96,
    type: "progress"
  });
  assert.equal(harness.controller.getSnapshot().progress, 4 / 96);

  const bytes = getValidGifBytes();
  harness.workers[0].emitMessage({
    bytes: toArrayBuffer(bytes),
    jobId: "gif-1",
    sourceKey: "source-a",
    type: "complete"
  });
  assert.deepEqual(harness.controller.getSnapshot(), {
    blobUrl: "blob:profile-gif-1",
    byteLength: bytes.byteLength,
    errorCode: null,
    progress: 1,
    sourceKey: "source-a",
    status: GIF_EXPORT_STATUSES.READY
  });
  assert.equal(harness.createdBlobs.length, 1);
  assert.equal(harness.createdBlobs[0].type, "image/gif");
  assert.equal(harness.workers[0].terminateCalls, 1);
  assert.equal(harness.timers.size, 0);

  harness.controller.generate({
    sourceKey: "source-a",
    sourceUrl: "/u/postmelee/card.png?theme=dark"
  });
  assert.equal(harness.workers.length, 1);
  assert.deepEqual(harness.revokedUrls, []);
  assert.ok(notifications.includes(GIF_EXPORT_STATUSES.READY));

  harness.controller.dispose();
  harness.controller.dispose();
  assert.deepEqual(harness.revokedUrls, ["blob:profile-gif-1"]);
  assert.throws(() => harness.controller.reset(), /disposed/);
});

test("terminates changed sources and ignores stale job messages", () => {
  const harness = createControllerHarness();
  harness.controller.generate({ sourceKey: "source-a", sourceUrl: "/a.png" });
  harness.controller.generate({ sourceKey: "source-b", sourceUrl: "/b.png" });

  assert.equal(harness.workers.length, 2);
  assert.equal(harness.workers[0].terminateCalls, 1);
  assert.equal(harness.controller.getSnapshot().sourceKey, "source-b");

  harness.workers[1].emitMessage({
    bytes: toArrayBuffer(getValidGifBytes()),
    jobId: "gif-1",
    sourceKey: "source-a",
    type: "complete"
  });
  assert.equal(harness.controller.getSnapshot().status, GIF_EXPORT_STATUSES.GENERATING);
  assert.equal(harness.createdBlobs.length, 0);

  harness.workers[1].emitMessage({
    bytes: toArrayBuffer(getValidGifBytes()),
    jobId: "gif-2",
    sourceKey: "source-b",
    type: "complete"
  });
  assert.equal(harness.controller.getSnapshot().status, GIF_EXPORT_STATUSES.READY);
  harness.controller.synchronizeSource("source-c");
  assert.equal(harness.controller.getSnapshot().status, GIF_EXPORT_STATUSES.IDLE);
  assert.deepEqual(harness.revokedUrls, ["blob:profile-gif-1"]);
});

test("supports typed retry, timeout, cancel, and malformed progress errors", () => {
  const harness = createControllerHarness();
  harness.controller.generate({ sourceKey: "source-a", sourceUrl: "/a.png" });
  harness.workers[0].emitMessage({
    code: "source_failed",
    jobId: "gif-1",
    sourceKey: "source-a",
    type: "error"
  });
  assert.equal(harness.controller.getSnapshot().errorCode, "source_failed");

  harness.controller.generate({ sourceKey: "source-a", sourceUrl: "/a.png" });
  assert.equal(harness.workers.length, 2);
  assert.equal([...harness.timers.values()][0].delay, 60_000);
  harness.fireOnlyTimer();
  assert.equal(
    harness.controller.getSnapshot().errorCode,
    GIF_EXPORT_ERROR_CODES.TIMED_OUT
  );
  assert.equal(harness.workers[1].terminateCalls, 1);

  harness.controller.generate({ sourceKey: "source-a", sourceUrl: "/a.png" });
  harness.workers[2].emitMessage({
    completedFrames: 8,
    jobId: "gif-3",
    sourceKey: "source-a",
    totalFrames: 96,
    type: "progress"
  });
  harness.workers[2].emitMessage({
    completedFrames: 4,
    jobId: "gif-3",
    sourceKey: "source-a",
    totalFrames: 96,
    type: "progress"
  });
  assert.equal(
    harness.controller.getSnapshot().errorCode,
    GIF_EXPORT_ERROR_CODES.INVALID_OUTPUT
  );

  harness.controller.generate({ sourceKey: "source-a", sourceUrl: "/a.png" });
  harness.controller.cancel();
  assert.equal(harness.controller.getSnapshot().status, GIF_EXPORT_STATUSES.IDLE);
  assert.equal(harness.workers[3].terminateCalls, 1);
});

test("does not create Blobs for malformed or oversized Worker output", () => {
  const harness = createControllerHarness();
  harness.controller.generate({ sourceKey: "source-a", sourceUrl: "/a.png" });
  harness.workers[0].emitMessage({
    bytes: Uint8Array.from([1, 2, 3]).buffer,
    jobId: "gif-1",
    sourceKey: "source-a",
    type: "complete"
  });
  assert.equal(
    harness.controller.getSnapshot().errorCode,
    GIF_EXPORT_ERROR_CODES.INVALID_OUTPUT
  );
  assert.equal(harness.createdBlobs.length, 0);

  harness.controller.generate({ sourceKey: "source-a", sourceUrl: "/a.png" });
  harness.workers[1].emitMessage({
    bytes: new ArrayBuffer(PROFILE_GIF_PRESET.maxBytes),
    jobId: "gif-2",
    sourceKey: "source-a",
    type: "complete"
  });
  assert.equal(
    harness.controller.getSnapshot().errorCode,
    GIF_EXPORT_ERROR_CODES.TOO_LARGE
  );
  assert.equal(harness.createdBlobs.length, 0);
  assert.deepEqual(harness.revokedUrls, []);
});

test("accepts only safe same-origin HTTP PNG source URLs", async () => {
  assert.equal(
    normalizeWorkerSourceUrl(
      "/u/postmelee/card.png?theme=dark",
      "https://profiles.example.test"
    ).toString(),
    "https://profiles.example.test/u/postmelee/card.png?theme=dark"
  );
  for (const value of [
    "https://other.example.test/card.png",
    "//other.example.test/card.png",
    "data:image/png;base64,abc",
    "/u/../private/card.png",
    "/u/%252e%252e/private/card.png",
    "/u\\..\\private.png",
    "/card.png#fragment"
  ]) {
    assert.throws(
      () => normalizeWorkerSourceUrl(value, "https://profiles.example.test"),
      (error) => error.gifExportCode === GIF_EXPORT_ERROR_CODES.SOURCE_FAILED,
      value
    );
  }

  const request = createWorkerRequest();
  await assert.rejects(
    runGifExportWorkerJob(request, {}),
    (error) => error.gifExportCode === GIF_EXPORT_ERROR_CODES.UNSUPPORTED
  );

  for (const response of [
    new Response("missing", { status: 404 }),
    new Response("html", { headers: { "content-type": "text/html" } }),
    new Response(new Uint8Array(), { headers: { "content-type": "image/png" } }),
    {
      blob: async () => new Blob(["png"], { type: "image/png" }),
      headers: new Headers({ "content-type": "image/png" }),
      ok: true,
      url: "https://other.example.test/card.png"
    },
    new Response("png", {
      headers: {
        "content-length": String(PROFILE_GIF_PRESET.sourceMaxBytes + 1),
        "content-type": "image/png"
      }
    })
  ]) {
    await assert.rejects(
      runGifExportWorkerJob(request, createWorkerDependencies(async () => response)),
      (error) => error.gifExportCode === GIF_EXPORT_ERROR_CODES.SOURCE_FAILED
    );
  }

  await assert.rejects(
    runGifExportWorkerJob(request, createWorkerDependencies(async () => (
      new Response("png", { headers: { "content-type": "image/png" } })
    ), {
      async createImageBitmap() { throw new Error("decode failed"); }
    })),
    (error) => error.gifExportCode === GIF_EXPORT_ERROR_CODES.SOURCE_FAILED
  );

  class MissingContextCanvas {
    getContext() { return null; }
  }
  await assert.rejects(
    runGifExportWorkerJob(request, createWorkerDependencies(async () => (
      new Response("png", { headers: { "content-type": "image/png" } })
    ), {
      OffscreenCanvas: MissingContextCanvas
    })),
    (error) => error.gifExportCode === GIF_EXPORT_ERROR_CODES.UNSUPPORTED
  );
});

test("maps Worker encode, output, and transfer failures to typed errors", async () => {
  const response = () => new Response("png", {
    headers: { "content-type": "image/png" }
  });
  const request = createWorkerRequest();

  await assert.rejects(
    runGifExportWorkerJob(request, createWorkerDependencies(response, {
      encodeGif() { throw new Error("encode failed"); }
    })),
    (error) => error.gifExportCode === GIF_EXPORT_ERROR_CODES.ENCODE_FAILED
  );
  await assert.rejects(
    runGifExportWorkerJob(request, createWorkerDependencies(response, {
      encodeGif() { return Uint8Array.from([1, 2, 3]); }
    })),
    (error) => error.gifExportCode === GIF_EXPORT_ERROR_CODES.INVALID_OUTPUT
  );
  await assert.rejects(
    runGifExportWorkerJob(request, createWorkerDependencies(response, {
      encodeGif() { throw new RangeError("too large"); }
    })),
    (error) => error.gifExportCode === GIF_EXPORT_ERROR_CODES.TOO_LARGE
  );
  await assert.rejects(
    runGifExportWorkerJob(request, createWorkerDependencies(response, {
      encodeGif() { return getValidGifBytes(); },
      postMessage() { throw new Error("transfer failed"); }
    })),
    (error) => error.gifExportCode === GIF_EXPORT_ERROR_CODES.UNSUPPORTED
  );
});

test("reports bounded progress and transfers one validated ArrayBuffer", async () => {
  const bytes = getValidGifBytes();
  const messages = [];
  const fetchCalls = [];
  const dependencies = createWorkerDependencies(async (url, options) => {
    fetchCalls.push([url, options]);
    return new Response("png", { headers: { "content-type": "image/png" } });
  }, {
    encodeGif(_rgba, options) {
      for (let completedFrames = 1; completedFrames <= 96; completedFrames += 1) {
        options.onProgress({ completedFrames, totalFrames: 96 });
      }
      return bytes;
    },
    postMessage(message, transfer) {
      messages.push({ message, transfer });
    }
  });

  await runGifExportWorkerJob(createWorkerRequest(), dependencies);
  assert.deepEqual(fetchCalls, [[
    "https://profiles.example.test/u/postmelee/card.png?theme=dark",
    { cache: "no-cache", credentials: "same-origin" }
  ]]);
  assert.deepEqual(
    messages.filter(({ message }) => message.type === "progress")
      .map(({ message }) => message.completedFrames),
    [1, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48,
      52, 56, 60, 64, 68, 72, 76, 80, 84, 88, 92, 96]
  );
  const completion = messages.at(-1);
  const expectedMetadata = assertProfileGifContract(bytes);
  assert.equal(completion.message.type, "complete");
  assert.equal(completion.message.bytes.byteLength, bytes.byteLength);
  assert.deepEqual(completion.transfer, [completion.message.bytes]);
  assert.deepEqual(completion.message.metadata, {
    byteLength: bytes.byteLength,
    frameCount: 96,
    frameDelayCentiseconds: 5,
    globalColorTableSize: expectedMetadata.globalColorTableSize,
    height: 612,
    loopCount: 0,
    width: 998
  });
});

test("uses high-quality smoothing when rasterizing the source PNG at 2x", async () => {
  const bytes = getValidGifBytes();
  const baseRgba = createTransparentBase();
  let context;

  class RecordingOffscreenCanvas {
    getContext() {
      context = {
        clearRect() {},
        drawImage() {},
        getImageData() { return { data: baseRgba }; },
        imageSmoothingEnabled: false,
        imageSmoothingQuality: "low"
      };
      return context;
    }
  }

  await runGifExportWorkerJob(createWorkerRequest(), createWorkerDependencies(async () => (
    new Response("png", { headers: { "content-type": "image/png" } })
  ), {
    OffscreenCanvas: RecordingOffscreenCanvas,
    encodeGif() { return bytes; }
  }));

  assert.equal(context.imageSmoothingEnabled, true);
  assert.equal(context.imageSmoothingQuality, "high");
});

test("encodes representative dark/light and en/ko cards below 15MB", async () => {
  const avatar = await readFile(new URL(
    "../../../public/assets/postmelee-avatar.png",
    import.meta.url
  ));
  const byteLengths = [];

  for (const theme of ["dark", "light"]) {
    for (const locale of ["en", "ko"]) {
      const viewModel = buildCardViewModel({
        locale,
        owner: locale === "ko"
          ? { ...sampleCardOwner, displayName: "로컬 사용자" }
          : sampleCardOwner,
        theme,
        todayIso: SAMPLE_CARD_TODAY_ISO,
        usage: sampleAccountUsageReadResult
      });
      const png = await renderProfileCardPng(viewModel, { avatarSource: avatar });
      const messages = [];

      await runGifExportWorkerJob({
        ...createWorkerRequest(),
        sourceKey: `${theme}-${locale}`,
        sourceUrl: `https://profiles.example.test/u/postmelee/card.png?theme=${theme}&locale=${locale}`
      }, {
        OffscreenCanvas: NapiOffscreenCanvas,
        async createImageBitmap(blob) {
          return loadImage(Buffer.from(await blob.arrayBuffer()));
        },
        async fetchImpl() {
          return new Response(png, {
            headers: {
              "content-length": String(png.byteLength),
              "content-type": "image/png"
            }
          });
        },
        origin: "https://profiles.example.test",
        postMessage(message, transfer) {
          messages.push({ message, transfer });
        }
      });

      const completion = messages.find(({ message }) => message.type === "complete");
      assert.ok(completion, `${theme}/${locale} completion`);
      const metadata = assertProfileGifContract(
        new Uint8Array(completion.message.bytes)
      );
      assert.ok(metadata.byteLength < PROFILE_GIF_PRESET.maxBytes);
      assert.deepEqual(completion.transfer, [completion.message.bytes]);
      byteLengths.push(metadata.byteLength);
    }
  }

  assert.equal(byteLengths.length, 4);
  assert.ok(byteLengths.every((byteLength) => byteLength < PROFILE_GIF_PRESET.maxBytes));
});

function createControllerHarness(options = {}) {
  const workers = [];
  const timers = new Map();
  const revokedUrls = [];
  const createdBlobs = [];
  let nextTimerId = 1;

  function RecordingBlob(parts, blobOptions) {
    const blob = new Blob(parts, blobOptions);
    createdBlobs.push(blob);
    return blob;
  }

  const controller = createGifExportController({
    BlobConstructor: RecordingBlob,
    clearTimer(timerId) { timers.delete(timerId); },
    createObjectUrl() { return `blob:profile-gif-${createdBlobs.length}`; },
    isSupported: options.isSupported ?? (() => true),
    revokeObjectUrl(value) { revokedUrls.push(value); },
    setTimer(callback, delay) {
      const timerId = nextTimerId++;
      timers.set(timerId, { callback, delay });
      return timerId;
    },
    workerFactory() {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    }
  });

  return {
    controller,
    createdBlobs,
    fireOnlyTimer() {
      assert.equal(timers.size, 1);
      [...timers.values()][0].callback();
    },
    revokedUrls,
    timers,
    workers
  };
}

class FakeWorker {
  constructor() {
    this.listeners = new Map();
    this.posted = [];
    this.terminateCalls = 0;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(message) {
    this.posted.push(message);
  }

  terminate() {
    this.terminateCalls += 1;
  }

  emitMessage(data) {
    for (const listener of this.listeners.get("message") ?? []) {
      listener({ data });
    }
  }
}

class NapiOffscreenCanvas {
  constructor(width, height) {
    this.canvas = createCanvas(width, height);
  }

  getContext(type, options) {
    return this.canvas.getContext(type, options);
  }
}

function createWorkerRequest() {
  return {
    jobId: "gif-1",
    presetVersion: GIF_EXPORT_PRESET_VERSION,
    sourceKey: "source-a",
    sourceUrl: "https://profiles.example.test/u/postmelee/card.png?theme=dark",
    type: "generate"
  };
}

function createWorkerDependencies(fetchImpl, overrides = {}) {
  const baseRgba = createTransparentBase();
  class FakeOffscreenCanvas {
    getContext() {
      return {
        clearRect() {},
        drawImage() {},
        getImageData() { return { data: baseRgba }; }
      };
    }
  }
  return {
    OffscreenCanvas: FakeOffscreenCanvas,
    createImageBitmap: async () => ({
      close() {},
      height: 1,
      width: 1
    }),
    fetchImpl,
    origin: "https://profiles.example.test",
    postMessage() {},
    ...overrides
  };
}

function getValidGifBytes() {
  validGifBytes ??= encodeProfileCardGif(createTransparentBase());
  return validGifBytes;
}

function createTransparentBase() {
  const { width, height, borderRadius } = PROFILE_GIF_PRESET;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nearestX = Math.max(borderRadius, Math.min(width - borderRadius, x + 0.5));
      const nearestY = Math.max(borderRadius, Math.min(height - borderRadius, y + 0.5));
      const dx = x + 0.5 - nearestX;
      const dy = y + 0.5 - nearestY;
      if (dx * dx + dy * dy > borderRadius * borderRadius) continue;
      const offset = (y * width + x) * 4;
      rgba.set([18, 24, 38, 255], offset);
    }
  }
  return rgba;
}

function toArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
