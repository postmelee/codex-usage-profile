import assert from "node:assert/strict";
import test from "node:test";

import {
  OAUTH_STATE_STATUS,
  PROFILE_BACKEND_ERROR_CODES,
  PROFILE_VISIBILITY,
  ProfileBackendError,
  createMemoryProfileBackendStore,
  createOAuthRuntimeService,
  resolveCallbackUrl
} from "../index.js";

test("starts GitHub login and stores a pending OAuth state", async () => {
  const { service, store } = createFixture();

  const { authorizationUrl, oauthState } = await service.startGitHubLogin({
    cliLoginChallengeId: "cli_login_1",
    redirectTo: "/u/postmelee"
  });
  const url = new URL(authorizationUrl);

  assert.equal(oauthState.id, "oauth_state_1");
  assert.equal(oauthState.status, OAUTH_STATE_STATUS.PENDING);
  assert.equal(oauthState.cliLoginChallengeId, "cli_login_1");
  assert.equal(oauthState.redirectTo, "/u/postmelee");
  assert.equal(oauthState.expiresAt, "2026-06-08T00:10:00.000Z");
  assert.deepEqual(store.getOAuthState(oauthState.id), oauthState);
  assert.equal(url.origin + url.pathname, "https://github.com/login/oauth/authorize");
  assert.equal(url.searchParams.get("client_id"), "github_client_1");
  assert.equal(url.searchParams.get("redirect_uri"), "https://profiles.example.test/api/auth/github/callback");
  assert.equal(url.searchParams.get("scope"), "read:user");
  assert.equal(url.searchParams.get("state"), "oauth_state_1");
});

test("completes GitHub callback, consumes state, upserts owner, and creates session", async () => {
  const { service, store, githubCalls } = createFixture();
  const { oauthState } = await service.startGitHubLogin();

  const result = await service.completeGitHubCallback({
    code: "oauth_code_1",
    state: oauthState.id,
    visibility: PROFILE_VISIBILITY.PUBLIC
  });
  const storedState = store.getOAuthState(oauthState.id);
  const storedSession = store.getSession(result.session.id);
  const serializedStoreRecords = JSON.stringify({
    owner: store.getOwnerById(result.owner.id),
    state: storedState,
    session: storedSession
  });

  assert.equal(result.owner.id, "owner_github_12345");
  assert.equal(result.owner.handle, "postmelee");
  assert.equal(result.owner.visibility, PROFILE_VISIBILITY.PUBLIC);
  assert.equal(result.session.id, "session_2");
  assert.equal(result.sessionCookie.includes("cup_session=session_2"), true);
  assert.equal(storedState.status, OAUTH_STATE_STATUS.CONSUMED);
  assert.equal(storedState.ownerId, result.owner.id);
  assert.equal(storedState.sessionId, result.session.id);
  assert.deepEqual(githubCalls, [
    ["exchange", "oauth_code_1"],
    ["user", "gho_1234567890abcdefghijklmnopqrstuv"]
  ]);
  assert.equal(serializedStoreRecords.includes("gho_1234567890abcdefghijklmnopqrstuv"), false);
});

test("rejects replayed and expired OAuth states", async () => {
  const fixture = createFixture();
  const { service, store } = fixture;
  const { oauthState } = await service.startGitHubLogin();

  await service.completeGitHubCallback({
    code: "oauth_code_1",
    state: oauthState.id
  });

  await assertBackendRejects(
    () => service.completeGitHubCallback({
      code: "oauth_code_1",
      state: oauthState.id
    }),
    PROFILE_BACKEND_ERROR_CODES.GONE
  );

  const expired = (await service.startGitHubLogin()).oauthState;
  fixture.setNow(new Date("2026-06-08T00:10:00.000Z"));

  await assertBackendRejects(
    () => service.completeGitHubCallback({
      code: "oauth_code_2",
      state: expired.id
    }),
    PROFILE_BACKEND_ERROR_CODES.EXPIRED
  );
  assert.equal(store.getOAuthState(expired.id).status, OAUTH_STATE_STATUS.EXPIRED);
});

test("validates callback inputs and resolves callback URLs", async () => {
  const { service } = createFixture();
  const { oauthState } = await service.startGitHubLogin();

  await assertBackendRejects(
    () => service.completeGitHubCallback({
      code: "",
      state: oauthState.id
    }),
    PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST
  );
  await assertBackendRejects(
    () => service.completeGitHubCallback({
      code: "oauth_code_1",
      state: "missing"
    }),
    PROFILE_BACKEND_ERROR_CODES.UNAUTHORIZED
  );
  assert.equal(
    resolveCallbackUrl("https://profiles.example.test/app", "/callback"),
    "https://profiles.example.test/callback"
  );
});

test("logs out through the session service", async () => {
  const { service } = createFixture();
  const { oauthState } = await service.startGitHubLogin();
  const result = await service.completeGitHubCallback({
    code: "oauth_code_1",
    state: oauthState.id
  });

  const logout = await service.logout({ cookieHeader: result.sessionCookie });

  assert.equal(logout.session.id, result.session.id);
  assert.equal(logout.session.revokedAt, "2026-06-08T00:00:00.000Z");
  assert.equal(logout.cookie.includes("Max-Age=0"), true);
});

function createFixture() {
  const store = createMemoryProfileBackendStore();
  let current = new Date("2026-06-08T00:00:00.000Z");
  const githubCalls = [];
  const service = createOAuthRuntimeService({
    store,
    now: () => current,
    createId: createIdFactory(),
    githubClientId: "github_client_1",
    publicBaseUrl: "https://profiles.example.test",
    githubClient: {
      async exchangeCodeForToken(code) {
        githubCalls.push(["exchange", code]);
        return { accessToken: "gho_1234567890abcdefghijklmnopqrstuv" };
      },
      async getAuthenticatedUser(accessToken) {
        githubCalls.push(["user", accessToken]);
        return {
          id: 12345,
          login: "postmelee",
          name: "Post Melee",
          avatar_url: "https://avatars.githubusercontent.com/u/12345",
          html_url: "https://github.com/postmelee"
        };
      }
    }
  });

  return {
    service,
    store,
    githubCalls,
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

async function assertBackendRejects(callback, code) {
  await assert.rejects(async () => callback(), (error) => {
    assert.equal(error instanceof ProfileBackendError, true);
    assert.equal(error.code, code);
    return true;
  });
}
