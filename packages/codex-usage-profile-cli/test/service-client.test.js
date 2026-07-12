import assert from "node:assert/strict";
import test from "node:test";

import {
  ServiceClientError,
  createServiceClient
} from "../src/service-client.js";

test("starts and polls device login with JSON requests", async () => {
  const requests = [];
  const client = createServiceClient({
    serviceOrigin: "https://profiles.example.test",
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return jsonResponse({
        ok: true,
        data: url.endsWith("/poll")
          ? { status: "pending" }
          : {
              deviceCode: "cup_device_1",
              userCode: "ABCD-1234",
              expiresAt: "2026-07-13T01:00:00.000Z",
              intervalSeconds: 5,
              verificationUri: "/device"
            }
      });
    }
  });

  await client.startDeviceLogin({ label: "MacBook" });
  await client.pollDeviceLogin({ deviceCode: "cup_device_1", label: "MacBook" });

  assert.equal(requests[0].url, "https://profiles.example.test/api/auth/device");
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].options.redirect, "error");
  assert.deepEqual(JSON.parse(requests[0].options.body), { label: "MacBook" });
  assert.equal(requests[1].url, "https://profiles.example.test/api/auth/device/poll");
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    deviceCode: "cup_device_1",
    label: "MacBook"
  });
});

test("uses bearer auth for metadata-only status", async () => {
  const requests = [];
  const client = createServiceClient({
    serviceOrigin: "https://profiles.example.test",
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return jsonResponse({
        ok: true,
        data: {
          account: { handle: "postmelee" },
          latestUsage: null
        }
      });
    }
  });

  const status = await client.getStatus({ token: "cup_secret_value" });

  assert.equal(requests[0].options.headers.authorization, "Bearer cup_secret_value");
  assert.equal(requests[0].options.body, undefined);
  assert.equal(status.account.handle, "postmelee");
});

test("submits the exact analyzer document with device headers", async () => {
  const requests = [];
  const document = {
    contractVersion: 1,
    capturedAt: "2026-07-13T00:00:00.000Z",
    summary: {
      lifetimeTokens: 100,
      peakDailyTokens: 50,
      longestRunningTurnSec: 10,
      currentStreakDays: 2,
      longestStreakDays: 3
    },
    dailyUsageBuckets: []
  };
  const client = createServiceClient({
    serviceOrigin: "https://profiles.example.test",
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return jsonResponse({
        ok: true,
        data: {
          submission: { status: "accepted" },
          profile: { handle: "postmelee" }
        }
      }, { status: 201 });
    }
  });

  await client.submitAccountUsage({
    token: "cup_secret_value",
    document,
    deviceId: "device_1",
    deviceName: "MacBook"
  });

  assert.equal(requests[0].url, "https://profiles.example.test/api/account-usage/submit");
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].options.headers.authorization, "Bearer cup_secret_value");
  assert.equal(requests[0].options.headers["x-codex-usage-profile-device-id"], "device_1");
  assert.equal(requests[0].options.headers["x-codex-usage-profile-device-name"], "MacBook");
  assert.deepEqual(JSON.parse(requests[0].options.body), document);
});

test("returns safe service errors and Retry-After metadata", async () => {
  const client = createServiceClient({
    serviceOrigin: "https://profiles.example.test",
    fetchImpl: async () => jsonResponse({
      ok: false,
      error: {
        code: "rate_limited",
        message: "cup_secret_value"
      }
    }, {
      status: 429,
      headers: { "retry-after": "7" }
    })
  });

  await assert.rejects(
    () => client.getStatus({ token: "cup_secret_value" }),
    (error) => {
      assert.equal(error instanceof ServiceClientError, true);
      assert.equal(error.code, "rate_limited");
      assert.equal(error.status, 429);
      assert.equal(error.retryAfterSeconds, 7);
      assert.equal(error.message.includes("cup_secret_value"), false);
      return true;
    }
  );
});

test("maps network and timeout failures without raw causes", async () => {
  const networkClient = createServiceClient({
    serviceOrigin: "https://profiles.example.test",
    fetchImpl: async () => {
      throw new Error("connect cup_secret_value");
    }
  });
  const timeoutClient = createServiceClient({
    serviceOrigin: "https://profiles.example.test",
    timeoutMs: 1,
    fetchImpl: (_url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("aborted")));
    })
  });

  await assert.rejects(() => networkClient.getStatus({ token: "cup_secret_value" }), (error) => {
    assert.equal(error.code, "network_error");
    assert.equal(error.message.includes("cup_secret_value"), false);
    return true;
  });
  await assert.rejects(() => timeoutClient.getStatus({ token: "cup_secret_value" }), (error) => {
    assert.equal(error.code, "request_timeout");
    return true;
  });
});

function jsonResponse(body, options = {}) {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...options.headers
    }
  });
}
