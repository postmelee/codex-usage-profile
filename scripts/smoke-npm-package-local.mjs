import { execFile as execFileCallback } from "node:child_process";
import {
  lstat,
  mkdir,
  mkdtemp,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import {
  EXPECTED_ANALYZER_PACKAGE,
  EXPECTED_NPM_PACKAGE,
  createNpmReleaseCandidate,
  publicReleaseSummary
} from "./verify-npm-release.mjs";

const execFileAsync = promisify(execFileCallback);
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, "..");
const DEFAULT_SERVICE_ORIGIN =
  "https://codex-usage-profile.meleeisdeveloping.chatgpt.site";
const SAFE_ENVIRONMENT_KEYS = Object.freeze([
  "ComSpec",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "LANG",
  "LC_ALL",
  "NO_PROXY",
  "PATH",
  "PATHEXT",
  "SSL_CERT_FILE",
  "SystemRoot",
  "WINDIR",
  "http_proxy",
  "https_proxy",
  "no_proxy"
]);

export async function runNpmPackageLocalSmoke(options = {}) {
  const temporaryRoot = await mkdtemp(
    join(tmpdir(), "codex-usage-profile-npm-smoke-")
  );
  const keepTemporaryDirectory = options.keepTemporaryDirectory === true;

  try {
    const repositoryRoot = resolve(
      options.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT
    );
    const candidateDirectory = join(temporaryRoot, "candidate");
    const projectDirectory = join(temporaryRoot, "consumer");
    const homeDirectory = join(temporaryRoot, "home");
    const cacheDirectory = join(temporaryRoot, "npm-cache");
    const xdgConfigDirectory = join(temporaryRoot, "xdg-config");
    const xdgCacheDirectory = join(temporaryRoot, "xdg-cache");
    const commandTemporaryDirectory = join(temporaryRoot, "tmp");
    const userConfigPath = join(temporaryRoot, "user.npmrc");
    const globalConfigPath = join(temporaryRoot, "global.npmrc");

    for (const directory of [
      projectDirectory,
      homeDirectory,
      cacheDirectory,
      xdgConfigDirectory,
      xdgCacheDirectory,
      commandTemporaryDirectory
    ]) {
      await mkdir(directory, { recursive: true });
    }
    await writeFile(userConfigPath, "");
    await writeFile(globalConfigPath, "");

    const createCandidate = options.createCandidate ??
      createNpmReleaseCandidate;
    const candidate = await createCandidate({
      candidateDirectory,
      processEnvironment: options.processEnvironment,
      repositoryRoot
    });
    assertPathInside(candidate.tarballPath, temporaryRoot, "candidate tarball");

    const environment = createSmokeEnvironment({
      baseEnvironment: options.processEnvironment,
      cacheDirectory,
      commandTemporaryDirectory,
      globalConfigPath,
      homeDirectory,
      userConfigPath,
      xdgCacheDirectory,
      xdgConfigDirectory
    });
    const runCommand = options.runCommand ?? defaultRunCommand;
    const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
    const binExecutable = process.platform === "win32"
      ? join(projectDirectory, "node_modules", ".bin", "codex-usage-profile.cmd")
      : join(projectDirectory, "node_modules", ".bin", "codex-usage-profile");

    assertSucceeded(
      await runCommand(npmExecutable, [
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--package-lock=false",
        "--save=false",
        "--registry",
        EXPECTED_NPM_PACKAGE.registry,
        candidate.tarballPath
      ], {
        cwd: projectDirectory,
        env: environment,
        timeout: 120_000
      }),
      "isolated npm install"
    );

    const exportProbe = [
      "const pkg = await import('codex-usage-profile');",
      `if (pkg.CLI_VERSION !== '${EXPECTED_NPM_PACKAGE.version}') process.exit(2);`,
      `if (pkg.DEFAULT_SERVICE_ORIGIN !== '${DEFAULT_SERVICE_ORIGIN}') process.exit(3);`
    ].join("");
    assertSucceeded(
      await runCommand(process.execPath, [
        "--input-type=module",
        "--eval",
        exportProbe
      ], {
        cwd: projectDirectory,
        env: environment,
        timeout: 30_000
      }),
      "installed package export"
    );

    const analyzerProbe = [
      "const { access, readFile } = await import('node:fs/promises');",
      "const entry = import.meta.resolve('codex-usage-analyzer');",
      "const manifest = JSON.parse(await readFile(new URL('../package.json', entry), 'utf8'));",
      `if (manifest.version !== '${EXPECTED_ANALYZER_PACKAGE.version}') process.exit(2);`,
      `if (manifest.license !== '${EXPECTED_ANALYZER_PACKAGE.license}') process.exit(3);`,
      `if (manifest.engines?.node !== '${EXPECTED_ANALYZER_PACKAGE.node}') process.exit(4);`,
      "if (Object.keys(manifest.dependencies ?? {}).length !== 0) process.exit(5);",
      "const scripts = manifest.scripts ?? {};",
      "if (['preinstall','install','postinstall'].some((key) => scripts[key])) process.exit(6);",
      "const analyzer = await import('codex-usage-analyzer');",
      "if (typeof analyzer.readAccountUsage !== 'function') process.exit(7);",
      "await access(new URL('./codex-executable.js', entry));"
    ].join("");
    assertSucceeded(
      await runCommand(process.execPath, [
        "--input-type=module",
        "--eval",
        analyzerProbe
      ], {
        cwd: projectDirectory,
        env: environment,
        timeout: 30_000
      }),
      "installed analyzer contract"
    );

    const help = await runCommand(binExecutable, ["--help"], {
      cwd: projectDirectory,
      env: environment,
      timeout: 30_000
    });
    assertSucceeded(help, "installed package bin help");
    if (
      !help.stdout.includes("Usage: codex-usage-profile") ||
      !help.stdout.includes(DEFAULT_SERVICE_ORIGIN)
    ) {
      throw new Error("installed package help does not match the CLI contract");
    }

    assertLoginRequired(
      await runCommand(binExecutable, ["status", "--json"], {
        cwd: projectDirectory,
        env: environment,
        timeout: 30_000
      }),
      "credential-free default status"
    );
    assertLoginRequired(
      await runCommand(binExecutable, [
        "status",
        "--json",
        "--server",
        "http://127.0.0.1:41777"
      ], {
        cwd: projectDirectory,
        env: environment,
        timeout: 30_000
      }),
      "credential-free loopback status"
    );

    const invalidOrigin = await runCommand(binExecutable, [
      "status",
      "--json",
      "--server",
      "http://profiles.example.test"
    ], {
      cwd: projectDirectory,
      env: environment,
      timeout: 30_000
    });
    if (
      invalidOrigin.code === 0 ||
      !invalidOrigin.stderr.includes(
        "Service URL must use HTTPS, except for loopback development URLs."
      )
    ) {
      throw new Error("installed package accepted an unsafe service origin");
    }

    await assertPathAbsent(
      join(xdgConfigDirectory, "codex-usage-profile"),
      "credential-free smoke config"
    );

    return Object.freeze({
      checksVerified: 6,
      ...publicReleaseSummary(candidate)
    });
  } finally {
    if (!keepTemporaryDirectory) {
      await rm(temporaryRoot, { force: true, recursive: true });
    }
  }
}

