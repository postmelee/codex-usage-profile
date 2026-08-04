const CARD_STYLE_KEYS = Object.freeze(["effect", "schemaVersion", "theme"]);
const EFFECT_KEYS = Object.freeze(["preset", "version"]);

export const CARD_STYLE_SCHEMA_VERSION = 1;
export const CARD_STYLE_MAX_BYTES = 1_024;

export const CARD_PRESENTATION_REGISTRY = deepFreeze({
  themes: {
    light: {
      id: "light",
      version: 1,
      allowedOptions: {},
      defaults: {},
      staticRenderer: true,
      previewAdapterId: null,
      animatedExport: null
    },
    dark: {
      id: "dark",
      version: 1,
      allowedOptions: {},
      defaults: {},
      staticRenderer: true,
      previewAdapterId: null,
      animatedExport: null
    }
  },
  effects: {
    none: {
      id: "none",
      version: 1,
      allowedOptions: {},
      defaults: {},
      staticRenderer: true,
      previewAdapterId: null,
      animatedExport: null
    }
  }
});

export const DEFAULT_CARD_STYLE = deepFreeze({
  schemaVersion: CARD_STYLE_SCHEMA_VERSION,
  theme: "dark",
  effect: {
    preset: "none",
    version: 1
  }
});

export function normalizeCardStyle(value, options = {}) {
  const defaultWhenMissing = options.defaultWhenMissing ?? true;
  if (value === undefined || value === null) {
    if (!defaultWhenMissing) {
      throw new TypeError("cardStyle is required");
    }
    return clone(DEFAULT_CARD_STYLE);
  }

  assertBoundedJson(value);
  assertPlainObject(value, "cardStyle");
  assertExactKeys(value, CARD_STYLE_KEYS, "cardStyle");

  if (value.schemaVersion !== CARD_STYLE_SCHEMA_VERSION) {
    throw new TypeError("Unsupported cardStyle schemaVersion");
  }
  if (!Object.hasOwn(CARD_PRESENTATION_REGISTRY.themes, value.theme)) {
    throw new TypeError("Unsupported cardStyle theme");
  }

  assertPlainObject(value.effect, "cardStyle.effect");
  assertExactKeys(value.effect, EFFECT_KEYS, "cardStyle.effect");
  const effect = CARD_PRESENTATION_REGISTRY.effects[value.effect.preset];
  if (!effect || effect.version !== value.effect.version) {
    throw new TypeError("Unsupported cardStyle effect preset or version");
  }

  return {
    schemaVersion: CARD_STYLE_SCHEMA_VERSION,
    theme: value.theme,
    effect: {
      preset: effect.id,
      version: effect.version
    }
  };
}

export function serializeCardStyle(value) {
  return stableStringify(normalizeCardStyle(value));
}

export async function createPresentationDigest(value) {
  const serialized = serializeCardStyle(value);
  const bytes = new TextEncoder().encode(serialized);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return toBase64Url(new Uint8Array(digest));
}

function assertBoundedJson(value) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new TypeError("cardStyle must be valid JSON");
  }
  if (serialized === undefined) {
    throw new TypeError("cardStyle must be valid JSON");
  }
  if (new TextEncoder().encode(serialized).byteLength > CARD_STYLE_MAX_BYTES) {
    throw new TypeError("cardStyle exceeds the maximum size");
  }
}

function assertPlainObject(value, label) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError(`${label} must be an object`);
  }
}

function assertExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new TypeError(`${label} contains unsupported fields`);
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableStringify(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}
