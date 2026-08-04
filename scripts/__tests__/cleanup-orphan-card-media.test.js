import assert from "node:assert/strict";
import test from "node:test";

import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command
} from "@aws-sdk/client-s3";

import {
  cleanupHelpText,
  cleanupOrphanCardMedia,
  parseCleanupArgs
} from "../cleanup-orphan-card-media.mjs";

test("dry-run paginates stable and revision objects while preserving every guard", async () => {
  const fixture = createCleanupFixture();
  const log = [];

  const result = await cleanupOrphanCardMedia({
    bucket: "cards",
    client: fixture.client,
    log: (line) => log.push(line),
    now: NOW
  });

  assert.deepEqual(
    result.candidates.map((candidate) => candidate.key),
    [fixture.candidateKey]
  );
  assert.equal(result.summary.mode, "dry-run");
  assert.equal(result.summary.deleted, 0);
  assert.equal(fixture.client.deletedKeys.length, 0);
  assert.equal(fixture.client.listCalls > 2, true);
  assert.equal(log.some((line) => line.startsWith("DRY-RUN ")), true);
  assert.equal(log.at(-1).startsWith("SUMMARY mode=dry-run"), true);
  assert.equal(log.join("\n").includes("secret-value"), false);
  assert.equal(log.join("\n").includes("body-value"), false);
});

test("apply rechecks stable metadata and skips a newly referenced candidate", async () => {
  const fixture = createCleanupFixture({ referenceCandidateOnRecheck: true });
  const log = [];

  const result = await cleanupOrphanCardMedia({
    apply: true,
    bucket: "cards",
    client: fixture.client,
    log: (line) => log.push(line),
    now: NOW
  });

  assert.equal(result.summary.candidates, 1);
  assert.equal(result.summary.deleted, 0);
  assert.equal(result.summary.skipped, 1);
  assert.deepEqual(fixture.client.deletedKeys, []);
  assert.equal(log.some((line) => line.startsWith("SKIP-REFERENCED ")), true);
});

test("apply deletes only the exact candidate after the race guard", async () => {
  const fixture = createCleanupFixture();

  const result = await cleanupOrphanCardMedia({
    apply: true,
    bucket: "cards",
    client: fixture.client,
    log: () => {},
    now: NOW
  });

  assert.equal(result.summary.deleted, 1);
  assert.equal(result.summary.skipped, 0);
  assert.deepEqual(fixture.client.deletedKeys, [fixture.candidateKey]);
  assert.equal(
    fixture.client.deletedKeys.some((key) => key.startsWith("cards/v2/public/")),
    false
  );
});

test("stable tombstones are retained without protecting immutable revisions", async () => {
  const fixture = createCleanupFixture({ includeTombstone: true });

  const result = await cleanupOrphanCardMedia({
    bucket: "cards",
    client: fixture.client,
    log: () => {},
    now: NOW
  });

  assert.equal(result.summary.scannedStable, 2);
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.key),
    [fixture.candidateKey]
  );
  assert.equal(
    fixture.client.deletedKeys.some((key) => key.endsWith("/card.png")),
    false
  );
});

test("v4 cleanup protects all theme revisions and counts the light stable object", async () => {
  const stableKey = "cards/v2/public/owner-a/card.png";
  const lightStableKey = "cards/v2/public/owner-a/themes/light/card.png";
  const protectedKeys = {
    darkEn: revisionKey("owner_a", "en", 20),
    darkKo: revisionKey("owner_a", "ko", 21),
    lightEn: themeRevisionKey("owner_a", "light", "en", 22),
    lightKo: themeRevisionKey("owner_a", "light", "ko", 23)
  };
  const candidateKey = themeRevisionKey("owner_a", "light", "en", 24);
  const objects = [
    { Key: stableKey, LastModified: daysAgo(1) },
    { Key: lightStableKey, LastModified: daysAgo(1) },
    ...Object.values(protectedKeys).map((Key) => ({
      Key,
      LastModified: daysAgo(120)
    })),
    { Key: candidateKey, LastModified: daysAgo(200) }
  ];
  const client = new CleanupFakeS3Client({
    objects,
    pageSize: 10,
    stableMetadata: new Map([[stableKey, {
      "contract-version": "4",
      "dark-en-key": protectedKeys.darkEn,
      "dark-ko-key": protectedKeys.darkKo,
      "light-en-key": protectedKeys.lightEn,
      "light-ko-key": protectedKeys.lightKo,
      kind: "publication",
      "owner-id": "owner_a"
    }]])
  });

  const result = await cleanupOrphanCardMedia({
    bucket: "cards",
    client,
    log: () => {},
    now: NOW,
    recentRevisions: 1
  });

  assert.equal(result.summary.scannedStable, 2);
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.key),
    [candidateKey]
  );
});

test("cleanup fails closed on an unknown stable publication contract", async () => {
  const stableKey = "cards/v2/public/owner-a/card.png";
  const client = new CleanupFakeS3Client({
    objects: [{ Key: stableKey, LastModified: daysAgo(1) }],
    pageSize: 10,
    stableMetadata: new Map([[stableKey, {
      "contract-version": "5",
      kind: "publication",
      "owner-id": "owner_a"
    }]])
  });

  await assert.rejects(
    cleanupOrphanCardMedia({
      bucket: "cards",
      client,
      log: () => {},
      now: NOW
    }),
    /contract version is invalid/
  );
  assert.deepEqual(client.deletedKeys, []);
});

