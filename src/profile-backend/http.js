import { createAccountService } from "./accounts.js";
import { resolveGitHubIdentityFromCode } from "./auth.js";
import { createCliLoginService } from "./cli-login.js";
import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError,
  isProfileBackendError
} from "./errors.js";
import { createOAuthRuntimeService } from "./oauth-runtime.js";
import { createSessionService } from "./session.js";
import { createSnapshotSubmitService } from "./snapshots.js";
import { createCliTokenService } from "./tokens.js";

const JSON_HEADERS = Object.freeze({
  "content-type": "application/json; charset=utf-8"
});

export function createProfileBackendHttpHandler(options = {}) {
  const {
    store,
    githubClient,
    now = () => new Date(),
    createId,
    createToken,
    browserUrlBase
  } = options;

  if (!store) {
    throw new TypeError("store is required");
  }

  const tokenService = options.tokenService ?? createCliTokenService({
    store,
    now,
    createId,
    createToken
  });
  const accountService = options.accountService ?? createAccountService({
    store,
    now
  });
  const sessionService = options.sessionService ?? createSessionService({
    store,
    now,
    createId,
    secureCookies: options.secureCookies
  });
  const oauthRuntimeService = options.oauthRuntimeService ?? createOAuthRuntimeService({
    store,
    githubClient,
    accountService,
    sessionService,
    now,
    createId,
    githubClientId: options.githubClientId,
    githubAuthorizationUrl: options.githubAuthorizationUrl,
    publicBaseUrl: options.publicBaseUrl,
    callbackPath: options.githubCallbackPath
  });
  const cliLoginService = options.cliLoginService ?? createCliLoginService({
    store,
    now,
    createId,
    browserUrlBase,
    tokenService
  });
  const snapshotService = options.snapshotService ?? createSnapshotSubmitService({
    store,
    now,
    tokenService
  });

  return async function handleProfileBackendRequest(request) {
    try {
      const url = new URL(request.url);
      const route = `${request.method.toUpperCase()} ${url.pathname}`;

      if (route === "GET /api/auth/github/login") {
        const result = oauthRuntimeService.startGitHubLogin({
          cliLoginChallengeId: url.searchParams.get("cli_login_challenge"),
          redirectTo: url.searchParams.get("redirect_to")
        });

        return redirectResponse(result.authorizationUrl);
      }

      if (route === "GET /api/auth/github/callback") {
        const result = await oauthRuntimeService.completeGitHubCallback({
          code: url.searchParams.get("code"),
          state: url.searchParams.get("state")
        });
        const challenge = result.oauthState.cliLoginChallengeId
          ? cliLoginService.approveCliLogin({
            challengeId: result.oauthState.cliLoginChallengeId,
            ownerId: result.owner.id
          })
          : null;

        return okResponse({
          owner: serializeOwner(result.owner),
          session: serializeSession(result.session),
          challenge: serializeChallenge(challenge),
          redirectTo: result.oauthState.redirectTo ?? null
        }, 200, {
          "set-cookie": result.sessionCookie
        });
      }

      if (route === "GET /api/auth/me") {
        const { owner, session } = sessionService.verifySessionFromCookie(
          readCookieHeader(request)
        );

        return okResponse({
          owner: serializeOwner(owner),
          session: serializeSession(session)
        });
      }

      if (route === "POST /api/auth/logout") {
        const result = oauthRuntimeService.logout({
          cookieHeader: readCookieHeader(request)
        });

        return okResponse({
          session: serializeSession(result.session)
        }, 200, {
          "set-cookie": result.cookie
        });
      }

      if (route === "POST /api/auth/github/callback") {
        const body = await readJsonBody(request);
        const identity = await resolveGitHubIdentityFromCode({
          code: body.code,
          githubClient
        });
        const owner = accountService.upsertGitHubOwner(identity, {
          handle: body.handle,
          visibility: body.visibility
        });
        const challengeId = body.challengeId
          ?? body.cliLoginChallengeId
          ?? body.cli_login_challenge;
        const challenge = challengeId
          ? cliLoginService.approveCliLogin({ challengeId, ownerId: owner.id })
          : null;

        return okResponse({
          owner: serializeOwner(owner),
          challenge: serializeChallenge(challenge)
        });
      }

      if (route === "POST /api/cli/login/start") {
        const body = await readJsonBody(request);
        const result = cliLoginService.startCliLogin({
          label: body.label,
          redirectUri: body.redirectUri
        });

        return okResponse({
          browserUrl: result.browserUrl,
          challenge: serializeChallenge(result.challenge)
        }, 201);
      }

      if (route === "POST /api/cli/login/approve") {
        const body = await readJsonBody(request);
        const { owner } = sessionService.verifySessionFromCookie(
          readCookieHeader(request)
        );
        const challenge = cliLoginService.approveCliLogin({
          challengeId: body.challengeId,
          ownerId: owner.id
        });

        return okResponse({
          challenge: serializeChallenge(challenge)
        });
      }

      if (route === "POST /api/cli/login/exchange") {
        const body = await readJsonBody(request);
        const result = cliLoginService.exchangeCliLogin({
          challengeId: body.challengeId,
          label: body.label
        });

        return okResponse({
          token: result.token,
          tokenRecord: serializeCliTokenRecord(result.tokenRecord),
          challenge: serializeChallenge(result.challenge)
        });
      }

      if (route === "POST /api/snapshots/submit") {
        const token = readBearerToken(request);
        const payload = await readJsonBody(request);
        const record = snapshotService.submitSnapshot({ token, payload });

        return okResponse({
          snapshot: serializeLatestSnapshot(record)
        }, 201);
      }

      const publicSnapshotPrefix = "/api/snapshots/public/";
      if (
        request.method.toUpperCase() === "GET" &&
        url.pathname.startsWith(publicSnapshotPrefix)
      ) {
        const handle = decodeURIComponent(url.pathname.slice(publicSnapshotPrefix.length));
        const record = snapshotService.getPublicSnapshotByHandle(handle);

        if (!record) {
          throw new ProfileBackendError(
            PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
            "Snapshot not found"
          );
        }

        return okResponse({
          snapshot: serializeLatestSnapshot(record)
        });
      }

      throw new ProfileBackendError(
        PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
        "Route not found"
      );
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export async function readJsonBody(request) {
  const text = await request.text();

  if (text.trim() === "") {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST,
      "Request body must be valid JSON"
    );
  }
}

export function readBearerToken(request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match || match[1].trim() === "") {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED,
      "Bearer token is required"
    );
  }

  return match[1].trim();
}

