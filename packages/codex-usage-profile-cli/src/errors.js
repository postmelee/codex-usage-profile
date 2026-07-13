export class CliError extends Error {
  constructor(code, message, options = {}) {
    super(message);

    this.name = "CliError";
    this.code = code;
    this.exitCode = options.exitCode ?? 1;
  }
}

export function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new CliError("invalid_input", `${label} is required`);
  }

  return value.trim();
}
