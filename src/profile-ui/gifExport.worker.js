import {
  GIF_EXPORT_PRESET_VERSION,
  PROFILE_GIF_PRESET
} from "../profile-card/gif-animation.js";
import { drawProfileAttachmentCanvas } from "../profile-card/attachment-canvas.js";
import {
  assertProfileGifContract,
  createProfileGifTransferMetadata
} from "../profile-card/gif-binary.js";
import { loadProfileGifBeamFrames } from "../profile-card/gif-beam-frames.js";
import { encodeProfileCardGif } from "../profile-card/gif-encoder.js";
import { CARD_THEMES } from "../profile-card/theme.js";

const WORKER_ERROR_CODES = Object.freeze({
  ENCODE_FAILED: "encode_failed",
  INVALID_OUTPUT: "invalid_output",
  SOURCE_FAILED: "source_failed",
  TOO_LARGE: "too_large",
  UNSUPPORTED: "unsupported"
});

export async function runGifExportWorkerJob(message, options = {}) {
  const scope = options.scope ?? globalThis;
  const fetchImpl = options.fetchImpl ?? scope.fetch?.bind(scope);
  const createImageBitmapImpl = options.createImageBitmap ??
    scope.createImageBitmap?.bind(scope);
  const OffscreenCanvasConstructor = options.OffscreenCanvas ?? scope.OffscreenCanvas;
  const encodeGif = options.encodeGif ?? encodeProfileCardGif;
  const inspectGif = options.inspectGif ?? assertProfileGifContract;
  const loadBeamFrames = options.loadBeamFrames ?? ((theme) => (
    loadProfileGifBeamFrames({ environment: scope, fetchImpl, theme })
  ));
  const postMessage = options.postMessage ?? scope.postMessage?.bind(scope);
  const origin = options.origin ?? scope.location?.origin;
  const request = normalizeWorkerRequest(message);

  if (
    typeof fetchImpl !== "function" ||
    typeof createImageBitmapImpl !== "function" ||
    typeof OffscreenCanvasConstructor !== "function" ||
    typeof postMessage !== "function"
  ) {
    throw createWorkerError(WORKER_ERROR_CODES.UNSUPPORTED);
  }

  const sourceUrl = normalizeWorkerSourceUrl(request.sourceUrl, origin);
  const blob = await fetchSourcePng(sourceUrl, fetchImpl);
  const baseRgba = await decodeSourcePng(blob, {
    createImageBitmapImpl,
    OffscreenCanvasConstructor,
    theme: request.cardTheme
  });

  let bytes;
  try {
    const beamFrames = await loadBeamFrames(request.cardTheme);
    bytes = await encodeGif(baseRgba, {
      beamFrames,
      theme: request.cardTheme,
      onProgress(progress) {
        if (shouldReportProgress(progress.completedFrames)) {
          postMessage({
            completedFrames: progress.completedFrames,
            jobId: request.jobId,
            sourceKey: request.sourceKey,
            totalFrames: progress.totalFrames,
            type: "progress"
          });
        }
      }
    });
  } catch (error) {
    throw error instanceof RangeError
      ? createWorkerError(WORKER_ERROR_CODES.TOO_LARGE)
      : createWorkerError(WORKER_ERROR_CODES.ENCODE_FAILED);
  }

  let metadata;
  try {
    metadata = inspectGif(bytes);
  } catch (error) {
    throw error instanceof RangeError && bytes?.byteLength >= PROFILE_GIF_PRESET.maxBytes
      ? createWorkerError(WORKER_ERROR_CODES.TOO_LARGE)
      : createWorkerError(WORKER_ERROR_CODES.INVALID_OUTPUT);
  }

  if (!(bytes instanceof Uint8Array)) {
    throw createWorkerError(WORKER_ERROR_CODES.INVALID_OUTPUT);
  }
  if (bytes.byteLength >= PROFILE_GIF_PRESET.maxBytes) {
    throw createWorkerError(WORKER_ERROR_CODES.TOO_LARGE);
  }

  const transferBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  );
  try {
    postMessage({
      bytes: transferBuffer,
      jobId: request.jobId,
      metadata: createProfileGifTransferMetadata(metadata),
      sourceKey: request.sourceKey,
      type: "complete"
    }, [transferBuffer]);
  } catch {
    throw createWorkerError(WORKER_ERROR_CODES.UNSUPPORTED);
  }
  return metadata;
}

