export class ProfileApiError extends Error {
  constructor(message, options = {}) {
    super(message);

    this.name = "ProfileApiError";
    this.code = options.code ?? "request_failed";
    this.responseBody = options.responseBody ?? null;
    this.status = options.status ?? 0;
  }
}

export function createProfileApiClient(options = {}) {
  const {
    baseUrl = "",
    fetchImpl = globalThis.fetch
  } = options;

  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetch implementation is required");
  }

  return {
    buildGitHubLoginUrl(loginOptions = {}) {
      return buildGitHubLoginUrl(baseUrl, loginOptions);
    },

    async getCurrentAccount() {
      const response = await fetchImpl(buildApiUrl(baseUrl, "/api/auth/me"), {
        credentials: "same-origin",
        headers: {
          accept: "application/json"
        }
      });

      if (response.status === 401) {
        return null;
      }

      const envelope = await readApiEnvelope(response);
      return {
        owner: envelope.data.owner,
        session: envelope.data.session
      };
    },

    async getPublicSnapshot(handle) {
      const normalizedHandle = requireHandle(handle);
      const response = await fetchImpl(
        buildApiUrl(baseUrl, `/api/snapshots/public/${encodeURIComponent(normalizedHandle)}`),
        {
          headers: {
            accept: "application/json"
          }
        }
      );

      if (response.status === 404) {
        return null;
      }

      const envelope = await readApiEnvelope(response);
      return envelope.data.snapshot;
    },

    async submitSnapshot(options = {}) {
      const token = requireToken(options.token);
      const response = await fetchImpl(
        buildApiUrl(baseUrl, "/api/snapshots/submit"),
        {
          body: JSON.stringify(options.payload ?? {}),
          headers: {
            accept: "application/json",
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
          },
          method: "POST"
        }
      );
      const envelope = await readApiEnvelope(response);

      return envelope.data.snapshot;
    },

    async logout() {
      const response = await fetchImpl(buildApiUrl(baseUrl, "/api/auth/logout"), {
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "content-type": "application/json"
        },
        method: "POST"
      });
      const envelope = await readApiEnvelope(response);

      return {
        session: envelope.data.session
      };
    }
  };
}

export function buildApiUrl(baseUrl, path) {
  if (!baseUrl) {
    return path;
  }

  return new URL(path, ensureTrailingSlash(baseUrl)).toString();
}

export function buildGitHubLoginUrl(baseUrl = "", options = {}) {
  const url = new URL(
    buildApiUrl(baseUrl, "/api/auth/github/login"),
    "http://localhost"
  );
  const cliLoginChallengeId = normalizeOptionalString(
    options.cliLoginChallengeId,
    "cliLoginChallengeId"
  );
  const redirectTo = normalizeOptionalString(options.redirectTo, "redirectTo");

  if (cliLoginChallengeId) {
    url.searchParams.set("cli_login_challenge", cliLoginChallengeId);
  }

  if (redirectTo) {
    url.searchParams.set("redirect_to", redirectTo);
  }

  if (baseUrl) {
    return url.toString();
  }

  return `${url.pathname}${url.search}`;
}

async function readApiEnvelope(response) {
  const body = await readJsonResponse(response);

  if (!response.ok) {
    throw createErrorFromResponse(response, body);
  }

  if (!body || body.ok !== true || !body.data) {
    throw new ProfileApiError("API response envelope is invalid", {
      responseBody: body,
      status: response.status
    });
  }

  return body;
}

async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    if (!response.ok) {
      return null;
    }

    throw new ProfileApiError("API response must be JSON", {
      status: response.status
    });
  }

  try {
    return await response.json();
  } catch {
    throw new ProfileApiError("API response JSON is invalid", {
      status: response.status
    });
  }
}

function createErrorFromResponse(response, body) {
  const apiError = body?.error;

  return new ProfileApiError(
    apiError?.message ?? `API request failed with status ${response.status}`,
    {
      code: apiError?.code,
      responseBody: body,
      status: response.status
    }
  );
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function requireHandle(handle) {
  if (typeof handle !== "string" || handle.trim() === "") {
    throw new ProfileApiError("Profile handle is required", {
      code: "validation_failed"
    });
  }

  return handle.trim();
}

function requireToken(token) {
  if (typeof token !== "string" || token.trim() === "") {
    throw new ProfileApiError("Bearer token is required", {
      code: "validation_failed"
    });
  }

  return token.trim();
}

function normalizeOptionalString(value, label) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || value.trim() === "") {
    throw new ProfileApiError(`${label} must be a non-empty string`, {
      code: "validation_failed"
    });
  }

  return value.trim();
}
