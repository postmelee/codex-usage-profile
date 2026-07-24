import migrationOne from "../../../../db/migrations/0001_profile_backend.sql";
import migrationTwo from "../../../../db/migrations/0002_account_usage_rate_limits.sql";
import {
  migrateD1Database
} from "../../../profile-backend/d1/migration-runner.js";
import {
  WORKER_CARD_RENDERER_VERSION,
  createWorkerProfileCardRenderer
} from "../../../profile-card/worker-renderer.js";
import {
  PROFILE_CARD_WORKER_RENDERER_ASSETS
} from "../../../profile-card/worker-renderer-assets.js";
import { createProfileSitesWorker } from "../worker.js";

const migrations = Object.freeze([
  Object.freeze({
    version: 1,
    name: "profile_backend",
    sql: migrationOne
  }),
  Object.freeze({
    version: 2,
    name: "account_usage_rate_limits",
    sql: migrationTwo
  })
]);
let localMaintenanceEnabled = false;

const worker = createProfileSitesWorker({
  fetchImpl: async (input) => {
    const url = new URL(
      typeof input === "string" ? input : input.url
    );
    if (url.hostname === "avatars.githubusercontent.com") {
      return new Response("avatar unavailable", { status: 503 });
    }
    return fetch(input);
  },
  githubClient: {
    async exchangeCodeForToken(code) {
      if (code !== "local-oauth-code") {
        throw new Error("Local OAuth code is invalid");
      }
      return { accessToken: "local-github-access-token" };
    },
    async getAuthenticatedUser(accessToken) {
      if (accessToken !== "local-github-access-token") {
        throw new Error("Local OAuth token is invalid");
      }
      return {
        id: 49,
        login: "local-owner",
        name: "로컬 사용자",
        avatar_url: "https://avatars.githubusercontent.com/u/49",
        html_url: "https://github.com/local-owner"
      };
    }
  },
  profileCardRenderPng: createWorkerProfileCardRenderer(
    PROFILE_CARD_WORKER_RENDERER_ASSETS
  ),
  profileCardRendererVersion: WORKER_CARD_RENDERER_VERSION,
  writeEvent: null
});

export default {
  async fetch(request, environment, executionContext) {
    const url = new URL(request.url);
    if (url.pathname === "/__local/migrate") {
      if (
        environment.LOCAL_FULL_STACK_TEST !== "1" ||
        request.method !== "POST"
      ) {
        return new Response("Not found", { status: 404 });
      }

      const result = await migrateD1Database(environment.DB, {
        migrations,
        now: () => new Date("2026-07-24T00:00:00.000Z")
      });
      return Response.json({ ok: true, result });
    }

    if (url.pathname === "/__local/maintenance-mode") {
      if (
        environment.LOCAL_FULL_STACK_TEST !== "1" ||
        request.method !== "POST"
      ) {
        return new Response("Not found", { status: 404 });
      }
      const body = await request.json();
      if (
        !body ||
        typeof body.enabled !== "boolean" ||
        Object.keys(body).length !== 1
      ) {
        return Response.json({
          ok: false,
          error: { code: "invalid_request" }
        }, { status: 400 });
      }
      localMaintenanceEnabled = body.enabled;
      return Response.json({
        ok: true,
        maintenanceEnabled: localMaintenanceEnabled
      });
    }

    const runtimeEnvironment = Object.create(environment);
    runtimeEnvironment.PROFILE_MAINTENANCE_MODE =
      localMaintenanceEnabled ? "enabled" : "disabled";
    return worker.fetch(request, runtimeEnvironment, executionContext);
  }
};
