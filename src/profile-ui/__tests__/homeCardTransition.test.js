import assert from "node:assert/strict";
import test from "node:test";

import {
  HOME_CARD_SOURCE_KINDS,
  HOME_CARD_TRANSITION_STATUSES,
  beginHomeCardTransition,
  createHomeCardSource,
  createHomeCardTransition,
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

function createTransition() {
  return createHomeCardTransition({
    fallbackSrc: SAMPLE_SRC,
    target: OPERATOR_SOURCE
  });
}

function restoreProperty(name, descriptor) {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
  } else {
    delete globalThis[name];
  }
}
