import {
  migrateD1Database
} from "../../../profile-backend/d1/migration-runner.js";
import {
  D1_MIGRATION_MANIFEST
} from "../../../profile-backend/d1/migration-manifest.js";
import {
  WORKER_CARD_RENDERER_VERSION,
  createWorkerProfileCardRenderer
} from "../../../profile-card/worker-renderer.js";
import {
  PROFILE_CARD_WORKER_RENDERER_ASSETS
} from "../../../profile-card/worker-renderer-assets.js";
import { createProfileSitesWorker } from "../worker.js";

const migrationSqlModules = import.meta.glob(
  "../../../../db/migrations/*.sql",
  { eager: true, import: "default", query: "?raw" }
);
const migrations = createBundledMigrations(
  D1_MIGRATION_MANIFEST,
  migrationSqlModules
);
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

function createBundledMigrations(manifest, sqlModules) {
  const expectedModuleKeys = new Set(
    manifest.map((migration) => `../../../../${migration.file}`)
  );
  const unexpectedModuleKeys = Object.keys(sqlModules)
    .filter((key) => !expectedModuleKeys.has(key));
  if (unexpectedModuleKeys.length > 0) {
    throw new TypeError(
      `Unexpected bundled D1 migrations: ${unexpectedModuleKeys.join(", ")}`
    );
  }

  return Object.freeze(manifest.map((migration) => {
    const moduleKey = `../../../../${migration.file}`;
    const sql = sqlModules[moduleKey];
    if (typeof sql !== "string" || sql.trim() === "") {
      throw new TypeError(`Missing bundled D1 migration: ${migration.file}`);
    }
    return Object.freeze({
      version: migration.version,
      name: migration.name,
      sql
    });
  }));
}
