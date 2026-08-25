import {
  HOME_CARD_SOURCE_KINDS,
  createHomeCardSource
} from "./homeCardTransition.js";

export const HOME_CARD_TARGET_STATUSES = Object.freeze({
  SELECTED: "selected",
  UNRESOLVED: "unresolved"
});

const UNRESOLVED_TARGET = Object.freeze({
  source: null,
  status: HOME_CARD_TARGET_STATUSES.UNRESOLVED
});

export function resolveHomeCardTarget({
  authStatus,
  hasUsage,
  operatorSource,
  ownerPreviewSrc,
  profileStatus,
  sampleSource
} = {}) {
  if (authStatus === "loading") return UNRESOLVED_TARGET;

  if (authStatus !== "authenticated") {
    return createSelectedTarget(operatorSource);
  }

  if (profileStatus === "idle" || profileStatus === "loading") {
    return UNRESOLVED_TARGET;
  }

  if (profileStatus === "ready" && hasUsage === false) {
    return createSelectedTarget(operatorSource);
  }

  if (
    profileStatus === "ready" &&
    hasUsage === true &&
    typeof ownerPreviewSrc === "string" &&
    ownerPreviewSrc !== ""
  ) {
    return createSelectedTarget({
      kind: HOME_CARD_SOURCE_KINDS.OWNER,
      src: ownerPreviewSrc
    });
  }

  return createSelectedTarget(sampleSource);
}

function createSelectedTarget(source) {
  return Object.freeze({
    source: createHomeCardSource(source),
    status: HOME_CARD_TARGET_STATUSES.SELECTED
  });
}
