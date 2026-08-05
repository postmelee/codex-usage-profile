import { resolve } from "node:path";

import { Miniflare } from "miniflare";

import { loadD1Migrations } from "../d1/migrate.js";

const REPOSITORY_ROOT = resolve(".");
const HARNESS_PATH = resolve(
  "src/profile-backend/__tests__/_d1-worker-harness.js"
);

export async function createD1TestFixture(options = {}) {
  const miniflare = new Miniflare({
    compatibilityDate: "2026-05-22",
    d1Databases: {
      DB: `profile-test-${crypto.randomUUID()}`
    },
    host: "127.0.0.1",
    modules: true,
    modulesRoot: REPOSITORY_ROOT,
    modulesRules: [
      {
        type: "ESModule",
        include: ["**/*.js"],
        fallthrough: true
      }
    ],
    port: 0,
    scriptPath: HARNESS_PATH
  });

  const fixture = {
    async call(pathname, payload = {}) {
      const ready = await miniflare.ready;
      const response = await fetch(new URL(pathname, ready), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const text = await response.text();
      if (!text) {
        throw new Error(`D1 test Worker returned an empty ${response.status} response`);
      }
      const result = JSON.parse(text);
      if (result?.__error) {
        const error = new Error(result.message);
        error.code = result.code;
        error.status = result.status;
        error.headers = result.headers;
        throw error;
      }
      return result;
    },

    async migrate() {
      return fixture.call("/migrate", {
        migrations: await loadD1Migrations(),
        now: options.now ?? "2026-07-23T00:00:00.000Z"
      });
    },

    rpc(method, ...args) {
      return fixture.call("/rpc", { method, args });
    },

    atomic(operation, command) {
      return fixture.call("/atomic", { operation, command });
    },

    maintenance(method, options = {}) {
      return fixture.call("/maintenance", { method, options });
    },

    inspect(name) {
      return fixture.call("/inspect", { name });
    },

    rate(key, now, rateOptions = {}) {
      return fixture.call("/rate", {
        key,
        now,
        options: rateOptions
      });
    },

    dispose() {
      return miniflare.dispose();
    }
  };

  return fixture;
}

export function ownerFixture(overrides = {}) {
  return {
    id: "owner_1",
    authProvider: "github",
    providerUserId: "1",
    githubLogin: "postmelee",
    displayName: "Post Melee",
    avatarUrl: "https://avatars.githubusercontent.com/u/1",
    profileUrl: "https://github.com/postmelee",
    handle: "postmelee",
    visibility: "private",
    cardLocale: "en",
    cardStyle: {
      schemaVersion: 1,
      theme: "dark",
      effect: { preset: "none", version: 1 }
    },
    createdAt: "2026-07-23T00:00:00.000Z",
    updatedAt: "2026-07-23T00:00:00.000Z",
    ...overrides
  };
}

export function usageFixture(overrides = {}) {
  return {
    ownerId: "owner_1",
    handle: "postmelee",
    visibility: "private",
    contractVersion: 1,
    capturedAt: "2026-07-23T00:00:00.000Z",
    uploadedAt: "2026-07-23T00:00:01.000Z",
    contentDigest: "digest_1",
    usage: {
      summary: { lifetimeTokens: 1 },
      dailyUsageBuckets: []
    },
    ...overrides
  };
}
