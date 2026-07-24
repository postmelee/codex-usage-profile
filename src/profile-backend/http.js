import { createAccountService } from "./accounts.js";
import { createAccountUsageSubmitService } from "./account-usage-submit.js";
import { normalizeAccountUsageReadResult } from "../profile-card/account-usage.js";
import { createProfileCardServiceCore } from "../profile-card/service-core.js";
import { createProfilePublicationService } from "../profile-media/publication-service.js";
import {
  PROFILE_MEDIA_CACHE_CONTROL,
  PROFILE_MEDIA_CONTENT_TYPE,
  PROFILE_MEDIA_STORE_ERROR_CODES,
  createProfileMediaStableKey
} from "../profile-media/media-store-contract.js";
import { resolveGitHubIdentityFromCode } from "./auth.js";
import { createCliLoginService } from "./cli-login.js";
import {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError,
  createProfileMediaUnavailableError,
  isProfileBackendError
} from "./errors.js";
import { createOAuthRuntimeService } from "./oauth-runtime.js";
import { createSessionService } from "./session.js";
import { createSnapshotSubmitService } from "./snapshots.js";
import { PROFILE_VISIBILITY } from "./store-values.js";
import { createCliTokenService } from "./tokens.js";
import {
  createSubmittedDeviceService,
  getSubmittedDeviceDisplayName
} from "./devices.js";

const JSON_HEADERS = Object.freeze({
  "content-type": "application/json; charset=utf-8"
});
const DEFAULT_SETTINGS_TOKEN_LABEL = "CLI token";
const MAX_SETTINGS_TOKEN_LABEL_LENGTH = 100;
const PRIVATE_CARD_CACHE_CONTROL = "private, no-store";

export const ACCOUNT_USAGE_DEVICE_ID_HEADER = "x-codex-usage-profile-device-id";
export const ACCOUNT_USAGE_DEVICE_NAME_HEADER = "x-codex-usage-profile-device-name";
export const DEFAULT_ACCOUNT_USAGE_BODY_MAX_BYTES = 64 * 1024;

