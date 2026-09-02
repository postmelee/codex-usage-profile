import {
  PROFILE_ATTACHMENT_HEIGHT,
  PROFILE_ATTACHMENT_PRESET_VERSION,
  PROFILE_ATTACHMENT_SOURCE_MAX_BYTES,
  PROFILE_ATTACHMENT_WIDTH,
  drawProfileAttachmentCanvas
} from "../profile-card/attachment-canvas.js";
import { normalizeCardTheme } from "../profile-card/theme.js";
import { parsePublicShareRevision } from "../profile-shared/public-share-url.js";

export const PNG_EXPORT_ERROR_CODES = Object.freeze({
  ENCODE_FAILED: "encode_failed",
  SOURCE_FAILED: "source_failed",
  UNSUPPORTED: "unsupported"
});

export function buildPngExportSourceKey(options = {}) {
  const selectedImageUrl = normalizeKeyPart(
    options.selectedImageUrl,
    "selectedImageUrl"
  );
  const cardLocale = normalizeKeyPart(
    options.cardLocale ?? "en",
    "cardLocale"
  ).toLowerCase();

  return JSON.stringify({
    cardLocale,
    cardTheme: normalizeCardTheme(options.cardTheme),
    presetVersion: PROFILE_ATTACHMENT_PRESET_VERSION,
    selectedImageUrl,
    shareRevision: parsePublicShareRevision(options.shareRevision)
  });
}

export function isBrowserPngExportSupported(environment = globalThis) {
  const canvas = environment?.document?.createElement?.("canvas");
  return Boolean(
    typeof environment?.fetch === "function" &&
    typeof environment?.createImageBitmap === "function" &&
    canvas &&
    typeof canvas.getContext === "function" &&
    typeof canvas.toBlob === "function"
  );
}

export async function createProfileAttachmentPngBlob(
  request = {},
  dependencies = {}
) {
  const environment = dependencies.environment ?? globalThis;
  const signal = request.signal;
  throwIfAborted(signal);

  const fetchImpl = dependencies.fetchImpl ??
    environment.fetch?.bind(environment);
  const decodeImage = dependencies.decodeImage ??
    createBrowserImageDecoder(environment);
  const createCanvas = dependencies.createCanvas ??
    createBrowserCanvasFactory(environment);
  const encodeCanvas = dependencies.encodeCanvas ?? encodeBrowserCanvas;
  const origin = dependencies.origin ?? environment.location?.origin;

  if (
    typeof fetchImpl !== "function" ||
    typeof decodeImage !== "function" ||
    typeof createCanvas !== "function" ||
    typeof encodeCanvas !== "function"
  ) {
    throw createPngExportError(PNG_EXPORT_ERROR_CODES.UNSUPPORTED);
  }

  const sourceUrl = normalizePngExportSourceUrl(request.sourceUrl, origin);
  const sourceBlob = await fetchSourcePng(sourceUrl, fetchImpl, signal);
  const decoded = await decodeSourcePng(sourceBlob, decodeImage, signal);

  try {
    throwIfAborted(signal);
    let canvas;
    try {
      canvas = createCanvas(
        PROFILE_ATTACHMENT_WIDTH,
        PROFILE_ATTACHMENT_HEIGHT
      );
      canvas.width = PROFILE_ATTACHMENT_WIDTH;
      canvas.height = PROFILE_ATTACHMENT_HEIGHT;
    } catch {
      throw createPngExportError(PNG_EXPORT_ERROR_CODES.UNSUPPORTED);
    }

    const context = canvas.getContext?.("2d", { alpha: true });
    if (!context) {
      throw createPngExportError(PNG_EXPORT_ERROR_CODES.UNSUPPORTED);
    }
    drawProfileAttachmentCanvas(context, decoded.source, {
      theme: request.cardTheme
    });
    throwIfAborted(signal);

    let output;
    try {
      output = await encodeCanvas(canvas, "image/png");
    } catch (error) {
      if (signal?.aborted) throwAbort(signal);
      throw createPngExportError(
        PNG_EXPORT_ERROR_CODES.ENCODE_FAILED,
        error
      );
    }
    throwIfAborted(signal);
    if (
      !output ||
      output.size <= 0 ||
      output.type.split(";", 1)[0].trim().toLowerCase() !== "image/png"
    ) {
      throw createPngExportError(PNG_EXPORT_ERROR_CODES.ENCODE_FAILED);
    }
    return output;
  } finally {
    decoded.close();
  }
}

