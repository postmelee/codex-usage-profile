import {
  GIF_EXPORT_PRESET_VERSION,
  PROFILE_GIF_PRESET
} from "../profile-card/gif-animation.js";
import { assertProfileGifContract } from "../profile-card/gif-binary.js";

export const GIF_EXPORT_STATUSES = Object.freeze({
  ERROR: "error",
  GENERATING: "generating",
  IDLE: "idle",
  READY: "ready"
});

export const GIF_EXPORT_ERROR_CODES = Object.freeze({
  ENCODE_FAILED: "encode_failed",
  INVALID_OUTPUT: "invalid_output",
  SOURCE_FAILED: "source_failed",
  TIMED_OUT: "timed_out",
  TOO_LARGE: "too_large",
  UNSUPPORTED: "unsupported"
});

const VALID_ERROR_CODES = new Set(Object.values(GIF_EXPORT_ERROR_CODES));
const INITIAL_STATE = createState();

export function buildGifExportSourceKey(options = {}) {
  const selectedImageUrl = normalizeKeyPart(
    options.selectedImageUrl,
    "selectedImageUrl"
  );
  const cardTheme = normalizeKeyPart(options.cardTheme ?? "dark", "cardTheme")
    .toLowerCase();
  const cardLocale = normalizeKeyPart(options.cardLocale ?? "en", "cardLocale")
    .toLowerCase();
  const shareRevision = normalizeRevision(options.shareRevision);

  return JSON.stringify({
    cardLocale,
    cardTheme,
    presetVersion: GIF_EXPORT_PRESET_VERSION,
    selectedImageUrl,
    shareRevision
  });
}

export function isBrowserGifExportSupported(environment = globalThis) {
  return Boolean(
    typeof environment?.Worker === "function" &&
    typeof environment?.Blob === "function" &&
    typeof environment?.DecompressionStream === "function" &&
    typeof environment?.createImageBitmap === "function" &&
    typeof environment?.OffscreenCanvas === "function" &&
    typeof environment?.URL?.createObjectURL === "function" &&
    typeof environment?.URL?.revokeObjectURL === "function"
  );
}

