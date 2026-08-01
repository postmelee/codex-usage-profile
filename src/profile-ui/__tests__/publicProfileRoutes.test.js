import assert from "node:assert/strict";
import test from "node:test";

import {
  loadPublicProfileRoute,
  resolvePublicProfileRoute
} from "../publicProfileRoutes.js";

const PUBLIC_PROFILE = Object.freeze({
  owner: {
    avatarUrl: "https://avatars.githubusercontent.com/u/12345",
    displayName: "Post Melee",
    githubLogin: "postmelee",
    handle: "postmelee"
  },
  publicCardUrl: "https://profiles.example.test/u/postmelee/card.png",
  usage: {
    capturedAt: "2026-07-14T00:00:00.000Z",
    uploadedAt: "2026-07-14T00:01:00.000Z",
    usage: {
      dailyUsageBuckets: [],
      summary: {
        currentStreakDays: 10,
        lifetimeTokens: 15_090_000_000,
        longestStreakDays: 49,
        longestTaskDurationMs: 6_780_000,
        peakDailyTokens: 700_000_000
      }
    }
  },
  visibility: "public"
});

test("starts every public profile handle in an API-backed loading state", () => {
  assert.deepEqual(
    resolvePublicProfileRoute(new URL("http://localhost/?profile=postmelee")),
    {
      handle: "postmelee",
      profile: null,
      source: "api",
      status: "loading"
    }
  );
  assert.deepEqual(
    resolvePublicProfileRoute(new URL("http://localhost/u/meleeisdeveloping")),
    {
      handle: "meleeisdeveloping",
      profile: null,
      source: "api",
      status: "loading"
    }
  );
  assert.deepEqual(
    resolvePublicProfileRoute(new URL("http://localhost/u/someone/")),
    {
      handle: "someone",
      profile: null,
      source: "api",
      status: "loading"
    }
  );
});

test("rejects unsupported and malformed public profile paths", () => {
  for (const url of [
    "http://localhost/unknown",
    "http://localhost/?profile=",
    "http://localhost/u/one/more",
    "http://localhost/u/%ZZ"
  ]) {
    assert.deepEqual(resolvePublicProfileRoute(new URL(url)), {
      handle: null,
      profile: null,
      source: "api",
      status: "unavailable"
    });
  }
});

test("loads a public Account Usage profile", async () => {
  const route = await loadPublicProfileRoute(
    new URL("http://localhost/u/requested-handle"),
    {
      client: {
        async getPublicProfile(handle) {
          assert.equal(handle, "requested-handle");
          return PUBLIC_PROFILE;
        }
      }
    }
  );

  assert.deepEqual(route, {
    handle: "postmelee",
    profile: PUBLIC_PROFILE,
    source: "api",
    status: "ready"
  });
});

test("maps missing, private, invalid, and failed responses to one unavailable state", async () => {
  const unavailable = {
    handle: null,
    profile: null,
    source: "api",
    status: "unavailable"
  };
  const responses = [
    null,
    { ...PUBLIC_PROFILE, visibility: "private" },
    { ...PUBLIC_PROFILE, publicCardUrl: null }
  ];

  for (const profile of responses) {
    assert.deepEqual(await loadPublicProfileRoute(
      new URL("http://localhost/u/hidden"),
      { client: { async getPublicProfile() { return profile; } } }
    ), unavailable);
  }

  assert.deepEqual(await loadPublicProfileRoute(
    new URL("http://localhost/u/failed"),
    { client: { async getPublicProfile() { throw new Error("network"); } } }
  ), unavailable);
});
