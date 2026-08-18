import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import test from "node:test";

import {
  materializeSitesTarget,
  readSitesTargetRegistry
} from "../materialize-sites-target.mjs";

const SOURCE_SHA = "a".repeat(40);
const PRODUCTION_ID = "production-project-id";
const STAGE5_ID = "stage5-project-id";

test("materializes production and stage5 archives outside the repository", async () => {
  const repositoryRoot = await createRepository();
  const helperPath = await createHelper();

  for (const target of ["production", "stage5"]) {
    const archivePath = join(
      await mkdtemp(join(tmpdir(), "codex-sites-archive-")),
      `${target}.tar.gz`
    );
    let stagedManifest;
    let stagedOutsideRepository = false;
    const result = await materializeSitesTarget({
      archivePath,
      packageHelperPath: helperPath,
      repositoryRoot,
      sourceSha: SOURCE_SHA,
      sourceProbe: async () => ({ clean: true, head: SOURCE_SHA }),
      target,
      verifyArtifact: async ({ expectedProjectId, outputDirectory }) => {
        stagedManifest = JSON.parse(await readFile(
          join(outputDirectory, ".openai/hosting.json"),
          "utf8"
        ));
        assert.equal(stagedManifest.project_id, expectedProjectId);
        return { artifactBytes: 123 };
      },
      packageInvoker: async ({ archivePath: output, projectDirectory }) => {
        const pathFromRepository = relative(repositoryRoot, projectDirectory);
        stagedOutsideRepository = pathFromRepository.startsWith("..");
        const rootManifest = JSON.parse(await readFile(
          join(projectDirectory, ".openai/hosting.json"),
          "utf8"
        ));
        assert.deepEqual(rootManifest, stagedManifest);
        await writeFile(output, `archive:${target}`);
      }
    });

    assert.equal(stagedOutsideRepository, true);
    assert.equal(result.target, target);
    assert.equal(result.sourceSha, SOURCE_SHA);
    assert.equal(
      result.projectId,
      target === "production" ? PRODUCTION_ID : STAGE5_ID
    );
    assert.equal(result.archiveBytes > 0, true);
    assert.match(result.archiveSha256, /^[0-9a-f]{64}$/);
    assert.match(result.manifestSha256, /^[0-9a-f]{64}$/);
  }

  const canonical = JSON.parse(await readFile(
    join(repositoryRoot, ".openai/hosting.json"),
    "utf8"
  ));
  assert.equal(canonical.project_id, PRODUCTION_ID);
});

test("rejects duplicate projects and unexpected target origins", async () => {
  const duplicateRoot = await createRepository({
    stage5: { project_id: PRODUCTION_ID }
  });
  await assert.rejects(
    () => readSitesTargetRegistry({ repositoryRoot: duplicateRoot }),
    /different project_id/
  );

  const originRoot = await createRepository({
    stage5: { origin: "https://wrong.example.test" }
  });
  await assert.rejects(
    () => readSitesTargetRegistry({ repositoryRoot: originRoot }),
    /unexpected origin/
  );
});

test("rejects canonical hosting drift, dirty source, and in-repository archives", async () => {
  const driftRoot = await createRepository({
    canonicalProjectId: STAGE5_ID
  });
  const helperPath = await createHelper();
  const externalArchive = join(
    await mkdtemp(join(tmpdir(), "codex-sites-archive-")),
    "candidate.tar.gz"
  );
  await assert.rejects(
    () => materializeSitesTarget({
      archivePath: externalArchive,
      packageHelperPath: helperPath,
      repositoryRoot: driftRoot,
      sourceSha: SOURCE_SHA,
      sourceProbe: async () => ({ clean: true, head: SOURCE_SHA }),
      target: "production"
    }),
    /does not match the production target/
  );

  const dirtyRoot = await createRepository();
  await assert.rejects(
    () => materializeSitesTarget({
      archivePath: externalArchive,
      packageHelperPath: helperPath,
      repositoryRoot: dirtyRoot,
      sourceSha: SOURCE_SHA,
      sourceProbe: async () => ({ clean: false, head: SOURCE_SHA }),
      target: "production"
    }),
    /clean repository/
  );

  await assert.rejects(
    () => materializeSitesTarget({
      archivePath: join(dirtyRoot, "candidate.tar.gz"),
      packageHelperPath: helperPath,
      repositoryRoot: dirtyRoot,
      sourceSha: SOURCE_SHA,
      sourceProbe: async () => ({ clean: true, head: SOURCE_SHA }),
      target: "production"
    }),
    /outside the repository/
  );
});

async function createRepository(overrides = {}) {
  const repositoryRoot = await mkdtemp(
    join(tmpdir(), "codex-sites-target-repository-")
  );
  await mkdir(join(repositoryRoot, ".openai"), { recursive: true });
  await mkdir(join(repositoryRoot, "dist/client"), { recursive: true });
  await writeFile(join(repositoryRoot, "dist/client/index.html"), "ok");

  const production = {
    project_id: PRODUCTION_ID,
    origin: "https://codex-usage-profile.meleeisdeveloping.chatgpt.site",
    d1: "DB",
    r2: "PROFILE_MEDIA",
    ...(overrides.production ?? {})
  };
  const stage5 = {
    project_id: STAGE5_ID,
    origin: "https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site",
    d1: "DB",
    r2: "PROFILE_MEDIA",
    ...(overrides.stage5 ?? {})
  };
  await writeFile(
    join(repositoryRoot, ".openai/hosting-targets.json"),
    `${JSON.stringify({ version: 1, production, stage5 }, null, 2)}\n`
  );
  await writeFile(
    join(repositoryRoot, ".openai/hosting.json"),
    `${JSON.stringify({
      project_id: overrides.canonicalProjectId ?? production.project_id,
      d1: "DB",
      r2: "PROFILE_MEDIA"
    }, null, 2)}\n`
  );
  return repositoryRoot;
}

async function createHelper() {
  const directory = await mkdtemp(join(tmpdir(), "codex-sites-helper-"));
  const helperPath = join(directory, "package-site.sh");
  await writeFile(helperPath, "#!/bin/sh\nexit 0\n", { mode: 0o700 });
  return helperPath;
}
