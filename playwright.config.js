import { defineConfig } from "@playwright/test";

const e2eOrigin = normalizeE2eOrigin(
  process.env.PROFILE_E2E_ORIGIN ?? "http://127.0.0.1:5173"
);

export default defineConfig({
  testDir: "./tests",
  reporter: "list",
  use: {
    baseURL: e2eOrigin.origin,
    trace: "retain-on-failure"
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${e2eOrigin.port}`,
    reuseExistingServer: true,
    timeout: 30_000,
    url: e2eOrigin.origin
  }
});

function normalizeE2eOrigin(value) {
  const url = new URL(value);
  if (
    url.protocol !== "http:"
    || url.hostname !== "127.0.0.1"
    || !url.port
    || url.pathname !== "/"
    || url.search
    || url.hash
    || url.username
    || url.password
  ) {
    throw new TypeError(
      "PROFILE_E2E_ORIGIN must be an HTTP 127.0.0.1 origin with an explicit port"
    );
  }

  return Object.freeze({ origin: url.origin, port: url.port });
}
