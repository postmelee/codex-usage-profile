import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  PROFILE_MEDIA_STORE_ERROR_CODES,
  createProfileMediaRevisionKey,
  createProfileMediaStableKey,
  createS3ProfileMediaStore
} from "../index.js";

test("immutable PUT, validation HEAD, and stable COPY failures preserve publication", async (t) => {
  for (const failure of ["put", "head", "copy"]) {
    await t.test(failure, async () => {
      const fixture = await createPublishedFixture();
      const next = createRepresentations("next");

      if (failure !== "put") {
        await fixture.store.putRevision(next.en);
        await fixture.store.putRevision(next.ko);
      }
      if (failure === "put") {
        fixture.client.failNext("PutObjectCommand", {
          key: createProfileMediaRevisionKey(next.en)
        });
        await assertUnavailable(() => fixture.store.putRevision(next.en));
      } else {
        fixture.client.failNext(
          failure === "head" ? "HeadObjectCommand" : "CopyObjectCommand",
          failure === "head"
            ? { key: createProfileMediaRevisionKey(next.en) }
            : {}
        );
        await assertUnavailable(() => fixture.store.publishRevision(
          publicationInput(next, "publication_next")
        ));
      }

      await assertPreviousPublication(fixture);
    });
  }
});

test("stable HEAD and GET failures are unavailable without mutating publication", async () => {
  const fixture = await createPublishedFixture();
  const stableKey = createProfileMediaStableKey({ handle: HANDLE });

  fixture.client.failNext("HeadObjectCommand", { key: stableKey });
  await assertUnavailable(() => fixture.store.getPublishedCard({
    handle: HANDLE,
    includeBody: false
  }));
  await assertPreviousPublication(fixture);

  fixture.client.failNext("GetObjectCommand", { key: stableKey });
  await assertUnavailable(() => fixture.store.getPublishedCard({ handle: HANDLE }));
  await assertPreviousPublication(fixture);
});

test("stable GET retries one concurrent republish and returns one coherent publication", async () => {
  const fixture = await createPublishedFixture();
  const stableKey = createProfileMediaStableKey({ handle: HANDLE });
  const next = createRepresentations("next");
  await fixture.store.putRevision(next.en);
  await fixture.store.putRevision(next.ko);
  await fixture.store.publishRevision(
    publicationInput(next, "publication_next")
  );
  const nextStable = fixture.client.snapshotObject(stableKey);
  await fixture.store.publishRevision(
    publicationInput(fixture.representations, PREVIOUS_PUBLICATION_ID)
  );
  fixture.client.replaceBeforeNextGets(stableKey, [nextStable]);

  const current = await fixture.store.getPublishedCard({ handle: HANDLE });

  assert.equal(current.publicationId, "publication_next");
  assert.equal(current.etag, next.en.etag);
  assert.deepEqual(current.body, next.en.body);
});

test("stable GET maps a repeated conditional read race to unavailable", async () => {
  const fixture = await createPublishedFixture();
  const stableKey = createProfileMediaStableKey({ handle: HANDLE });
  const next = createRepresentations("next");
  await fixture.store.putRevision(next.en);
  await fixture.store.putRevision(next.ko);
  await fixture.store.publishRevision(
    publicationInput(next, "publication_next")
  );
  const nextStable = fixture.client.snapshotObject(stableKey);
  await fixture.store.publishRevision(
    publicationInput(fixture.representations, PREVIOUS_PUBLICATION_ID)
  );
  const previousStable = fixture.client.snapshotObject(stableKey);
  fixture.client.replaceBeforeNextGets(stableKey, [
    nextStable,
    previousStable
  ]);

  await assert.rejects(
    () => fixture.store.getPublishedCard({ handle: HANDLE }),
    (error) =>
      error?.code === PROFILE_MEDIA_STORE_ERROR_CODES.UNAVAILABLE &&
      error.message === "stable media changed repeatedly during read"
  );
});