export function okResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify({ ok: true, data }), {
    status,
    headers: createHeaders(headers)
  });
}

export function errorResponse(error) {
  const normalized = normalizeError(error);

  return new Response(JSON.stringify(normalized.toResponseBody()), {
    status: normalized.status,
    headers: createHeaders()
  });
}

export function redirectResponse(location, status = 302) {
  const headers = new Headers();
  headers.set("location", location);

  return new Response(null, {
    status,
    headers
  });
}

function createHeaders(extraHeaders = {}) {
  const headers = new Headers(JSON_HEADERS);

  for (const [name, value] of Object.entries(extraHeaders)) {
    if (value !== undefined && value !== null) {
      headers.set(name, value);
    }
  }

  return headers;
}

function readCookieHeader(request) {
  return request.headers.get("cookie") ?? "";
}

function normalizeError(error) {
  if (isProfileBackendError(error)) {
    return error;
  }

  return new ProfileBackendError(
    PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST,
    error instanceof Error ? error.message : "Request failed"
  );
}

function serializeOwner(owner) {
  if (!owner) return null;

  return {
    id: owner.id,
    authProvider: owner.authProvider,
    providerUserId: owner.providerUserId,
    githubLogin: owner.githubLogin,
    displayName: owner.displayName ?? null,
    avatarUrl: owner.avatarUrl ?? null,
    profileUrl: owner.profileUrl ?? null,
    handle: owner.handle,
    visibility: owner.visibility,
    createdAt: owner.createdAt ?? null,
    updatedAt: owner.updatedAt ?? null
  };
}

function serializeChallenge(challenge) {
  if (!challenge) return null;

  return {
    id: challenge.id,
    status: challenge.status,
    label: challenge.label ?? null,
    redirectUri: challenge.redirectUri ?? null,
    createdAt: challenge.createdAt,
    expiresAt: challenge.expiresAt,
    approvedAt: challenge.approvedAt ?? null,
    exchangedAt: challenge.exchangedAt ?? null,
    ownerId: challenge.ownerId ?? null,
    cliTokenId: challenge.cliTokenId ?? null
  };
}

function serializeSession(session) {
  if (!session) return null;

  return {
    id: session.id,
    ownerId: session.ownerId,
    createdAt: session.createdAt ?? null,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt ?? null
  };
}

function serializeCliTokenRecord(tokenRecord) {
  if (!tokenRecord) return null;

  return {
    id: tokenRecord.id,
    ownerId: tokenRecord.ownerId,
    label: tokenRecord.label ?? null,
    scopes: [...tokenRecord.scopes],
    sourceChallengeId: tokenRecord.sourceChallengeId ?? null,
    createdAt: tokenRecord.createdAt,
    expiresAt: tokenRecord.expiresAt,
    revokedAt: tokenRecord.revokedAt ?? null,
    lastUsedAt: tokenRecord.lastUsedAt ?? null
  };
}

function serializeLatestSnapshot(record) {
  if (!record) return null;

  return {
    ownerId: record.ownerId,
    handle: record.handle,
    visibility: record.visibility,
    capturedAt: record.capturedAt,
    uploadedAt: record.uploadedAt,
    schemaVersion: record.schemaVersion,
    snapshot: record.snapshot
  };
}
