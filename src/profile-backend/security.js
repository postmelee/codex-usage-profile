import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError
} from "./errors.js";

const SECRET_VALUE_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/i,
  /\bCODEX_ACCESS_TOKEN\s*=/i,
  /"access_token"\s*:/i,
  /"refresh_token"\s*:/i,
  /\bsk-[A-Za-z0-9_-]{10,}\b/,
  /\bgh[opsu]_[A-Za-z0-9_]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/
];

const SAFE_SECRET_SUFFIXES = new Set(["digest", "hash", "fingerprint"]);
const SECRET_WORDS = new Set(["password", "secret"]);
const KEY_PREFIX_WORDS = new Set([
  "access",
  "api",
  "auth",
  "codex",
  "github",
  "openai",
  "private",
  "upload"
]);
const TOKEN_PREFIX_WORDS = new Set([
  "access",
  "api",
  "auth",
  "bearer",
  "cli",
  "codex",
  "github",
  "id",
  "openai",
  "refresh",
  "upload"
]);

export function detectForbiddenSecrets(value, options = {}) {
  const rootPath = options.path ?? "$";
  const findings = [];
  const seen = new WeakSet();

  visit(value, rootPath, findings, seen);

  return findings;
}

export function assertNoForbiddenSecrets(value, options = {}) {
  const findings = detectForbiddenSecrets(value, options);

  if (findings.length > 0) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.FORBIDDEN_SECRET,
      "Payload contains fields that look like credentials",
      { details: findings }
    );
  }
}

export function hasForbiddenSecrets(value, options = {}) {
  return detectForbiddenSecrets(value, options).length > 0;
}

export function isForbiddenSecretKey(key) {
  const lowerKey = String(key).toLowerCase();
  if (lowerKey === "auth.json" || lowerKey === "authjson") {
    return true;
  }

  const words = keyToWords(key);
  if (words.length === 0) {
    return false;
  }

  if (words.some((word) => SECRET_WORDS.has(word))) {
    return !words.some((word) => SAFE_SECRET_SUFFIXES.has(word));
  }

  if (words.includes("authorization") || words.includes("bearer")) {
    return true;
  }

  const keyIndex = words.indexOf("key");
  if (keyIndex !== -1) {
    const nextWord = words[keyIndex + 1];
    if (SAFE_SECRET_SUFFIXES.has(nextWord)) {
      return false;
    }

    const previousWord = words[keyIndex - 1];
    return KEY_PREFIX_WORDS.has(previousWord);
  }

  const tokenIndex = words.indexOf("token");
  if (tokenIndex === -1) {
    return false;
  }

  const nextWord = words[tokenIndex + 1];
  if (SAFE_SECRET_SUFFIXES.has(nextWord)) {
    return false;
  }

  const previousWord = words[tokenIndex - 1];
  return words.length === 1 || TOKEN_PREFIX_WORDS.has(previousWord);
}

export function isForbiddenSecretValue(value) {
  if (typeof value !== "string") {
    return false;
  }

  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function visit(value, path, findings, seen) {
  if (typeof value === "string") {
    if (isForbiddenSecretValue(value)) {
      findings.push({
        path,
        reason: "secret-like value"
      });
    }

    return;
  }

  if (value === null || typeof value !== "object") {
    return;
  }

  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      visit(item, `${path}[${index}]`, findings, seen);
    });
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;

    if (isForbiddenSecretKey(key)) {
      findings.push({
        path: childPath,
        reason: "secret-like key"
      });
    }

    visit(child, childPath, findings, seen);
  }
}

function keyToWords(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
