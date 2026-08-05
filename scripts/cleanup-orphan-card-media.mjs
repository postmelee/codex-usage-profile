import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command
} from "@aws-sdk/client-s3";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_PROFILE_MEDIA_RECENT_REVISIONS,
  DEFAULT_PROFILE_MEDIA_RETENTION_DAYS,
  PROFILE_MEDIA_REVISION_PREFIX,
  PROFILE_MEDIA_STABLE_PREFIX,
  createProfileMediaS3Client,
  resolveR2ProfileMediaStoreOptions,
  selectProfileMediaCleanupCandidates
} from "../src/profile-media/index.js";

export const DEFAULT_CARD_MEDIA_RETENTION_DAYS =
  DEFAULT_PROFILE_MEDIA_RETENTION_DAYS;
export const DEFAULT_CARD_MEDIA_RECENT_REVISIONS =
  DEFAULT_PROFILE_MEDIA_RECENT_REVISIONS;
export { PROFILE_MEDIA_REVISION_PREFIX, PROFILE_MEDIA_STABLE_PREFIX };

const REVISION_KEY_PATTERN =
  /^cards\/v2\/owners\/([^/]+)\/revisions\/(?:(light)\/)?(en|ko)\/([A-Za-z0-9_-]{43})\.png$/;

export async function cleanupOrphanCardMedia(options = {}) {
  const client = requireClient(options.client);
  const bucket = requireNonEmptyString(options.bucket, "bucket");
  const now = normalizeDate(options.now ?? new Date());
  const apply = options.apply === true;
  const log = options.log ?? console.log;
  const retentionDays = requirePositiveInteger(
    options.retentionDays ?? DEFAULT_CARD_MEDIA_RETENTION_DAYS,
    "retentionDays"
  );
  const recentRevisions = requirePositiveInteger(
    options.recentRevisions ?? DEFAULT_CARD_MEDIA_RECENT_REVISIONS,
    "recentRevisions"
  );

  const stableSnapshot = await readStableReferences({ bucket, client });
  const revisions = await listRevisionObjects({ bucket, client });
  const candidates = selectCleanupCandidates(revisions, {
    now,
    protectedKeys: stableSnapshot.revisionKeys,
    recentRevisions,
    retentionDays
  });
  let deleted = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    if (!apply) {
      log(formatCandidate("DRY-RUN", candidate));
      continue;
    }

    // Re-scan stable metadata immediately before each irreversible delete.
    // This is deliberately stronger than trusting the first scan: a new
    // handle/publication created during the cleanup run protects its revision.
    const current = await readStableReferences({ bucket, client });
    if (current.revisionKeys.has(candidate.key)) {
      skipped += 1;
      log(formatCandidate("SKIP-REFERENCED", candidate));
      continue;
    }

    await client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: candidate.key
    }));
    deleted += 1;
    log(formatCandidate("DELETED", candidate));
  }

  const summary = Object.freeze({
    candidates: candidates.length,
    deleted,
    mode: apply ? "apply" : "dry-run",
    scannedRevisions: revisions.length,
    scannedStable: stableSnapshot.stableCount,
    skipped
  });
  log(
    `SUMMARY mode=${summary.mode} stable=${summary.scannedStable} ` +
    `revisions=${summary.scannedRevisions} candidates=${summary.candidates} ` +
    `deleted=${summary.deleted} skipped=${summary.skipped}`
  );
  return { candidates, summary };
}

export function selectCleanupCandidates(revisions, options = {}) {
  return selectProfileMediaCleanupCandidates(revisions, options);
}

export function parseCleanupArgs(args = []) {
  let apply = false;
  let help = false;
  for (const argument of args) {
    if (argument === "--apply") {
      apply = true;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      help = true;
      continue;
    }
    throw new TypeError(`Unsupported cleanup option: ${argument}`);
  }
  return { apply, help };
}

export function cleanupHelpText() {
  return [
    "Usage: npm run cleanup:card-media -- [--apply]",
    "",
    "Defaults to dry-run. Candidates must be unreferenced, older than 90 days,",
    "and outside the latest 5 revisions for the same owner, theme, and locale.",
    "--apply rechecks stable publication metadata before each irreversible delete."
  ].join("\n");
}

