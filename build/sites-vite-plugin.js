import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SITE_ICON_FILES = Object.freeze([
  "apple-touch-icon.png",
  "favicon-32x32.png",
  "favicon.ico",
  "site-icon-512.png"
]);

export function sitesArtifactPlugin({ outputDirectory, projectDirectory }) {
  const clientDirectory = resolve(outputDirectory, "client");
  const generatedHtml = resolve(clientDirectory, "sites.html");
  const indexHtml = resolve(clientDirectory, "index.html");
  const workerSource = resolve(
    projectDirectory,
    "src/profile-marketing/sites-worker.js"
  );
  const workerOutput = resolve(outputDirectory, "server/index.js");
  const hostingOutput = resolve(outputDirectory, ".openai/hosting.json");
  const sampleCardSource = resolve(
    projectDirectory,
    "public/assets/codex-card-sample.png"
  );
  const sampleCardOutput = resolve(
    clientDirectory,
    "assets/codex-card-sample.png"
  );

  return {
    apply: "build",
    async buildStart() {
      await rm(outputDirectory, { force: true, recursive: true });
    },
    async writeBundle() {
      await rename(generatedHtml, indexHtml);
      await mkdir(dirname(workerOutput), { recursive: true });
      await mkdir(dirname(hostingOutput), { recursive: true });
      await mkdir(dirname(sampleCardOutput), { recursive: true });
      await copyFile(workerSource, workerOutput);
      await writeFile(
        hostingOutput,
        `${JSON.stringify({ d1: null, r2: null }, null, 2)}\n`
      );
      await copyFile(sampleCardSource, sampleCardOutput);
      await Promise.all(SITE_ICON_FILES.map((file) => copyFile(
        resolve(projectDirectory, "public", file),
        resolve(clientDirectory, file)
      )));

      const workerContents = await readFile(workerOutput, "utf8");
      if (!workerContents.includes("export default")) {
        throw new Error("Sites Worker output must expose an ESM default export");
      }
    },
    enforce: "pre",
    name: "codex-usage-profile-sites-artifact"
  };
}
