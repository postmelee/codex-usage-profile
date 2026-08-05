export const PROFILE_MAINTENANCE_CONTRACT_VERSION = 1;
export const PROFILE_MAINTENANCE_SCHEMA_VERSION = 1;

export const PROFILE_MAINTENANCE_OPERATIONS = Object.freeze([
  "plan",
  "export",
  "restore",
  "retention",
  "delete-account",
  "repair-publication"
]);

const BACKUP_KEYS = Object.freeze([
  "contentDigest",
  "contractVersion",
  "createdAt",
  "operation",
  "profiles",
  "schemaVersion"
]);
const PROFILE_KEYS = Object.freeze([
  "latestSnapshot",
  "latestUsage",
  "owner",
  "publication",
  "submittedDevices"
]);
const PROFILE_OPTIONAL_KEYS = Object.freeze(["presentationDigest"]);
const FORBIDDEN_BACKUP_KEYS = new Set([
  "accountUsageRateLimits",
  "cliLoginChallenges",
  "cliTokens",
  "deviceCodeDigest",
  "oauthStates",
  "rateLimits",
  "sessions",
  "tokenDigest"
]);

export async function createProfileMaintenanceBackup(options = {}) {
  const core = {
    contractVersion: PROFILE_MAINTENANCE_CONTRACT_VERSION,
    createdAt: normalizeIsoDate(options.createdAt),
    operation: "export",
    profiles: normalizeProfiles(options.profiles),
    schemaVersion: PROFILE_MAINTENANCE_SCHEMA_VERSION
  };
  assertNoForbiddenBackupFields(core);
  return deepFreeze({
    ...core,
    contentDigest: await createProfileMaintenanceDigest(core)
  });
}

export async function assertProfileMaintenanceBackup(value) {
  requirePlainObject(value, "maintenance backup");
  assertExactKeys(value, BACKUP_KEYS, "maintenance backup");
  if (value.contractVersion !== PROFILE_MAINTENANCE_CONTRACT_VERSION) {
    throw new TypeError("maintenance backup contract version is unsupported");
  }
  if (value.schemaVersion !== PROFILE_MAINTENANCE_SCHEMA_VERSION) {
    throw new TypeError("maintenance backup schema version is unsupported");
  }
  if (value.operation !== "export") {
    throw new TypeError("maintenance backup operation must be export");
  }

  const core = {
    contractVersion: value.contractVersion,
    createdAt: normalizeIsoDate(value.createdAt),
    operation: value.operation,
    profiles: normalizeProfiles(value.profiles),
    schemaVersion: value.schemaVersion
  };
  assertNoForbiddenBackupFields(core);
  const digest = await createProfileMaintenanceDigest(core);
  if (!safeEqualText(digest, value.contentDigest)) {
    throw new TypeError("maintenance backup content digest does not match");
  }
  return deepFreeze({ ...core, contentDigest: digest });
}

export async function createProfileMaintenanceDigest(value) {
  const bytes = new TextEncoder().encode(stableStringify(value));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return toBase64Url(digest);
}

export function createProfileMaintenanceSummary(options = {}) {
  const contentDigest = requireDigest(options.contentDigest);
  const objectCount = requireNonNegativeInteger(
    options.objectCount,
    "objectCount"
  );
  const ownerCount = requireNonNegativeInteger(
    options.ownerCount,
    "ownerCount"
  );
  const operation = requireOperation(options.operation);

  return Object.freeze({
    contentDigest,
    contractVersion: PROFILE_MAINTENANCE_CONTRACT_VERSION,
    createdAt: normalizeIsoDate(options.createdAt),
    objectCount,
    operation,
    ownerCount,
    schemaVersion: PROFILE_MAINTENANCE_SCHEMA_VERSION
  });
}

export function stableStringify(value) {
  return JSON.stringify(sortJsonValue(value));
}

export function safeEqualText(left, right) {
  const leftBytes = new TextEncoder().encode(String(left ?? ""));
  const rightBytes = new TextEncoder().encode(String(right ?? ""));
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

function normalizeProfiles(value) {
  if (!Array.isArray(value) || value.length !== 1) {
    throw new TypeError("maintenance backup must contain exactly one profile");
  }
  return value.map((profile) => {
    requirePlainObject(profile, "maintenance profile");
    assertAllowedProfileKeys(profile);
    requirePlainObject(profile.owner, "maintenance profile owner");
    if (!Array.isArray(profile.submittedDevices)) {
      throw new TypeError("maintenance submittedDevices must be an array");
    }
    for (const device of profile.submittedDevices) {
      requirePlainObject(device, "maintenance submitted device");
    }
    if (profile.latestSnapshot !== null) {
      requirePlainObject(profile.latestSnapshot, "maintenance latest snapshot");
    }
    if (profile.latestUsage !== null) {
      requirePlainObject(profile.latestUsage, "maintenance latest usage");
    }
    if (profile.publication !== null) {
      requirePlainObject(profile.publication, "maintenance publication");
    }
    return structuredClone(profile);
  });
}

function assertAllowedProfileKeys(value) {
  const actual = Object.keys(value).sort();
  const legacy = [...PROFILE_KEYS].sort();
  const current = [...PROFILE_KEYS, ...PROFILE_OPTIONAL_KEYS].sort();
  const matches = (expected) =>
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
  if (!matches(legacy) && !matches(current)) {
    throw new TypeError("maintenance profile fields are invalid");
  }
}

function assertNoForbiddenBackupFields(value, path = "backup") {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoForbiddenBackupFields(item, `${path}[${index}]`)
    );
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_BACKUP_KEYS.has(key)) {
      throw new TypeError(`maintenance backup contains forbidden field at ${path}`);
    }
    assertNoForbiddenBackupFields(item, `${path}.${key}`);
  }
}

function sortJsonValue(value) {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, sortJsonValue(value[key])])
  );
}

function assertExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const allowed = [...expected].sort();
  if (
    actual.length !== allowed.length ||
    actual.some((key, index) => key !== allowed[index])
  ) {
    throw new TypeError(`${label} fields are invalid`);
  }
}

function requirePlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function requireOperation(value) {
  if (!PROFILE_MAINTENANCE_OPERATIONS.includes(value)) {
    throw new TypeError("maintenance operation is unsupported");
  }
  return value;
}

function requireDigest(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new TypeError("contentDigest must be a SHA-256 base64url digest");
  }
  return value;
}

function requireNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative integer`);
  }
  return value;
}

function normalizeIsoDate(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("maintenance timestamp must be a valid date");
  }
  return date.toISOString();
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
