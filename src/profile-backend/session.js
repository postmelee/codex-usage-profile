import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError
} from "./errors.js";
import { defaultCreateId } from "./tokens.js";

export const DEFAULT_SESSION_COOKIE_NAME = "cup_session";
export const DEFAULT_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export function createSessionService(options = {}) {
  const {
    store,
    now = () => new Date(),
    createId = defaultCreateId,
    sessionTtlMs = DEFAULT_SESSION_TTL_MS,
    cookieName = DEFAULT_SESSION_COOKIE_NAME,
    secureCookies = false
  } = options;

  if (!store) {
    throw new TypeError("store is required");
  }

  const cookieOptions = { cookieName, secure: secureCookies };
  const verifySession = async (sessionId) => {
    const id = requireNonEmptyString(sessionId, "sessionId");
    const session = await store.getSession(id);

    if (!session) {
      throw unauthorized("Session is invalid");
    }

    assertSessionUsable(session, normalizeDate(now()));

    const owner = await store.getOwnerById(session.ownerId);
    if (!owner) {
      throw unauthorized("Session owner no longer exists");
    }

    return { owner, session };
  };

  return {
    prepareSession(createOptions = {}) {
      return prepareSessionRecord({
        ...createOptions,
        now,
        createId,
        sessionTtlMs
      });
    },

    async createSession(createOptions = {}) {
      // `store` override lets a caller run this write inside an open
      // transaction (tx handle) while keeping this service's cookie config.
      const activeStore = createOptions.store ?? store;
      const ownerId = requireNonEmptyString(createOptions.ownerId, "ownerId");
      const owner = await activeStore.getOwnerById(ownerId);

      if (!owner) {
        throw new ProfileBackendError(
          PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
          "Owner not found"
        );
      }

      const { createdAt, session } = prepareSessionRecord({
        ownerId,
        now,
        createId,
        sessionTtlMs
      });
      const savedSession = await activeStore.saveSession(session);

      return {
        owner,
        session: savedSession,
        cookie: serializeSessionCookie(savedSession, {
          ...cookieOptions,
          now: createdAt
        })
      };
    },

    verifySession,

    verifySessionFromCookie(cookieHeader) {
      return verifySession(
        readSessionIdFromCookie(cookieHeader, { cookieName })
      );
    },

    async revokeSession(revokeOptions = {}) {
      const sessionId = requireNonEmptyString(revokeOptions.sessionId, "sessionId");
      const session = await store.getSession(sessionId);

      if (!session) {
        throw unauthorized("Session is invalid");
      }

      if (session.revokedAt) {
        return session;
      }

      return store.saveSession({
        ...session,
        revokedAt: normalizeDate(now()).toISOString()
      });
    },

    async logoutFromCookie(cookieHeader) {
      const sessionId = readSessionIdFromCookie(cookieHeader, {
        cookieName,
        required: false
      });
      const session = sessionId ? await store.getSession(sessionId) : null;
      const revokedSession = session && !session.revokedAt
        ? await store.saveSession({
          ...session,
          revokedAt: normalizeDate(now()).toISOString()
        })
        : session;

      return {
        session: revokedSession,
        cookie: serializeExpiredSessionCookie(cookieOptions)
      };
    },

    serializeSessionCookie(session) {
      return serializeSessionCookie(session, {
        ...cookieOptions,
        now: normalizeDate(now())
      });
    },

    serializeExpiredSessionCookie() {
      return serializeExpiredSessionCookie(cookieOptions);
    }
  };
}

export function prepareSessionRecord(options = {}) {
  const ownerId = requireNonEmptyString(options.ownerId, "ownerId");
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? defaultCreateId;
  const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const createdAt = normalizeDate(now());
  const session = {
    id: createId("session"),
    ownerId,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + sessionTtlMs).toISOString(),
    revokedAt: null
  };

  return { createdAt, session };
}

export function serializeSessionCookie(session, options = {}) {
  const cookieName = normalizeCookieName(
    options.cookieName ?? DEFAULT_SESSION_COOKIE_NAME
  );
  const expiresAt = normalizeDate(session?.expiresAt);
  const nowDate = normalizeDate(options.now ?? new Date());
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - nowDate.getTime()) / 1000));
  const parts = [
    `${cookieName}=${encodeURIComponent(requireNonEmptyString(session?.id, "session.id"))}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    `Expires=${expiresAt.toUTCString()}`
  ];

  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function serializeExpiredSessionCookie(options = {}) {
  const cookieName = normalizeCookieName(
    options.cookieName ?? DEFAULT_SESSION_COOKIE_NAME
  );
  const parts = [
    `${cookieName}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT"
  ];

  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function readSessionIdFromCookie(cookieHeader, options = {}) {
  const cookieName = normalizeCookieName(
    options.cookieName ?? DEFAULT_SESSION_COOKIE_NAME
  );
  const parsed = parseCookieHeader(cookieHeader);
  const sessionId = parsed.get(cookieName) ?? "";

  if (!sessionId && options.required !== false) {
    throw unauthorized("Session cookie is required");
  }

  return sessionId || null;
}

export function parseCookieHeader(cookieHeader) {
  const parsed = new Map();

  if (typeof cookieHeader !== "string" || cookieHeader.trim() === "") {
    return parsed;
  }

  for (const pair of cookieHeader.split(";")) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (key) {
      parsed.set(key, decodeURIComponent(value));
    }
  }

  return parsed;
}

function assertSessionUsable(session, nowDate) {
  if (session.revokedAt) {
    throw unauthorized("Session has been revoked");
  }

  if (new Date(session.expiresAt).getTime() <= nowDate.getTime()) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.EXPIRED,
      "Session has expired"
    );
  }
}

function normalizeCookieName(value) {
  const cookieName = requireNonEmptyString(value, "cookieName");

  if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(cookieName)) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
      "Cookie name is invalid"
    );
  }

  return cookieName;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
      `${label} is required`
    );
  }

  return value.trim();
}

function normalizeDate(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
      "Expected a valid date"
    );
  }

  return date;
}

function unauthorized(message) {
  return new ProfileBackendError(
    PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED,
    message
  );
}
