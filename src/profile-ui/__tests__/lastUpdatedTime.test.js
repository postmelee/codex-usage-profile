import assert from "node:assert/strict";
import test from "node:test";

import react from "@vitejs/plugin-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const UPLOADED_AT = "2026-08-12T20:20:00.000Z";
let localeProvider;
let lastUpdatedTime;
let profileHeader;
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
  ({ ProfileHeader: profileHeader } = await viteServer.ssrLoadModule(
    "/src/profile-ui/ProfileHeader.jsx"
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

test("keeps a stable Profile update slot for valid and invalid timestamps", () => {
  const validMarkup = renderProfileHeader(UPLOADED_AT);
  assert.match(validMarkup, /class="profile-last-updated-slot"/u);
  assert.match(
    validMarkup,
    /<time class="profile-last-updated" dateTime="2026-08-12T20:20:00.000Z">/u
  );

  const invalidMarkup = renderProfileHeader("not-a-date");
  assert.match(
    invalidMarkup,
    /<div class="profile-last-updated-slot"><\/div>/u
  );
  assert.doesNotMatch(invalidMarkup, /<time/u);
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

function renderProfileHeader(uploadedAt) {
  return renderToStaticMarkup(createElement(
    localeProvider,
    {
      initialLocale: "en",
      targetDocument: null,
      targetWindow: null
    },
    createElement(profileHeader, {
      header: {
        avatarAsset: { url: "https://avatars.example.test/postmelee.png" },
        displayName: "Post Melee",
        username: "postmelee"
      },
      headingId: "profile-title",
      headingLevel: 1,
      uploadedAt
    })
  ));
}
