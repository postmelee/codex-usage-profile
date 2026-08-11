import assert from "node:assert/strict";
import test from "node:test";

import { createD1ProfileBackendStore } from "../d1/store.js";
import { createPostgresProfileBackendStore } from "../postgres/store.js";

const ROW = Object.freeze({
  card_locale: "ko",
  handle: "postmelee",
  owner_updated_at: "2026-08-08T00:00:00.001Z",
  uploaded_at: "2026-08-07T23:59:00.000Z"
});

const EXPECTED = Object.freeze({
  cardLocale: "ko",
  handle: "postmelee",
  ownerUpdatedAt: ROW.owner_updated_at,
  uploadedAt: ROW.uploaded_at
});

test("D1 resolves a public profile summary with one joined statement", async () => {
  const calls = [];
  const database = {
    async batch() {},
    prepare(sql) {
      return {
        bind(...params) {
          calls.push({ params, sql });
          return {
            async first() {
              return { ...ROW };
            }
          };
        }
      };
    }
  };
  const store = createD1ProfileBackendStore({ database });

  assert.deepEqual(
    await store.getPublicProfileSummaryByHandle("postmelee"),
    EXPECTED
  );
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /owners owner JOIN latest_usages usage/);
  assert.deepEqual(calls[0].params, ["postmelee", "public", "public"]);
});

test("Postgres resolves a public profile summary with one joined statement", async () => {
  const calls = [];
  const pool = {
    async end() {},
    async query(sql, params) {
      calls.push({ params, sql });
      return { rows: [{ ...ROW }] };
    }
  };
  const store = createPostgresProfileBackendStore({ pool });

  assert.deepEqual(
    await store.getPublicProfileSummaryByHandle("postmelee"),
    EXPECTED
  );
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /owners owner JOIN latest_usages usage/);
  assert.deepEqual(calls[0].params, ["postmelee", "public"]);
});
