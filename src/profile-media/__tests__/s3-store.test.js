import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand
} from "@aws-sdk/client-s3";

import {
  createProfileMediaRevisionKey,
  createProfileMediaS3Client,
  createProfileMediaStableKey,
  createS3ProfileMediaStore,
  resolveR2ProfileMediaStoreOptions,
  resolveTestProfileMediaStoreOptions
} from "../index.js";

test("R2 config requires complete server-only connection settings", () => {
  assert.throws(
    () => resolveR2ProfileMediaStoreOptions({}),
    /R2_ACCESS_KEY_ID is required/
  );
  assert.deepEqual(resolveR2ProfileMediaStoreOptions({
    R2_ENDPOINT: "https://account.r2.cloudflarestorage.com",
    R2_BUCKET: "cards",
    R2_ACCESS_KEY_ID: "access",
    R2_SECRET_ACCESS_KEY: "secret"
  }), {
    accessKeyId: "access",
    bucket: "cards",
    endpoint: "https://account.r2.cloudflarestorage.com",
    forcePathStyle: false,
    operationTimeoutMs: 8_000,
    region: "auto",
    secretAccessKey: "secret"
  });
  assert.throws(
    () => resolveR2ProfileMediaStoreOptions({
      R2_ENDPOINT: "https://user:password@example.test/path",
      R2_BUCKET: "cards",
      R2_ACCESS_KEY_ID: "access",
      R2_SECRET_ACCESS_KEY: "secret"
    }),
    /contain only an origin/
  );
});

test("test S3 config is gated on every required setting", () => {
  const disabled = resolveTestProfileMediaStoreOptions({
    TEST_S3_ENDPOINT: "http://127.0.0.1:9000"
  });
  assert.equal(disabled.enabled, false);
  assert.match(disabled.reason, /TEST_S3_BUCKET/);

  const enabled = resolveTestProfileMediaStoreOptions({
    TEST_S3_ENDPOINT: "http://127.0.0.1:9000",
    TEST_S3_BUCKET: "cards",
    TEST_S3_ACCESS_KEY_ID: "minio",
    TEST_S3_SECRET_ACCESS_KEY: "minio-secret",
    TEST_S3_FORCE_PATH_STYLE: "true"
  });
  assert.equal(enabled.enabled, true);
  assert.equal(enabled.forcePathStyle, true);
  assert.equal(enabled.region, "us-east-1");
});

test("S3 adapter satisfies publication contract with a command client", async () => {
  const client = new FakeS3Client();
  const store = createS3ProfileMediaStore({
    bucket: "cards",
    client,
    operationTimeoutMs: 1_000
  });

  await exerciseS3Store(store);
  assert.equal(client.commandNames.includes("CopyObjectCommand"), true);
  assert.equal(client.commandNames.includes("HeadBucketCommand"), true);
});

test("S3 adapter fails closed when a HEAD references a missing locale revision", async () => {
  const client = new FakeS3Client();
  const store = createS3ProfileMediaStore({
    bucket: "cards",
    client,
    operationTimeoutMs: 1_000
  });
  const identity = createTestIdentity();
  await store.putRevision(identity.en);
  await store.putRevision(identity.ko);
  await store.publishRevision({
    ownerId: identity.ownerId,
    handle: identity.handle,
    publicationId: identity.publicationId,
    representations: {
      en: { revision: identity.en.revision, etag: identity.en.etag },
      ko: { revision: identity.ko.revision, etag: identity.ko.etag }
    }
  });
  await client.send(new DeleteObjectCommand({
    Bucket: "cards",
    Key: createProfileMediaRevisionKey(identity.ko)
  }));

  await assert.rejects(
    () => store.getPublishedCard({
      handle: identity.handle,
      locale: "ko",
      includeBody: false
    }),
    (error) => error.code === "not_found"
  );
  await assert.rejects(
    () => store.getPublishedCard({
      handle: identity.handle,
      locale: "ko",
      ifNoneMatch: identity.ko.etag
    }),
    (error) => error.code === "not_found"
  );
});

const integrationConfig = resolveTestProfileMediaStoreOptions(process.env);
test("S3 adapter satisfies contract against configured endpoint", {
  skip: integrationConfig.enabled ? false : integrationConfig.reason
}, async (t) => {
  const client = createProfileMediaS3Client(integrationConfig);
  const store = createS3ProfileMediaStore({
    bucket: integrationConfig.bucket,
    client,
    operationTimeoutMs: integrationConfig.operationTimeoutMs
  });
  const identity = createTestIdentity();
  t.after(async () => {
    for (const key of identity.keys) {
      try {
        await client.send(new DeleteObjectCommand({
          Bucket: integrationConfig.bucket,
          Key: key
        }));
      } catch {
        // Cleanup is best effort and limited to this test's unique keys.
      }
    }
    client.destroy();
  });

  await exerciseS3Store(store, identity);
});

