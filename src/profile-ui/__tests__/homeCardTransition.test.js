import assert from "node:assert/strict";
import test from "node:test";

import {
  HOME_CARD_SOURCE_KINDS,
  HOME_CARD_TRANSITION_STATUSES,
  areHomeCardSourcesEqual,
  beginHomeCardTransition,
  createHomeCardSource,
  createHomeCardTransition,
  isHomeCardImageAbortError,
  loadHomeCardImage,
  rejectHomeCardTransition,
  resetHomeCardTransition,
  resolveHomeCardTransition
} from "../homeCardTransition.js";

const OPERATOR_SOURCE = Object.freeze({
  kind: HOME_CARD_SOURCE_KINDS.OPERATOR,
  src: "/u/postmelee/card.png?locale=en"
});
const OWNER_SOURCE = Object.freeze({
  kind: HOME_CARD_SOURCE_KINDS.OWNER,
  src: "/api/profile/card.png?locale=en"
});
const SAMPLE_SRC = "/assets/codex-card-sample.png";

test("starts with one immutable pending operator source", () => {
  const state = createTransition();

  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.pending), true);
  assert.equal(Object.isFrozen(state.fallbackSource), true);
  assert.equal(state.generation, 1);
  assert.equal(state.status, HOME_CARD_TRANSITION_STATUSES.LOADING);
  assert.deepEqual(state.pending, OPERATOR_SOURCE);
  assert.equal(state.pendingIsFallback, false);
  assert.equal(state.visible, null);
});

test("commits only the current generation and preserves the visible card while pending", () => {
  const operatorReady = resolveHomeCardTransition(createTransition(), 1);
  assert.equal(operatorReady.status, HOME_CARD_TRANSITION_STATUSES.READY);
  assert.deepEqual(operatorReady.visible, OPERATOR_SOURCE);
  assert.equal(operatorReady.pending, null);

  const ownerPending = beginHomeCardTransition(operatorReady, OWNER_SOURCE);
  assert.equal(ownerPending.generation, 2);
  assert.equal(ownerPending.status, HOME_CARD_TRANSITION_STATUSES.LOADING);
  assert.deepEqual(ownerPending.visible, OPERATOR_SOURCE);
  assert.deepEqual(ownerPending.pending, OWNER_SOURCE);

  assert.equal(
    resolveHomeCardTransition(ownerPending, 1),
    ownerPending
  );
  assert.equal(
    rejectHomeCardTransition(ownerPending, 1),
    ownerPending
  );

  const ownerReady = resolveHomeCardTransition(ownerPending, 2);
  assert.equal(ownerReady.status, HOME_CARD_TRANSITION_STATUSES.READY);
  assert.deepEqual(ownerReady.visible, OWNER_SOURCE);
  assert.equal(ownerReady.pending, null);
});

test("falls back once and stops after a sample failure", () => {
  const operatorFailed = rejectHomeCardTransition(createTransition(), 1);

  assert.equal(operatorFailed.generation, 2);
  assert.equal(operatorFailed.status, HOME_CARD_TRANSITION_STATUSES.LOADING);
  assert.equal(operatorFailed.pendingIsFallback, true);
  assert.deepEqual(operatorFailed.pending, {
    kind: HOME_CARD_SOURCE_KINDS.SAMPLE,
    src: SAMPLE_SRC
  });

  const fallbackReady = resolveHomeCardTransition(operatorFailed, 2);
  assert.equal(fallbackReady.status, HOME_CARD_TRANSITION_STATUSES.FALLBACK);
  assert.deepEqual(fallbackReady.visible, {
    kind: HOME_CARD_SOURCE_KINDS.SAMPLE,
    src: SAMPLE_SRC
  });

  const samplePending = beginHomeCardTransition(fallbackReady, {
    kind: HOME_CARD_SOURCE_KINDS.SAMPLE,
    src: SAMPLE_SRC
  });
  const sampleFailed = rejectHomeCardTransition(
    samplePending,
    samplePending.generation
  );

  assert.equal(
    sampleFailed.status,
    HOME_CARD_TRANSITION_STATUSES.UNAVAILABLE
  );
  assert.equal(sampleFailed.pending, null);
  assert.equal(sampleFailed.visible, null);
  assert.equal(
    rejectHomeCardTransition(sampleFailed, sampleFailed.generation),
    sampleFailed
  );
});

test("logout reset removes the owner source before a new operator load", () => {
  const operatorReady = resolveHomeCardTransition(createTransition(), 1);
  const ownerPending = beginHomeCardTransition(operatorReady, OWNER_SOURCE);
  const ownerReady = resolveHomeCardTransition(
    ownerPending,
    ownerPending.generation
  );
  assert.equal(ownerReady.visible.kind, HOME_CARD_SOURCE_KINDS.OWNER);

  const reset = resetHomeCardTransition(ownerReady, OPERATOR_SOURCE);

  assert.equal(reset.status, HOME_CARD_TRANSITION_STATUSES.LOADING);
  assert.equal(reset.visible, null);
  assert.deepEqual(reset.pending, OPERATOR_SOURCE);
  assert.doesNotMatch(JSON.stringify(reset), /api\/profile|owner_1|avatar/i);
});

