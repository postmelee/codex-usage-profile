import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SESSION_COOKIE_NAME,
  PROFILE_BACKEND_ERROR_CODES,
  PROFILE_VISIBILITY,
  ProfileBackendError,
  createMemoryProfileBackendStore,
  createSessionService,
  parseCookieHeader,
  readSessionIdFromCookie,
  serializeExpiredSessionCookie,
  serializeSessionCookie
} from "../index.js";

test("creates sessions, serializes secure cookies, and verifies cookie auth", () => {
  const { service, store } = createFixture({ secureCookies: true });

  const { owner, session, cookie } = service.createSession({ ownerId: "owner_1" });
  const verified = service.verifySessionFromCookie(cookie);
  const storedSession = store.getSession(session.id);

  assert.equal(owner.id, "owner_1");
  assert.equal(session.id, "session_1");
  assert.equal(session.expiresAt, "2026-07-08T00:00:00.000Z");
  assert.equal(cookie.includes("HttpOnly"), true);
  assert.equal(cookie.includes("SameSite=Lax"), true);
  assert.equal(cookie.includes("Secure"), true);
  assert.equal(cookie.includes("Max-Age=2592000"), true);
  assert.equal(readSessionIdFromCookie(cookie), "session_1");
  assert.equal(verified.owner.id, "owner_1");
  assert.equal(Object.hasOwn(storedSession, "token"), false);
});

test("serializes explicit session cookie security attributes", () => {
  const { service } = createFixture();
  const { session, cookie } = service.createSession({ ownerId: "owner_1" });
  const parts = cookie.split("; ");
  const secureCookie = serializeSessionCookie(session, {
    now: new Date("2026-06-08T00:00:00.000Z"),
    secure: true
  });
  const secureExpiredCookie = serializeExpiredSessionCookie({ secure: true });

  assert.equal(parts[0], `${DEFAULT_SESSION_COOKIE_NAME}=session_1`);
  assert.equal(parts.includes("Path=/"), true);
  assert.equal(parts.includes("HttpOnly"), true);
  assert.equal(parts.includes("SameSite=Lax"), true);
  assert.equal(parts.includes("Max-Age=2592000"), true);
  assert.equal(parts.includes("Expires=Wed, 08 Jul 2026 00:00:00 GMT"), true);
  assert.equal(parts.includes("Secure"), false);

  assert.equal(secureCookie.includes("Secure"), true);
  assert.equal(secureCookie.includes("SameSite=Lax"), true);
  assert.equal(secureExpiredCookie.includes("Secure"), true);
  assert.equal(secureExpiredCookie.includes("SameSite=Lax"), true);
  assert.equal(secureExpiredCookie.includes("Max-Age=0"), true);
});

test("logs out by revoking sessions and expiring cookies", () => {
  const { service } = createFixture();
  const { session, cookie } = service.createSession({ ownerId: "owner_1" });

  const result = service.logoutFromCookie(cookie);

  assert.equal(result.session.id, session.id);
  assert.equal(result.session.revokedAt, "2026-06-08T00:00:00.000Z");
  assert.equal(result.cookie, serializeExpiredSessionCookie());
  assertBackendError(
    () => service.verifySession(session.id),
    PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED
  );
});

test("rejects missing, expired, revoked, and ownerless sessions", () => {
  const fixture = createFixture();
  const { service, store } = fixture;
  const { session } = service.createSession({ ownerId: "owner_1" });

  assertBackendError(
    () => service.verifySessionFromCookie("theme=dark"),
    PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED
  );

  fixture.setNow(new Date("2026-07-08T00:00:00.000Z"));

  assertBackendError(
    () => service.verifySession(session.id),
    PROFILE_BACKEND_ERROR_CODES.EXPIRED
  );

  fixture.setNow(new Date("2026-06-08T00:00:00.000Z"));
  const second = service.createSession({ ownerId: "owner_1" }).session;
  service.revokeSession({ sessionId: second.id });

  assertBackendError(
    () => service.verifySession(second.id),
    PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED
  );

  store.saveSession({
    id: "session_missing_owner",
    ownerId: "missing_owner",
    expiresAt: "2026-07-08T00:00:00.000Z",
    revokedAt: null
  });

  assertBackendError(
    () => service.verifySession("session_missing_owner"),
    PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED
  );
});

test("parses cookie headers and validates cookie names", () => {
  const parsed = parseCookieHeader("cup_session=session_1; theme=dark%20mode");

  assert.equal(parsed.get(DEFAULT_SESSION_COOKIE_NAME), "session_1");
  assert.equal(parsed.get("theme"), "dark mode");
  assert.equal(readSessionIdFromCookie("", { required: false }), null);
  assertBackendError(
    () => createSessionService({
      store: createMemoryProfileBackendStore(),
      cookieName: "bad cookie"
    }).serializeExpiredSessionCookie(),
    PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED
  );
});

function createFixture(options = {}) {
  const store = createMemoryProfileBackendStore();
  store.saveOwner({
    id: "owner_1",
    authProvider: "github",
    providerUserId: "1",
    githubLogin: "postmelee",
    handle: "postmelee",
    visibility: PROFILE_VISIBILITY.PRIVATE
  });

  let current = new Date("2026-06-08T00:00:00.000Z");
  const service = createSessionService({
    store,
    now: () => current,
    createId: createIdFactory(),
    ...options
  });

  return {
    service,
    store,
    setNow(value) {
      current = value;
    }
  };
}

function createIdFactory() {
  let nextId = 1;
  return (prefix) => {
    const id = `${prefix}_${nextId}`;
    nextId += 1;
    return id;
  };
}

function assertBackendError(callback, code) {
  assert.throws(callback, (error) => {
    assert.equal(error instanceof ProfileBackendError, true);
    assert.equal(error.code, code);
    return true;
  });
}