export function createSmokeEnvironment(options) {
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
    NPM_CONFIG_LOGLEVEL: "error",
    NPM_CONFIG_PACKAGE_LOCK: "false",
    NPM_CONFIG_PROVENANCE: "false",
    NPM_CONFIG_REGISTRY: EXPECTED_NPM_PACKAGE.registry,
    NPM_CONFIG_SAVE: "false",
    NPM_CONFIG_UPDATE_NOTIFIER: "false",
    NPM_CONFIG_USERCONFIG: options.userConfigPath,
    TEMP: options.commandTemporaryDirectory,
    TMP: options.commandTemporaryDirectory,
    TMPDIR: options.commandTemporaryDirectory,
    USERPROFILE: options.homeDirectory,
    XDG_CACHE_HOME: options.xdgCacheDirectory,
    XDG_CONFIG_HOME: options.xdgConfigDirectory
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

function assertSucceeded(result, label) {
  if (result.code !== 0) {
    throw new Error(`${label} failed`);
  }
}

function assertLoginRequired(result, label) {
  if (
    result.code === 0 ||
    !result.stderr.includes("No credential found. Run login first.") ||
    result.stdout !== ""
  ) {
    throw new Error(`${label} did not fail safely`);
  }
}

function assertPathInside(candidatePath, parentPath, label) {
  const child = resolve(candidatePath);
  const parent = resolve(parentPath);
  const pathFromParent = relative(parent, child);
  if (
    pathFromParent === "" ||
    pathFromParent === ".." ||
    pathFromParent.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
  ) {
    throw new Error(`${label} must remain inside the isolated smoke directory`);
  }
}

async function assertPathAbsent(path, label) {
  try {
    await lstat(path);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`${label} unexpectedly wrote product state`);
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;

if (invokedPath === import.meta.url) {
  try {
    const result = await runNpmPackageLocalSmoke();
    console.log(JSON.stringify({ ok: true, ...result }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
