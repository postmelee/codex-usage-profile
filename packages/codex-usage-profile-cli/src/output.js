import {
  formatTerminalHyperlink,
  supportsTerminalHyperlinks
} from "./device-login.js";

const ANSI_BRIGHT_BLACK = "\u001B[90m";
const ANSI_RESET = "\u001B[0m";

export function projectSubmitOutput(value, options = {}) {
  const forbiddenValues = normalizeForbiddenValues(options.forbiddenValues);
  return {
    submission: value?.submission
      ? {
          status: sanitizeString(value.submission.status, forbiddenValues),
          idempotent: typeof value.submission.idempotent === "boolean"
            ? value.submission.idempotent
            : null,
          contractVersion: Number.isSafeInteger(value.submission.contractVersion)
            ? value.submission.contractVersion
            : null,
          capturedAt: sanitizeString(value.submission.capturedAt, forbiddenValues),
          uploadedAt: sanitizeString(value.submission.uploadedAt, forbiddenValues)
        }
      : null,
    profile: value?.profile
      ? {
          handle: sanitizeString(value.profile.handle, forbiddenValues),
          visibility: sanitizeString(value.profile.visibility, forbiddenValues),
          profileUrl: sanitizeString(value.profile.profileUrl, forbiddenValues),
          imageUrl: sanitizeString(value.profile.imageUrl, forbiddenValues),
          readmeMarkdown: sanitizeString(value.profile.readmeMarkdown, forbiddenValues)
        }
      : null
  };
}

export function writeSubmitOutput(value, options = {}) {
  const output = projectSubmitOutput(value, options);
  const stdout = options.stdout;
  if (!stdout || typeof stdout.write !== "function") {
    throw new TypeError("stdout is required");
  }

  if (options.json) {
    stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return output;
  }

  const env = options.env ?? process.env;
  const hyperlinkEnabled = options.hyperlinks !== false &&
    supportsTerminalHyperlinks({
      env,
      stdout
    });
  const colorEnabled = supportsOutputColor({ env, stdout });

  const status = output.submission?.idempotent
    ? "✓ Usage is already up to date."
    : "✓ Usage submitted successfully.";
  stdout.write(`${status}\n`);
  if (output.submission?.capturedAt) {
    stdout.write(`Captured: ${output.submission.capturedAt}\n`);
  }
  const hasLinks = Boolean(
    output.profile?.profileUrl ||
    output.profile?.imageUrl ||
    output.profile?.readmeMarkdown
  );
  if (hasLinks) {
    stdout.write(`\n${formatLinksHeading(colorEnabled)}\n`);
  }
  if (output.profile?.profileUrl) {
    stdout.write(`  Profile: ${formatSubmitHyperlink(
      output.profile.profileUrl,
      hyperlinkEnabled
    )}\n`);
  }
  if (output.profile?.imageUrl) {
    stdout.write(`  Card:    ${formatSubmitHyperlink(
      output.profile.imageUrl,
      hyperlinkEnabled
    )}\n`);
  }
  if (output.profile?.readmeMarkdown) {
    stdout.write(`  README:  ${output.profile.readmeMarkdown}\n`);
  }

  return output;
}

function normalizeForbiddenValues(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item !== "");
}

function sanitizeString(value, forbiddenValues) {
  if (typeof value !== "string") return null;
  return forbiddenValues.some((secret) => value.includes(secret)) ? null : value;
}

function formatSubmitHyperlink(value, enabled) {
  if (!enabled || !isSafeHttpUrl(value)) return value;
  return formatTerminalHyperlink(value, { enabled: true });
}

function supportsOutputColor({ env, stdout }) {
  return stdout.isTTY === true &&
    env.TERM !== "dumb" &&
    !Object.hasOwn(env, "NO_COLOR");
}

function formatLinksHeading(enabled) {
  return enabled ? `${ANSI_BRIGHT_BLACK}Links${ANSI_RESET}` : "Links";
}

function isSafeHttpUrl(value) {
  if (typeof value !== "string" || /[\u0000-\u001F\u007F]/.test(value)) {
    return false;
  }
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
