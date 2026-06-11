import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_GITHUB_TOKEN_URL,
  DEFAULT_GITHUB_USER_URL,
  GitHubOAuthClientError,
  createGitHubOAuthClient
} from "../github-oauth-client.js";

test("exchanges a GitHub authorization code and loads the authenticated user", async () => {
  const requests = [];
  const client = createGitHubOAuthClient({
    clientId: "github_client_1",
    clientSecret: "github_secret_1",
    fetchImpl: async (url, options) => {
      requests.push({ url, options });

      if (url === DEFAULT_GITHUB_TOKEN_URL) {
        return jsonResponse({
          access_token: "gho_test_access_token",
          scope: "read:user",
          token_type: "bearer"
        });
      }

      return jsonResponse({
        id: 12345,
        login: "postmelee",
        name: "Post Melee"
      });
    }
  });

  const token = await client.exchangeCodeForToken("oauth_code_1");
  const user = await client.getAuthenticatedUser(token.accessToken);

  assert.deepEqual(token, {
    accessToken: "gho_test_access_token",
    scope: "read:user",
    tokenType: "bearer"
  });
  assert.deepEqual(user, {
    id: 12345,
    login: "postmelee",
    name: "Post Melee"
  });
  assert.equal(requests[0].url, DEFAULT_GITHUB_TOKEN_URL);
  assert.equal(requests[0].options.method, "POST");
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    client_id: "github_client_1",
    client_secret: "github_secret_1",
    code: "oauth_code_1"
  });
  assert.equal(requests[0].options.headers.accept, "application/json");
  assert.equal(requests[1].url, DEFAULT_GITHUB_USER_URL);
  assert.equal(requests[1].options.method, "GET");
  assert.equal(requests[1].options.headers.authorization, "Bearer gho_test_access_token");
  assert.equal(requests[1].options.headers.accept, "application/vnd.github+json");
});

test("surfaces GitHub token exchange errors without leaking the client secret", async () => {
  const client = createGitHubOAuthClient({
    clientId: "github_client_1",
    clientSecret: "github_secret_should_not_be_in_error",
    fetchImpl: async () => jsonResponse({
      error: "bad_verification_code",
      error_description: "The code passed is incorrect or expired."
    }, { status: 400 })
  });

  await assert.rejects(
    () => client.exchangeCodeForToken("expired_code"),
    (error) => {
      assert.equal(error instanceof GitHubOAuthClientError, true);
      assert.equal(error.status, 400);
      assert.match(error.message, /GitHub token exchange failed/);
      assert.doesNotMatch(error.message, /github_secret_should_not_be_in_error/);
      return true;
    }
  );
});

test("rejects token exchange responses without access tokens", async () => {
  const client = createGitHubOAuthClient({
    clientId: "github_client_1",
    clientSecret: "github_secret_1",
    fetchImpl: async () => jsonResponse({
      scope: "read:user",
      token_type: "bearer"
    })
  });

  await assert.rejects(
    () => client.exchangeCodeForToken("oauth_code_1"),
    (error) => {
      assert.equal(error instanceof GitHubOAuthClientError, true);
      assert.equal(error.message, "GitHub token exchange did not return an access token");
      return true;
    }
  );
});

test("rejects GitHub user lookup HTTP errors", async () => {
  const client = createGitHubOAuthClient({
    clientId: "github_client_1",
    clientSecret: "github_secret_1",
    fetchImpl: async () => jsonResponse({
      message: "Bad credentials"
    }, { status: 401 })
  });

  await assert.rejects(
    () => client.getAuthenticatedUser("gho_invalid_token"),
    (error) => {
      assert.equal(error instanceof GitHubOAuthClientError, true);
      assert.equal(error.status, 401);
      assert.match(error.message, /GitHub user lookup failed/);
      return true;
    }
  );
});

test("validates constructor and method inputs", async () => {
  assert.throws(
    () => createGitHubOAuthClient({ clientId: "", clientSecret: "secret" }),
    /clientId must be a non-empty string/
  );
  assert.throws(
    () => createGitHubOAuthClient({ clientId: "client", clientSecret: "" }),
    /clientSecret must be a non-empty string/
  );
  assert.throws(
    () => createGitHubOAuthClient({
      clientId: "client",
      clientSecret: "secret",
      fetchImpl: null
    }),
    /fetch implementation is required/
  );

  const client = createGitHubOAuthClient({
    clientId: "client",
    clientSecret: "secret",
    fetchImpl: async () => jsonResponse({})
  });

  await assert.rejects(
    () => client.exchangeCodeForToken(""),
    /code must be a non-empty string/
  );
  await assert.rejects(
    () => client.getAuthenticatedUser(""),
    /accessToken must be a non-empty string/
  );
});

function jsonResponse(body, options = {}) {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: {
      "content-type": "application/json"
    }
  });
}