export function createProfileBackendHttpHandler(options = {}) {
  const {
    store,
    githubClient,
    now = () => new Date(),
    createId,
    createToken,
    createDeviceCode,
    createUserCode,
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
    createDeviceCode,
    createUserCode,
    browserUrlBase,
    verificationUri: options.deviceVerificationUri,
    pollIntervalSeconds: options.devicePollIntervalSeconds,
    tokenService
  });
  const deviceService = options.deviceService ?? createSubmittedDeviceService({
    store,
    now,
    createId
  });
  const snapshotService = options.snapshotService ?? createSnapshotSubmitService({
    store,
    now,
    tokenService,
    deviceService,
    createId
  });
  const cardService = options.cardService ?? createProfileCardServiceCore({
    store,
    accountService,
    now,
    fetchImpl: options.profileCardFetchImpl ?? options.fetchImpl,
    renderPng: options.profileCardRenderPng,
    rendererVersion: options.profileCardRendererVersion,
    avatarTimeoutMs: options.profileCardAvatarTimeoutMs,
    avatarMaxBytes: options.profileCardAvatarMaxBytes,
    cacheEntries: options.profileCardCacheEntries
  });
  const mediaStore = options.mediaStore ?? null;
  const publicationService = options.publicationService ?? (
    mediaStore
      ? createProfilePublicationService({
        store,
        mediaStore,
        cardService,
        now,
        createId
      })
      : null
  );
  const accountUsageService = options.accountUsageService ??
    createAccountUsageSubmitService({
      store,
      now,
      tokenService,
      deviceService,
      rateLimiter: options.accountUsageRateLimiter,
      createId
    });

  return async function handleProfileBackendRequest(request) {
    try {
      const url = new URL(request.url);
      const route = `${request.method.toUpperCase()} ${url.pathname}`;

      assertSameOriginApiRequest(request, url, options.publicBaseUrl);
      assertSameOriginSessionMutation(request, route, url);

      if (route === "GET /api/auth/github/login") {
        try {
          const result = await oauthRuntimeService.startGitHubLogin({
            cliLoginChallengeId: url.searchParams.get("cli_login_challenge"),
            redirectTo: normalizeRequestedRedirectPath(
              url.searchParams.get("redirect_to")
            )
          });

          return redirectResponse(result.authorizationUrl);
        } catch (error) {
          if (shouldRedirectBrowserAuthError(request, error)) {
            return redirectResponse(buildAuthErrorRedirectPath(
              url.searchParams.get("redirect_to"),
              error
            ));
          }

          throw error;
        }
      }

      if (route === "GET /api/auth/github/callback") {
        const result = await oauthRuntimeService.completeGitHubCallback({
          code: url.searchParams.get("code"),
          state: url.searchParams.get("state")
        });
        const challenge = result.oauthState.cliLoginChallengeId
          ? await cliLoginService.approveCliLogin({
            challengeId: result.oauthState.cliLoginChallengeId,
            ownerId: result.owner.id
          })
          : null;

        const payload = {
          owner: serializeOwner(result.owner),
          session: serializeSession(result.session),
          challenge: serializeChallenge(challenge),
          redirectTo: result.oauthState.redirectTo ?? null
        };
        const headers = {
          "set-cookie": result.sessionCookie
        };

        if (wantsBrowserNavigation(request)) {
          return redirectResponse(
            sanitizeLocalRedirectPath(result.oauthState.redirectTo, "/settings"),
            302,
            headers
          );
        }

        return okResponse(payload, 200, headers);
      }

      if (route === "GET /api/auth/me") {
        const { owner, session } = await sessionService.verifySessionFromCookie(
          readCookieHeader(request)
        );

        return okResponse({
          owner: serializeOwner(owner),
          session: serializeSession(session)
        });
      }

      if (route === "POST /api/auth/logout") {
        const result = await oauthRuntimeService.logout({
          cookieHeader: readCookieHeader(request)
        });

        return okResponse({
          session: serializeSession(result.session)
        }, 200, {
          "set-cookie": result.cookie
        });
      }

      if (route === "GET /api/profile") {
        const { owner } = await sessionService.verifySessionFromCookie(
          readCookieHeader(request)
        );
        const profile = await cardService.getOwnerProfile({ ownerId: owner.id });
        return okResponse(serializeOwnerProfile(profile, request, options.publicBaseUrl));
      }

      if (route === "PATCH /api/profile") {
        const { owner } = await sessionService.verifySessionFromCookie(
          readCookieHeader(request)
        );
        const body = await readJsonBody(request);
        const profile = await (publicationService ?? cardService).updateVisibility({
          ownerId: owner.id,
          visibility: readProfileVisibility(body)
        });
        return okResponse(serializeOwnerProfile(profile, request, options.publicBaseUrl));
      }

      if (route === "GET /api/profile/card.png") {
        const { owner } = await sessionService.verifySessionFromCookie(
          readCookieHeader(request)
        );
        const card = await cardService.renderOwnerCard({
          ownerId: owner.id,
          locale: url.searchParams.get("locale")
        });
        return cardPngResponse(card, { cacheControl: PRIVATE_CARD_CACHE_CONTROL });
      }

      if (route === "POST /api/auth/device") {
        const body = await readJsonBody(request);
        const result = await cliLoginService.startCliLogin({
          label: body.label,
          redirectUri: body.redirectUri,
          verificationUri: body.verificationUri,
          intervalSeconds: body.intervalSeconds
        });

        return okResponse(serializeDeviceStart(result), 201);
      }

      if (route === "POST /api/auth/device/authorize") {
        const body = await readJsonBody(request);
        const { owner } = await sessionService.verifySessionFromCookie(
          readCookieHeader(request)
        );
        const challenge = await cliLoginService.approveCliLogin({
          userCode: body.userCode ?? body.user_code,
          challengeId: body.challengeId,
          ownerId: owner.id
        });

        return okResponse({
          status: challenge.status,
          challenge: serializeChallenge(challenge)
        });
      }

      if (route === "POST /api/auth/device/poll") {
        const body = await readJsonBody(request);
        const result = await cliLoginService.pollCliLogin({
          deviceCode: body.deviceCode ?? body.device_code,
          label: body.label
        });

        return okResponse(serializeDevicePoll(result));
      }

      if (route === "GET /api/settings/tokens") {
        const { owner } = await sessionService.verifySessionFromCookie(
          readCookieHeader(request)
        );
        const tokens = await tokenService.listCliTokens({ ownerId: owner.id });

        return okResponse({
          tokens: tokens.map(serializeCliTokenRecord)
        });
      }

      if (route === "POST /api/settings/tokens") {
        const { owner } = await sessionService.verifySessionFromCookie(
          readCookieHeader(request)
        );
        const body = await readJsonBody(request);
        const result = await tokenService.issueCliToken({
          ownerId: owner.id,
          label: normalizeSettingsTokenLabel(body.label ?? body.name)
        });

        return okResponse({
          token: result.token,
          tokenRecord: serializeCliTokenRecord(result.tokenRecord)
        }, 201);
      }

      const settingsTokenPrefix = "/api/settings/tokens/";
      if (
        request.method.toUpperCase() === "DELETE" &&
        url.pathname.startsWith(settingsTokenPrefix)
      ) {
        const { owner } = await sessionService.verifySessionFromCookie(
          readCookieHeader(request)
        );
        const tokenId = decodeURIComponent(url.pathname.slice(settingsTokenPrefix.length));
        const tokenRecord = await tokenService.revokeCliToken({
          tokenId,
          ownerId: owner.id
        });

        return okResponse({
          tokenRecord: serializeCliTokenRecord(tokenRecord)
        });
      }

      if (route === "GET /api/settings/devices") {
        const { owner } = await sessionService.verifySessionFromCookie(
          readCookieHeader(request)
        );
        const devices = await deviceService.listSubmittedDevices({ ownerId: owner.id });

        return okResponse({
          devices: devices.map(serializeSubmittedDevice)
        });
      }

      const settingsDevicePrefix = "/api/settings/devices/";
      if (
        request.method.toUpperCase() === "PATCH" &&
        url.pathname.startsWith(settingsDevicePrefix)
      ) {
        const { owner } = await sessionService.verifySessionFromCookie(
          readCookieHeader(request)
        );
        const body = await readJsonBody(request);
        const deviceId = decodeURIComponent(url.pathname.slice(settingsDevicePrefix.length));
        const device = await deviceService.renameSubmittedDevice({
          ownerId: owner.id,
          deviceId,
          displayName: body.name ?? body.displayName
        });

        return okResponse({
          device: serializeSubmittedDevice(device)
        });
      }

      if (route === "POST /api/auth/github/callback") {
        const body = await readJsonBody(request);
        const identity = await resolveGitHubIdentityFromCode({
          code: body.code,
          githubClient
        });
        const owner = await accountService.upsertGitHubOwner(identity, {
          handle: body.handle,
          visibility: body.visibility
        });
        const challengeId = body.challengeId
          ?? body.cliLoginChallengeId
          ?? body.cli_login_challenge;
        const challenge = challengeId
          ? await cliLoginService.approveCliLogin({ challengeId, ownerId: owner.id })
          : null;

        return okResponse({
          owner: serializeOwner(owner),
          challenge: serializeChallenge(challenge)
        });
      }

      if (route === "POST /api/cli/login/start") {
        const body = await readJsonBody(request);
        const result = await cliLoginService.startCliLogin({
          label: body.label,
          redirectUri: body.redirectUri
        });

        return okResponse({
          browserUrl: result.browserUrl,
          deviceCode: result.deviceCode,
          userCode: result.userCode,
          verificationUri: result.verificationUri,
          verificationUriComplete: result.verificationUriComplete,
          expiresAt: result.expiresAt,
          intervalSeconds: result.intervalSeconds,
          challenge: serializeChallenge(result.challenge)
        }, 201);
      }

      if (route === "POST /api/cli/login/approve") {
        const body = await readJsonBody(request);
        const { owner } = await sessionService.verifySessionFromCookie(
          readCookieHeader(request)
        );
        const challenge = await cliLoginService.approveCliLogin({
          challengeId: body.challengeId,
          ownerId: owner.id
        });

        return okResponse({
          challenge: serializeChallenge(challenge)
        });
      }

      if (route === "POST /api/cli/login/exchange") {
        const body = await readJsonBody(request);
        const result = await cliLoginService.exchangeCliLogin({
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
        const record = await snapshotService.submitSnapshot({ token, payload });

        return okResponse({
          snapshot: serializeLatestSnapshot(record)
        }, 201);
      }

      if (route === "POST /api/account-usage/submit") {
        const token = readBearerToken(request);
        const document = await readJsonBody(request, {
          maxBytes: options.accountUsageBodyMaxBytes ??
            DEFAULT_ACCOUNT_USAGE_BODY_MAX_BYTES,
          requireJson: true
        });
        const result = await accountUsageService.submitAccountUsage({
          token,
          document,
          device: readAccountUsageDeviceHeaders(request)
        });
        await refreshPublicProfileMedia(result, publicationService);

        return okResponse(
          serializeAccountUsageSubmission(
            result,
            request,
            options.publicBaseUrl
          ),
          result.idempotent ? 200 : 201
        );
      }

      if (route === "GET /api/account-usage/status") {
        const token = readBearerToken(request);
        const result = await accountUsageService.getAccountUsageStatus({ token });

        return okResponse(serializeAccountUsageStatus(
          result,
          request,
          options.publicBaseUrl
        ));
      }

      const publicProfilePrefix = "/api/profiles/public/";
      if (
        request.method.toUpperCase() === "GET" &&
        url.pathname.startsWith(publicProfilePrefix)
      ) {
        const profile = await cardService.getPublicProfile({
          handle: decodePublicHandle(
            url.pathname.slice(publicProfilePrefix.length)
          )
        });

        return okResponse(
          serializePublicProfile(profile, request, options.publicBaseUrl),
          200,
          { "cache-control": "no-store" }
        );
      }

      const publicSnapshotPrefix = "/api/snapshots/public/";
      if (
        request.method.toUpperCase() === "GET" &&
        url.pathname.startsWith(publicSnapshotPrefix)
      ) {
        const handle = decodeURIComponent(url.pathname.slice(publicSnapshotPrefix.length));
        const record = await snapshotService.getPublicSnapshotByHandle(handle);

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

      const publicCardMatch = url.pathname.match(/^\/u\/([^/]+)\/card\.png$/);
      if (publicCardMatch && ["GET", "HEAD"].includes(request.method.toUpperCase())) {
        const method = request.method.toUpperCase();
        const card = await readPublishedMediaCard({
          mediaStore,
          handle: decodePublicCardHandle(publicCardMatch[1]),
          locale: url.searchParams.get("locale"),
          ifNoneMatch: request.headers.get("if-none-match"),
          includeBody: method === "GET"
        });
        return cardPngResponse(card, {
          cacheControl: PROFILE_MEDIA_CACHE_CONTROL,
          contentType: PROFILE_MEDIA_CONTENT_TYPE,
          head: method === "HEAD"
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

export async function readJsonBody(request, options = {}) {
  if (options.requireJson === true) {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
      throw new ProfileBackendError(
        PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST,
        "Content-Type must be application/json",
        { status: 415 }
      );
    }
  }

  const maxBytes = normalizeBodyMaxBytes(options.maxBytes);
  const contentLength = request.headers.get("content-length");
  if (
    maxBytes !== null &&
    contentLength !== null &&
    Number.isFinite(Number(contentLength)) &&
    Number(contentLength) > maxBytes
  ) {
    throw bodyTooLargeError(maxBytes);
  }

  const text = await readRequestText(request, maxBytes);

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
    headers: createHeaders(normalized.headers ?? {})
  });
}

export function redirectResponse(location, status = 302, extraHeaders = {}) {
  const headers = new Headers(extraHeaders);
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

function readAccountUsageDeviceHeaders(request) {
  const id = request.headers.get(ACCOUNT_USAGE_DEVICE_ID_HEADER);
  const name = request.headers.get(ACCOUNT_USAGE_DEVICE_NAME_HEADER);

  if (id === null && name === null) {
    return undefined;
  }

  return {
    id,
    name
  };
}

function readProfileVisibility(body) {
  if (
    !body || typeof body !== "object" || Array.isArray(body) ||
    Object.keys(body).length !== 1 || !Object.hasOwn(body, "visibility")
  ) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
      "Profile visibility payload must contain only visibility"
    );
  }
  return body.visibility;
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

function shouldRedirectBrowserAuthError(request, error) {
  return wantsBrowserNavigation(request) && isProfileBackendError(error);
}

function wantsBrowserNavigation(request) {
  const accept = request.headers.get("accept") ?? "";

  return accept.includes("text/html");
}

function buildAuthErrorRedirectPath(redirectTo, error) {
  const path = sanitizeLocalRedirectPath(redirectTo, "/settings");
  const url = new URL(path, "http://localhost");
  const code = error.code === PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED &&
    error.message === "githubClientId is required"
    ? "github_oauth_not_configured"
    : "github_login_failed";

  url.searchParams.set("auth_error", code);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function sanitizeLocalRedirectPath(value, fallback) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return fallback;
  }

  try {
    const baseUrl = new URL("http://profile.local");
    const redirectUrl = new URL(value, baseUrl);
    if (redirectUrl.origin !== baseUrl.origin) {
      return fallback;
    }
    return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
  } catch {
    return fallback;
  }
}

function normalizeRequestedRedirectPath(value) {
  if (value === null) return null;

  const redirectPath = sanitizeLocalRedirectPath(value, null);
  if (!redirectPath) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED,
      "redirect_to must be a local application path"
    );
  }
  return redirectPath;
}

function assertSameOriginApiRequest(request, url, publicBaseUrl) {
  if (url.pathname !== "/api" && !url.pathname.startsWith("/api/")) {
    return;
  }

  const requestOrigin = request.headers.get("origin");
  if (requestOrigin === null) return;

  const expectedOrigin = new URL(publicBaseUrl ?? url.origin).origin;
  let normalizedOrigin = null;
  try {
    normalizedOrigin = new URL(requestOrigin).origin;
  } catch {
    normalizedOrigin = null;
  }

  if (normalizedOrigin !== expectedOrigin) {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.FORBIDDEN,
      "Cross-origin API access is not allowed"
    );
  }
}

function assertSameOriginSessionMutation(request, route, url) {
  if (!isSessionMutationRoute(route, url.pathname)) return;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    throw new ProfileBackendError(
      PROFILE_BACKEND_ERROR_CODES.FORBIDDEN,
      "Cross-origin session mutation is not allowed"
    );
  }
}