test("rejects external, traversal, identity-bearing, and malformed sources", () => {
  for (const source of [
    { kind: HOME_CARD_SOURCE_KINDS.OWNER, src: "https://example.test/card.png" },
    { kind: HOME_CARD_SOURCE_KINDS.OWNER, src: "//example.test/card.png" },
    { kind: HOME_CARD_SOURCE_KINDS.OWNER, src: "/u/../private/card.png" },
    { kind: HOME_CARD_SOURCE_KINDS.OWNER, src: "/u/%2e%2e/private/card.png" },
    { kind: HOME_CARD_SOURCE_KINDS.OWNER, src: "/u/%252e%252e/private.png" },
    { kind: HOME_CARD_SOURCE_KINDS.OWNER, src: "/u\\..\\private.png" },
    { kind: HOME_CARD_SOURCE_KINDS.OWNER, src: "/u/%zz/card.png" },
    {
      kind: HOME_CARD_SOURCE_KINDS.OWNER,
      owner: { id: "owner_1" },
      src: "/api/profile/card.png"
    }
  ]) {
    assert.throws(
      () => createHomeCardSource(source),
      /same-origin path|unsupported keys/
    );
  }

  assert.throws(
    () => createHomeCardSource({ kind: "external", src: "/card.png" }),
    /kind is not supported/
  );
});

test("pure transitions never consult browser storage", () => {
  const localStorageDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage"
  );
  const sessionStorageDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "sessionStorage"
  );

  Object.defineProperties(globalThis, {
    localStorage: {
      configurable: true,
      get() {
        throw new Error("localStorage must not be read");
      }
    },
    sessionStorage: {
      configurable: true,
      get() {
        throw new Error("sessionStorage must not be read");
      }
    }
  });

  try {
    const initial = createTransition();
    const ready = resolveHomeCardTransition(initial, initial.generation);
    const pending = beginHomeCardTransition(ready, OWNER_SOURCE);
    const reset = resetHomeCardTransition(pending, OPERATOR_SOURCE);
    assert.equal(reset.visible, null);
  } finally {
    restoreProperty("localStorage", localStorageDescriptor);
    restoreProperty("sessionStorage", sessionStorageDescriptor);
  }
});

test("compares normalized sources without relying on object identity", () => {
  assert.equal(areHomeCardSourcesEqual(OPERATOR_SOURCE, { ...OPERATOR_SOURCE }), true);
  assert.equal(areHomeCardSourcesEqual(OPERATOR_SOURCE, OWNER_SOURCE), false);
  assert.equal(areHomeCardSourcesEqual(OPERATOR_SOURCE, null), false);
});

test("preloads and decodes an image before resolving the source", async () => {
  const image = createFakeImage();
  const pending = loadHomeCardImage(OWNER_SOURCE, {
    createImage: () => image
  });

  assert.equal(image.src, OWNER_SOURCE.src);
  assert.equal(image.decodeCalls, 0);

  image.complete = true;
  image.naturalWidth = 1497;
  image.onload();

  assert.deepEqual(await pending, OWNER_SOURCE);
  assert.equal(image.decodeCalls, 1);
  assert.equal(image.onload, null);
  assert.equal(image.onerror, null);
});

test("uses complete and naturalWidth when decode is unavailable", async () => {
  const image = createFakeImage({ decode: false });
  const pending = loadHomeCardImage(OPERATOR_SOURCE, {
    createImage: () => image
  });

  image.complete = true;
  image.naturalWidth = 1497;
  image.onload();

  assert.deepEqual(await pending, OPERATOR_SOURCE);
});

test("rejects decode failures and aborts an in-flight decode", async () => {
  const decodeFailure = createFakeImage({
    decode: () => Promise.reject(new Error("decode failed"))
  });
  const failed = loadHomeCardImage(OWNER_SOURCE, {
    createImage: () => decodeFailure
  });
  decodeFailure.complete = true;
  decodeFailure.naturalWidth = 1497;
  decodeFailure.onload();
  await assert.rejects(failed, /decode failed/);

  let releaseDecode;
  const slowImage = createFakeImage({
    decode: () => new Promise((resolve) => {
      releaseDecode = resolve;
    })
  });
  const controller = new AbortController();
  const aborted = loadHomeCardImage(OWNER_SOURCE, {
    createImage: () => slowImage,
    signal: controller.signal
  });
  slowImage.complete = true;
  slowImage.naturalWidth = 1497;
  slowImage.onload();
  controller.abort();
  releaseDecode();

  await assert.rejects(aborted, (error) => (
    isHomeCardImageAbortError(error)
  ));
  assert.equal(slowImage.onload, null);
  assert.equal(slowImage.onerror, null);
});

function createTransition() {
  return createHomeCardTransition({
    fallbackSrc: SAMPLE_SRC,
    target: OPERATOR_SOURCE
  });
}

function createFakeImage(options = {}) {
  const image = {
    complete: false,
    decodeCalls: 0,
    naturalWidth: 0,
    onerror: null,
    onload: null,
    src: ""
  };

  if (options.decode !== false) {
    image.decode = async () => {
      image.decodeCalls += 1;
      return options.decode?.();
    };
  }

  return image;
}

function restoreProperty(name, descriptor) {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
  } else {
    delete globalThis[name];
  }
}