async function exerciseS3Store(store, suppliedIdentity = createTestIdentity()) {
  const { en, ko, handle, ownerId, publicationId } = suppliedIdentity;
  assert.deepEqual(await store.verifyReadiness(), { ready: true });

  const first = await store.putRevision(en);
  const retry = await store.putRevision(en);
  await store.putRevision(ko);
  assert.equal(first.idempotent, false);
  assert.equal(retry.idempotent, true);
  await assert.rejects(
    () => store.putRevision({ ...en, body: Buffer.from("different") }),
    (error) => error.code === "conflict"
  );

  const published = await store.publishRevision({
    ownerId,
    handle,
    publicationId,
    representations: {
      en: { revision: en.revision, etag: en.etag },
      ko: { revision: ko.revision, etag: ko.etag }
    },
    publishedAt: "2026-07-22T02:00:00.000Z"
  });
  assert.deepEqual(published.body, en.body);
  assert.equal(published.etag, en.etag);
  assert.equal(published.representations.ko.etag, ko.etag);

  const korean = await store.getPublishedCard({ handle, locale: "ko" });
  assert.deepEqual(korean.body, ko.body);
  assert.equal(korean.etag, ko.etag);

  const notModified = await store.getPublishedCard({
    handle,
    locale: "ko",
    ifNoneMatch: ko.etag
  });
  assert.equal(notModified.notModified, true);
  assert.equal(notModified.body, null);

  const head = await store.getPublishedCard({
    handle,
    locale: "en",
    includeBody: false
  });
  assert.equal(head.notModified, false);
  assert.equal(head.body, null);

  const removed = await store.unpublishCard({ handle });
  assert.equal(removed.publicationId, publicationId);
  assert.equal(await store.getPublishedCard({ handle }), null);
  assert.notEqual(await store.getRevision(en), null);
  assert.notEqual(await store.getRevision(ko), null);
  assert.equal(await store.unpublishCard({ handle }), null);
}

function createTestIdentity() {
  const suffix = randomUUID().replaceAll("-", "");
  const ownerId = `owner_${suffix}`;
  const handle = `media-${suffix}`;
  const enBody = Buffer.from(`english-${suffix}`);
  const koBody = Buffer.from(`korean-${suffix}`);
  const en = createRevision(ownerId, "en", enBody);
  const ko = createRevision(ownerId, "ko", koBody);
  return {
    en,
    handle,
    keys: [
      createProfileMediaRevisionKey(en),
      createProfileMediaRevisionKey(ko),
      createProfileMediaStableKey({ handle })
    ],
    ko,
    ownerId,
    publicationId: `publication_${suffix}`
  };
}

function createRevision(ownerId, locale, body) {
  const revision = createHash("sha256").update(body).digest("base64url");
  return {
    body,
    createdAt: "2026-07-22T01:00:00.000Z",
    etag: `"${revision}"`,
    locale,
    ownerId,
    revision
  };
}

class FakeS3Client {
  constructor() {
    this.commandNames = [];
    this.objects = new Map();
    this.etagSequence = 0;
  }

  async send(command) {
    this.commandNames.push(command.constructor.name);
    const input = command.input;

    if (command instanceof HeadBucketCommand) return {};
    if (command instanceof PutObjectCommand) {
      if (input.IfNoneMatch === "*" && this.objects.has(input.Key)) {
        throw s3Error("PreconditionFailed", 412);
      }
      this.objects.set(input.Key, this.createObject(input));
      return { ETag: this.objects.get(input.Key).ETag };
    }
    if (command instanceof HeadObjectCommand) {
      return this.responseFor(this.requireObject(input.Key), false);
    }
    if (command instanceof GetObjectCommand) {
      const object = this.requireObject(input.Key);
      if (input.IfMatch && input.IfMatch !== object.ETag) {
        throw s3Error("PreconditionFailed", 412);
      }
      return this.responseFor(object, true);
    }
    if (command instanceof CopyObjectCommand) {
      const [, ...sourceParts] = decodeURIComponent(input.CopySource).split("/");
      const source = this.requireObject(sourceParts.join("/"));
      if (input.CopySourceIfMatch && input.CopySourceIfMatch !== source.ETag) {
        throw s3Error("PreconditionFailed", 412);
      }
      this.objects.set(input.Key, this.createObject({
        Body: source.Body,
        CacheControl: input.CacheControl,
        ContentType: input.ContentType,
        Metadata: input.Metadata
      }));
      return { CopyObjectResult: { ETag: this.objects.get(input.Key).ETag } };
    }
    if (command instanceof DeleteObjectCommand) {
      this.objects.delete(input.Key);
      return {};
    }
    throw new Error(`unsupported command: ${command.constructor.name}`);
  }

  createObject(input) {
    this.etagSequence += 1;
    return {
      Body: Buffer.from(input.Body),
      CacheControl: input.CacheControl,
      ContentType: input.ContentType,
      ETag: `"storage-${this.etagSequence}"`,
      Metadata: { ...input.Metadata }
    };
  }

  requireObject(key) {
    const object = this.objects.get(key);
    if (!object) throw s3Error("NoSuchKey", 404);
    return object;
  }

  responseFor(object, includeBody) {
    return {
      Body: includeBody ? Buffer.from(object.Body) : undefined,
      CacheControl: object.CacheControl,
      ContentLength: object.Body.byteLength,
      ContentType: object.ContentType,
      ETag: object.ETag,
      Metadata: { ...object.Metadata }
    };
  }
}

function s3Error(name, status) {
  const error = new Error(name);
  error.name = name;
  error.$metadata = { httpStatusCode: status };
  return error;
}