function isSessionMutationRoute(route, pathname) {
  if ([
    "POST /api/auth/device/authorize",
    "POST /api/auth/logout",
    "POST /api/cli/login/approve",
    "PATCH /api/profile",
    "POST /api/settings/tokens"
  ].includes(route)) {
    return true;
  }

  return (route.startsWith("DELETE ") && pathname.startsWith("/api/settings/tokens/")) ||
    (route.startsWith("PATCH ") && pathname.startsWith("/api/settings/devices/"));
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
    userCode: challenge.userCode ?? null,
    verificationUri: challenge.verificationUri ?? null,
    verificationUriComplete: challenge.verificationUriComplete ?? null,
    intervalSeconds: challenge.intervalSeconds ?? null,
    createdAt: challenge.createdAt,
    expiresAt: challenge.expiresAt,
    approvedAt: challenge.approvedAt ?? null,
    exchangedAt: challenge.exchangedAt ?? null,
    ownerId: challenge.ownerId ?? null,
    cliTokenId: challenge.cliTokenId ?? null
  };
}

function serializeDeviceStart(result) {
  return {
    deviceCode: result.deviceCode,
    userCode: result.userCode,
    verificationUri: result.verificationUri,
    verificationUriComplete: result.verificationUriComplete,
    expiresAt: result.expiresAt,
    intervalSeconds: result.intervalSeconds,
    challenge: serializeChallenge(result.challenge)
  };
}

