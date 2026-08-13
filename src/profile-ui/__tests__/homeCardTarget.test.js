import assert from "node:assert/strict";
import test from "node:test";

import {
  HOME_CARD_SOURCE_KINDS,
  createHomeCardSource
} from "../homeCardTransition.js";
import {
  HOME_CARD_TARGET_STATUSES,
  resolveHomeCardTarget
} from "../homeCardTarget.js";

const OPERATOR_SOURCE = createHomeCardSource({
  kind: HOME_CARD_SOURCE_KINDS.OPERATOR,
  src: "/u/postmelee/card.png?locale=en"
});
const SAMPLE_SOURCE = createHomeCardSource({
  kind: HOME_CARD_SOURCE_KINDS.SAMPLE,
  src: "/assets/codex-card-sample.png"
});

test("keeps auth and authenticated profile bootstrap unresolved", () => {
  for (const input of [
    { authStatus: "loading", profileStatus: "idle" },
    { authStatus: "authenticated", profileStatus: "idle" },
    { authStatus: "authenticated", profileStatus: "loading" }
  ]) {
    const target = resolveTarget(input);
    assert.equal(target.status, HOME_CARD_TARGET_STATUSES.UNRESOLVED);
    assert.equal(target.source, null);
    assert.equal(Object.isFrozen(target), true);
  }
});

test("selects the operator only after anonymous or unavailable auth is final", () => {
  for (const authStatus of ["anonymous", "unavailable"]) {
    const target = resolveTarget({ authStatus, profileStatus: "idle" });
    assert.equal(target.status, HOME_CARD_TARGET_STATUSES.SELECTED);
    assert.deepEqual(target.source, OPERATOR_SOURCE);
    assert.equal(Object.isFrozen(target), true);
    assert.equal(Object.isFrozen(target.source), true);
  }
});

test("selects the owner only after a ready profile supplies usage and preview", () => {
  const target = resolveTarget({
    authStatus: "authenticated",
    hasUsage: true,
    ownerPreviewSrc: "/api/profile/card.png?locale=en&theme=dark",
    profileStatus: "ready"
  });

  assert.equal(target.status, HOME_CARD_TARGET_STATUSES.SELECTED);
  assert.deepEqual(target.source, {
    kind: HOME_CARD_SOURCE_KINDS.OWNER,
    src: "/api/profile/card.png?locale=en&theme=dark"
  });
});

test("selects the sample for ready no-usage and profile error outcomes", () => {
  for (const input of [
    { authStatus: "authenticated", hasUsage: false, profileStatus: "ready" },
    { authStatus: "authenticated", hasUsage: true, profileStatus: "error" },
    {
      authStatus: "authenticated",
      hasUsage: true,
      ownerPreviewSrc: null,
      profileStatus: "ready"
    }
  ]) {
    const target = resolveTarget(input);
    assert.equal(target.status, HOME_CARD_TARGET_STATUSES.SELECTED);
    assert.deepEqual(target.source, SAMPLE_SOURCE);
  }
});

function resolveTarget(overrides) {
  return resolveHomeCardTarget({
    authStatus: "loading",
    hasUsage: false,
    operatorSource: OPERATOR_SOURCE,
    ownerPreviewSrc: null,
    profileStatus: "idle",
    sampleSource: SAMPLE_SOURCE,
    ...overrides
  });
}
