import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

import { sitesArtifactPlugin } from "./build/sites-vite-plugin.js";

const rootDirectory = fileURLToPath(new URL(".", import.meta.url));
const outputDirectory = resolve(rootDirectory, "dist-sites");

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: resolve(outputDirectory, "client"),
    rollupOptions: {
      input: resolve(rootDirectory, "sites.html"),
      output: {
        assetFileNames: "assets/[name]-[hash][extname]",
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/marketing-[hash].js"
      }
    }
  },
  plugins: [
    sitesArtifactPlugin({ outputDirectory, projectDirectory: rootDirectory }),
    react()
  ],
  publicDir: false
});