export function normalizePngExportSourceUrl(value, origin) {
  if (typeof value !== "string" || value.trim() === "") {
    throw createPngExportError(PNG_EXPORT_ERROR_CODES.SOURCE_FAILED);
  }
  if (typeof origin !== "string" || origin === "") {
    throw createPngExportError(PNG_EXPORT_ERROR_CODES.UNSUPPORTED);
  }

  let baseUrl;
  let sourceUrl;
  try {
    baseUrl = new URL(origin);
    sourceUrl = new URL(value.trim(), baseUrl);
  } catch {
    throw createPngExportError(PNG_EXPORT_ERROR_CODES.SOURCE_FAILED);
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
    throw createPngExportError(PNG_EXPORT_ERROR_CODES.SOURCE_FAILED);
  }
  return sourceUrl;
}

async function fetchSourcePng(sourceUrl, fetchImpl, signal) {
  let response;
  try {
    response = await fetchImpl(sourceUrl.toString(), {
      cache: "no-cache",
      credentials: "same-origin",
      signal
    });
  } catch (error) {
    if (signal?.aborted) throwAbort(signal);
    throw createPngExportError(PNG_EXPORT_ERROR_CODES.SOURCE_FAILED, error);
  }
  if (!response?.ok) {
    throw createPngExportError(PNG_EXPORT_ERROR_CODES.SOURCE_FAILED);
  }
  if (response.url) {
    try {
      if (new URL(response.url).origin !== sourceUrl.origin) {
        throw createPngExportError(PNG_EXPORT_ERROR_CODES.SOURCE_FAILED);
      }
    } catch (error) {
      if (error?.pngExportCode) throw error;
      throw createPngExportError(PNG_EXPORT_ERROR_CODES.SOURCE_FAILED, error);
    }
  }

  const contentType = response.headers?.get?.("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  const contentLengthHeader = response.headers?.get?.("content-length");
  const contentLength = contentLengthHeader === null
    ? null
    : Number(contentLengthHeader);
  if (
    contentType !== "image/png" ||
    (
      contentLength !== null &&
      (!Number.isFinite(contentLength) ||
        contentLength > PROFILE_ATTACHMENT_SOURCE_MAX_BYTES)
    )
  ) {
    throw createPngExportError(PNG_EXPORT_ERROR_CODES.SOURCE_FAILED);
  }

  let blob;
  try {
    blob = await response.blob();
  } catch (error) {
    if (signal?.aborted) throwAbort(signal);
    throw createPngExportError(PNG_EXPORT_ERROR_CODES.SOURCE_FAILED, error);
  }
  if (
    !blob ||
    blob.size <= 0 ||
    blob.size > PROFILE_ATTACHMENT_SOURCE_MAX_BYTES ||
    blob.type.split(";", 1)[0].trim().toLowerCase() !== "image/png"
  ) {
    throw createPngExportError(PNG_EXPORT_ERROR_CODES.SOURCE_FAILED);
  }
  return blob;
}

async function decodeSourcePng(blob, decodeImage, signal) {
  let decoded;
  try {
    decoded = await decodeImage(blob, { signal });
  } catch (error) {
    if (signal?.aborted) throwAbort(signal);
    throw createPngExportError(PNG_EXPORT_ERROR_CODES.SOURCE_FAILED, error);
  }
  const source = decoded?.source ?? decoded;
  if (
    !source ||
    !Number.isFinite(source.width) ||
    source.width <= 0 ||
    !Number.isFinite(source.height) ||
    source.height <= 0
  ) {
    decoded?.close?.();
    throw createPngExportError(PNG_EXPORT_ERROR_CODES.SOURCE_FAILED);
  }
  return Object.freeze({
    close() {
      decoded?.close?.();
      if (decoded !== source) source.close?.();
    },
    source
  });
}

function createBrowserImageDecoder(environment) {
  if (typeof environment?.createImageBitmap !== "function") return null;
  return async (blob) => environment.createImageBitmap(blob);
}

function createBrowserCanvasFactory(environment) {
  if (typeof environment?.document?.createElement !== "function") return null;
  return () => environment.document.createElement("canvas");
}

function encodeBrowserCanvas(canvas, type) {
  if (typeof canvas?.toBlob !== "function") {
    throw createPngExportError(PNG_EXPORT_ERROR_CODES.UNSUPPORTED);
  }
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(createPngExportError(PNG_EXPORT_ERROR_CODES.ENCODE_FAILED));
        }
      }, type);
    } catch (error) {
      reject(createPngExportError(PNG_EXPORT_ERROR_CODES.ENCODE_FAILED, error));
    }
  });
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

function normalizeKeyPart(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`PNG export ${name} must be a non-empty string`);
  }
  return value.trim();
}

function throwIfAborted(signal) {
  if (signal?.aborted) throwAbort(signal);
}

function throwAbort(signal) {
  throw signal.reason ??
    new DOMException("PNG export was aborted", "AbortError");
}

function createPngExportError(code, cause) {
  const error = new Error(code, cause ? { cause } : undefined);
  error.pngExportCode = code;
  return error;
}
