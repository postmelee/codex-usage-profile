import assert from "node:assert/strict";
import test from "node:test";

import react from "@vitejs/plugin-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const UPLOADED_AT = "2026-08-12T20:20:00.000Z";
let localeProvider;
let lastUpdatedTime;
let viteServer;

test.before(async () => {
  viteServer = await createServer({
    appType: "custom",
    logLevel: "silent",
    plugins: [react()],
    server: { middlewareMode: true }
  });
  ({ LocaleProvider: localeProvider } = await viteServer.ssrLoadModule(
    "/src/profile-ui/LocaleProvider.jsx"
  ));
  ({ LastUpdatedTime: lastUpdatedTime } = await viteServer.ssrLoadModule(
    "/src/profile-ui/LastUpdatedTime.jsx"
  ));
});

test.after(async () => {
  await viteServer?.close();
});

test("renders localized semantic time markup", () => {
  assert.equal(
    renderLastUpdatedTime("en", "UTC"),
    '<time class="test-updated-at" dateTime="2026-08-12T20:20:00.000Z">Last updated · Aug 12, 8:20 PM</time>'
  );
  assert.equal(
    renderLastUpdatedTime("ko", "Asia/Seoul"),
    '<time class="test-updated-at" dateTime="2026-08-12T20:20:00.000Z">최근 업데이트 · 8월 13일 오전 5:20</time>'
  );
});

test("does not render semantic time markup for invalid timestamps", () => {
  assert.equal(renderLastUpdatedTime("en", "UTC", "not-a-date"), "");
});

function renderLastUpdatedTime(locale, timeZone, uploadedAt = UPLOADED_AT) {
  return renderToStaticMarkup(createElement(
    localeProvider,
    {
      initialLocale: locale,
      targetDocument: null,
      targetWindow: null
    },
    createElement(lastUpdatedTime, {
      className: "test-updated-at",
      timeZone,
      uploadedAt
    })
  ));
}