export function createGifExportController(options = {}) {
  const environment = options.environment ?? globalThis;
  const workerFactory = options.workerFactory ?? createBrowserGifExportWorker;
  const supported = options.isSupported ?? (() => (
    isBrowserGifExportSupported(environment)
  ));
  const BlobConstructor = options.BlobConstructor ?? environment.Blob;
  const createObjectUrl = options.createObjectUrl ?? (
    (blob) => environment.URL.createObjectURL(blob)
  );
  const revokeObjectUrl = options.revokeObjectUrl ?? (
    (value) => environment.URL.revokeObjectURL(value)
  );
  const setTimer = options.setTimer ?? environment.setTimeout?.bind(environment);
  const clearTimer = options.clearTimer ?? environment.clearTimeout?.bind(environment);
  const timeoutMs = options.timeoutMs ?? PROFILE_GIF_PRESET.jobTimeoutMs;
  const listeners = new Set();

  let activeJob = null;
  let disposed = false;
  let nextJobId = 1;
  let state = INITIAL_STATE;

  if (typeof workerFactory !== "function") {
    throw new TypeError("GIF export worker factory must be a function");
  }
  if (typeof supported !== "function") {
    throw new TypeError("GIF export capability check must be a function");
  }
  if (typeof setTimer !== "function" || typeof clearTimer !== "function") {
    throw new TypeError("GIF export timer functions must be available");
  }

  return Object.freeze({
    cancel,
    dispose,
    generate,
    getSnapshot: () => state,
    reset,
    subscribe,
    synchronizeSource
  });

  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("GIF export subscriber must be a function");
    }
    if (disposed) return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function generate(request = {}) {
    assertUsable();
    const sourceUrl = normalizeKeyPart(request.sourceUrl, "sourceUrl");
    const sourceKey = normalizeKeyPart(
      request.sourceKey ?? buildGifExportSourceKey({
        cardLocale: request.cardLocale,
        cardTheme: request.cardTheme,
        selectedImageUrl: sourceUrl,
        shareRevision: request.shareRevision
      }),
      "sourceKey"
    );

    if (
      state.status === GIF_EXPORT_STATUSES.READY &&
      state.sourceKey === sourceKey
    ) {
      return state;
    }
    if (
      activeJob &&
      activeJob.sourceKey === sourceKey
    ) {
      return state;
    }

    cancelActiveJob();
    releaseReadyUrl();

    let capabilityAvailable = false;
    try {
      capabilityAvailable = supported();
    } catch {
      capabilityAvailable = false;
    }
    if (!capabilityAvailable) {
      updateState(createState({
        errorCode: GIF_EXPORT_ERROR_CODES.UNSUPPORTED,
        sourceKey,
        status: GIF_EXPORT_STATUSES.ERROR
      }));
      return state;
    }

    let worker;
    try {
      worker = workerFactory();
      assertWorker(worker);
    } catch {
      worker?.terminate?.();
      updateState(createState({
        errorCode: GIF_EXPORT_ERROR_CODES.UNSUPPORTED,
        sourceKey,
        status: GIF_EXPORT_STATUSES.ERROR
      }));
      return state;
    }

    const jobId = `gif-${nextJobId++}`;
    const handleMessage = (event) => receiveWorkerMessage(jobId, event?.data);
    const handleError = () => failActiveJob(
      jobId,
      GIF_EXPORT_ERROR_CODES.ENCODE_FAILED
    );
    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.addEventListener("messageerror", handleError);

    activeJob = {
      handleError,
      handleMessage,
      jobId,
      lastCompletedFrames: 0,
      sourceKey,
      timeoutId: null,
      worker
    };
    activeJob.timeoutId = setTimer(() => {
      failActiveJob(jobId, GIF_EXPORT_ERROR_CODES.TIMED_OUT);
    }, timeoutMs);

    updateState(createState({
      progress: 0,
      sourceKey,
      status: GIF_EXPORT_STATUSES.GENERATING
    }));

    try {
      worker.postMessage({
        jobId,
        presetVersion: GIF_EXPORT_PRESET_VERSION,
        sourceKey,
        sourceUrl,
        type: "generate"
      });
    } catch {
      failActiveJob(jobId, GIF_EXPORT_ERROR_CODES.UNSUPPORTED);
    }
    return state;
  }

  function receiveWorkerMessage(jobId, message) {
    const job = activeJob;
    if (
      !job ||
      job.jobId !== jobId ||
      message?.jobId !== job.jobId ||
      message?.sourceKey !== job.sourceKey
    ) {
      return;
    }

    if (message.type === "progress") {
      const completedFrames = message.completedFrames;
      const totalFrames = message.totalFrames;
      if (
        !Number.isInteger(completedFrames) ||
        !Number.isInteger(totalFrames) ||
        totalFrames !== PROFILE_GIF_PRESET.frameCount ||
        completedFrames < job.lastCompletedFrames ||
        completedFrames < 1 ||
        completedFrames > totalFrames
      ) {
        failActiveJob(jobId, GIF_EXPORT_ERROR_CODES.INVALID_OUTPUT);
        return;
      }
      job.lastCompletedFrames = completedFrames;
      updateState(createState({
        progress: completedFrames / totalFrames,
        sourceKey: job.sourceKey,
        status: GIF_EXPORT_STATUSES.GENERATING
      }));
      return;
    }

    if (message.type === "complete") {
      completeActiveJob(jobId, message.bytes);
      return;
    }

    if (message.type === "error") {
      failActiveJob(jobId, normalizeWorkerErrorCode(message.code));
    }
  }

  function completeActiveJob(jobId, buffer) {
    const job = activeJob;
    if (!job || job.jobId !== jobId) return;

    let blobUrl = null;
    try {
      if (!(buffer instanceof ArrayBuffer)) {
        throw createExportError(GIF_EXPORT_ERROR_CODES.INVALID_OUTPUT);
      }
      if (buffer.byteLength >= PROFILE_GIF_PRESET.maxBytes) {
        throw createExportError(GIF_EXPORT_ERROR_CODES.TOO_LARGE);
      }
      const bytes = new Uint8Array(buffer);
      assertProfileGifContract(bytes);
      if (typeof BlobConstructor !== "function") {
        throw createExportError(GIF_EXPORT_ERROR_CODES.UNSUPPORTED);
      }
      const blob = new BlobConstructor([bytes], { type: "image/gif" });
      if (blob.size !== bytes.byteLength || blob.type !== "image/gif") {
        throw createExportError(GIF_EXPORT_ERROR_CODES.INVALID_OUTPUT);
      }
      blobUrl = createObjectUrl(blob);
      if (typeof blobUrl !== "string" || blobUrl === "") {
        throw createExportError(GIF_EXPORT_ERROR_CODES.INVALID_OUTPUT);
      }

      finishActiveJob(job);
      updateState(createState({
        blobUrl,
        byteLength: bytes.byteLength,
        progress: 1,
        sourceKey: job.sourceKey,
        status: GIF_EXPORT_STATUSES.READY
      }));
    } catch (error) {
      if (blobUrl) safeRevokeObjectUrl(blobUrl);
      failActiveJob(
        jobId,
        error?.gifExportCode ?? GIF_EXPORT_ERROR_CODES.INVALID_OUTPUT
      );
    }
  }

  function failActiveJob(jobId, errorCode) {
    const job = activeJob;
    if (!job || job.jobId !== jobId) return;
    finishActiveJob(job);
    updateState(createState({
      errorCode,
      sourceKey: job.sourceKey,
      status: GIF_EXPORT_STATUSES.ERROR
    }));
  }

  function cancel() {
    assertUsable();
    if (!activeJob) return state;
    cancelActiveJob();
    updateState(INITIAL_STATE);
    return state;
  }

  function reset() {
    assertUsable();
    cancelActiveJob();
    releaseReadyUrl();
    updateState(INITIAL_STATE);
    return state;
  }

  function synchronizeSource(sourceKey) {
    assertUsable();
    const normalizedSourceKey = normalizeKeyPart(sourceKey, "sourceKey");
    if (state.sourceKey && state.sourceKey !== normalizedSourceKey) {
      reset();
    }
    return state;
  }

  function dispose() {
    if (disposed) return;
    cancelActiveJob();
    releaseReadyUrl();
    state = INITIAL_STATE;
    disposed = true;
    listeners.clear();
  }

  function cancelActiveJob() {
    if (!activeJob) return;
    finishActiveJob(activeJob);
  }

  function finishActiveJob(job) {
    if (activeJob !== job) return;
    activeJob = null;
    clearTimer(job.timeoutId);
    job.worker.removeEventListener("message", job.handleMessage);
    job.worker.removeEventListener("error", job.handleError);
    job.worker.removeEventListener("messageerror", job.handleError);
    job.worker.terminate();
  }

  function releaseReadyUrl() {
    if (
      state.status !== GIF_EXPORT_STATUSES.READY ||
      !state.blobUrl
    ) {
      return;
    }
    safeRevokeObjectUrl(state.blobUrl);
  }

  function safeRevokeObjectUrl(value) {
    try {
      revokeObjectUrl(value);
    } catch {
      // URL cleanup is best-effort; state still advances to avoid reuse.
    }
  }

  function updateState(nextState) {
    if (state === nextState) return;
    state = nextState;
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // Store observers must not corrupt Worker and object URL cleanup.
      }
    }
  }

  function assertUsable() {
    if (disposed) {
      throw new Error("GIF export controller has been disposed");
    }
  }
}

