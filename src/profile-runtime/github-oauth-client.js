export const DEFAULT_GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
export const DEFAULT_GITHUB_USER_URL = "https://api.github.com/user";
export const DEFAULT_GITHUB_USER_AGENT = "codex-usage-profile";

export class GitHubOAuthClientError extends Error {
  constructor(message, options = {}) {
    super(message);

    this.name = "GitHubOAuthClientError";
    this.status = options.status ?? 0;
    this.responseBody = options.responseBody ?? null;
  }
}

export function createGitHubOAuthClient(options = {}) {
  const {
    clientId,
    clientSecret,
    fetchImpl = globalThis.fetch,
    tokenUrl = DEFAULT_GITHUB_TOKEN_URL,
    userUrl = DEFAULT_GITHUB_USER_URL
  } = options;
  const normalizedClientId = requireNonEmptyString(clientId, "clientId");
  const normalizedClientSecret = requireNonEmptyString(clientSecret, "clientSecret");

  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetch implementation is required");
  }

  return {
    async exchangeCodeForToken(code) {
      const response = await fetchImpl(tokenUrl, {
        body: JSON.stringify({
          client_id: normalizedClientId,
          client_secret: normalizedClientSecret,
          code: requireNonEmptyString(code, "code")
        }),
        headers: {
          accept: "application/json",
          "content-type": "application/json"
        },
        method: "POST"
      });
      const body = await readJsonResponse(response, "GitHub token exchange");

      if (!response.ok || body?.error) {
        throw createGitHubError("GitHub token exchange failed", response, body);
      }

      const accessToken = requireResponseString(
        body?.access_token,
        "GitHub token exchange did not return an access token"
      );

      return {
        accessToken,
        tokenType: normalizeOptionalString(body.token_type),
        scope: normalizeOptionalString(body.scope)
      };
    },

    async getAuthenticatedUser(accessToken) {
      const response = await fetchImpl(userUrl, {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${requireNonEmptyString(accessToken, "accessToken")}`,
          "user-agent": DEFAULT_GITHUB_USER_AGENT,
          "x-github-api-version": "2022-11-28"
        },
        method: "GET"
      });
      const body = await readJsonResponse(response, "GitHub user lookup");

      if (!response.ok) {
        throw createGitHubError("GitHub user lookup failed", response, body);
      }

      return body;
    }
  };
}

async function readJsonResponse(response, label) {
  try {
    return await response.json();
  } catch {
    throw new GitHubOAuthClientError(`${label} response JSON is invalid`, {
      status: response.status
    });
  }
}

function createGitHubError(message, response, body) {
  const githubMessage = normalizeOptionalString(body?.error_description) ||
    normalizeOptionalString(body?.message) ||
    normalizeOptionalString(body?.error);

  return new GitHubOAuthClientError(
    githubMessage ? `${message}: ${githubMessage}` : message,
    {
      responseBody: body,
      status: response.status
    }
  );
}

function requireResponseString(value, message) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new GitHubOAuthClientError(message);
  }

  return value.trim();
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty string`);
  }

  return value.trim();
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }

  return value.trim() || null;
}
