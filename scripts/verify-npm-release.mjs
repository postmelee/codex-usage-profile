import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import {
  dirname,
  join,
  posix,
  resolve
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFileCallback);
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, "..");

export const EXPECTED_NPM_PACKAGE = Object.freeze({
  name: "codex-usage-profile",
  version: "0.1.4",
  id: "codex-usage-profile@0.1.4",
  license: "MIT",
  registry: "https://registry.npmjs.org/"
});

export const EXPECTED_ANALYZER_PACKAGE = Object.freeze({
  name: "codex-usage-analyzer",
  version: "0.4.1",
  resolved:
    "https://registry.npmjs.org/codex-usage-analyzer/-/" +
    "codex-usage-analyzer-0.4.1.tgz",
  integrity:
    "sha512-0UJFechEYosMyXzlNqlDxyrjM2B1muzrec9CqBgVZW6CYG9VZ8eXteeuNfX" +
    "IeBVQMx2jxO2XMu9UpCQrsQSQmw==",
  license: "MIT",
  node: ">=20"
});

export const EXPECTED_NPM_PACKAGE_FILES = Object.freeze([
  "LICENSE",
  "README.md",
  "bin/codex-usage-profile.js",
  "package.json",
  "src/cli.js",
  "src/config.js",
  "src/credentials.js",
  "src/device-login.js",
  "src/errors.js",
  "src/github-star.js",
  "src/index.js",
  "src/output.js",
  "src/service-client.js",
  "src/submit.js"
]);

const EXPECTED_PACKAGE_DIRECTORY = "packages/codex-usage-profile-cli";
const EXPECTED_REPOSITORY_URL =
  "https://github.com/postmelee/codex-usage-profile";
const EXPECTED_HOMEPAGE = `${EXPECTED_REPOSITORY_URL}#readme`;
const EXPECTED_BUGS_URL = `${EXPECTED_REPOSITORY_URL}/issues`;
const EXPECTED_FILES_FIELD = Object.freeze([
  "bin",
  "src",
  "README.md",
  "LICENSE"
]);
const TEXT_PACKAGE_PATH = /\.(?:js|json|md|txt)$|^LICENSE$/;
const SAFE_ENVIRONMENT_KEYS = Object.freeze([
  "ComSpec",
  "LANG",
  "LC_ALL",
  "PATH",
  "PATHEXT",
  "SystemRoot",
  "WINDIR"
]);

const TOKEN_PATTERNS = Object.freeze([
  Object.freeze({
    category: "GitHub credential",
    pattern: /\b(?:github_pat_[A-Za-z0-9_]{40,}|gh[pousr]_[A-Za-z0-9]{30,})\b/g
  }),
  Object.freeze({
    category: "npm credential",
    pattern: /\bnpm_[A-Za-z0-9]{30,}\b/g
  }),
  Object.freeze({
    category: "OpenAI credential",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/g
  }),
  Object.freeze({
    category: "AWS access key",
    pattern: /\bAKIA[0-9A-Z]{16}\b/g
  }),
  Object.freeze({
    category: "private key",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g
  }),
  Object.freeze({
    category: "private absolute path",
    pattern:
      /(?:\/Users\/[^/\s"'`]+\/|\/home\/[^/\s"'`]+\/|[A-Za-z]:\\\\Users\\\\[^\\\s"'`]+\\\\)/g
  }),
  Object.freeze({
    category: "local Codex session path",
    pattern: /\.codex[\\/]sessions(?:[\\/]|["'`])/g
  }),
  Object.freeze({
    category: "repository-only path",
    pattern: /(?:codex-extracted[\\/]|(?:file|link|workspace):\.\.?[\\/])/g
  })
]);

