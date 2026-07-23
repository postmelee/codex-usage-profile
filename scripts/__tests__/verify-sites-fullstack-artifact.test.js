import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  verifySitesFullStackArtifact
} from "../verify-sites-fullstack-artifact.mjs";

test("full-stack artifact verifier accepts the Stage 1 Sites shape", async () => {
  const outputDirectory = await createArtifact();
  const result = await verifySitesFullStackArtifact({ outputDirectory });

  assert.equal(result.clientFileCount, 2);
  assert.equal(result.workerFileCount, 1);
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

test("full-stack artifact verifier keeps Stage 1 bindings unprovisioned", async () => {
  const outputDirectory = await createArtifact({
    hosting: {
      d1: "DB",
      r2: "PROFILE_MEDIA"
    }
  });

  await assert.rejects(
    () => verifySitesFullStackArtifact({ outputDirectory }),
    /must keep d1\/r2 null/
  );
});

async function createArtifact(options = {}) {
  const outputDirectory = await mkdtemp(
    join(tmpdir(), "codex-usage-profile-sites-artifact-")
  );
  const clientDirectory = join(outputDirectory, "client");
  const workerDirectory = join(outputDirectory, "profile-sites");
  const metadataDirectory = join(outputDirectory, ".openai");

  await mkdir(join(clientDirectory, "assets"), { recursive: true });
  await mkdir(workerDirectory, { recursive: true });
  await mkdir(metadataDirectory, { recursive: true });
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

  return outputDirectory;
}