async function readStableReferences(options) {
  const stableObjects = await listObjects({
    ...options,
    prefix: PROFILE_MEDIA_STABLE_PREFIX
  });
  const revisionKeys = new Set();
  let stableCount = 0;

  for (const object of stableObjects) {
    if (!isStableKey(object.Key)) continue;
    if (!isAuthorityStableKey(object.Key)) {
      stableCount += 1;
      continue;
    }
    let response;
    try {
      response = await options.client.send(new HeadObjectCommand({
        Bucket: options.bucket,
        Key: object.Key
      }));
    } catch (error) {
      if (isNotFound(error)) continue;
      throw error;
    }
    const metadata = normalizeMetadata(response.Metadata);
    if (metadata.kind === "unpublished") {
      // Native R2 uses a stable tombstone because R2 delete has no storage
      // precondition. It intentionally protects no immutable revision and is
      // never itself a cleanup candidate.
      stableCount += 1;
      continue;
    }
    if (metadata.kind !== undefined && metadata.kind !== "publication") {
      throw new Error("stable media metadata kind is invalid");
    }
    const contractVersion = Number(metadata["contract-version"] ?? 3);
    if (![3, 4].includes(contractVersion)) {
      throw new Error("stable publication contract version is invalid");
    }
    const themes = contractVersion === 4 ? ["dark", "light"] : [null];
    for (const theme of themes) {
      for (const locale of ["en", "ko"]) {
        const prefix = theme ? `${theme}-` : "";
        const revisionKey = metadata[`${prefix}${locale}-key`];
        if (
          typeof revisionKey !== "string" ||
          !REVISION_KEY_PATTERN.test(revisionKey)
        ) {
          throw new Error("stable publication metadata is incomplete");
        }
        revisionKeys.add(revisionKey);
      }
    }
    stableCount += 1;
  }
  return { revisionKeys, stableCount };
}

async function listRevisionObjects(options) {
  return listObjects({
    ...options,
    prefix: PROFILE_MEDIA_REVISION_PREFIX
  });
}

async function listObjects(options) {
  const objects = [];
  let continuationToken;
  do {
    const response = await options.client.send(new ListObjectsV2Command({
      Bucket: options.bucket,
      ContinuationToken: continuationToken,
      Prefix: options.prefix
    }));
    for (const object of response.Contents ?? []) {
      if (typeof object?.Key === "string") objects.push(object);
    }
    if (!response.IsTruncated) break;
    continuationToken = response.NextContinuationToken;
    if (typeof continuationToken !== "string" || continuationToken === "") {
      throw new Error("paginated media listing omitted a continuation token");
    }
  } while (continuationToken);
  return objects;
}

function isStableKey(key) {
  return /^cards\/v2\/public\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/themes\/light)?\/card\.png$/.test(key) ||
    isSocialStableKey(key);
}

// Social objects are published and removed with the card publication, so the
// orphan sweep only counts them and never treats them as revision authorities.
function isSocialStableKey(key) {
  return /^cards\/v2\/public\/[a-z0-9]+(?:-[a-z0-9]+)*\/social\.png$/.test(key);
}

function isAuthorityStableKey(key) {
  return /^cards\/v2\/public\/[a-z0-9]+(?:-[a-z0-9]+)*\/card\.png$/.test(key);
}

function formatCandidate(action, candidate) {
  return `${action} key=${candidate.key} reason=${candidate.reason} ageDays=${candidate.ageDays}`;
}

function normalizeMetadata(value) {
  if (!value || typeof value !== "object") {
    throw new Error("stable publication metadata is missing");
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key.toLowerCase(),
      String(item)
    ])
  );
}

function isNotFound(error) {
  const status = error?.$metadata?.httpStatusCode;
  const code = error?.Code ?? error?.code ?? error?.name;
  return status === 404 || ["NotFound", "NoSuchKey"].includes(code);
}

function normalizeDate(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("now must be a valid date");
  return date;
}

function requireClient(client) {
  if (!client || typeof client.send !== "function") {
    throw new TypeError("client.send is required");
  }
  return client;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} is required`);
  }
  return value.trim();
}

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer`);
  }
  return value;
}

async function main() {
  const args = parseCleanupArgs(process.argv.slice(2));
  if (args.help) {
    console.log(cleanupHelpText());
    return;
  }

  const config = resolveR2ProfileMediaStoreOptions(process.env);
  const client = createProfileMediaS3Client(config);
  try {
    await cleanupOrphanCardMedia({
      apply: args.apply,
      bucket: config.bucket,
      client
    });
  } finally {
    client.destroy();
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(() => {
    console.error("Card media cleanup failed.");
    process.exitCode = 1;
  });
}
