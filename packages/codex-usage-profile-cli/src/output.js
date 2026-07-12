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

  const status = output.submission?.idempotent
    ? "Usage is already up to date."
    : "Usage submitted successfully.";
  stdout.write(`${status}\n`);
  if (output.submission?.capturedAt) {
    stdout.write(`Captured: ${output.submission.capturedAt}\n`);
  }
  if (output.profile?.profileUrl) {
    stdout.write(`Profile: ${output.profile.profileUrl}\n`);
  }
  if (output.profile?.imageUrl) {
    stdout.write(`Card: ${output.profile.imageUrl}\n`);
  }
  if (output.profile?.readmeMarkdown) {
    stdout.write(`README: ${output.profile.readmeMarkdown}\n`);
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
