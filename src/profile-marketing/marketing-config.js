export const MARKETING_SAMPLE_CARD_URL = "/assets/codex-card-sample.png";
export const MARKETING_OPERATOR_CARD_HANDLE = "postmelee";
export const MARKETING_CARD_LOCALES = Object.freeze(["en", "ko"]);
export const MARKETING_SUBMIT_COMMAND = "npx codex-usage-profile@latest submit";

const MARKETING_OPERATOR_HANDLE_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const MARKETING_QUICKSTART_STEPS = Object.freeze([
  createStep(
    "approve-device",
    "Approve your device",
    "Open the link from the CLI and approve the device with your signed-in account."
  ),
  createStep(
    "submit-usage",
    "Submit Codex usage",
    "Let the CLI read your Codex usage and send the supported usage fields."
  ),
  createStep(
    "review-card",
    "Review your card",
    "Confirm the updated private card on the home page."
  ),
  createStep(
    "publish-card",
    "Publish your card",
    "Make the card public when it is ready to share."
  ),
  createStep(
    "copy-readme",
    "Copy README Markdown",
    "Copy the stable image link or Markdown for your GitHub README."
  )
]);

export const DEFAULT_MARKETING_COPY = Object.freeze({
  appCta: "Create your card",
  appUnavailable: "App URL unavailable",
  description: "Keep one shareable card up to date with the Codex usage you submit.",
  quickstartDescription: "Connect the CLI once, review your card, and reuse the same image link.",
  quickstartTitle: "Quickstart",
  sampleCardAlt: "Sample Codex usage card",
  title: "Codex Usage Profile"
});

export function createMarketingConfig(options = {}) {
  const copy = normalizeCopy(options.copy);
  const canonicalAppUrl = normalizeOptionalCanonicalAppUrl(
    options.canonicalAppUrl
  );
  const operatorCardHandle = normalizeOperatorCardHandle(
    options.operatorCardHandle ?? MARKETING_OPERATOR_CARD_HANDLE
  );

  return Object.freeze({
    appHref: canonicalAppUrl ? new URL("/", canonicalAppUrl).toString() : null,
    canonicalAppUrl,
    copy,
    operatorCardHandle,
    sampleCardUrl: normalizeNonEmptyString(
      options.sampleCardUrl ?? MARKETING_SAMPLE_CARD_URL,
      "sampleCardUrl"
    ),
    submitCommand: normalizeNonEmptyString(
      options.submitCommand ?? MARKETING_SUBMIT_COMMAND,
      "submitCommand"
    ),
    quickstartSteps: MARKETING_QUICKSTART_STEPS
  });
}

export function buildMarketingOperatorCardUrl(config, locale = "en") {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new TypeError("config must be a marketing config object");
  }

  const handle = normalizeOperatorCardHandle(config.operatorCardHandle);
  if (!MARKETING_CARD_LOCALES.includes(locale)) {
    throw new TypeError(
      `locale must be one of: ${MARKETING_CARD_LOCALES.join(", ")}`
    );
  }

  return `/u/${handle}/card.png?locale=${locale}`;
}

export function normalizeOptionalCanonicalAppUrl(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new TypeError("canonicalAppUrl must be an absolute URL");
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new TypeError("canonicalAppUrl must be an absolute URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new TypeError("canonicalAppUrl must use http or https");
  }

  if (url.protocol === "http:" && !isLoopbackHostname(url.hostname)) {
    throw new TypeError("canonicalAppUrl must use https outside local development");
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new TypeError("canonicalAppUrl must not contain credentials, query, or hash");
  }

  return url.toString().replace(/\/$/, "");
}

function normalizeOperatorCardHandle(value) {
  const normalized = normalizeNonEmptyString(
    value,
    "operatorCardHandle"
  );

  if (
    normalized.length > 200 ||
    normalized !== normalized.toLowerCase() ||
    !MARKETING_OPERATOR_HANDLE_PATTERN.test(normalized)
  ) {
    throw new TypeError(
      "operatorCardHandle must be a lowercase public profile handle"
    );
  }

  return normalized;
}

function normalizeCopy(value) {
  if (value === undefined) return DEFAULT_MARKETING_COPY;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("copy must be an object");
  }

  return Object.freeze(Object.fromEntries(
    Object.entries(DEFAULT_MARKETING_COPY).map(([key, defaultValue]) => [
      key,
      normalizeNonEmptyString(value[key] ?? defaultValue, `copy.${key}`)
    ])
  ));
}

function normalizeNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty string`);
  }

  return value.trim();
}

function createStep(id, title, description) {
  return Object.freeze({ description, id, title });
}

function isLoopbackHostname(hostname) {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" ||
    normalized === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/.test(normalized);
}
