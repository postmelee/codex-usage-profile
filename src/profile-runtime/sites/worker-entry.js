import {
  WORKER_CARD_RENDERER_VERSION,
  createWorkerProfileCardRenderer
} from "../../profile-card/worker-renderer.js";
import {
  PROFILE_CARD_WORKER_RENDERER_ASSETS
} from "../../profile-card/worker-renderer-assets.js";
import {
  D1_MIGRATION_MANIFEST
} from "../../profile-backend/d1/migration-manifest.js";
import { createProfileSitesWorker } from "./worker.js";

const migrationSqlModules = import.meta.glob(
  "../../../db/migrations/*.sql",
  { eager: true, import: "default", query: "?raw" }
);
const migrations = createBundledMigrations(
  D1_MIGRATION_MANIFEST,
  migrationSqlModules
);

const profileCardRenderPng = createWorkerProfileCardRenderer(
  PROFILE_CARD_WORKER_RENDERER_ASSETS
);

export default createProfileSitesWorker({
  migrations,
  profileCardRenderPng,
  profileCardRendererVersion: WORKER_CARD_RENDERER_VERSION
});

function createBundledMigrations(manifest, sqlModules) {
  const expectedModuleKeys = new Set(
    manifest.map((migration) => `../../../${migration.file}`)
  );
  const unexpectedModuleKeys = Object.keys(sqlModules)
    .filter((key) => !expectedModuleKeys.has(key));
  if (unexpectedModuleKeys.length > 0) {
    throw new TypeError(
      `Unexpected bundled D1 migrations: ${unexpectedModuleKeys.join(", ")}`
    );
  }

  return Object.freeze(manifest.map((migration) => {
    const moduleKey = `../../../${migration.file}`;
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