test("CLI accepts only help and explicit apply", () => {
  assert.deepEqual(parseCleanupArgs([]), { apply: false, help: false });
  assert.deepEqual(parseCleanupArgs(["--apply"]), { apply: true, help: false });
  assert.deepEqual(parseCleanupArgs(["--help"]), { apply: false, help: true });
  assert.throws(() => parseCleanupArgs(["*"]), /Unsupported cleanup option/);
  assert.match(cleanupHelpText(), /Defaults to dry-run/);
  assert.match(cleanupHelpText(), /irreversible delete/);
});

function createCleanupFixture(options = {}) {
  const revisions = [];
  for (let index = 0; index < 6; index += 1) {
    revisions.push({
      Key: revisionKey("owner_a", "en", index),
      LastModified: daysAgo(120 - index)
    });
  }
  const referencedOldKey = revisions[0].Key;
  const candidateKey = revisions[1].Key;
  const koreanKey = revisionKey("owner_a", "ko", 0);
  revisions.push({
    Key: koreanKey,
    LastModified: daysAgo(200)
  });
  revisions.push({
    Key: revisionKey("owner_b", "en", 0),
    LastModified: daysAgo(300)
  });
  revisions.push({
    Key: revisionKey("owner_a", "en", 8),
    LastModified: daysAgo(10)
  });
  revisions.push({
    Key: "cards/v2/owners/owner_a/revisions/en/not-a-revision.png",
    LastModified: daysAgo(400)
  });

  const stableKey = "cards/v2/public/owner-a/card.png";
  const tombstoneKey = "cards/v2/public/retired-owner/card.png";
  const stableObjects = [
    { Key: stableKey, LastModified: daysAgo(1) }
  ];
  const stableMetadata = new Map([[
    stableKey,
    {
      "en-key": referencedOldKey,
      "ko-key": koreanKey,
      "owner-id": "owner_a"
    }
  ]]);
  if (options.includeTombstone) {
    stableObjects.push({ Key: tombstoneKey, LastModified: daysAgo(1) });
    stableMetadata.set(tombstoneKey, {
      handle: "retired-owner",
      kind: "unpublished",
      "tombstone-id": "tombstone_1",
      "unpublished-at": "2026-07-20T00:00:00.000Z"
    });
  }
  const client = new CleanupFakeS3Client({
    objects: [
      ...stableObjects,
      ...revisions
    ],
    pageSize: 3,
    stableMetadata,
    onStableList(callCount, metadata) {
      if (options.referenceCandidateOnRecheck && callCount === 2) {
        metadata.get(stableKey)["en-key"] = candidateKey;
      }
    }
  });
  return { candidateKey, client };
}

class CleanupFakeS3Client {
  constructor(options) {
    this.deletedKeys = [];
    this.listCalls = 0;
    this.objects = options.objects;
    this.onStableList = options.onStableList;
    this.pageSize = options.pageSize;
    this.stableListCalls = 0;
    this.stableMetadata = options.stableMetadata;
  }

  async send(command) {
    const input = command.input;
    if (command instanceof ListObjectsV2Command) {
      this.listCalls += 1;
      if (input.Prefix === "cards/v2/public/") {
        this.stableListCalls += 1;
        this.onStableList?.(this.stableListCalls, this.stableMetadata);
      }
      const matching = this.objects
        .filter((object) => object.Key.startsWith(input.Prefix))
        .sort((left, right) => left.Key.localeCompare(right.Key));
      const start = input.ContinuationToken
        ? Number(input.ContinuationToken)
        : 0;
      const contents = matching.slice(start, start + this.pageSize);
      const next = start + contents.length;
      return {
        Contents: contents,
        IsTruncated: next < matching.length,
        NextContinuationToken: next < matching.length ? String(next) : undefined
      };
    }
    if (command instanceof HeadObjectCommand) {
      const metadata = this.stableMetadata.get(input.Key);
      if (!metadata) throw s3Error("NoSuchKey", 404);
      return { Metadata: { ...metadata } };
    }
    if (command instanceof DeleteObjectCommand) {
      this.deletedKeys.push(input.Key);
      this.objects = this.objects.filter((object) => object.Key !== input.Key);
      return {};
    }
    throw new Error(`unsupported command: ${command.constructor.name}`);
  }
}

function revisionKey(ownerId, locale, index) {
  const suffix = String(index).padStart(2, "0");
  const revision = `${"A".repeat(41)}${suffix}`;
  return `cards/v2/owners/${ownerId}/revisions/${locale}/${revision}.png`;
}

function themeRevisionKey(ownerId, theme, locale, index) {
  const suffix = String(index).padStart(2, "0");
  const revision = `${"B".repeat(41)}${suffix}`;
  return `cards/v2/owners/${ownerId}/revisions/${theme}/${locale}/${revision}.png`;
}

function daysAgo(days) {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1_000);
}

function s3Error(name, status) {
  const error = new Error(name);
  error.name = name;
  error.$metadata = { httpStatusCode: status };
  return error;
}

const NOW = new Date("2026-07-23T00:00:00.000Z");
