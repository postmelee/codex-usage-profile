import assert from "node:assert/strict";
import test from "node:test";

import { CliError } from "../src/errors.js";
import { ServiceClientError } from "../src/service-client.js";
import {
  assertAccountUsageDocument,
  mapAnalyzerError,
  mapSubmitError,
  submitAccountUsage
} from "../src/submit.js";

const ANALYZER_ERROR_CODES = [
  "INVALID_TIMEOUT",
  "CODEX_NOT_FOUND",
  "APP_SERVER_START_FAILED",
  "APP_SERVER_EXITED",
  "APP_SERVER_TIMEOUT",
  "APP_SERVER_PROTOCOL_ERROR",
  "APP_SERVER_RPC_ERROR",
  "INVALID_ACCOUNT_USAGE_RESPONSE"
];

test("submits the exact analyzer document and retries one ambiguous network failure", async () => {
  const document = createDocument();
  const requests = [];
  const sleeps = [];
  const client = {
    async submitAccountUsage(options) {
      requests.push(options);
      if (requests.length === 1) {
        throw new ServiceClientError("network_error", "network");
      }
      return createResponse();
    }
  };

  const result = await submitAccountUsage({
    readAccountUsage: async ({ timeoutMs }) => {
      assert.equal(timeoutMs, 30_000);
      return document;
    },
    client,
    token: "cup_secret_value",
    timeoutMs: 30_000,
    deviceId: "device_1",
    deviceName: "MacBook",
    sleep: async (milliseconds) => { sleeps.push(milliseconds); }
  });

  assert.equal(result.submission.status, "accepted");
  assert.equal(requests.length, 2);
  assert.equal(requests[0].document, document);
  assert.equal(requests[1].document, document);
  assert.deepEqual(requests[0], requests[1]);
  assert.deepEqual(sleeps, [250]);
});

test("validates the complete identity-free Account Usage Contract", () => {
  const document = createDocument();
  assert.equal(assertAccountUsageDocument(document), document);
});

test("rejects unknown, identity, duplicate, unsafe, and malformed fields", () => {
  const invalidDocuments = [
    { ...createDocument(), username: "postmelee" },
    { ...createDocument(), contractVersion: 2 },
    { ...createDocument(), capturedAt: "2026-07-13T00:00:00Z" },
    {
      ...createDocument(),
      summary: { ...createDocument().summary, lifetimeTokens: Number.MAX_SAFE_INTEGER + 1 }
    },
    {
      ...createDocument(),
      dailyUsageBuckets: [
        { startDate: "2026-07-13", tokens: 1 },
        { startDate: "2026-07-13", tokens: 2 }
      ]
    },
    {
      ...createDocument(),
      dailyUsageBuckets: [{ startDate: "2026-02-30", tokens: 1 }]
    }
  ];

  for (const document of invalidDocuments) {
    assert.throws(
      () => assertAccountUsageDocument(document),
      (error) => error instanceof CliError && error.code === "invalid_account_usage_document"
    );
  }
});

test("maps every analyzer error code without forwarding raw messages", () => {
  for (const code of ANALYZER_ERROR_CODES) {
    const source = new Error(`secret path /Users/test ${code}`);
    source.code = code;
    const mapped = mapAnalyzerError(source);

    assert.equal(mapped instanceof CliError, true);
    assert.match(mapped.code, /^analyzer_/);
    assert.equal(mapped.message.includes("/Users/test"), false);
  }

  const unknown = mapAnalyzerError(new Error("cup_secret_value"));
  assert.equal(unknown.code, "analyzer_failed");
  assert.equal(unknown.message.includes("cup_secret_value"), false);
});

test("maps auth, conflict, rate limit, contract, network, and unknown submit errors", () => {
  const cases = [
    [new ServiceClientError("unauthorized", "secret", { status: 401 }), "submit_auth_failed"],
    [new ServiceClientError("gone", "secret", { status: 410 }), "submit_auth_failed"],
    [new ServiceClientError("conflict", "secret", { status: 409 }), "submit_conflict"],
    [new ServiceClientError("rate_limited", "secret", {
      status: 429,
      retryAfterSeconds: 9
    }), "submit_rate_limited"],
    [new ServiceClientError("invalid_request", "secret", { status: 413 }), "submit_contract_rejected"],
    [new ServiceClientError("network_error", "secret"), "submit_network_failed"],
    [new Error("cup_secret_value"), "submit_failed"]
  ];

  for (const [source, code] of cases) {
    const mapped = mapSubmitError(source);
    assert.equal(mapped.code, code);
    assert.equal(mapped.message.includes("secret"), false);
  }
  assert.match(mapSubmitError(cases[3][0]).message, /9 seconds/);
});

test("does not retry deterministic submit failures", async () => {
  let requests = 0;
  await assert.rejects(
    () => submitAccountUsage({
      readAccountUsage: async () => createDocument(),
      client: {
        async submitAccountUsage() {
          requests += 1;
          throw new ServiceClientError("conflict", "conflict", { status: 409 });
        }
      },
      token: "cup_secret_value",
      deviceId: "device_1"
    }),
    (error) => error.code === "submit_conflict"
  );
  assert.equal(requests, 1);
});

function createDocument() {
  return {
    contractVersion: 1,
    capturedAt: "2026-07-13T00:00:00.000Z",
    summary: {
      lifetimeTokens: 100,
      peakDailyTokens: 50,
      longestRunningTurnSec: 10,
      currentStreakDays: 2,
      longestStreakDays: 3
    },
    dailyUsageBuckets: [
      { startDate: "2026-07-13", tokens: 100 }
    ]
  };
}

function createResponse() {
  return {
    submission: {
      status: "accepted",
      idempotent: false,
      contractVersion: 1,
      capturedAt: "2026-07-13T00:00:00.000Z",
      uploadedAt: "2026-07-13T00:01:00.000Z",
      revision: "usage_revision"
    },
    profile: {
      handle: "postmelee",
      profileUrl: "https://profiles.example.test/profile",
      imageUrl: "https://profiles.example.test/u/postmelee/card.png"
    }
  };
}