function serializeDevicePoll(result) {
  const payload = {
    status: result.status,
    challenge: serializeChallenge(result.challenge)
  };

  if (result.token) {
    payload.token = result.token;
  }
  if (result.tokenRecord) {
    payload.tokenRecord = serializeCliTokenRecord(result.tokenRecord);
  }

  return payload;
}

function normalizeSettingsTokenLabel(value) {
  if (typeof value !== "string") {
    return DEFAULT_SETTINGS_TOKEN_LABEL;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_SETTINGS_TOKEN_LABEL;
  }

  return trimmed.slice(0, MAX_SETTINGS_TOKEN_LABEL_LENGTH);
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

function serializeSubmittedDevice(device) {
  if (!device) return null;

  return {
    id: device.id,
    deviceKey: device.deviceKey,
    displayName: getSubmittedDeviceDisplayName(device),
    customName: device.displayName ?? null,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt,
    lastSubmittedAt: device.lastSubmittedAt
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

function serializeOwnerProfile(profile, request, publicBaseUrl) {
  return {
    owner: serializeOwner(profile.owner),
    usage: serializeLatestUsage(profile.usageRecord),
    visibility: profile.visibility,
    publicCardUrl: buildPublicCardUrl(profile.owner.handle, request, publicBaseUrl)
  };
}

function serializePublicProfile(profile, request, publicBaseUrl) {
  const usage = normalizeAccountUsageReadResult(profile.usageRecord.usage);

  return {
    owner: {
      displayName: profile.owner.displayName ?? null,
      githubLogin: profile.owner.githubLogin ?? null,
      avatarUrl: profile.owner.avatarUrl ?? null,
      handle: profile.owner.handle
    },
    usage: {
      capturedAt: profile.usageRecord.capturedAt,
      uploadedAt: profile.usageRecord.uploadedAt,
      usage: {
        summary: usage.summary,
        dailyUsageBuckets: usage.dailyUsageBuckets
      }
    },
    visibility: PROFILE_VISIBILITY.PUBLIC,
    publicCardUrl: buildPublicCardUrl(
      profile.owner.handle,
      request,
      publicBaseUrl
    )
  };
}

function serializeLatestUsage(record) {
  if (!record) return null;
  return {
    ownerId: record.ownerId,
    handle: record.handle,
    visibility: record.visibility,
    capturedAt: record.capturedAt,
    uploadedAt: record.uploadedAt,
    usage: record.usage
  };
}

function serializeAccountUsageSubmission(result, request, publicBaseUrl) {
  return {
    submission: {
      status: result.idempotent ? "unchanged" : "accepted",
      idempotent: result.idempotent,
      contractVersion: result.usageRecord.contractVersion ?? 1,
      capturedAt: result.usageRecord.capturedAt,
      uploadedAt: result.usageRecord.uploadedAt,
      revision: result.revision
    },
    profile: buildAccountUsageProfileMetadata(
      result.owner,
      request,
      publicBaseUrl
    ),
    device: serializeSubmittedDevice(result.device)
  };
}

function serializeAccountUsageStatus(result, request, publicBaseUrl) {
  return {
    account: {
      handle: result.owner.handle,
      visibility: result.owner.visibility
    },
    token: {
      id: result.tokenRecord.id,
      label: result.tokenRecord.label ?? null,
      createdAt: result.tokenRecord.createdAt,
      expiresAt: result.tokenRecord.expiresAt,
      lastUsedAt: result.tokenRecord.lastUsedAt ?? null
    },
    latestUsage: result.usageRecord
      ? {
          contractVersion: result.usageRecord.contractVersion ?? 1,
          capturedAt: result.usageRecord.capturedAt,
          uploadedAt: result.usageRecord.uploadedAt,
          revision: result.revision
        }
      : null,
    profile: buildAccountUsageProfileMetadata(
      result.owner,
      request,
      publicBaseUrl
    )
  };
}

function buildAccountUsageProfileMetadata(owner, request, publicBaseUrl) {
  const baseUrl = publicBaseUrl ?? new URL(request.url).origin;
  const imageUrl = buildPublicCardUrl(owner.handle, request, publicBaseUrl);

  return {
    handle: owner.handle,
    visibility: owner.visibility,
    profileUrl: new URL("/profile", baseUrl).toString(),
    imageUrl,
    readmeMarkdown: `![Codex usage profile](${imageUrl})`
  };
}

function normalizeBodyMaxBytes(value) {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError("maxBytes must be a positive safe integer");
  }
  return value;
}

async function readRequestText(request, maxBytes) {
  if (maxBytes === null || request.body === null) {
    return request.text();
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        await reader.cancel();
        throw bodyTooLargeError(maxBytes);
      }

      text += decoder.decode(value, { stream: true });
    }

    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function bodyTooLargeError(maxBytes) {
  return new ProfileBackendError(
    PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST,
    `Request body must be ${maxBytes} bytes or fewer`,
    { status: 413 }
  );
}

function buildPublicCardUrl(handle, request, publicBaseUrl) {
  const baseUrl = publicBaseUrl ?? new URL(request.url).origin;
  return new URL(`/u/${encodeURIComponent(handle)}/card.png`, baseUrl).toString();
}

function decodePublicHandle(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

function decodePublicCardHandle(value) {
  const handle = decodePublicHandle(value);
  try {
    createProfileMediaStableKey({ handle });
    return handle;
  } catch {
    throw publicCardNotFoundError();
  }
}

function cardPngResponse(card, options) {
  const headers = {
    "cache-control": options.cacheControl,
    "content-type": options.contentType ?? "image/png",
    etag: card.etag
  };
  if (card.notModified) return new Response(null, { status: 304, headers });
  return new Response(options.head ? null : card.body, { status: 200, headers });
}

async function refreshPublicProfileMedia(result, publicationService) {
  if (result?.owner?.visibility !== PROFILE_VISIBILITY.PUBLIC) return;

  if (
    !publicationService ||
    typeof publicationService.refreshPublishedCard !== "function"
  ) {
    throw createProfileMediaUnavailableError();
  }

  try {
    await publicationService.refreshPublishedCard({
      ownerId: result.owner.id
    });
  } catch (error) {
    if (
      isProfileBackendError(error) &&
      error.code === PROFILE_BACKEND_ERROR_CODES.MEDIA_UNAVAILABLE &&
      error.headers?.["retry-after"]
    ) {
      throw error;
    }
    throw createProfileMediaUnavailableError({
      details: isProfileBackendError(error) ? error.details : null
    });
  }
}

async function readPublishedMediaCard(options) {
  if (
    !options.mediaStore ||
    typeof options.mediaStore.getPublishedCard !== "function"
  ) {
    throw createProfileMediaUnavailableError();
  }

  let card;
  try {
    card = await options.mediaStore.getPublishedCard({
      handle: options.handle,
      locale: options.locale,
      ifNoneMatch: options.ifNoneMatch,
      includeBody: options.includeBody
    });
  } catch (error) {
    if ([
      PROFILE_MEDIA_STORE_ERROR_CODES.CONFLICT,
      PROFILE_MEDIA_STORE_ERROR_CODES.INVALID,
      PROFILE_MEDIA_STORE_ERROR_CODES.NOT_FOUND
    ].includes(error?.code)) {
      throw publicCardNotFoundError();
    }
    throw createProfileMediaUnavailableError();
  }

  if (!isPublishedMediaCard(card, { includeBody: options.includeBody })) {
    throw publicCardNotFoundError();
  }
  return card;
}

function publicCardNotFoundError() {
  return new ProfileBackendError(
    PROFILE_BACKEND_ERROR_CODES.NOT_FOUND,
    "Card not found"
  );
}

function isPublishedMediaCard(card, options) {
  if (
    !card ||
    card.contentType !== PROFILE_MEDIA_CONTENT_TYPE ||
    card.cacheControl !== PROFILE_MEDIA_CACHE_CONTROL ||
    typeof card.etag !== "string" ||
    !/^"[A-Za-z0-9_-]{43}"$/.test(card.etag) ||
    typeof card.notModified !== "boolean"
  ) return false;

  if (card.notModified || options.includeBody === false) return card.body === null;
  return (Buffer.isBuffer(card.body) || card.body instanceof Uint8Array) &&
    card.body.byteLength > 0;
}
