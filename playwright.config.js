import { defineConfig } from "@playwright/test";

import { resolveE2eOrigin } from "./tests/e2eOrigin.js";

const e2eOrigin = resolveE2eOrigin(process.env.PROFILE_E2E_ORIGIN);

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  reporter: "list",
  use: {
    baseURL: e2eOrigin.origin,
    trace: "retain-on-failure"
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${e2eOrigin.port} --strictPort`,
    reuseExistingServer: false,
    timeout: 30_000,
    url: e2eOrigin.origin
  }
});
