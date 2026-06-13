export {
  PROFILE_BACKEND_ERROR_CODES,
  ProfileBackendError,
  createProfileBackendError,
  isProfileBackendError
} from "./errors.js";

export {
  DEFAULT_DURABLE_STORE_FILE,
  createFileProfileBackendStore,
  readStoreState,
  writeStoreState
} from "./durable-store.js";

export {
  createProfileBackendHttpHandler,
  errorResponse,
  okResponse,
  readBearerToken,
  readJsonBody,
  redirectResponse
} from "./http.js";

export {
  AUTH_PROVIDERS,
  normalizeGitHubIdentity,
  resolveGitHubIdentityFromCode
} from "./auth.js";

export {
  createAccountService,
  createOwnerId,
  normalizeVisibility,
  resolveOwnerHandle,
  slugifyHandleCandidate
} from "./accounts.js";

export {
  CLI_DEVICE_CODE_PREFIX,
  CLI_LOGIN_STATUS,
  DEFAULT_CLI_LOGIN_POLL_INTERVAL_SECONDS,
  DEFAULT_CLI_LOGIN_TTL_MS,
  DEFAULT_CLI_LOGIN_VERIFICATION_URI,
  createDeviceCodeDigest,
  createCliLoginService
} from "./cli-login.js";

export {
  DEFAULT_GITHUB_AUTHORIZATION_URL,
  DEFAULT_GITHUB_CALLBACK_PATH,
  DEFAULT_GITHUB_OAUTH_SCOPE,
  DEFAULT_OAUTH_STATE_TTL_MS,
  OAUTH_STATE_STATUS,
  buildGitHubAuthorizationUrl,
  createOAuthRuntimeService,
  resolveCallbackUrl
} from "./oauth-runtime.js";

export {
  assertNoForbiddenSecrets,
  detectForbiddenSecrets,
  hasForbiddenSecrets,
  isForbiddenSecretKey,
  isForbiddenSecretValue
} from "./security.js";

export {
  createSnapshotSubmitService,
  normalizeSnapshotSubmitPayload
} from "./snapshots.js";

export {
  DEFAULT_SESSION_COOKIE_NAME,
  DEFAULT_SESSION_TTL_MS,
  createSessionService,
  parseCookieHeader,
  readSessionIdFromCookie,
  serializeExpiredSessionCookie,
  serializeSessionCookie
} from "./session.js";

export {
  PROFILE_BACKEND_STORE_SCHEMA_VERSION,
  PROFILE_VISIBILITY,
  createMemoryProfileBackendStore
} from "./store.js";

export {
  CLI_TOKEN_PREFIX,
  DEFAULT_CLI_TOKEN_SCOPES,
  DEFAULT_CLI_TOKEN_TTL_MS,
  createCliTokenDigest,
  createCliTokenService,
  defaultCreateId,
  defaultCreateToken
} from "./tokens.js";
