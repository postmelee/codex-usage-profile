import assert from "node:assert/strict";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  finalizeSitesFullStackArtifact
} from "../finalize-sites-fullstack-artifact.mjs";

test("finalizer removes only the consumed Vite manifest", async (t) => {
  const fixture = await createArtifactFixture(t);
  const runtimeBefore = await readRuntimeFiles(fixture.outputDirectory);

  const result = await finalizeSitesFullStackArtifact({
    outputDirectory: fixture.outputDirectory
  });

  assert.deepEqual(result, {
    manifestRemoved: true,
    preservedEntryCount: 0
  });
  await assert.rejects(() => access(fixture.manifestPath), { code: "ENOENT" });
  await assert.rejects(() => access(fixture.metadataDirectory), { code: "ENOENT" });
  assert.deepEqual(
    await readRuntimeFiles(fixture.outputDirectory),
    runtimeBefore
  );
});

test("finalizer is a no-op when the build has no Vite metadata", async (t) => {
  const fixture = await createArtifactFixture(t, { manifest: false });

  assert.deepEqual(
    await finalizeSitesFullStackArtifact({
      outputDirectory: fixture.outputDirectory
    }),
    {
      manifestRemoved: false,
      preservedEntryCount: 0
    }
  );
});

test("finalizer preserves unexpected Vite metadata for verification", async (t) => {
  const fixture = await createArtifactFixture(t);
  const additionalMetadata = join(fixture.metadataDirectory, "other.json");
  await writeFile(additionalMetadata, '{"unexpected":true}');

  assert.deepEqual(
    await finalizeSitesFullStackArtifact({
      outputDirectory: fixture.outputDirectory
    }),
    {
      manifestRemoved: true,
      preservedEntryCount: 1
    }
  );
  assert.equal(await readFile(additionalMetadata, "utf8"), '{"unexpected":true}');
});

test("finalizer rejects a symlinked manifest", async (t) => {
  const fixture = await createArtifactFixture(t, { manifest: false });
  const target = join(fixture.rootDirectory, "outside-manifest.json");
  await writeFile(target, '{"outside":true}');
  await symlink(target, fixture.manifestPath);

  await assert.rejects(
    () => finalizeSitesFullStackArtifact({
      outputDirectory: fixture.outputDirectory
    }),
    /manifest must be a regular file/
  );
  assert.equal(await readFile(target, "utf8"), '{"outside":true}');
});

test("finalizer rejects a symlinked metadata directory", async (t) => {
  const fixture = await createArtifactFixture(t, { metadata: false });
  const target = join(fixture.rootDirectory, "outside-metadata");
  await mkdir(target);
  await writeFile(join(target, "manifest.json"), '{"outside":true}');
  await symlink(target, fixture.metadataDirectory);

  await assert.rejects(
    () => finalizeSitesFullStackArtifact({
      outputDirectory: fixture.outputDirectory
    }),
    /metadata directory must be a regular directory/
  );
  assert.equal(
    await readFile(join(target, "manifest.json"), "utf8"),
    '{"outside":true}'
  );
});

async function createArtifactFixture(t, options = {}) {
  const rootDirectory = await mkdtemp(
    join(tmpdir(), "codex-usage-profile-sites-finalizer-")
  );
  t.after(() => rm(rootDirectory, { force: true, recursive: true }));

  const outputDirectory = join(rootDirectory, "dist");
  const serverDirectory = join(outputDirectory, "server");
  const metadataDirectory = join(serverDirectory, ".vite");
  const manifestPath = join(metadataDirectory, "manifest.json");
  await mkdir(serverDirectory, { recursive: true });
  if (options.metadata !== false) {
    await mkdir(metadataDirectory);
  }

  const runtimeFiles = new Map([
    ["index.js", "export default { fetch() {} };"],
    ["renderer.wasm", "wasm"],
    ["font.bin", "font"],
    ["wrangler.json", '{"main":"index.js"}']
  ]);
  for (const [name, contents] of runtimeFiles) {
    await writeFile(join(serverDirectory, name), contents);
  }

  if (options.metadata !== false && options.manifest !== false) {
    await writeFile(
      manifestPath,
      '{"/Users/example/source.js":{"file":"assets/app.js"}}'
    );
  }

  return {
    manifestPath,
    metadataDirectory,
    outputDirectory,
    rootDirectory
  };
}

async function readRuntimeFiles(outputDirectory) {
  const serverDirectory = join(outputDirectory, "server");
  const entries = [
    "index.js",
    "renderer.wasm",
    "font.bin",
    "wrangler.json"
  ];
  return Promise.all(entries.map(async (name) => [
    name,
    await readFile(join(serverDirectory, name))
  ]));
}
