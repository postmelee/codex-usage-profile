import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import {
  verifySitesProductionArtifact
} from "./verify-sites-production-artifact.mjs";

const execFileAsync = promisify(execFileCallback);
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, "..");
const TARGET_NAMES = Object.freeze(["production", "stage5"]);
const EXPECTED_ORIGINS = Object.freeze({
  production:
    "https://codex-usage-profile.meleeisdeveloping.chatgpt.site",
  stage5:
    "https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site"
});

export async function readSitesTargetRegistry(options = {}) {
  const repositoryRoot = resolve(
    options.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT
  );
  const registryPath = resolve(
    options.registryPath ?? join(repositoryRoot, ".openai/hosting-targets.json")
  );
  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  assertExactKeys(registry, ["production", "stage5", "version"], "target registry");
  if (registry.version !== 1) {
    throw new Error("Sites target registry version must be 1");
  }

  const targets = {};
  for (const name of TARGET_NAMES) {
    const target = registry[name];
    assertExactKeys(
      target,
      ["d1", "origin", "project_id", "r2"],
      `${name} target`
    );
    if (typeof target.project_id !== "string" || target.project_id.trim() === "") {
      throw new Error(`${name} target requires a project_id`);
    }
    if (target.d1 !== "DB" || target.r2 !== "PROFILE_MEDIA") {
      throw new Error(`${name} target requires DB and PROFILE_MEDIA bindings`);
    }
    if (normalizeOrigin(target.origin) !== EXPECTED_ORIGINS[name]) {
      throw new Error(`${name} target has an unexpected origin`);
    }
    targets[name] = Object.freeze({ ...target });
  }

  if (targets.production.project_id === targets.stage5.project_id) {
    throw new Error("Production and stage5 must use different project_id values");
  }
  if (targets.production.origin === targets.stage5.origin) {
    throw new Error("Production and stage5 must use different origins");
  }

  return Object.freeze({
    production: targets.production,
    stage5: targets.stage5,
    version: 1
  });
}

export async function materializeSitesTarget(options = {}) {
  const repositoryRoot = resolve(
    options.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT
  );
  const targetName = options.target;
  if (!TARGET_NAMES.includes(targetName)) {
    throw new Error("Sites target must be production or stage5");
  }
  if (typeof options.sourceSha !== "string" || !/^[0-9a-f]{40}$/.test(options.sourceSha)) {
    throw new Error("Sites target packaging requires a lowercase 40-character source SHA");
  }
  if (typeof options.archivePath !== "string" || !isAbsolute(options.archivePath)) {
    throw new Error("Sites target archive path must be absolute");
  }
  const archivePath = resolve(options.archivePath);
  assertPathOutside(archivePath, repositoryRoot, "Sites target archive");
  await assertPathAbsent(archivePath, "Sites target archive");

  if (
    typeof options.packageHelperPath !== "string" ||
    !isAbsolute(options.packageHelperPath)
  ) {
    throw new Error("Sites package helper path must be absolute");
  }
  const packageHelperPath = resolve(options.packageHelperPath);
  await requireRegularFile(packageHelperPath, "Sites package helper");

  const registry = await readSitesTargetRegistry({ repositoryRoot });
  const target = registry[targetName];
  const canonicalHosting = JSON.parse(
    await readFile(join(repositoryRoot, ".openai/hosting.json"), "utf8")
  );
  assertHostingMatchesTarget(
    canonicalHosting,
    registry.production,
    "Canonical hosting manifest"
  );

  const sourceProbe = options.sourceProbe ?? probeGitSource;
  const source = await sourceProbe(repositoryRoot);
  if (source.head !== options.sourceSha) {
    throw new Error("Sites target source SHA does not match the repository HEAD");
  }
  if (source.clean !== true) {
    throw new Error("Sites target packaging requires a clean repository");
  }

  const outputDirectory = join(repositoryRoot, "dist");
  await requireDirectory(outputDirectory, "Sites build output");
  const temporaryRoot = await mkdtemp(join(tmpdir(), "codex-usage-profile-sites-target-"));
  try {
    const stagedOutput = join(temporaryRoot, "dist");
    const stagedMetadata = join(temporaryRoot, ".openai");
    await cp(outputDirectory, stagedOutput, { recursive: true });
    await mkdir(stagedMetadata, { recursive: true });
    await mkdir(join(stagedOutput, ".openai"), { recursive: true });

    const hosting = {
      project_id: target.project_id,
      d1: target.d1,
      r2: target.r2
    };
    const manifestBytes = `${JSON.stringify(hosting, null, 2)}\n`;
    await writeFile(join(stagedMetadata, "hosting.json"), manifestBytes);
    await writeFile(
      join(stagedOutput, ".openai/hosting.json"),
      manifestBytes
    );

    const verifyArtifact = options.verifyArtifact ?? verifySitesProductionArtifact;
    const artifact = await verifyArtifact({
      expectedProjectId: target.project_id,
      outputDirectory: stagedOutput
    });

    const packageInvoker = options.packageInvoker ?? invokePackageHelper;
    await packageInvoker({
      archivePath,
      packageHelperPath,
      projectDirectory: temporaryRoot
    });
    const archive = await readFile(archivePath);
    if (archive.length === 0) {
      throw new Error("Sites target archive is empty");
    }

    return Object.freeze({
      archiveBytes: archive.length,
      archivePath,
      archiveSha256: sha256(archive),
      artifactBytes: artifact.artifactBytes ?? null,
      manifestSha256: sha256(Buffer.from(manifestBytes)),
      origin: target.origin,
      projectId: target.project_id,
      sourceSha: options.sourceSha,
      target: targetName
    });
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
}

async function probeGitSource(repositoryRoot) {
  const [{ stdout: head }, { stdout: statusOutput }] = await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: repositoryRoot,
      encoding: "utf8"
    }),
    execFileAsync("git", ["status", "--short"], {
      cwd: repositoryRoot,
      encoding: "utf8"
    })
  ]);
  return {
    clean: statusOutput.trim() === "",
    head: head.trim()
  };
}

