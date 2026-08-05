import assert from "node:assert/strict";
import test from "node:test";

import {
  createProfileMediaRevisionDigest,
  supportsProfileMediaSocialCard
} from "../media-store-contract.js";
import { createR2BindingProfileMediaStore } from "../r2-binding/store.js";
import { createS3ProfileMediaStore } from "../s3/store.js";

const HANDLE = "postmelee";
const SOCIAL_KEY = "cards/v2/public/postmelee/social.png";
const BODY = Buffer.from("social-card-bytes");
const REVISION = createProfileMediaRevisionDigest(BODY);
const PRESENTATION_DIGEST = createProfileMediaRevisionDigest(
  Buffer.from("presentation")
);

function createInput(overrides = {}) {
  const body = overrides.body ?? BODY;
  const revision = createProfileMediaRevisionDigest(body);
  return {
    body,
    contentType: "image/png",
    createdAt: "2026-06-11T09:05:00.000Z",
    etag: `"${revision}"`,
    handle: HANDLE,
    ownerId: "owner_github_1",
    presentationDigest: PRESENTATION_DIGEST,
    publicationId: "profile_media_1",
    revision,
    ...overrides
  };
}

function createR2Store() {
  const objects = new Map();
  const bucket = {
    async get(key) {
      return objects.get(key) ?? null;
    },
    async head(key) {
      const object = objects.get(key);
      return object ? { ...object, body: null } : null;
    },
    async put(key, body, options = {}) {
      const object = {
        arrayBuffer: async () => Buffer.from(body),
        customMetadata: options.customMetadata,
        etag: `storage-${objects.size + 1}`,
        httpMetadata: options.httpMetadata,
        key
      };
      objects.set(key, object);
      return object;
    },
    async delete(key) {
      objects.delete(key);
    }
  };

  return { objects, store: createR2BindingProfileMediaStore({ bucket }) };
}

function createS3Store() {
  const objects = new Map();
  const client = {
    async send(command) {
      const name = command.constructor.name;
      const key = command.input.Key;

      if (name === "PutObjectCommand") {
        objects.set(key, {
          Body: command.input.Body,
          CacheControl: command.input.CacheControl,
          ContentType: command.input.ContentType,
          Metadata: command.input.Metadata
        });
        return {};
      }
      if (name === "GetObjectCommand" || name === "HeadObjectCommand") {
        const object = objects.get(key);
        if (!object) throw createMissingKeyError();
        return name === "GetObjectCommand"
          ? { Body: object.Body, Metadata: object.Metadata }
          : { Metadata: object.Metadata };
      }
      if (name === "DeleteObjectCommand") {
        objects.delete(key);
        return {};
      }
      throw new Error(`unexpected command ${name}`);
    }
  };

  return {
    objects,
    store: createS3ProfileMediaStore({ bucket: "media", client })
  };
}

function createMissingKeyError() {
  const error = new Error("missing key");
  error.name = "NoSuchKey";
  error.$metadata = { httpStatusCode: 404 };
  return error;
}

const ADAPTERS = [
  ["r2-binding", createR2Store],
  ["s3", createS3Store]
];

for (const [name, createStore] of ADAPTERS) {
  test(`${name} store advertises social card support`, () => {
    const { store } = createStore();
    assert.equal(supportsProfileMediaSocialCard(store), true);
  });

  test(`${name} store writes and reads one social object per handle`, async () => {
    const { objects, store } = createStore();

    assert.equal(await store.getSocialCard({ handle: HANDLE }), null);

    const written = await store.putSocialCard(createInput());
    assert.equal(written.socialKey, SOCIAL_KEY);
    assert.equal(written.body, undefined);

    const read = await store.getSocialCard({ handle: HANDLE });
    assert.equal(read.socialKey, SOCIAL_KEY);
    assert.equal(read.etag, `"${REVISION}"`);
    assert.equal(read.presentationDigest, PRESENTATION_DIGEST);
    assert.equal(read.publicationId, "profile_media_1");
    assert.equal(Buffer.from(read.body).equals(BODY), true);
    assert.equal(objects.size, 1);

    const nextBody = Buffer.from("updated-social-bytes");
    await store.putSocialCard(createInput({ body: nextBody }));
    const updated = await store.getSocialCard({ handle: HANDLE });

    assert.equal(objects.size, 1);
    assert.equal(Buffer.from(updated.body).equals(nextBody), true);
    assert.notEqual(updated.etag, read.etag);
  });

  test(`${name} store reads social metadata without the body`, async () => {
    const { store } = createStore();
    await store.putSocialCard(createInput());

    const metadata = await store.getSocialCard({
      handle: HANDLE,
      includeBody: false
    });

    assert.equal(metadata.body, undefined);
    assert.equal(metadata.etag, `"${REVISION}"`);
  });

  test(`${name} store deletes the social object idempotently`, async () => {
    const { objects, store } = createStore();
    await store.putSocialCard(createInput());

    assert.deepEqual(
      await store.deleteSocialCard({ handle: HANDLE }),
      { deleted: true, handle: HANDLE }
    );
    assert.equal(objects.size, 0);
    assert.equal(await store.getSocialCard({ handle: HANDLE }), null);
    assert.deepEqual(
      await store.deleteSocialCard({ handle: HANDLE }),
      { deleted: false, handle: HANDLE }
    );
  });

  test(`${name} store rejects a body that does not match the revision`, async () => {
    const { store } = createStore();

    await assert.rejects(
      () => store.putSocialCard({
        ...createInput(),
        body: Buffer.from("other-bytes"),
        etag: `"${REVISION}"`,
        revision: REVISION
      }),
      /social media does not match body digest/
    );
  });
}
