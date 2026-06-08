import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTH_PROVIDERS,
  PROFILE_BACKEND_ERROR_CODES,
  PROFILE_VISIBILITY,
  ProfileBackendError,
  createAccountService,
  createMemoryProfileBackendStore,
  normalizeGitHubIdentity,
  resolveGitHubIdentityFromCode,
  slugifyHandleCandidate
} from "../index.js";

const fixedNow = () => new Date("2026-06-08T00:00:00.000Z");

test("normalizes a GitHub identity payload without copying OAuth tokens", () => {
  const identity = normalizeGitHubIdentity({
    id: 12345,
    login: "postmelee",
    name: "Post Melee",
    avatar_url: "https://avatars.githubusercontent.com/u/12345",
    html_url: "https://github.com/postmelee",
    access_token: "gho_1234567890abcdefghijklmnopqrstuv"
  });

  assert.deepEqual(identity, {
    authProvider: AUTH_PROVIDERS.GITHUB,
    providerUserId: "12345",
    githubLogin: "postmelee",
    displayName: "Post Melee",
    avatarUrl: "https://avatars.githubusercontent.com/u/12345",
    profileUrl: "https://github.com/postmelee"
  });
  assert.equal(Object.hasOwn(identity, "access_token"), false);
});

test("resolves a GitHub identity through a fake client seam", async () => {
  const calls = [];
  const identity = await resolveGitHubIdentityFromCode({
    code: "oauth_code_1",
    githubClient: {
      async exchangeCodeForToken(code) {
        calls.push(["exchange", code]);
        return { accessToken: "gho_1234567890abcdefghijklmnopqrstuv" };
      },
      async getAuthenticatedUser(accessToken) {
        calls.push(["user", accessToken]);
        return { id: "12345", login: "postmelee" };
      }
    }
  });

  assert.deepEqual(calls, [
    ["exchange", "oauth_code_1"],
    ["user", "gho_1234567890abcdefghijklmnopqrstuv"]
  ]);
  assert.equal(identity.providerUserId, "12345");
  assert.equal(identity.githubLogin, "postmelee");
});

test("rejects invalid GitHub identity and callback inputs", async () => {
  assertBackendError(
    () => normalizeGitHubIdentity({ id: 12345 }),
    PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST
  );

  await assert.rejects(
    () => resolveGitHubIdentityFromCode({ code: "", githubClient: {} }),
    (error) => {
      assert.equal(error instanceof ProfileBackendError, true);
      assert.equal(error.code, PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST);
      return true;
    }
  );
});

test("upserts GitHub owners idempotently by provider identity", () => {
  const store = createMemoryProfileBackendStore();
  const accounts = createAccountService({ store, now: fixedNow });

  const first = accounts.upsertGitHubOwner({
    id: 12345,
    login: "postmelee",
    name: "Post Melee"
  });
  const second = accounts.upsertGitHubOwner({
    id: 12345,
    login: "postmelee-renamed",
    name: "Post Melee Updated"
  });

  assert.equal(first.id, "owner_github_12345");
  assert.equal(first.handle, "postmelee");
  assert.equal(first.visibility, PROFILE_VISIBILITY.PRIVATE);
  assert.equal(second.id, first.id);
  assert.equal(second.handle, first.handle);
  assert.equal(second.githubLogin, "postmelee-renamed");
  assert.equal(second.displayName, "Post Melee Updated");
  assert.equal(store.listOwners().length, 1);
});

test("assigns deterministic handles when GitHub logins collide", () => {
  const store = createMemoryProfileBackendStore();
  const accounts = createAccountService({ store, now: fixedNow });

  accounts.upsertGitHubOwner({ id: 1, login: "postmelee" });
  accounts.upsertGitHubOwner({ id: 2, login: "postmelee" });
  const third = accounts.upsertGitHubOwner({ id: 3, login: "postmelee" });

  assert.equal(store.getOwnerByProviderIdentity("github", "1").handle, "postmelee");
  assert.equal(store.getOwnerByProviderIdentity("github", "2").handle, "postmelee-2");
  assert.equal(third.handle, "postmelee-3");
});

test("normalizes requested handles and reserves suffixes", () => {
  const store = createMemoryProfileBackendStore();
  const accounts = createAccountService({ store, now: fixedNow });

  accounts.upsertGitHubOwner({ id: 1, login: "one" }, { handle: "Melee" });
  const second = accounts.upsertGitHubOwner(
    { id: 2, login: "two" },
    { handle: "melee" }
  );

  assert.equal(second.handle, "melee-2");
  assert.equal(slugifyHandleCandidate("  Post Melee!!  "), "post-melee");
  assert.equal(slugifyHandleCandidate(""), "user");
});

test("validates owner visibility", () => {
  const store = createMemoryProfileBackendStore();
  const accounts = createAccountService({ store, now: fixedNow });

  assertBackendError(
    () => accounts.upsertGitHubOwner(
      { id: 12345, login: "postmelee" },
      { visibility: "team-only" }
    ),
    PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED
  );
});

function assertBackendError(callback, code) {
  assert.throws(callback, (error) => {
    assert.equal(error instanceof ProfileBackendError, true);
    assert.equal(error.code, code);
    return true;
  });
}
