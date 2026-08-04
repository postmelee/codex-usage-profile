export const DEFAULT_PROFILE_MEDIA_RETENTION_DAYS = 90;
export const DEFAULT_PROFILE_MEDIA_RECENT_REVISIONS = 5;
export const PROFILE_MEDIA_REVISION_PREFIX = "cards/v2/owners/";
export const PROFILE_MEDIA_STABLE_PREFIX = "cards/v2/public/";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;
const REVISION_KEY_PATTERN =
  /^cards\/v2\/owners\/([^/]+)\/revisions\/(?:(light)\/)?(en|ko)\/([A-Za-z0-9_-]{43})\.png$/;

export function parseProfileMediaRevisionObject(object = {}) {
  const key = object.key ?? object.Key;
  if (typeof key !== "string") return null;
  const match = key.match(REVISION_KEY_PATTERN);
  if (!match) return null;
  const lastModified = normalizeOptionalDate(
    object.lastModified ?? object.uploaded ?? object.LastModified
  );
  if (!lastModified) return null;
  return Object.freeze({
    key,
    lastModified,
    locale: match[3],
    ownerId: match[1],
    revision: match[4],
    size: normalizeOptionalSize(object.size ?? object.Size),
    storageEtag: normalizeOptionalString(
      object.storageEtag ?? object.etag ?? object.ETag
    ),
    theme: match[2] ?? "dark"
  });
}

export function selectProfileMediaCleanupCandidates(revisions, options = {}) {
  if (!Array.isArray(revisions)) {
    throw new TypeError("revisions must be an array");
  }
  const now = normalizeDate(options.now ?? new Date());
  const protectedKeys = options.protectedKeys ?? new Set();
  const recentRevisions = requirePositiveInteger(
    options.recentRevisions ?? DEFAULT_PROFILE_MEDIA_RECENT_REVISIONS,
    "recentRevisions"
  );
  const retentionDays = requirePositiveInteger(
    options.retentionDays ?? DEFAULT_PROFILE_MEDIA_RETENTION_DAYS,
    "retentionDays"
  );
  const groups = new Map();

  for (const object of revisions) {
    const parsed = parseProfileMediaRevisionObject(object);
    if (!parsed) continue;
    const groupKey = `${parsed.ownerId}\u0000${parsed.theme}\u0000${parsed.locale}`;
    const group = groups.get(groupKey) ?? [];
    group.push(parsed);
    groups.set(groupKey, group);
  }

  const candidates = [];
  for (const group of groups.values()) {
    group.sort((left, right) =>
      right.lastModified.getTime() - left.lastModified.getTime() ||
      left.key.localeCompare(right.key)
    );
    group.forEach((object, index) => {
      const ageDays = Math.floor(
        (now.getTime() - object.lastModified.getTime()) / MILLISECONDS_PER_DAY
      );
      if (
        protectedKeys.has(object.key) ||
        index < recentRevisions ||
        ageDays <= retentionDays
      ) {
        return;
      }
      candidates.push(Object.freeze({
        ageDays,
        key: object.key,
        locale: object.locale,
        ownerId: object.ownerId,
        reason:
          `older_than_${retentionDays}_days_and_beyond_latest_${recentRevisions}`,
        revision: object.revision,
        storageEtag: object.storageEtag,
        theme: object.theme
      }));
    });
  }

  return candidates.sort((left, right) => left.key.localeCompare(right.key));
}

export function isProfileMediaStableKey(key) {
  return /^cards\/v2\/public\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/themes\/light)?\/card\.png$/.test(key);
}

function normalizeDate(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("now must be a valid date");
  }
  return date;
}

function normalizeOptionalDate(value) {
  if (value === undefined || value === null) return null;
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeOptionalSize(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") return null;
  return value.replace(/^"|"$/gu, "") || null;
}

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer`);
  }
  return value;
}