const SECRET_ASSIGNMENT_PATTERN =
  /\b[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|ACCESS_KEY)[A-Z0-9_]*\b\s*[:=]\s*["'`]([^"'`\r\n]{16,})["'`]/gi;

export async function verifyNpmRelease(options = {}) {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "codex-usage-profile-npm-verify-")
  );
  try {
    const candidate = await createNpmReleaseCandidate({
      ...options,
      candidateDirectory: temporaryDirectory
    });
    return publicReleaseSummary(candidate);
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}

export async function createNpmReleaseCandidate(options = {}) {
  if (
    typeof options.candidateDirectory !== "string" ||
    options.candidateDirectory.trim() === ""
  ) {
    throw new Error("candidateDirectory is required for npm release verification");
  }
  const repositoryRoot = resolve(
    options.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT
  );
  const packageDirectory = resolve(
    options.packageDirectory ??
      join(repositoryRoot, EXPECTED_PACKAGE_DIRECTORY)
  );
  const candidateDirectory = resolve(options.candidateDirectory);
  const packageManifest = JSON.parse(
    await readFile(join(packageDirectory, "package.json"), "utf8")
  );
  const lockfile = JSON.parse(
    await readFile(join(repositoryRoot, "package-lock.json"), "utf8")
  );

  verifyPackageMetadata(packageManifest);
  verifyLockfileContract(lockfile);
  await verifyPackageSourceFiles(packageDirectory);

  await mkdir(candidateDirectory, { recursive: true });
  const packResult = await runNpmPack({
    candidateDirectory,
    packageDirectory,
    processEnvironment: options.processEnvironment,
    runCommand: options.runCommand
  });
  const tarballPath = resolve(
    candidateDirectory,
    "artifact",
    packResult.filename
  );
  const tarball = await readFile(tarballPath);
  const tarEntries = parseTarEntries(tarball);

  verifyPackResult(packResult, tarball);
  verifyPackedEntries(tarEntries, packResult.files);

  const packedManifestEntry = tarEntries.find(
    (entry) => entry.path === "package.json"
  );
  verifyPackageMetadata(JSON.parse(packedManifestEntry.content.toString("utf8")));
  assertPackageContentSafe(tarEntries);

  return Object.freeze({
    ...publicReleaseSummary({
      entryCount: packResult.entryCount,
      integrity: packResult.integrity,
      packageId: packResult.id,
      packedBytes: packResult.size,
      shasum: packResult.shasum,
      unpackedBytes: packResult.unpackedSize
    }),
    candidateDirectory,
    tarballPath
  });
}

export function verifyPackageMetadata(manifest) {
  assertPlainObject(manifest, "package manifest");
  assertEqual(manifest.name, EXPECTED_NPM_PACKAGE.name, "package name");
  assertEqual(manifest.version, EXPECTED_NPM_PACKAGE.version, "package version");
  assertEqual(manifest.license, EXPECTED_NPM_PACKAGE.license, "package license");
  if (manifest.private === true) {
    throw new Error("npm release package must not be private");
  }
  if (typeof manifest.description !== "string" || manifest.description.trim() === "") {
    throw new Error("npm release package requires a description");
  }

  assertExactObject(manifest.bin, {
    "codex-usage-profile": "./bin/codex-usage-profile.js"
  }, "package bin");
  assertExactObject(manifest.exports, {
    ".": "./src/index.js"
  }, "package exports");
  assertExactArray(manifest.files, EXPECTED_FILES_FIELD, "package files");
  assertExactObject(manifest.dependencies, {
    [EXPECTED_ANALYZER_PACKAGE.name]: EXPECTED_ANALYZER_PACKAGE.version
  }, "package dependencies");
  assertEqual(manifest.engines?.node, ">=20", "package Node engine");
  assertEqual(manifest.homepage, EXPECTED_HOMEPAGE, "package homepage");
  assertExactObject(manifest.repository, {
    type: "git",
    url: EXPECTED_REPOSITORY_URL,
    directory: EXPECTED_PACKAGE_DIRECTORY
  }, "package repository");
  assertExactObject(manifest.bugs, {
    url: EXPECTED_BUGS_URL
  }, "package bugs");

  assertPlainObject(manifest.publishConfig, "package publishConfig");
  assertEqual(
    manifest.publishConfig.access,
    "public",
    "package publish access"
  );
  assertEqual(
    manifest.publishConfig.registry,
    EXPECTED_NPM_PACKAGE.registry,
    "package publish registry"
  );
  assertEqual(
    manifest.publishConfig.provenance,
    true,
    "package publish provenance"
  );
  const publishKeys = Object.keys(manifest.publishConfig);
  const unexpectedPublishKeys = publishKeys.filter(
    (key) => !["access", "provenance", "registry"].includes(key)
  );
  if (unexpectedPublishKeys.length > 0) {
    throw new Error("package publishConfig contains unsupported fields");
  }
}

export function verifyLockfileContract(lockfile) {
  assertPlainObject(lockfile, "package lock");
  if (lockfile.lockfileVersion !== 3) {
    throw new Error("package lock must use lockfileVersion 3");
  }

  const workspace = lockfile.packages?.[EXPECTED_PACKAGE_DIRECTORY];
  assertPlainObject(workspace, "CLI package lock workspace");
  assertEqual(workspace.name, EXPECTED_NPM_PACKAGE.name, "locked package name");
  assertEqual(
    workspace.version,
    EXPECTED_NPM_PACKAGE.version,
    "locked package version"
  );
  assertEqual(
    workspace.dependencies?.[EXPECTED_ANALYZER_PACKAGE.name],
    EXPECTED_ANALYZER_PACKAGE.version,
    "locked analyzer dependency"
  );

  const analyzer = lockfile.packages?.[
    `node_modules/${EXPECTED_ANALYZER_PACKAGE.name}`
  ];
  assertPlainObject(analyzer, "locked analyzer package");
  for (const field of ["version", "resolved", "integrity", "license"]) {
    assertEqual(
      analyzer[field],
      EXPECTED_ANALYZER_PACKAGE[field],
      `locked analyzer ${field}`
    );
  }
  assertEqual(
    analyzer.engines?.node,
    EXPECTED_ANALYZER_PACKAGE.node,
    "locked analyzer Node engine"
  );
}

export function parseTarEntries(tarball) {
  const archive = gunzipSync(tarball);
  const entries = [];
  let offset = 0;
  let terminated = false;

  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      if (!archive.subarray(offset).every((byte) => byte === 0)) {
        throw new Error("npm tarball contains data after its terminator");
      }
      terminated = true;
      break;
    }
    verifyTarHeaderChecksum(header);

    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const archivePath = prefix ? `${prefix}/${name}` : name;
    const size = readTarNumber(header, 124, 12);
    const mode = readTarNumber(header, 100, 8) & 0o777;
    const type = readTarString(header, 156, 1) || "0";
    const linkName = readTarString(header, 157, 100);
    const contentOffset = offset + 512;
    const contentEnd = contentOffset + size;
    if (contentEnd > archive.length) {
      throw new Error("npm tarball contains a truncated entry");
    }
    if (type !== "0" || linkName !== "") {
      throw new Error("npm tarball must contain regular files only");
    }
    if (!archivePath.startsWith("package/")) {
      throw new Error("npm tarball contains a file outside the package root");
    }

    const packagePath = archivePath.slice("package/".length);
    if (
      packagePath === "" ||
      packagePath.startsWith("/") ||
      packagePath.includes("\\") ||
      posix.normalize(packagePath) !== packagePath ||
      packagePath.split("/").includes("..")
    ) {
      throw new Error("npm tarball contains an unsafe package path");
    }

    entries.push(Object.freeze({
      content: Buffer.from(archive.subarray(contentOffset, contentEnd)),
      mode,
      path: packagePath,
      size,
      type
    }));
    offset = contentOffset + Math.ceil(size / 512) * 512;
  }

  if (!terminated || entries.length === 0) {
    throw new Error("npm tarball is missing a valid terminator");
  }
  return entries;
}

export function verifyPackedEntries(entries, npmFiles = []) {
  const actualPaths = entries.map((entry) => entry.path).sort();
  const expectedPaths = [...EXPECTED_NPM_PACKAGE_FILES].sort();
  assertExactArray(actualPaths, expectedPaths, "packed file allowlist");
  if (new Set(actualPaths).size !== actualPaths.length) {
    throw new Error("npm tarball contains duplicate package files");
  }

  const npmFileByPath = new Map(npmFiles.map((file) => [file.path, file]));
  assertExactArray(
    [...npmFileByPath.keys()].sort(),
    expectedPaths,
    "npm pack file allowlist"
  );

  for (const entry of entries) {
    const expectedMode = entry.path === "bin/codex-usage-profile.js"
      ? 0o755
      : 0o644;
    if (entry.mode !== expectedMode) {
      throw new Error(`packed file has unsafe mode: ${entry.path}`);
    }
    const npmFile = npmFileByPath.get(entry.path);
    if (
      !npmFile ||
      npmFile.size !== entry.size ||
      npmFile.mode !== expectedMode
    ) {
      throw new Error(`npm pack metadata differs for ${entry.path}`);
    }
  }
}

export function findForbiddenPackageContent(entries) {
  const findings = [];

  for (const entry of entries) {
    if (/(?:~|\.bak|\.orig|\.swp)$/.test(entry.path)) {
      findings.push({
        category: "backup or editor file",
        count: 1,
        path: entry.path
      });
    }
    if (!TEXT_PACKAGE_PATH.test(entry.path)) continue;

    const text = entry.content.toString("utf8");
    for (const scanner of TOKEN_PATTERNS) {
      const matches = [...text.matchAll(scanner.pattern)];
      if (matches.length > 0) {
        findings.push({
          category: scanner.category,
          count: matches.length,
          path: entry.path
        });
      }
    }

    const assignmentMatches = [...text.matchAll(SECRET_ASSIGNMENT_PATTERN)]
      .filter((match) => looksLikeSecretValue(match[1]));
    if (assignmentMatches.length > 0) {
      findings.push({
        category: "credential-like assignment",
        count: assignmentMatches.length,
        path: entry.path
      });
    }
  }

  return findings;
}

export function assertPackageContentSafe(entries) {
  const findings = findForbiddenPackageContent(entries);
  if (findings.length === 0) return;

  const first = findings[0];
  throw new Error(
    `packed package contains forbidden ${first.category} in ` +
    `${first.path} (${first.count})`
  );
}

export function publicReleaseSummary(candidate) {
  return Object.freeze({
    entryCount: candidate.entryCount,
    integrity: candidate.integrity,
    packageId: candidate.packageId,
    packedBytes: candidate.packedBytes,
    shasum: candidate.shasum,
    unpackedBytes: candidate.unpackedBytes
  });
}

async function verifyPackageSourceFiles(packageDirectory) {
  for (const packagePath of EXPECTED_NPM_PACKAGE_FILES) {
    const file = await lstat(join(packageDirectory, packagePath));
    if (!file.isFile() || file.isSymbolicLink()) {
      throw new Error(`package source must be a regular file: ${packagePath}`);
    }
    const expectedMode = packagePath === "bin/codex-usage-profile.js"
      ? 0o755
      : 0o644;
    if ((file.mode & 0o777) !== expectedMode) {
      throw new Error(`package source has unsafe mode: ${packagePath}`);
    }
  }

  const license = await readFile(join(packageDirectory, "LICENSE"), "utf8");
  if (
    !license.includes("MIT License") ||
    !license.includes("Copyright (c) 2026 postmelee") ||
    !license.includes("Permission is hereby granted")
  ) {
    throw new Error("package LICENSE does not match the approved MIT notice");
  }
}

async function runNpmPack(options) {
  const artifactDirectory = join(options.candidateDirectory, "artifact");
  const isolationDirectory = join(options.candidateDirectory, "isolation");
  const cacheDirectory = join(isolationDirectory, "npm-cache");
  const homeDirectory = join(isolationDirectory, "home");
  const userConfigPath = join(isolationDirectory, "user.npmrc");
  const globalConfigPath = join(isolationDirectory, "global.npmrc");
  await mkdir(artifactDirectory, { recursive: true });
  await mkdir(cacheDirectory, { recursive: true });
  await mkdir(homeDirectory, { recursive: true });
  await writeFile(userConfigPath, "");
  await writeFile(globalConfigPath, "");

  const executable = process.platform === "win32" ? "npm.cmd" : "npm";
  const args = [
    "pack",
    "--json",
    "--ignore-scripts",
    "--pack-destination",
    artifactDirectory
  ];
  const environment = createIsolatedNpmEnvironment({
    baseEnvironment: options.processEnvironment,
    cacheDirectory,
    globalConfigPath,
    homeDirectory,
    temporaryDirectory: isolationDirectory,
    userConfigPath
  });
  const runCommand = options.runCommand ?? defaultRunCommand;
  const result = await runCommand(executable, args, {
    cwd: options.packageDirectory,
    env: environment,
    timeout: 30_000
  });
  if (result.code !== 0) {
    throw new Error("npm pack failed without producing a release candidate");
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new Error("npm pack returned invalid JSON metadata");
  }
  return normalizeNpmPackResult(parsed);
}

export function normalizeNpmPackResult(parsed) {
  const candidates = Array.isArray(parsed)
    ? parsed
    : parsed !== null && typeof parsed === "object"
      ? Object.values(parsed)
      : [];
  if (
    candidates.length !== 1 ||
    candidates[0] === null ||
    Array.isArray(candidates[0]) ||
    typeof candidates[0] !== "object"
  ) {
    throw new Error("npm pack must produce exactly one package candidate");
  }
  return candidates[0];
}

function verifyPackResult(packResult, tarball) {
  assertEqual(packResult.id, EXPECTED_NPM_PACKAGE.id, "packed package id");
  assertEqual(packResult.name, EXPECTED_NPM_PACKAGE.name, "packed package name");
  assertEqual(
    packResult.version,
    EXPECTED_NPM_PACKAGE.version,
    "packed package version"
  );
  assertEqual(
    packResult.filename,
    `${EXPECTED_NPM_PACKAGE.name}-${EXPECTED_NPM_PACKAGE.version}.tgz`,
    "packed filename"
  );
  assertEqual(packResult.entryCount, EXPECTED_NPM_PACKAGE_FILES.length, "packed entry count");
  assertEqual(packResult.size, tarball.length, "packed byte count");
  assertEqual(
    packResult.shasum,
    createHash("sha1").update(tarball).digest("hex"),
    "packed SHA-1"
  );
  assertEqual(
    packResult.integrity,
    `sha512-${createHash("sha512").update(tarball).digest("base64")}`,
    "packed SHA-512 integrity"
  );

  const unpackedBytes = packResult.files.reduce(
    (total, file) => total + file.size,
    0
  );
  assertEqual(
    packResult.unpackedSize,
    unpackedBytes,
    "packed unpacked byte count"
  );
  if (!Array.isArray(packResult.bundled) || packResult.bundled.length !== 0) {
    throw new Error("npm release package must not bundle dependencies");
  }
}

function createIsolatedNpmEnvironment(options) {
  const baseEnvironment = options.baseEnvironment ?? process.env;
  const environment = {};
  for (const key of SAFE_ENVIRONMENT_KEYS) {
    if (typeof baseEnvironment[key] === "string") {
      environment[key] = baseEnvironment[key];
    }
  }

  return {
    ...environment,
    APPDATA: options.homeDirectory,
    HOME: options.homeDirectory,
    NO_COLOR: "1",
    NPM_CONFIG_AUDIT: "false",
    NPM_CONFIG_CACHE: options.cacheDirectory,
    NPM_CONFIG_FUND: "false",
    NPM_CONFIG_FETCH_RETRIES: "1",
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT: "3000",
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT: "1000",
    NPM_CONFIG_FETCH_TIMEOUT: "15000",
    NPM_CONFIG_GLOBALCONFIG: options.globalConfigPath,
    NPM_CONFIG_IGNORE_SCRIPTS: "true",
    NPM_CONFIG_REGISTRY: EXPECTED_NPM_PACKAGE.registry,
    NPM_CONFIG_UPDATE_NOTIFIER: "false",
    NPM_CONFIG_USERCONFIG: options.userConfigPath,
    TEMP: options.temporaryDirectory,
    TMP: options.temporaryDirectory,
    TMPDIR: options.temporaryDirectory,
    USERPROFILE: options.homeDirectory,
    XDG_CACHE_HOME: join(options.homeDirectory, ".cache"),
    XDG_CONFIG_HOME: join(options.homeDirectory, ".config")
  };
}

async function defaultRunCommand(executable, args, options) {
  try {
    const result = await execFileAsync(executable, args, {
      ...options,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true
    });
    return { code: 0, stderr: result.stderr, stdout: result.stdout };
  } catch (error) {
    return {
      code: Number.isSafeInteger(error?.code) ? error.code : 1,
      stderr: typeof error?.stderr === "string" ? error.stderr : "",
      stdout: typeof error?.stdout === "string" ? error.stdout : ""
    };
  }
}

function verifyTarHeaderChecksum(header) {
  const expected = readTarNumber(header, 148, 8);
  let actual = 0;
  for (let index = 0; index < header.length; index += 1) {
    actual += index >= 148 && index < 156 ? 32 : header[index];
  }
  if (expected !== actual) {
    throw new Error("npm tarball contains an invalid header checksum");
  }
}

function readTarString(buffer, offset, length) {
  return buffer
    .subarray(offset, offset + length)
    .toString("utf8")
    .replace(/\0.*$/s, "")
    .trim();
}

function readTarNumber(buffer, offset, length) {
  const value = readTarString(buffer, offset, length).replace(/\s/g, "");
  if (!/^[0-7]+$/.test(value)) {
    throw new Error("npm tarball contains an invalid numeric header");
  }
  return Number.parseInt(value, 8);
}

function looksLikeSecretValue(value) {
  if (
    value.startsWith("<") ||
    /^https?:\/\//i.test(value) ||
    /^[A-Z0-9_]+$/.test(value)
  ) {
    return false;
  }
  return /[a-z]/.test(value) && /\d/.test(value);
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} does not match the release contract`);
  }
}

function assertExactObject(actual, expected, label) {
  assertPlainObject(actual, label);
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  assertExactArray(actualKeys, expectedKeys, `${label} fields`);
  for (const key of expectedKeys) {
    assertEqual(actual[key], expected[key], `${label}.${key}`);
  }
}

function assertExactArray(actual, expected, label) {
  if (
    !Array.isArray(actual) ||
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    throw new Error(`${label} does not match the release contract`);
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;

if (invokedPath === import.meta.url) {
  try {
    const result = await verifyNpmRelease();
    console.log(JSON.stringify({ ok: true, ...result }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
