import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDirectory = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: "dist-marketing",
    rollupOptions: {
      input: resolve(rootDirectory, "src/profile-marketing/sites-entry.jsx"),
      output: {
        assetFileNames: "assets/[name]-[hash][extname]",
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/marketing-[hash].js"
      }
    }
  },
  plugins: [react()]
});
