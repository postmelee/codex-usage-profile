import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  symlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  materializeSitesTarget,
  normalizeOrigin,
  parseArguments,
  readSitesTargetRegistry
} from "../materialize-sites-target.mjs";

const execFileAsync = promisify(execFileCallback);
const SOURCE_SHA = "a".repeat(40);
const PRODUCTION_ID = "production-project-id";
const STAGE5_ID = "stage5-project-id";

test("materializes and re-verifies production and stage5 archives", async () => {
  const repositoryRoot = await createRepository();
  const helperPath = await createHelper();

  for (const target of ["production", "stage5"]) {
    const projectId = target === "production" ? PRODUCTION_ID : STAGE5_ID;
    const archivePath = join(
      await mkdtemp(join(tmpdir(), "codex-sites-archive-")),
      `${target}.tar.gz`
    );
    const verifiedManifests = [];
    const result = await materializeSitesTarget({
      archivePath,
      buildInvoker: createBuildOutput,
      expectedProjectId: projectId,
      packageHelperPath: helperPath,
      repositoryRoot,
      sourceSha: SOURCE_SHA,
      sourceProbe: async () => ({ clean: true, head: SOURCE_SHA }),
      target,
      verifyArtifact: async ({ expectedProjectId, outputDirectory }) => {
        const manifest = JSON.parse(await readFile(
          join(outputDirectory, ".openai/hosting.json"),
          "utf8"
        ));
        assert.equal(manifest.project_id, expectedProjectId);
        verifiedManifests.push(manifest);
        return { artifactBytes: 123 };
      }
    });

    assert.equal(verifiedManifests.length, 2);
    assert.deepEqual(verifiedManifests[0], verifiedManifests[1]);
    assert.equal(result.target, target);
    assert.equal(result.sourceSha, SOURCE_SHA);
    assert.equal(result.projectId, projectId);
    assert.equal(result.artifactBytes, 123);
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

test("uses the real git source probe and executable package helper", async () => {
  const repositoryRoot = await createRepository();
  await execFileAsync("git", ["init"], { cwd: repositoryRoot });
  await execFileAsync("git", ["config", "user.name", "Target Test"], {
    cwd: repositoryRoot
  });
  await execFileAsync("git", ["config", "user.email", "target@example.test"], {
    cwd: repositoryRoot
  });
  await execFileAsync("git", ["add", "."], { cwd: repositoryRoot });
  await execFileAsync("git", ["commit", "-m", "fixture"], {
    cwd: repositoryRoot
  });
  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
  const archivePath = join(
    await mkdtemp(join(tmpdir(), "codex-sites-real-probe-")),
    "production.tar.gz"
  );

  const result = await materializeSitesTarget({
    archivePath,
    buildInvoker: createBuildOutput,
    expectedProjectId: PRODUCTION_ID,
    packageHelperPath: await createHelper(),
    repositoryRoot,
    sourceSha: stdout.trim(),
    target: "production",
    verifyArtifact: async () => ({ artifactBytes: 456 })
  });

  assert.equal(result.sourceSha, stdout.trim());
  assert.equal(result.artifactBytes, 456);
});

test("deletes ignored stale dist before rebuilding from the exact source", async () => {
  const repositoryRoot = await createRepository();
  const stalePath = join(repositoryRoot, "dist/server/stale.js");
  await mkdir(join(repositoryRoot, "dist/server"), { recursive: true });
  await writeFile(stalePath, "stale build");
  const archivePath = join(
    await mkdtemp(join(tmpdir(), "codex-sites-rebuild-")),
    "production.tar.gz"
  );

  await materializeSitesTarget({
    archivePath,
    buildInvoker: async (options) => {
      await assert.rejects(() => access(stalePath), /ENOENT/);
      await createBuildOutput(options);
    },
    expectedProjectId: PRODUCTION_ID,
    packageHelperPath: await createHelper(),
    repositoryRoot,
    sourceSha: SOURCE_SHA,
    sourceProbe: async () => ({ clean: true, head: SOURCE_SHA }),
    target: "production",
    verifyArtifact: async ({ outputDirectory }) => {
      await assert.rejects(
        () => access(join(outputDirectory, "server/stale.js")),
        /ENOENT/
      );
      return { artifactBytes: 789 };
    }
  });
});

test("rejects duplicate projects, registry versions, and invalid origins", async () => {
  const duplicateRoot = await createRepository({
    stage5: { project_id: PRODUCTION_ID }
  });
  await assert.rejects(
    () => readSitesTargetRegistry({ repositoryRoot: duplicateRoot }),
    /different project_id/
  );

  const versionRoot = await createRepository({ registryVersion: 2 });
  await assert.rejects(
    () => readSitesTargetRegistry({ repositoryRoot: versionRoot }),
    /version must be 1/
  );

  for (const origin of [
    "http://codex-usage-profile.meleeisdeveloping.chatgpt.site",
    "https://user:secret@codex-usage-profile.meleeisdeveloping.chatgpt.site",
    "https://codex-usage-profile.meleeisdeveloping.chatgpt.site/path"
  ]) {
    assert.throws(() => normalizeOrigin(origin), /HTTPS origin/);
  }
});

test("requires complete unique CLI arguments", () => {
  const expected = {
    archivePath: "/tmp/production.tar.gz",
    expectedProjectId: PRODUCTION_ID,
    packageHelperPath: "/tmp/package-site.sh",
    sourceSha: SOURCE_SHA,
    target: "production"
  };
  assert.deepEqual(parseArguments([
    "--target", "production",
    "--archive", expected.archivePath,
    "--source-sha", SOURCE_SHA,
    "--package-helper", expected.packageHelperPath,
    "--expected-project-id", PRODUCTION_ID
  ]), expected);
  assert.throws(() => parseArguments([]), /Expected unique/);
  assert.throws(
    () => parseArguments([
      "--target", "production",
      "--target", "stage5"
    ]),
    /Expected unique/
  );
});

test("rejects canonical drift, wrong live target, dirty source, and in-repository archives", async () => {
  const driftRoot = await createRepository({ canonicalProjectId: STAGE5_ID });
  const helperPath = await createHelper();
  const externalArchive = join(
    await mkdtemp(join(tmpdir(), "codex-sites-archive-")),
    "candidate.tar.gz"
  );
  await assert.rejects(
    () => materializeSitesTarget({
      archivePath: externalArchive,
      buildInvoker: createBuildOutput,
      expectedProjectId: PRODUCTION_ID,
      packageHelperPath: helperPath,
      repositoryRoot: driftRoot,
      sourceSha: SOURCE_SHA,
      sourceProbe: async () => ({ clean: true, head: SOURCE_SHA }),
      target: "production"
    }),
    /does not match the production target/
  );

  const repositoryRoot = await createRepository();
  await assert.rejects(
    () => materializeSitesTarget({
      archivePath: externalArchive,
      buildInvoker: createBuildOutput,
      packageHelperPath: helperPath,
      repositoryRoot,
      sourceSha: SOURCE_SHA,
      sourceProbe: async () => ({ clean: true, head: SOURCE_SHA }),
      target: "production"
    }),
    /requires the live preflight project_id/
  );
  await assert.rejects(
    () => materializeSitesTarget({
      archivePath: externalArchive,
      buildInvoker: createBuildOutput,
      expectedProjectId: "wrong-live-project",
      packageHelperPath: helperPath,
      repositoryRoot,
      sourceSha: SOURCE_SHA,
      sourceProbe: async () => ({ clean: true, head: SOURCE_SHA }),
      target: "production"
    }),
    /live preflight project_id/
  );

  await assert.rejects(
    () => materializeSitesTarget({
      archivePath: externalArchive,
      buildInvoker: createBuildOutput,
      expectedProjectId: PRODUCTION_ID,
      packageHelperPath: helperPath,
      repositoryRoot,
      sourceSha: SOURCE_SHA,
      sourceProbe: async () => ({ clean: false, head: SOURCE_SHA }),
      target: "production"
    }),
    /clean repository/
  );

  await assert.rejects(
    () => materializeSitesTarget({
      archivePath: join(repositoryRoot, "candidate.tar.gz"),
      buildInvoker: createBuildOutput,
      expectedProjectId: PRODUCTION_ID,
      packageHelperPath: helperPath,
      repositoryRoot,
      sourceSha: SOURCE_SHA,
      sourceProbe: async () => ({ clean: true, head: SOURCE_SHA }),
      target: "production"
    }),
    /outside the repository/
  );
});

test("resolves archive parent symlinks before enforcing the repository boundary", async () => {
  const repositoryRoot = await createRepository();
  const externalRoot = await mkdtemp(join(tmpdir(), "codex-sites-symlink-"));
  const repositoryLink = join(externalRoot, "repository-link");
  const helperPath = await createHelper();
  await symlink(repositoryRoot, repositoryLink, "dir");

  await assert.rejects(
    () => materializeSitesTarget({
      archivePath: join(repositoryLink, "candidate.tar.gz"),
      buildInvoker: createBuildOutput,
      expectedProjectId: PRODUCTION_ID,
      packageHelperPath: helperPath,
      repositoryRoot,
      sourceSha: SOURCE_SHA,
      sourceProbe: async () => ({ clean: true, head: SOURCE_SHA }),
      target: "production"
    }),
    /outside the repository/
  );
});

test("rejects existing, empty, malformed, and partially written archives without leftovers", async () => {
  const repositoryRoot = await createRepository();
  const archiveDirectory = await mkdtemp(join(tmpdir(), "codex-sites-failure-"));
  const baseOptions = {
    buildInvoker: createBuildOutput,
    expectedProjectId: PRODUCTION_ID,
    repositoryRoot,
    sourceSha: SOURCE_SHA,
    sourceProbe: async () => ({ clean: true, head: SOURCE_SHA }),
    target: "production",
    verifyArtifact: async () => ({ artifactBytes: 1 })
  };

  const existingArchive = join(archiveDirectory, "existing.tar.gz");
  const validHelper = await createHelper();
  await writeFile(existingArchive, "keep");
  await assert.rejects(
    () => materializeSitesTarget({
      ...baseOptions,
      archivePath: existingArchive,
      packageHelperPath: validHelper
    }),
    /already exists/
  );
  assert.equal(await readFile(existingArchive, "utf8"), "keep");

  for (const mode of ["empty", "malformed", "partial-failure"]) {
    const archivePath = join(archiveDirectory, `${mode}.tar.gz`);
    const packageHelperPath = await createHelper(mode);
    await assert.rejects(
      () => materializeSitesTarget({
        ...baseOptions,
        archivePath,
        packageHelperPath
      }),
      mode === "empty" ? /archive is empty/ : /archive|Command failed|unsafe/
    );
    await assert.rejects(() => access(archivePath), /ENOENT/);
  }
});

async function createRepository(overrides = {}) {
  const repositoryRoot = await mkdtemp(
    join(tmpdir(), "codex-sites-target-repository-")
  );
  await mkdir(join(repositoryRoot, ".openai"), { recursive: true });
  await writeFile(join(repositoryRoot, ".gitignore"), "dist/\n");
  await writeFile(join(repositoryRoot, "source.txt"), "exact source\n");

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
    `${JSON.stringify({
      version: overrides.registryVersion ?? 1,
      production,
      stage5
    }, null, 2)}\n`
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

async function createBuildOutput({ outputDirectory }) {
  await mkdir(join(outputDirectory, "client"), { recursive: true });
  await mkdir(join(outputDirectory, "server"), { recursive: true });
  await writeFile(join(outputDirectory, "client/index.html"), "ok");
  await writeFile(join(outputDirectory, "server/index.js"), "export default {};\n");
}

async function createHelper(mode = "valid") {
  const directory = await mkdtemp(join(tmpdir(), "codex-sites-helper-"));
  const helperPath = join(directory, "package-site.sh");
  const bodies = {
    valid: [
      "#!/bin/sh",
      "set -eu",
      "mkdir -p \"$(dirname \"$2\")\"",
      "tar -C \"$1\" -czf \"$2\" dist"
    ],
    empty: ["#!/bin/sh", "set -eu", ": > \"$2\""],
    malformed: [
      "#!/bin/sh",
      "set -eu",
      "tar -C \"$1\" -czf \"$2\" .openai"
    ],
    "partial-failure": [
      "#!/bin/sh",
      "set -eu",
      "printf partial > \"$2\"",
      "exit 9"
    ]
  };
  await writeFile(helperPath, `${bodies[mode].join("\n")}\n`, { mode: 0o700 });
  return helperPath;
}
