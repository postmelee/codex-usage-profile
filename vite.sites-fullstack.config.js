import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import {
  sitesFullStackArtifactPlugin
} from "./build/sites-fullstack-vite-plugin.js";

const rootDirectory = fileURLToPath(new URL(".", import.meta.url));
const outputDirectory = resolve(rootDirectory, "dist-sites-fullstack");
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    build: {
      emptyOutDir: true,
      outDir: outputDirectory,
      rollupOptions: {
        output: {
          assetFileNames: "assets/[name]-[hash][extname]",
          chunkFileNames: "assets/[name]-[hash].js",
          entryFileNames: "assets/app-[hash].js"
        }
      }
    },
    plugins: [
      react(),
      sitesFullStackArtifactPlugin({
        outputDirectory,
        projectDirectory: rootDirectory
      }),
      cloudflare({
        config: {
          assets: {
            binding: "ASSETS",
            html_handling: "none",
            not_found_handling: "none",
            run_worker_first: true
          },
          compatibility_flags: ["nodejs_compat"],
          main: "./src/profile-runtime/sites/worker.js",
          name: "codex-usage-profile-sites-fullstack"
        },
        inspectorPort: false,
        persistState: {
          path: ".wrangler/state-sites-fullstack"
        }
      })
    ],
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined
  };
});
