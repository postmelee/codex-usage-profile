import {
  lstat,
  readdir,
  rm,
  rmdir
} from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function finalizeSitesFullStackArtifact(options = {}) {
  const outputDirectory = resolve(options.outputDirectory ?? "dist");
  const serverDirectory = resolve(outputDirectory, "server");
  const metadataDirectory = resolve(serverDirectory, ".vite");
  const manifestPath = resolve(metadataDirectory, "manifest.json");

  if (!(await requireRegularDirectory(outputDirectory, {
    allowMissing: true,
    label: "Sites output directory"
  }))) {
    return finalizationSummary(false, 0);
  }
  if (!(await requireRegularDirectory(serverDirectory, {
    allowMissing: true,
    label: "Sites server directory"
  }))) {
    return finalizationSummary(false, 0);
  }
  if (!(await requireRegularDirectory(metadataDirectory, {
    allowMissing: true,
    label: "Sites Vite metadata directory"
  }))) {
    return finalizationSummary(false, 0);
  }

  const manifest = await lstatIfExists(manifestPath);
  if (manifest === null) {
    return finalizationSummary(
      false,
      (await readdir(metadataDirectory)).length
    );
  }
  if (!manifest.isFile() || manifest.isSymbolicLink()) {
    throw new Error("Sites Vite manifest must be a regular file");
  }

  await rm(manifestPath);
  const preservedEntries = await readdir(metadataDirectory);
  if (preservedEntries.length === 0) {
    await rmdir(metadataDirectory);
  }

  return finalizationSummary(true, preservedEntries.length);
}

async function requireRegularDirectory(path, options) {
  const entry = await lstatIfExists(path);
  if (entry === null && options.allowMissing === true) return false;
  if (entry === null || !entry.isDirectory() || entry.isSymbolicLink()) {
    throw new Error(`${options.label} must be a regular directory`);
  }
  return true;
}

async function lstatIfExists(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function finalizationSummary(manifestRemoved, preservedEntryCount) {
  return Object.freeze({
    manifestRemoved,
    preservedEntryCount
  });
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;

if (invokedPath === import.meta.url) {
  if (process.argv.length > 3) {
    console.error("Usage: finalize-sites-fullstack-artifact [output-directory]");
    process.exitCode = 1;
  } else {
    try {
      const result = await finalizeSitesFullStackArtifact({
        outputDirectory: process.argv[2]
      });
      console.log(JSON.stringify(result));
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
