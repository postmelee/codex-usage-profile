export const PROFILE_BACKEND_ERROR_CODES = Object.freeze({
  CONFLICT: "conflict",
  EXPIRED: "expired",
  FORBIDDEN: "forbidden",
  FORBIDDEN_SECRET: "forbidden_secret",
  GONE: "gone",
  INVALID_REQUEST: "invalid_request",
  NOT_FOUND: "not_found",
  RATE_LIMITED: "rate_limited",
  UNAUTHORIZED: "unauthorized",
  VALIDATION_FAILED: "validation_failed"
});

const DEFAULT_STATUS_BY_CODE = {
  [PROFILE_BACKEND_ERROR_CODES.CONFLICT]: 409,
  [PROFILE_BACKEND_ERROR_CODES.EXPIRED]: 410,
  [PROFILE_BACKEND_ERROR_CODES.FORBIDDEN]: 403,
  [PROFILE_BACKEND_ERROR_CODES.FORBIDDEN_SECRET]: 400,
  [PROFILE_BACKEND_ERROR_CODES.GONE]: 410,
  [PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST]: 400,
  [PROFILE_BACKEND_ERROR_CODES.NOT_FOUND]: 404,
  [PROFILE_BACKEND_ERROR_CODES.RATE_LIMITED]: 429,
  [PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED]: 401,
  [PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED]: 400
};

export class ProfileBackendError extends Error {
  constructor(code, message, options = {}) {
    super(message);

    this.name = "ProfileBackendError";
    this.code = code;
    this.details = options.details ?? null;
    this.headers = options.headers ?? null;
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

export function isProfileBackendError(error) {
  return error instanceof ProfileBackendError;
}