async function invokePackageHelper(options) {
  await execFileAsync(options.packageHelperPath, [
    options.projectDirectory,
    options.archivePath
  ], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024
  });
}

function assertHostingMatchesTarget(hosting, target, label) {
  assertExactKeys(hosting, ["d1", "project_id", "r2"], label);
  if (
    hosting.project_id !== target.project_id ||
    hosting.d1 !== target.d1 ||
    hosting.r2 !== target.r2
  ) {
    throw new Error(`${label} does not match the production target`);
  }
}

function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${label} has unexpected fields`);
  }
}

function normalizeOrigin(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    throw new Error("Sites target origin must be an absolute URL");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Sites target origin must be a credential-free HTTPS origin");
  }
  return url.origin;
}

function assertPathOutside(candidatePath, parentPath, label) {
  const pathFromParent = relative(resolve(parentPath), resolve(candidatePath));
  if (
    pathFromParent === "" ||
    pathFromParent === ".." ||
    !pathFromParent.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
  ) {
    throw new Error(`${label} must be outside the repository`);
  }
}

async function assertPathAbsent(path, label) {
  try {
    await lstat(path);
    throw new Error(`${label} already exists`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function requireDirectory(path, label) {
  const details = await stat(path);
  if (!details.isDirectory()) throw new Error(`${label} must be a directory`);
}

async function requireRegularFile(path, label) {
  const details = await stat(path);
  if (!details.isFile()) throw new Error(`${label} must be a regular file`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) {
      throw new Error("Expected --target, --archive, --source-sha, and --package-helper");
    }
    values[key.slice(2)] = value;
  }
  return {
    archivePath: values.archive,
    packageHelperPath: values["package-helper"],
    sourceSha: values["source-sha"],
    target: values.target
  };
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;

if (invokedPath === import.meta.url) {
  try {
    const result = await materializeSitesTarget(parseArguments(process.argv.slice(2)));
    console.log(JSON.stringify({
      archiveBytes: result.archiveBytes,
      archiveSha256: result.archiveSha256,
      manifestSha256: result.manifestSha256,
      ok: true,
      origin: result.origin,
      projectId: result.projectId,
      sourceSha: result.sourceSha,
      target: result.target
    }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