function createBrowserGifExportWorker() {
  return new Worker(new URL("./gifExport.worker.js", import.meta.url), {
    name: "profile-gif-export",
    type: "module"
  });
}

function createState(overrides = {}) {
  return Object.freeze({
    blobUrl: overrides.blobUrl ?? null,
    byteLength: overrides.byteLength ?? null,
    errorCode: overrides.errorCode ?? null,
    progress: overrides.progress ?? 0,
    sourceKey: overrides.sourceKey ?? null,
    status: overrides.status ?? GIF_EXPORT_STATUSES.IDLE
  });
}

function assertWorker(worker) {
  if (
    !worker ||
    typeof worker.postMessage !== "function" ||
    typeof worker.terminate !== "function" ||
    typeof worker.addEventListener !== "function" ||
    typeof worker.removeEventListener !== "function"
  ) {
    throw new TypeError("GIF export worker factory returned an invalid Worker");
  }
}

function normalizeWorkerErrorCode(code) {
  return VALID_ERROR_CODES.has(code)
    ? code
    : GIF_EXPORT_ERROR_CODES.ENCODE_FAILED;
}

function createExportError(code) {
  const error = new Error(code);
  error.gifExportCode = code;
  return error;
}

function normalizeKeyPart(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`GIF export ${name} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeRevision(value) {
  if (value === undefined || value === null || value === "") return null;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("GIF export shareRevision must be a non-negative safe integer");
  }
  return value;
}