test("light stable HEAD to GET race retries one coherent S3 variant", async () => {
  const client = new FailureS3Client();
  const store = createS3ProfileMediaStore({
    bucket: BUCKET,
    client,
    operationTimeoutMs: 1_000
  });
  const representations = createThemeRepresentations("light-race");
  for (const theme of ["dark", "light"]) {
    await store.putRevision(representations[theme].en);
    await store.putRevision(representations[theme].ko);
  }
  const input = themePublicationInput(representations, "publication_light");
  await store.publishRevision(input);
  const lightKey = createProfileMediaStableKey({ handle: HANDLE, theme: "light" });
  const priorLight = client.snapshotObject(lightKey);
  await store.publishRevision(input);
  client.replaceBeforeNextGets(lightKey, [priorLight]);

  const current = await store.getPublishedCard({
    handle: HANDLE,
    theme: "light"
  });

  assert.equal(current.publicationId, "publication_light");
  assert.deepEqual(current.body, representations.light.en.body);
});

test("missing media bucket is unavailable rather than an unpublished object", async () => {
  const fixture = await createPublishedFixture();
  fixture.client.failNext("HeadObjectCommand", {
    key: createProfileMediaStableKey({ handle: HANDLE }),
    name: "NoSuchBucket",
    status: 404
  });

  await assertUnavailable(() => fixture.store.getPublishedCard({
    handle: HANDLE
  }));
});

test("stable DELETE failure keeps the previous public object", async () => {
  const fixture = await createPublishedFixture();
  fixture.client.failNext("DeleteObjectCommand", {
    key: createProfileMediaStableKey({ handle: HANDLE })
  });

  await assertUnavailable(() => fixture.store.unpublishCard({ handle: HANDLE }));

  await assertPreviousPublication(fixture);
});

test("operation timeout fails unavailable and preserves the previous publication", async () => {
  const fixture = await createPublishedFixture({ operationTimeoutMs: 5 });
  const next = createRepresentations("timeout");
  fixture.client.timeoutNext("PutObjectCommand", {
    key: createProfileMediaRevisionKey(next.en)
  });

  await assertUnavailable(() => fixture.store.putRevision(next.en));

  await assertPreviousPublication(fixture);
});

async function createPublishedFixture(options = {}) {
  const client = new FailureS3Client();
  const store = createS3ProfileMediaStore({
    bucket: BUCKET,
    client,
    operationTimeoutMs: options.operationTimeoutMs ?? 1_000
  });
  const representations = createRepresentations("previous");
  await store.putRevision(representations.en);
  await store.putRevision(representations.ko);
  const publication = await store.publishRevision(
    publicationInput(representations, PREVIOUS_PUBLICATION_ID)
  );
  return { client, publication, representations, store };
}

async function assertPreviousPublication(fixture) {
  const current = await fixture.store.getPublishedCard({ handle: HANDLE });
  assert.equal(current.publicationId, PREVIOUS_PUBLICATION_ID);
  assert.deepEqual(current.body, fixture.representations.en.body);
  assert.equal(
    current.representations.ko.revision,
    fixture.representations.ko.revision
  );
}

async function assertUnavailable(operation) {
  await assert.rejects(
    operation,
    (error) => error?.code === "unavailable" &&
      error.message.endsWith("failed")
  );
}

function createRepresentations(label) {
  return {
    en: createRevision("en", `${label}:en`),
    ko: createRevision("ko", `${label}:ko`)
  };
}

function createThemeRepresentations(label) {
  return Object.fromEntries(["dark", "light"].map((theme) => [
    theme,
    Object.fromEntries(["en", "ko"].map((locale) => [
      locale,
      createRevision(locale, `${label}:${theme}:${locale}`, {
        contractVersion: 4,
        presentationDigest: PRESENTATION_DIGEST,
        theme
      })
    ]))
  ]));
}

