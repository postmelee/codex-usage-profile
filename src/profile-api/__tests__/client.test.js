import assert from "node:assert/strict";
import test from "node:test";

import {
  ProfileApiError,
  buildApiUrl,
  createProfileApiClient
} from "../client.js";
import { sampleProfileSnapshot } from "../../profile-snapshot/fixtures/sample-snapshot.js";

test("loads a public snapshot from the API envelope", async () => {
  const requests = [];
  const client = createProfileApiClient({
    baseUrl: "https://profiles.example.test/app",
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return jsonResponse({
        ok: true,
        data: {
          snapshot: {
            handle: "postmelee",
            snapshot: sampleProfileSnapshot
          }
        }
      });
    }
  });

  const record = await client.getPublicSnapshot("postmelee");

  assert.equal(requests[0].url, "https://profiles.example.test/api/snapshots/public/postmelee");
  assert.equal(requests[0].options.headers.accept, "application/json");
  assert.equal(record.handle, "postmelee");
  assert.deepEqual(record.snapshot, sampleProfileSnapshot);
});

test("returns null for public snapshot not found", async () => {
  const client = createProfileApiClient({
    fetchImpl: async () => jsonResponse({
      ok: false,
      error: {
        code: "not_found",
        message: "Snapshot not found"
      }
    }, { status: 404 })
  });

  assert.equal(await client.getPublicSnapshot("missing"), null);
});

test("submits snapshots with bearer auth and JSON body", async () => {
  const requests = [];
  const client = createProfileApiClient({
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return jsonResponse({
        ok: true,
        data: {
          snapshot: {
            handle: "postmelee",
            snapshot: sampleProfileSnapshot
          }
        }
      }, { status: 201 });
    }
  });
  const payload = {
    snapshot: sampleProfileSnapshot,
    capturedAt: sampleProfileSnapshot.capturedAt
  };

  const record = await client.submitSnapshot({
    token: "cup_test_token",
    payload
  });

  assert.equal(requests[0].url, "/api/snapshots/submit");
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].options.headers.authorization, "Bearer cup_test_token");
  assert.deepEqual(JSON.parse(requests[0].options.body), payload);
  assert.equal(record.handle, "postmelee");
});

test("throws ProfileApiError for API error envelopes", async () => {
  const client = createProfileApiClient({
    fetchImpl: async () => jsonResponse({
      ok: false,
      error: {
        code: "validation_failed",
        message: "Snapshot payload is invalid"
      }
    }, { status: 400 })
  });

  await assert.rejects(
    () => client.submitSnapshot({
      token: "cup_test_token",
      payload: {}
    }),
    (error) => {
      assert.equal(error instanceof ProfileApiError, true);
      assert.equal(error.status, 400);
      assert.equal(error.code, "validation_failed");
      return true;
    }
  );
});

test("validates required client inputs", async () => {
  assert.throws(
    () => createProfileApiClient({ fetchImpl: null }),
    /fetch implementation is required/
  );

  const client = createProfileApiClient({ fetchImpl: async () => jsonResponse({}) });

  await assert.rejects(
    () => client.getPublicSnapshot(""),
    (error) => {
      assert.equal(error instanceof ProfileApiError, true);
      assert.equal(error.code, "validation_failed");
      return true;
    }
  );
  await assert.rejects(
    () => client.submitSnapshot({ token: "", payload: {} }),
    (error) => {
      assert.equal(error instanceof ProfileApiError, true);
      assert.equal(error.code, "validation_failed");
      return true;
    }
  );
});

test("builds API URLs for relative and absolute bases", () => {
  assert.equal(buildApiUrl("", "/api/snapshots/public/me"), "/api/snapshots/public/me");
  assert.equal(
    buildApiUrl("https://profiles.example.test/base", "/api/snapshots/public/me"),
    "https://profiles.example.test/api/snapshots/public/me"
  );
});

function jsonResponse(body, options = {}) {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: {
      "content-type": "application/json"
    }
  });
}

