export const HOME_CARD_SOURCE_KINDS = Object.freeze({
  OPERATOR: "operator",
  OWNER: "owner",
  SAMPLE: "sample"
});

export const HOME_CARD_TRANSITION_STATUSES = Object.freeze({
  FALLBACK: "fallback",
  LOADING: "loading",
  READY: "ready",
  UNAVAILABLE: "unavailable"
});

const HOME_CARD_SOURCE_KIND_VALUES = new Set(
  Object.values(HOME_CARD_SOURCE_KINDS)
);
const LOCAL_URL_BASE = "https://codex-usage-profile.invalid";

export function createHomeCardSource(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new TypeError("card source must be an object");
  }

  const unsupportedKeys = Object.keys(candidate).filter(
    (key) => !["kind", "src"].includes(key)
  );
  if (unsupportedKeys.length > 0) {
    throw new TypeError(
      `card source contains unsupported keys: ${unsupportedKeys.join(", ")}`
    );
  }

  if (!HOME_CARD_SOURCE_KIND_VALUES.has(candidate.kind)) {
    throw new TypeError("card source kind is not supported");
  }

  return Object.freeze({
    kind: candidate.kind,
    src: normalizeSameOriginPath(candidate.src, "card source src")
  });
}

export function createHomeCardTransition({ fallbackSrc, target } = {}) {
  const fallbackSource = createHomeCardSource({
    kind: HOME_CARD_SOURCE_KINDS.SAMPLE,
    src: fallbackSrc
  });

  return freezeTransition({
    fallbackSource,
    generation: 1,
    pending: createHomeCardSource(target),
    pendingIsFallback: false,
    status: HOME_CARD_TRANSITION_STATUSES.LOADING,
    visible: null
  });
}

export function beginHomeCardTransition(state, target) {
  const current = requireTransition(state);

  return freezeTransition({
    ...current,
    generation: current.generation + 1,
    pending: createHomeCardSource(target),
    pendingIsFallback: false,
    status: HOME_CARD_TRANSITION_STATUSES.LOADING
  });
}

export function resolveHomeCardTransition(state, generation) {
  const current = requireTransition(state);
  if (!isCurrentPendingGeneration(current, generation)) return current;

  return freezeTransition({
    ...current,
    pending: null,
    pendingIsFallback: false,
    status: current.pendingIsFallback
      ? HOME_CARD_TRANSITION_STATUSES.FALLBACK
      : HOME_CARD_TRANSITION_STATUSES.READY,
    visible: current.pending
  });
}

export function rejectHomeCardTransition(state, generation) {
  const current = requireTransition(state);
  if (!isCurrentPendingGeneration(current, generation)) return current;

  if (
    current.pendingIsFallback ||
    current.pending.kind === HOME_CARD_SOURCE_KINDS.SAMPLE
  ) {
    return freezeTransition({
      ...current,
      pending: null,
      pendingIsFallback: false,
      status: HOME_CARD_TRANSITION_STATUSES.UNAVAILABLE,
      visible: null
    });
  }

  return freezeTransition({
    ...current,
    generation: current.generation + 1,
    pending: current.fallbackSource,
    pendingIsFallback: true,
    status: HOME_CARD_TRANSITION_STATUSES.LOADING
  });
}

export function resetHomeCardTransition(state, target) {
  const current = requireTransition(state);

  return freezeTransition({
    ...current,
    generation: current.generation + 1,
    pending: createHomeCardSource(target),
    pendingIsFallback: false,
    status: HOME_CARD_TRANSITION_STATUSES.LOADING,
    visible: null
  });
}

function freezeTransition(state) {
  return Object.freeze({
    fallbackSource: state.fallbackSource,
    generation: state.generation,
    pending: state.pending,
    pendingIsFallback: state.pendingIsFallback,
    status: state.status,
    visible: state.visible
  });
}

function requireTransition(state) {
  if (
    !state ||
    typeof state !== "object" ||
    Array.isArray(state) ||
    !Object.isFrozen(state) ||
    !Number.isSafeInteger(state.generation) ||
    state.generation < 1
  ) {
    throw new TypeError("state must be a home card transition");
  }
  return state;
}

function isCurrentPendingGeneration(state, generation) {
  return Number.isSafeInteger(generation) &&
    generation === state.generation &&
    state.pending !== null;
}

function normalizeSameOriginPath(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty same-origin path`);
  }

  const candidate = value.trim();
  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    hasUnsafePathSegment(candidate)
  ) {
    throw new TypeError(`${label} must be a safe same-origin path`);
  }

  let url;
  try {
    url = new URL(candidate, LOCAL_URL_BASE);
  } catch {
    throw new TypeError(`${label} must be a safe same-origin path`);
  }

  if (
    url.origin !== LOCAL_URL_BASE ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new TypeError(`${label} must be a safe same-origin path`);
  }

  return `${url.pathname}${url.search}`;
}

function hasUnsafePathSegment(candidate) {
  const pathname = candidate.split(/[?#]/, 1)[0];

  return pathname.split("/").some((segment) => {
    let decoded = segment;

    for (let pass = 0; pass < 3; pass += 1) {
      let next;
      try {
        next = decodeURIComponent(decoded);
      } catch {
        return true;
      }

      if (next === decoded) break;
      decoded = next;
    }

    return decoded === "." || decoded === "..";
  });
}
