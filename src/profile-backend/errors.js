export const PROFILE_BACKEND_ERROR_CODES = Object.freeze({
  CONFLICT: "conflict",
  EXPIRED: "expired",
  FORBIDDEN: "forbidden",
  FORBIDDEN_SECRET: "forbidden_secret",
  GONE: "gone",
  INVALID_REQUEST: "invalid_request",
  MEDIA_UNAVAILABLE: "media_unavailable",
  NOT_FOUND: "not_found",
  RATE_LIMITED: "rate_limited",
  UNAUTHORIZED: "unauthorized",
  VALIDATION_FAILED: "validation_failed"
});

export const PROFILE_MEDIA_RETRY_AFTER_SECONDS = 5;

const DEFAULT_STATUS_BY_CODE = {
  [PROFILE_BACKEND_ERROR_CODES.CONFLICT]: 409,
  [PROFILE_BACKEND_ERROR_CODES.EXPIRED]: 410,
  [PROFILE_BACKEND_ERROR_CODES.FORBIDDEN]: 403,
  [PROFILE_BACKEND_ERROR_CODES.FORBIDDEN_SECRET]: 400,
  [PROFILE_BACKEND_ERROR_CODES.GONE]: 410,
  [PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST]: 400,
  [PROFILE_BACKEND_ERROR_CODES.MEDIA_UNAVAILABLE]: 503,
  [PROFILE_BACKEND_ERROR_CODES.NOT_FOUND]: 404,
  [PROFILE_BACKEND_ERROR_CODES.RATE_LIMITED]: 429,
  [PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED]: 401,
  [PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED]: 400
};

const DEFAULT_HEADERS_BY_CODE = {
  [PROFILE_BACKEND_ERROR_CODES.MEDIA_UNAVAILABLE]: Object.freeze({
    "retry-after": String(PROFILE_MEDIA_RETRY_AFTER_SECONDS)
  })
};

export class ProfileBackendError extends Error {
  constructor(code, message, options = {}) {
    super(message);

    this.name = "ProfileBackendError";
    this.code = code;
    this.details = options.details ?? null;
    this.headers = options.headers ?? DEFAULT_HEADERS_BY_CODE[code] ?? null;
    this.status = options.status ?? DEFAULT_STATUS_BY_CODE[code] ?? 500;
  }

  toResponseBody() {
    return {
      ok: false,
      error: {
        code: this.code,
        message: this.message
      }
    };
  }
}

export function createProfileBackendError(code, message, options = {}) {
  return new ProfileBackendError(code, message, options);
}

export function createProfileMediaUnavailableError(options = {}) {
  return new ProfileBackendError(
    PROFILE_BACKEND_ERROR_CODES.MEDIA_UNAVAILABLE,
    "Profile media is temporarily unavailable",
    {
      details: options.details,
      headers: {
        "retry-after": String(
          options.retryAfterSeconds ?? PROFILE_MEDIA_RETRY_AFTER_SECONDS
        )
      }
    }
  );
}

export function isProfileBackendError(error) {
  return error instanceof ProfileBackendError;
}
