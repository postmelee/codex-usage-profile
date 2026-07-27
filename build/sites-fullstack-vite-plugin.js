import {
  access,
  cp,
  mkdir,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { resolve } from "node:path";

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

// Keep Sites-owned metadata beside the Cloudflare Vite output. This mirrors
// the current Sites starter plugin without changing the existing marketing
// artifact packager.
export function sitesFullStackArtifactPlugin(options = {}) {
  const projectDirectory = resolve(options.projectDirectory ?? process.cwd());
  const outputDirectory = resolve(
    options.outputDirectory ?? resolve(projectDirectory, "dist")
  );

  return {
    apply: "build",
    async closeBundle() {
      await ensurePackagedServerEntry(outputDirectory);

      const metadataOutput = resolve(outputDirectory, ".openai");
      const hostingSource = resolve(projectDirectory, ".openai/hosting.json");
      const hostingOutput = resolve(metadataOutput, "hosting.json");
      const migrationsSource = resolve(projectDirectory, "db/migrations");
      const migrationsOutput = resolve(metadataOutput, "drizzle");

      await rm(metadataOutput, { force: true, recursive: true });
      await mkdir(metadataOutput, { recursive: true });

      if (await exists(hostingSource)) {
        await cp(hostingSource, hostingOutput);
      }
      if (await exists(migrationsSource)) {
        await cp(migrationsSource, migrationsOutput, { recursive: true });
      }
    },
    name: "codex-usage-profile-sites-fullstack-artifact"
  };
}

async function ensurePackagedServerEntry(outputDirectory) {
  const serverDirectory = resolve(outputDirectory, "server");
  const configPath = resolve(serverDirectory, "wrangler.json");
  if (!(await exists(configPath))) return;

  const config = JSON.parse(await readFile(configPath, "utf8"));
  const bundledMain = normalizeBundledMain(config.main);
  const packagedMain = resolve(serverDirectory, "index.js");

  if (bundledMain === "index.js") {
    await access(packagedMain);
    return;
  }

  await access(resolve(serverDirectory, bundledMain));
  await writeFile(
    packagedMain,
    `export { default } from "./${bundledMain}";\n`
  );
  await writeFile(
    configPath,
    `${JSON.stringify({ ...config, main: "index.js" })}\n`
  );
}

function normalizeBundledMain(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Sites Worker config must declare a bundled main entry");
  }

  const normalized = value.replace(/^\.\//, "");
  if (
    normalized.startsWith("/") ||
    normalized.split("/").includes("..")
  ) {
    throw new Error("Sites Worker bundled main must stay inside dist/server");
  }
  return normalized;
}