function createRevision(locale, value, overrides = {}) {
  const body = Buffer.from(value);
  const revision = createHash("sha256").update(body).digest("base64url");
  return {
    body,
    createdAt: "2026-07-23T00:00:00.000Z",
    etag: `"${revision}"`,
    locale,
    ownerId: OWNER_ID,
    revision,
    ...overrides
  };
}

function publicationInput(representations, publicationId) {
  return {
    handle: HANDLE,
    ownerId: OWNER_ID,
    publicationId,
    publishedAt: "2026-07-23T00:01:00.000Z",
    representations: {
      en: {
        etag: representations.en.etag,
        revision: representations.en.revision
      },
      ko: {
        etag: representations.ko.etag,
        revision: representations.ko.revision
      }
    }
  };
}

function themePublicationInput(representations, publicationId) {
  return {
    contractVersion: 4,
    handle: HANDLE,
    ownerId: OWNER_ID,
    presentationDigest: PRESENTATION_DIGEST,
    publicationId,
    publishedAt: "2026-07-23T00:01:00.000Z",
    representations: Object.fromEntries(
      Object.entries(representations).map(([theme, locales]) => [
        theme,
        Object.fromEntries(Object.entries(locales).map(([locale, revision]) => [
          locale,
          { etag: revision.etag, revision: revision.revision }
        ]))
      ])
    )
  };
}

class FailureS3Client {
  constructor() {
    this.etagSequence = 0;
    this.failures = [];
    this.objects = new Map();
    this.replacementsBeforeGet = new Map();
  }

  failNext(commandName, options = {}) {
    this.failures.push({
      commandName,
      key: options.key,
      name: options.name ?? "ServiceUnavailable",
      status: options.status ?? 503,
      timeout: false
    });
  }

  timeoutNext(commandName, options = {}) {
    this.failures.push({
      commandName,
      key: options.key,
      name: "ServiceUnavailable",
      status: 503,
      timeout: true
    });
  }

  replaceBeforeNextGets(key, replacements) {
    this.replacementsBeforeGet.set(
      key,
      replacements.map((object) => this.cloneObject(object))
    );
  }

  snapshotObject(key) {
    return this.cloneObject(this.requireObject(key));
  }

  async send(command, options = {}) {
    const input = command.input;
    const failureIndex = this.failures.findIndex((failure) =>
      failure.commandName === command.constructor.name &&
      (failure.key === undefined || failure.key === input.Key)
    );
    if (failureIndex !== -1) {
      const [failure] = this.failures.splice(failureIndex, 1);
      if (failure.timeout) {
        await rejectOnAbort(options.abortSignal);
      }
      throw s3Error(failure.name, failure.status);
    }

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
      const replacements = this.replacementsBeforeGet.get(input.Key);
      if (replacements?.length > 0) {
        this.objects.set(input.Key, this.cloneObject(replacements.shift()));
        if (replacements.length === 0) {
          this.replacementsBeforeGet.delete(input.Key);
        }
      }
      const object = this.requireObject(input.Key);
      if (input.IfMatch && input.IfMatch !== object.ETag) {
        throw s3Error("PreconditionFailed", 412);
      }
      return this.responseFor(object, true);
    }
    if (command instanceof CopyObjectCommand) {
      const [, ...sourceParts] = decodeURIComponent(input.CopySource).split("/");
      const source = this.requireObject(sourceParts.join("/"));
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

  cloneObject(object) {
    return {
      ...object,
      Body: Buffer.from(object.Body),
      Metadata: { ...object.Metadata }
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

function rejectOnAbort(signal) {
  return new Promise((_, reject) => {
    if (!signal) {
      reject(new Error("abort signal is required"));
      return;
    }
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}

function s3Error(name, status) {
  const error = new Error(name);
  error.name = name;
  error.$metadata = { httpStatusCode: status };
  return error;
}

const BUCKET = "cards";
const HANDLE = "failure-user";
const OWNER_ID = "owner_failure";
const PRESENTATION_DIGEST = createHash("sha256")
  .update("presentation-v1")
  .digest("base64url");
const PREVIOUS_PUBLICATION_ID = "publication_previous";
