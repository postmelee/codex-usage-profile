import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  verifySitesFullStackArtifact
} from "../verify-sites-fullstack-artifact.mjs";

test("full-stack artifact verifier accepts the production Sites shape", async () => {
  const outputDirectory = await createArtifact();
  const result = await verifySitesFullStackArtifact({ outputDirectory });

  assert.equal(result.clientFileCount, 2);
  assert.equal(result.hostingMode, "pre-hosted");
  assert.equal(result.migrationFileCount, 3);
  assert.equal(result.workerFileCount, 1);
});

test("full-stack artifact verifier accepts the approved hosted linkage", async () => {
  const outputDirectory = await createArtifact({
    hosting: {
      project_id: "opaque-sites-project-id",
      d1: "DB",
      r2: "PROFILE_MEDIA"
    }
  });
  const result = await verifySitesFullStackArtifact({ outputDirectory });

  assert.equal(result.hostingMode, "hosted");
});

test("full-stack artifact verifier rejects server-only values in the client", async () => {
  const outputDirectory = await createArtifact({
    clientScript: "const secret = 'GITHUB_CLIENT_SECRET';"
  });

  await assert.rejects(
    () => verifySitesFullStackArtifact({ outputDirectory }),
    /client artifact contains forbidden pattern/
  );
});

test("full-stack artifact verifier rejects Node-only hosted imports", async () => {
  const outputDirectory = await createArtifact({
    workerScript: [
      "import { readFile } from 'node:fs';",
      "export default { fetch() { return new Response(String(readFile)); } };"
    ].join("\n")
  });

  await assert.rejects(
    () => verifySitesFullStackArtifact({ outputDirectory }),
    /Worker artifact contains forbidden pattern/
  );
});

test("full-stack artifact verifier keeps pre-hosted bindings unprovisioned", async () => {
  const outputDirectory = await createArtifact({
    hosting: {
      d1: "DB",
      r2: "PROFILE_MEDIA"
    }
  });

  await assert.rejects(
    () => verifySitesFullStackArtifact({ outputDirectory }),
    /approved project_id\/DB\/PROFILE_MEDIA linkage/
  );
});

async function createArtifact(options = {}) {
  const outputDirectory = await mkdtemp(
    join(tmpdir(), "codex-usage-profile-sites-artifact-")
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
      d1: null,
      r2: null
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
  await writeFile(
    join(migrationsDirectory, "0003_cli_login_intent.sql"),
    "ALTER TABLE cli_login_challenges ADD COLUMN intent TEXT;"
  );

  return outputDirectory;
}
