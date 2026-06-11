import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  CLI_TOKEN_PREFIX,
  OAUTH_STATE_STATUS,
  PROFILE_BACKEND_ERROR_CODES,
  PROFILE_VISIBILITY,
  ProfileBackendError,
  createCliTokenService,
  createCliTokenDigest,
  createFileProfileBackendStore,
  createOAuthRuntimeService,
  createSnapshotSubmitService,
  readStoreState
} from "../index.js";
import { sampleProfileSnapshot } from "../../profile-snapshot/fixtures/sample-snapshot.js";

test("persists owner, OAuth state, session, CLI token digest, and latest snapshot", async () => {
  const filePath = createTempStorePath();
  const rawCliToken = `${CLI_TOKEN_PREFIX}raw_test_token`;
  const rawGitHubToken = "gho_1234567890abcdefghijklmnopqrstuv";
  const firstStore = createFileProfileBackendStore({ filePath });
  let current = new Date("2026-06-08T00:00:00.000Z");
  const oauth = createOAuthRuntimeService({
    store: firstStore,
    now: () => current,
    createId: createIdFactory(),
    githubClientId: "github_client_1",
    publicBaseUrl: "https://profiles.example.test",
    githubClient: {
      async exchangeCodeForToken() {
        return { accessToken: rawGitHubToken };
      },
      async getAuthenticatedUser() {
        return {
          id: 12345,
          login: "postmelee",
          name: "Post Melee"
        };
      }
    }
  });

  const { oauthState } = oauth.startGitHubLogin();
  const login = await oauth.completeGitHubCallback({
    code: "oauth_code_1",
    state: oauthState.id,
    visibility: PROFILE_VISIBILITY.PUBLIC
  });
  const tokenService = createCliTokenService({
    store: firstStore,
    now: () => current,
    createId: createIdFactory("token"),
    createToken: () => rawCliToken
  });
  const { token } = tokenService.issueCliToken({
    ownerId: login.owner.id
  });
  const snapshots = createSnapshotSubmitService({
    store: firstStore,
    now: () => new Date("2026-06-08T00:01:00.000Z"),
    tokenService
  });

  snapshots.submitSnapshot({
    token,
    payload: {
      snapshot: sampleProfileSnapshot,
      capturedAt: sampleProfileSnapshot.capturedAt,
      visibility: PROFILE_VISIBILITY.PUBLIC
    }
  });

  const storedFile = readFileSync(filePath, "utf8");
  const reopenedStore = createFileProfileBackendStore({ filePath });

  assert.equal(storedFile.includes(rawCliToken), false);
  assert.equal(storedFile.includes(rawGitHubToken), false);
  assert.equal(reopenedStore.getOwnerById(login.owner.id).handle, "postmelee");
  assert.equal(
    reopenedStore.getOAuthState(oauthState.id).status,
    OAUTH_STATE_STATUS.CONSUMED
  );
  assert.equal(reopenedStore.getSession(login.session.id).ownerId, login.owner.id);
  assert.equal(reopenedStore.getCliTokenByDigest(
    createCliTokenDigest(rawCliToken)
  ).ownerId, login.owner.id);
  assert.equal(
    reopenedStore.getLatestSnapshotByHandle("postmelee").snapshot.profile.username,
    sampleProfileSnapshot.profile.username
  );
});

test("persists mutating operations and preserves conflict behavior", () => {
  const filePath = createTempStorePath();
  const store = createFileProfileBackendStore({ filePath, createIfMissing: true });
  const owner = createOwner();

  store.saveOwner(owner);
  store.saveCliToken({
    id: "cli_token_1",
    ownerId: owner.id,
    tokenDigest: "digest_1"
  });
  store.saveCliToken({
    id: "cli_token_1",
    ownerId: owner.id,
    tokenDigest: "digest_2"
  });

  const reopenedStore = createFileProfileBackendStore({ filePath });

  assert.equal(reopenedStore.getCliTokenByDigest("digest_1"), null);
  assert.equal(reopenedStore.getCliTokenByDigest("digest_2").id, "cli_token_1");
  assertBackendError(
    () => reopenedStore.saveOwner({
      ...createOwner({ id: "owner_2" }),
      providerUserId: owner.providerUserId,
      handle: "other"
    }),
    PROFILE_BACKEND_ERROR_CODES.CONFLICT
  );

  reopenedStore.deleteCliToken("cli_token_1");

  const afterDeleteStore = createFileProfileBackendStore({ filePath });
  assert.equal(afterDeleteStore.getCliTokenByDigest("digest_2"), null);
});

test("returns cloned records from reopened durable state", () => {
  const filePath = createTempStorePath();
  const store = createFileProfileBackendStore({ filePath });

  store.saveOwner(createOwner());

  const reopenedStore = createFileProfileBackendStore({ filePath });
  const owner = reopenedStore.getOwnerById("owner_1");
  owner.handle = "changed";

  assert.equal(reopenedStore.getOwnerById("owner_1").handle, "postmelee");
});

test("validates durable store file inputs", () => {
  assertBackendError(
    () => createFileProfileBackendStore({ filePath: "" }),
    PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED
  );

  const invalidJsonPath = createTempStorePath();
  writeFileSync(invalidJsonPath, "{not-json", "utf8");

  assertBackendError(
    () => readStoreState(invalidJsonPath),
    PROFILE_BACKEND_ERROR_CODES.INVALID_REQUEST
  );

  const invalidStatePath = createTempStorePath();
  writeFileSync(invalidStatePath, JSON.stringify({ schemaVersion: 999 }), "utf8");

  assertBackendError(
    () => createFileProfileBackendStore({ filePath: invalidStatePath }),
    PROFILE_BACKEND_ERROR_CODES.VALIDATION_FAILED
  );
});

function createTempStorePath() {
  return join(mkdtempSync(join(tmpdir(), "cup-store-")), "store.json");
}

function createOwner(overrides = {}) {
  return {
    id: "owner_1",
    authProvider: "github",
    providerUserId: "12345",
    githubLogin: "postmelee",
    handle: "postmelee",
    visibility: PROFILE_VISIBILITY.PUBLIC,
    ...overrides
  };
}

function createIdFactory(label = "id") {
  let nextId = 1;
  return (prefix) => {
    const id = `${prefix}_${label}_${nextId}`;
    nextId += 1;
    return id;
  };
}

function assertBackendError(callback, code) {
  assert.throws(callback, (error) => {
    assert.equal(error instanceof ProfileBackendError, true);
    assert.equal(error.code, code);
    return true;
  });
}
