import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import {
  runSitesFullStackLocalSmoke
} from "./smoke-sites-fullstack-local.mjs";
import {
  verifySitesProductionArtifact
} from "./verify-sites-production-artifact.mjs";

const execFileAsync = promisify(execFile);
const REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  ".."
);

export async function runSitesProductionLocalSmoke(options = {}) {
  const buildProductionArtifact = options.buildProductionArtifact ??
    defaultBuildProductionArtifact;
  const verifyProductionArtifact = options.verifyProductionArtifact ??
    verifySitesProductionArtifact;
  const runRuntimeSmoke = options.runRuntimeSmoke ??
    runSitesFullStackLocalSmoke;

  if (options.skipProductionBuild !== true) {
    await buildProductionArtifact();
  }
  const artifact = await verifyProductionArtifact({
    outputDirectory: options.outputDirectory ?? resolve(REPOSITORY_ROOT, "dist")
  });
  const runtime = await runRuntimeSmoke({
    skipBuild: options.skipRuntimeBuild === true
  });

  return Object.freeze({
    artifactBytes: artifact.artifactBytes,
    clientFileCount: artifact.clientFileCount,
    expectedBindingCount: artifact.expectedBindingCount,
    migrationFileCount: artifact.migrationFileCount,
    publicPngBytes: runtime.publicPngBytes,
    routesVerified: runtime.routesVerified,
    workerCompressedBytes: artifact.workerCompressedBytes,
    workerFileCount: artifact.workerFileCount,
    workerRawBytes: artifact.workerRawBytes
  });
}

async function defaultBuildProductionArtifact() {
  const executable = process.platform === "win32" ? "npm.cmd" : "npm";
  await execFileAsync(executable, ["run", "build:production"], {
    cwd: REPOSITORY_ROOT,
    maxBuffer: 10 * 1024 * 1024
  });
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;

if (invokedPath === import.meta.url) {
  try {
    const result = await runSitesProductionLocalSmoke();
    console.log(JSON.stringify({ ok: true, ...result }));
  } catch (error) {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  }
}