export function normalizeWorkerSourceUrl(value, origin) {
  if (typeof value !== "string" || value.trim() === "") {
    throw createWorkerError(WORKER_ERROR_CODES.SOURCE_FAILED);
  }
  if (typeof origin !== "string" || origin === "") {
    throw createWorkerError(WORKER_ERROR_CODES.UNSUPPORTED);
  }

  let baseUrl;
  let sourceUrl;
  try {
    baseUrl = new URL(origin);
    sourceUrl = new URL(value.trim(), baseUrl);
  } catch {
    throw createWorkerError(WORKER_ERROR_CODES.SOURCE_FAILED);
  }

  if (
    (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") ||
    sourceUrl.origin !== baseUrl.origin ||
    (sourceUrl.protocol !== "http:" && sourceUrl.protocol !== "https:") ||
    sourceUrl.username ||
    sourceUrl.password ||
    sourceUrl.hash ||
    value.includes("\\") ||
    value.trim().startsWith("//") ||
    hasUnsafePathSegment(value)
  ) {
    throw createWorkerError(WORKER_ERROR_CODES.SOURCE_FAILED);
  }
  return sourceUrl;
}

async function fetchSourcePng(sourceUrl, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(sourceUrl.toString(), {
      cache: "no-cache",
      credentials: "same-origin"
    });
  } catch {
    throw createWorkerError(WORKER_ERROR_CODES.SOURCE_FAILED);
  }

  if (!response?.ok) {
    throw createWorkerError(WORKER_ERROR_CODES.SOURCE_FAILED);
  }
  if (response.url) {
    try {
      if (new URL(response.url).origin !== sourceUrl.origin) {
        throw createWorkerError(WORKER_ERROR_CODES.SOURCE_FAILED);
      }
    } catch (error) {
      throw error?.gifExportCode
        ? error
        : createWorkerError(WORKER_ERROR_CODES.SOURCE_FAILED);
    }
  }
  const contentType = response.headers?.get?.("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  const contentLength = Number(response.headers?.get?.("content-length"));
  if (
    contentType !== "image/png" ||
    (Number.isFinite(contentLength) && contentLength > PROFILE_GIF_PRESET.sourceMaxBytes)
  ) {
    throw createWorkerError(WORKER_ERROR_CODES.SOURCE_FAILED);
  }

  let blob;
  try {
    blob = await response.blob();
  } catch {
    throw createWorkerError(WORKER_ERROR_CODES.SOURCE_FAILED);
  }
  if (
    !blob ||
    blob.size <= 0 ||
    blob.size > PROFILE_GIF_PRESET.sourceMaxBytes ||
    blob.type.split(";", 1)[0].toLowerCase() !== "image/png"
  ) {
    throw createWorkerError(WORKER_ERROR_CODES.SOURCE_FAILED);
  }
  return blob;
}

async function decodeSourcePng(blob, options) {
  let bitmap;
  try {
    bitmap = await options.createImageBitmapImpl(blob);
    if (
      !bitmap ||
      !Number.isFinite(bitmap.width) ||
      bitmap.width <= 0 ||
      !Number.isFinite(bitmap.height) ||
      bitmap.height <= 0
    ) {
      throw new Error("PNG decoded without pixels");
    }
    let canvas;
    try {
      canvas = new options.OffscreenCanvasConstructor(
        PROFILE_GIF_PRESET.width,
        PROFILE_GIF_PRESET.height
      );
    } catch {
      throw createWorkerError(WORKER_ERROR_CODES.UNSUPPORTED);
    }
    const context = canvas.getContext("2d", {
      alpha: true,
      willReadFrequently: true
    });
    if (!context) {
      throw createWorkerError(WORKER_ERROR_CODES.UNSUPPORTED);
    }
    drawProfileAttachmentCanvas(context, bitmap, { theme: options.theme });
    const rgba = context.getImageData(
      0,
      0,
      PROFILE_GIF_PRESET.width,
      PROFILE_GIF_PRESET.height
    )?.data;
    if (
      !(rgba instanceof Uint8ClampedArray) ||
      rgba.length !== PROFILE_GIF_PRESET.width * PROFILE_GIF_PRESET.height * 4
    ) {
      throw new Error("OffscreenCanvas returned invalid RGBA data");
    }
    for (let offset = 3; offset < rgba.length; offset += 4) {
      if (rgba[offset] !== 255) {
        throw new Error("OffscreenCanvas returned a transparent GIF base");
      }
    }
    return rgba;
  } catch (error) {
    throw error?.gifExportCode
      ? error
      : createWorkerError(WORKER_ERROR_CODES.SOURCE_FAILED);
  } finally {
    bitmap?.close?.();
  }
}

function normalizeWorkerRequest(message) {
  if (
    message?.type !== "generate" ||
    !CARD_THEMES.includes(message.cardTheme) ||
    typeof message.jobId !== "string" ||
    message.jobId === "" ||
    typeof message.sourceKey !== "string" ||
    message.sourceKey === "" ||
    message.presetVersion !== GIF_EXPORT_PRESET_VERSION
  ) {
    throw createWorkerError(WORKER_ERROR_CODES.INVALID_OUTPUT);
  }
  return Object.freeze({
    cardTheme: message.cardTheme,
    jobId: message.jobId,
    sourceKey: message.sourceKey,
    sourceUrl: message.sourceUrl
  });
}

function shouldReportProgress(completedFrames) {
  return completedFrames === 1 ||
    completedFrames === PROFILE_GIF_PRESET.frameCount ||
    completedFrames % 4 === 0;
}

function hasUnsafePathSegment(candidate) {
  return candidate.split(/[?#]/, 1)[0].split("/").some((segment) => {
    let decoded = segment;
    for (let pass = 0; pass < 3; pass += 1) {
      try {
        const next = decodeURIComponent(decoded);
        if (next === decoded) break;
        decoded = next;
      } catch {
        return true;
      }
    }
    return decoded === "." || decoded === "..";
  });
}

function createWorkerError(code) {
  const error = new Error(code);
  error.gifExportCode = code;
  return error;
}

function isDedicatedWorkerScope(scope) {
  return typeof scope?.WorkerGlobalScope === "function" &&
    scope instanceof scope.WorkerGlobalScope;
}

if (isDedicatedWorkerScope(globalThis)) {
  let started = false;
  globalThis.addEventListener("message", (event) => {
    if (started || event?.data?.type !== "generate") return;
    started = true;
    const request = event.data;
    runGifExportWorkerJob(request).catch((error) => {
      globalThis.postMessage({
        code: error?.gifExportCode ?? WORKER_ERROR_CODES.ENCODE_FAILED,
        jobId: request?.jobId,
        sourceKey: request?.sourceKey,
        type: "error"
      });
    });
  });
}
