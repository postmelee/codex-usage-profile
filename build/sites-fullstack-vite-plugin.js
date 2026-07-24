import { access, cp, mkdir, rm } from "node:fs/promises";
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
    options.outputDirectory ?? resolve(projectDirectory, "dist-sites-fullstack")
  );

  return {
    apply: "build",
    async closeBundle() {
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
