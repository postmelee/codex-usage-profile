import assert from "node:assert/strict";
import test from "node:test";

import {
  PROFILE_SITES_REQUEST_ID_HEADER,
  bucketDuration,
  createProfileCardAvatarLoadEvent,
  classifyProfileSitesRoute,
  observeProfileCardAvatarLoadFailure,
  observeProfileSitesRequest
} from "../observability.js";

test("Sites observability emits only the approved bounded event fields", async () => {
  const events = [];
  const times = [100, 350];
  const request = new Request(
    "https://profile.example/api/auth/github/callback" +
      "?code=oauth-secret-code&state=oauth-secret-state",
    {
      headers: {
        authorization: "Bearer cli-secret-token",
        cookie: "profile_session=session-secret"
      }
    }
  );
  const response = await observeProfileSitesRequest(
    request,
    async () => {
      throw new Error("private owner and usage bytes must not be logged");
    },
    {
      createRequestId: () => "request_123456",
      now: () => times.shift(),
      writeEvent(event) {
        events.push(event);
      }
    }
  );

  assert.equal(response.status, 503);
  assert.equal(
    response.headers.get(PROFILE_SITES_REQUEST_ID_HEADER),
    "request_123456"
  );
  assert.deepEqual(events, [{
    requestId: "request_123456",
    routeClass: "auth",
    method: "GET",
    status: 503,
    durationBucket: "under_1s",
    errorCode: "unhandled_error",
    retryable: true
  }]);
  assert.deepEqual(Object.keys(events[0]), [
    "requestId",
    "routeClass",
    "method",
    "status",
    "durationBucket",
    "errorCode",
    "retryable"
  ]);
  assert.doesNotMatch(
    JSON.stringify(events),
    /oauth-secret|cli-secret|session-secret|private owner|usage bytes/
  );
});

test("Sites observability reduces dynamic paths and unusual methods to safe classes", () => {
  const publicCard = new Request(
    "https://profile.example/u/private-owner-handle/card.png?locale=ko"
  );
  const unknownApi = new Request(
    "https://profile.example/api/custom/private-value",
    { method: "CUSTOM" }
  );
  const publicShare = new Request(
    "https://profile.example/api/share/private-owner-handle"
  );
  const publicSocial = new Request(
    "https://profile.example/u/private-owner-handle/social.png"
  );

  assert.equal(classifyProfileSitesRoute(publicCard), "public_card");
  assert.equal(classifyProfileSitesRoute(publicSocial), "public_card");
  assert.equal(classifyProfileSitesRoute(publicShare), "public_profile");
  assert.equal(classifyProfileSitesRoute(unknownApi), "api");
  assert.doesNotMatch(
    JSON.stringify({
      first: classifyProfileSitesRoute(publicCard),
      second: classifyProfileSitesRoute(unknownApi),
      third: classifyProfileSitesRoute(publicShare),
      fourth: classifyProfileSitesRoute(publicSocial)
    }),
    /private-owner-handle|private-value/
  );
  assert.equal(bucketDuration(0), "under_10ms");
  assert.equal(bucketDuration(10), "under_100ms");
  assert.equal(bucketDuration(100), "under_1s");
  assert.equal(bucketDuration(1_000), "under_5s");
  assert.equal(bucketDuration(5_000), "over_5s");
});

test("Sites observability never lets a logging failure alter the response", async () => {
  const response = await observeProfileSitesRequest(
    new Request("https://profile.example/"),
    () => new Response("landing", { status: 200 }),
    {
      createRequestId: () => "request_654321",
      now: () => 0,
      writeEvent() {
        throw new Error("logging provider failed with private data");
      }
    }
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "landing");
});

test("avatar observability emits only bounded retry fields and ignores writer failure", () => {
  const events = [];
  const event = observeProfileCardAvatarLoadFailure({
    attempt: 1,
    errorCode: "avatar_fetch_unavailable",
    retrying: true
  }, {
    writeEvent(value) {
      events.push(value);
      throw new Error("logging failed with owner and avatar URL");
    }
  });

  assert.deepEqual(event, {
    eventType: "profile_card_avatar",
    errorCode: "avatar_fetch_unavailable",
    attempt: 1,
    retrying: true
  });
  assert.deepEqual(events, [event]);
  assert.deepEqual(Object.keys(event), [
    "eventType",
    "errorCode",
    "attempt",
    "retrying"
  ]);
  assert.doesNotMatch(JSON.stringify(event), /owner|github|avatar URL/);
  assert.throws(
    () => createProfileCardAvatarLoadEvent({
      attempt: 3,
      errorCode: "provider body leaked",
      retrying: false
    }),
    /invalid/
  );
});
