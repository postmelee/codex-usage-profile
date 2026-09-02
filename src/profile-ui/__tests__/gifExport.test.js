import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import test from "node:test";

import { createCanvas, loadImage } from "@napi-rs/canvas";

import { drawProfileAttachmentCanvas } from "../../profile-card/attachment-canvas.js";
import {
  GIF_EXPORT_PRESET_VERSION,
  PROFILE_GIF_PRESET
} from "../../profile-card/gif-animation.js";
import { assertProfileGifContract } from "../../profile-card/gif-binary.js";
import {
  PROFILE_GIF_BEAM_ASSET_URL,
  PROFILE_GIF_LIGHT_BEAM_ASSET_URL,
  parseProfileGifBeamFrames
} from "../../profile-card/gif-beam-frames.js";
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
const goldenBeamFrames = new Map();

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
    presetVersion: 4,
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
  assert.equal(buildGifExportSourceKey({
    selectedImageUrl: "/card.png",
    shareRevision: "42"
  }), buildGifExportSourceKey({
    selectedImageUrl: "/card.png",
    shareRevision: 42
  }));
  for (const shareRevision of [7.5, -1, "abc", {}, ""]) {
    assert.equal(JSON.parse(buildGifExportSourceKey({
      selectedImageUrl: "/card.png",
      shareRevision
    })).shareRevision, null);
  }

  const supportedEnvironment = {
    Blob,
    DecompressionStream,
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
  assert.equal(isBrowserGifExportSupported({
    ...supportedEnvironment,
    DecompressionStream: undefined
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
    cardTheme: "dark",
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

test("never falls back to procedural encoding when either golden asset fails", async () => {
  for (const cardTheme of ["dark", "light"]) {
    for (const [failure, errorCode] of [
      [new Error("golden load failed"), GIF_EXPORT_ERROR_CODES.ENCODE_FAILED],
      [new RangeError("golden too large"), GIF_EXPORT_ERROR_CODES.TOO_LARGE]
    ]) {
      let encodeCalls = 0;
      const messages = [];
      const dependencies = createWorkerDependencies(async () => (
        new Response("png", { headers: { "content-type": "image/png" } })
      ), {
        loadBeamFrames(theme) {
          assert.equal(theme, cardTheme);
          throw failure;
        },
        encodeGif() { encodeCalls += 1; },
        postMessage(message) { messages.push(message); }
      });
      await assert.rejects(
        runGifExportWorkerJob({ ...createWorkerRequest(), cardTheme }, dependencies),
        (error) => error.gifExportCode === errorCode
      );
      assert.equal(encodeCalls, 0);
      assert.deepEqual(messages, []);
    }
  }
});

test("rejects missing or unsupported Worker card themes", async () => {
  for (const cardTheme of [undefined, "sepia", "LIGHT"]) {
    await assert.rejects(
      runGifExportWorkerJob({
        ...createWorkerRequest(),
        cardTheme
      }),
      (error) => error.gifExportCode === GIF_EXPORT_ERROR_CODES.INVALID_OUTPUT
    );
  }
});

test("reports bounded progress and transfers one validated ArrayBuffer", async () => {
  const bytes = getValidGifBytes();
  const messages = [];
  const fetchCalls = [];
  let encodedTheme;
  let loadedTheme;
  const dependencies = createWorkerDependencies(async (url, options) => {
    fetchCalls.push([url, options]);
    return new Response("png", { headers: { "content-type": "image/png" } });
  }, {
    encodeGif(_rgba, options) {
      encodedTheme = options.theme;
      for (let completedFrames = 1; completedFrames <= 96; completedFrames += 1) {
        options.onProgress({ completedFrames, totalFrames: 96 });
      }
      return bytes;
    },
    loadBeamFrames(theme) {
      loadedTheme = theme;
      return null;
    },
    postMessage(message, transfer) {
      messages.push({ message, transfer });
    }
  });

  await runGifExportWorkerJob(createWorkerRequest(), dependencies);
  assert.equal(loadedTheme, "dark");
  assert.equal(encodedTheme, "dark");
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

test("uses the attachment surface with high-quality source rasterization", async () => {
  const bytes = getValidGifBytes();
  const baseRgba = createOpaqueBase();
  let context;

  class RecordingOffscreenCanvas {
    getContext() {
      context = {
        beginPath() {},
        drawImage() {},
        fillRect() {},
        getImageData() { return { data: baseRgba }; },
        imageSmoothingEnabled: false,
        imageSmoothingQuality: "low",
        restore() {},
        roundRect() {},
        save() {},
        stroke() {}
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
      const attachmentBase = await renderAttachmentBase(png, theme);
      const messages = [];

      await runGifExportWorkerJob({
        ...createWorkerRequest(),
        cardTheme: theme,
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
        loadBeamFrames: getGoldenBeamFrames,
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
      assert.ok(metadata.frames.every((frame) => (
        !frame.transparent && frame.transparentIndex === null
      )));
      assert.deepEqual(completion.transfer, [completion.message.bytes]);
      const gif = new Uint8Array(completion.message.bytes);
      await assertFirstGifFrameMatchesAttachment(gif, theme, attachmentBase);
      if (
        locale === "en" &&
        process.env.PROFILE_GIF_VISUAL_OUTPUT_DIR
      ) {
        await mkdir(resolve(process.env.PROFILE_GIF_VISUAL_OUTPUT_DIR), {
          recursive: true
        });
        await writeFile(
          resolve(
            process.env.PROFILE_GIF_VISUAL_OUTPUT_DIR,
            `attachment-${theme}.gif`
          ),
          gif
        );
      }
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
    cardTheme: "dark",
    jobId: "gif-1",
    presetVersion: GIF_EXPORT_PRESET_VERSION,
    sourceKey: "source-a",
    sourceUrl: "https://profiles.example.test/u/postmelee/card.png?theme=dark",
    type: "generate"
  };
}

function createWorkerDependencies(fetchImpl, overrides = {}) {
  const baseRgba = createOpaqueBase();
  class FakeOffscreenCanvas {
    getContext() {
      return {
        beginPath() {},
        drawImage() {},
        fillRect() {},
        getImageData() { return { data: baseRgba }; },
        restore() {},
        roundRect() {},
        save() {},
        stroke() {}
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
    loadBeamFrames: () => null,
    origin: "https://profiles.example.test",
    postMessage() {},
    ...overrides
  };
}

function getValidGifBytes() {
  validGifBytes ??= encodeProfileCardGif(createOpaqueBase());
  return validGifBytes;
}

async function getGoldenBeamFrames(theme) {
  if (!goldenBeamFrames.has(theme)) {
    const assetUrl = theme === "light"
      ? PROFILE_GIF_LIGHT_BEAM_ASSET_URL
      : PROFILE_GIF_BEAM_ASSET_URL;
    goldenBeamFrames.set(theme, parseProfileGifBeamFrames(gunzipSync(
      await readFile(assetUrl)
    )));
  }
  return goldenBeamFrames.get(theme);
}

function createOpaqueBase() {
  const { width, height } = PROFILE_GIF_PRESET;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < rgba.length; offset += 4) {
    rgba.set([24, 24, 24, 255], offset);
  }
  return rgba;
}

async function renderAttachmentBase(png, theme) {
  const image = await loadImage(png);
  const canvas = createCanvas(
    PROFILE_GIF_PRESET.width,
    PROFILE_GIF_PRESET.height
  );
  const context = canvas.getContext("2d");
  drawProfileAttachmentCanvas(context, image, { theme });
  return context.getImageData(
    0,
    0,
    PROFILE_GIF_PRESET.width,
    PROFILE_GIF_PRESET.height
  ).data;
}

async function assertFirstGifFrameMatchesAttachment(gif, theme, base) {
  const image = await loadImage(gif);
  assert.equal(image.width, PROFILE_GIF_PRESET.width);
  assert.equal(image.height, PROFILE_GIF_PRESET.height);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height).data;
  let minimumAlpha = 255;
  for (let offset = 3; offset < pixels.length; offset += 4) {
    minimumAlpha = Math.min(minimumAlpha, pixels[offset]);
  }
  assert.equal(minimumAlpha, 255, `${theme} first frame minimum alpha`);
  const expectedCorner = theme === "light"
    ? [255, 255, 255, 255]
    : [24, 24, 24, 255];
  for (const [x, y] of [
    [0, 0],
    [image.width - 1, 0],
    [0, image.height - 1],
    [image.width - 1, image.height - 1]
  ]) {
    assert.deepEqual(
      Array.from(context.getImageData(x, y, 1, 1).data),
      expectedCorner,
      `${theme} first frame corner ${x},${y}`
    );
  }
  let comparedChannels = 0;
  let maximumDelta = 0;
  let squaredError = 0;
  for (let y = 72; y < image.height - 72; y += 1) {
    for (let x = 72; x < image.width - 72; x += 1) {
      const offset = (y * image.width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const delta = Math.abs(pixels[offset + channel] - base[offset + channel]);
        maximumDelta = Math.max(maximumDelta, delta);
        squaredError += delta * delta;
        comparedChannels += 1;
      }
    }
  }
  assert.ok(maximumDelta <= 32, `${theme} first frame maximum RGB delta`);
  assert.ok(
    Math.sqrt(squaredError / comparedChannels) < 1,
    `${theme} first frame interior RGB RMSE`
  );
}

function toArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
