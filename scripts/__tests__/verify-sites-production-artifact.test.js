import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  MAX_SITES_PRODUCTION_ARTIFACT_BYTES,
  verifySitesProductionArtifact
} from "../verify-sites-production-artifact.mjs";

test("production artifact verifier accepts the exact hosted candidate shape", async () => {
  const outputDirectory = await createProductionArtifact();
  const result = await verifySitesProductionArtifact({ outputDirectory });

  assert.equal(result.clientFileCount, 3);
  assert.equal(result.expectedBindingCount, 3);
  assert.equal(result.migrationFileCount, 2);
  assert.equal(result.workerFileCount, 1);
  assert.ok(result.artifactBytes > 0);
});

test("production artifact verifier rejects pre-hosted linkage", async () => {
  const outputDirectory = await createProductionArtifact({
    hosting: { d1: null, r2: null }
  });

  await assert.rejects(
    () => verifySitesProductionArtifact({ outputDirectory }),
    /requires the hosted linkage/
  );
});

test("production artifact verifier rejects credentials and local paths", async () => {
  const credentialArtifact = await createProductionArtifact({
    clientScript: "const token = 'gho_123456789012345678901234567890';"
  });
  await assert.rejects(
    () => verifySitesProductionArtifact({
      outputDirectory: credentialArtifact
    }),
    /forbidden credential/
  );

  const localPathArtifact = await createProductionArtifact({
    clientScript: "const source = '/Users/example/private/source.js';"
  });
  await assert.rejects(
    () => verifySitesProductionArtifact({
      outputDirectory: localPathArtifact
    }),
    /forbidden pattern|forbidden absolute local path/
  );
});

test("production artifact verifier rejects fallback runtime imports", async () => {
  const outputDirectory = await createProductionArtifact({
    workerScript: [
      "import { readFile } from 'node:fs';",
      "export default { fetch() { return new Response(String(readFile)); } };"
    ].join("\n")
  });

  await assert.rejects(
    () => verifySitesProductionArtifact({ outputDirectory }),
    /forbidden pattern|forbidden Node runtime import/
  );
});

test("production artifact verifier enforces the total candidate size", async () => {
  const outputDirectory = await createProductionArtifact();
  await writeFile(
    join(outputDirectory, "client/assets/oversized.bin"),
    Buffer.alloc(MAX_SITES_PRODUCTION_ARTIFACT_BYTES + 1)
  );

  await assert.rejects(
    () => verifySitesProductionArtifact({ outputDirectory }),
    /artifact size .* exceeds/
  );
});

async function createProductionArtifact(options = {}) {
  const outputDirectory = await mkdtemp(
    join(tmpdir(), "codex-usage-profile-production-artifact-")
  );
  const clientDirectory = join(outputDirectory, "client");
  const workerDirectory = join(outputDirectory, "server");
  const metadataDirectory = join(outputDirectory, ".openai");
  const migrationsDirectory = join(metadataDirectory, "drizzle");

  await mkdir(join(clientDirectory, "assets"), { recursive: true });
  await mkdir(workerDirectory, { recursive: true });
  await mkdir(migrationsDirectory, { recursive: true });
  await writeFile(
    join(clientDirectory, "index.html"),
    '<script type="module" src="/assets/app.js"></script>'
  );
  await writeFile(
    join(clientDirectory, "assets/app.js"),
    options.clientScript ?? "console.log('profile client');"
  );
  await writeFile(
    join(clientDirectory, "assets/app.css"),
    "body { color: #111; }"
  );
  await writeFile(
    join(workerDirectory, "index.js"),
    options.workerScript ??
      "const worker={fetch(){return new Response('ok')}};export{worker as default};"
  );
  await writeFile(join(workerDirectory, "renderer.wasm"), "wasm");
  for (const name of [
    "korean-400.bin",
    "korean-600.bin",
    "latin-400.bin",
    "latin-600.bin"
  ]) {
    await writeFile(join(workerDirectory, name), `font:${name}`);
  }
  await writeFile(
    join(workerDirectory, "wrangler.json"),
    JSON.stringify({
      assets: {
        binding: "ASSETS",
        run_worker_first: true
      },
      main: "index.js"
    })
  );
  await writeFile(
    join(metadataDirectory, "hosting.json"),
    JSON.stringify(options.hosting ?? {
      project_id: "opaque-sites-project-id",
      d1: "DB",
      r2: "PROFILE_MEDIA"
    })
  );
  await writeFile(
    join(migrationsDirectory, "0001_profile_backend.sql"),
    "CREATE TABLE owners (id TEXT PRIMARY KEY);"
  );
  await writeFile(
    join(migrationsDirectory, "0002_account_usage_rate_limits.sql"),
    "CREATE TABLE rate_limits (id TEXT PRIMARY KEY);"
  );

  return outputDirectory;
}
