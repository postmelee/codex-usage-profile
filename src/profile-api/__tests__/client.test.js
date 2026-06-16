import assert from "node:assert/strict";
import test from "node:test";

import {
  ProfileApiError,
  buildApiUrl,
  buildGitHubLoginUrl,
  createProfileApiClient
} from "../client.js";
import { sampleProfileSnapshot } from "../../profile-snapshot/fixtures/sample-snapshot.js";

test("loads the current account with session credentials", async () => {
  const requests = [];
  const client = createProfileApiClient({
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return jsonResponse({
        ok: true,
        data: {
          owner: {
            id: "owner_1",
            handle: "postmelee",
            githubLogin: "postmelee"
          },
          session: {
            id: "session_1",
            ownerId: "owner_1"
          }
        }
      });
    }
  });

  const account = await client.getCurrentAccount();

  assert.equal(requests[0].url, "/api/auth/me");
  assert.equal(requests[0].options.credentials, "same-origin");
  assert.equal(requests[0].options.headers.accept, "application/json");
  assert.equal(account.owner.handle, "postmelee");
  assert.equal(account.session.ownerId, "owner_1");
});

test("returns null when current account has no valid session", async () => {
  const client = createProfileApiClient({
    fetchImpl: async () => jsonResponse({
      ok: false,
      error: {
        code: "unauthorized",
        message: "Session cookie is required"
      }
    }, { status: 401 })
  });

  assert.equal(await client.getCurrentAccount(), null);
});

test("loads a public snapshot from the API envelope", async () => {
  const requests = [];
  const client = createProfileApiClient({
    baseUrl: "https://profiles.example.test/app",
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return jsonResponse({
        ok: true,
        data: {
          snapshot: {
            handle: "postmelee",
            snapshot: sampleProfileSnapshot
          }
        }
      });
    }
  });

  const record = await client.getPublicSnapshot("postmelee");

  assert.equal(requests[0].url, "https://profiles.example.test/api/snapshots/public/postmelee");
  assert.equal(requests[0].options.headers.accept, "application/json");
  assert.equal(record.handle, "postmelee");
  assert.deepEqual(record.snapshot, sampleProfileSnapshot);
});

test("returns null for public snapshot not found", async () => {
  const client = createProfileApiClient({
    fetchImpl: async () => jsonResponse({
      ok: false,
      error: {
        code: "not_found",
        message: "Snapshot not found"
      }
    }, { status: 404 })
  });

  assert.equal(await client.getPublicSnapshot("missing"), null);
});

test("submits snapshots with bearer auth and JSON body", async () => {
  const requests = [];
  const client = createProfileApiClient({
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return jsonResponse({
        ok: true,
        data: {
          snapshot: {
            handle: "postmelee",
            snapshot: sampleProfileSnapshot
          }
        }
      }, { status: 201 });
    }
  });
  const payload = {
    snapshot: sampleProfileSnapshot,
    capturedAt: sampleProfileSnapshot.capturedAt
  };

  const record = await client.submitSnapshot({
    token: "cup_test_token",
    payload
  });

  assert.equal(requests[0].url, "/api/snapshots/submit");
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].options.headers.authorization, "Bearer cup_test_token");
  assert.deepEqual(JSON.parse(requests[0].options.body), payload);
  assert.equal(record.handle, "postmelee");
});

test("logs out with session credentials", async () => {
  const requests = [];
  const client = createProfileApiClient({
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return jsonResponse({
        ok: true,
        data: {
          session: {
            id: "session_1",
            ownerId: "owner_1",
            revokedAt: "2026-06-10T00:00:00.000Z"
          }
        }
      });
    }
  });

  const result = await client.logout();

  assert.equal(requests[0].url, "/api/auth/logout");
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].options.credentials, "same-origin");
  assert.equal(requests[0].options.headers["content-type"], "application/json");
  assert.equal(result.session.revokedAt, "2026-06-10T00:00:00.000Z");
});

test("authorizes device login with session credentials", async () => {
  const requests = [];
  const client = createProfileApiClient({
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return jsonResponse({
        ok: true,
        data: {
          challenge: {
            id: "cli_login_1",
            ownerId: "owner_1",
            status: "approved"
          },
          status: "approved"
        }
      });
    }
  });

  const result = await client.authorizeDeviceLogin({
    userCode: "ABCD-1234"
  });

  assert.equal(requests[0].url, "/api/auth/device/authorize");
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].options.credentials, "same-origin");
  assert.equal(requests[0].options.headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    userCode: "ABCD-1234"
  });
  assert.equal(result.status, "approved");
  assert.equal(result.challenge.ownerId, "owner_1");
});

test("manages settings tokens with session credentials", async () => {
  const requests = [];
  const client = createProfileApiClient({
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      if (url === "/api/settings/tokens" && options.method === "POST") {
        return jsonResponse({
          ok: true,
          data: {
            token: "cup_raw_token",
            tokenRecord: {
              id: "cli_token_1",
              label: "CI token"
            }
          }
        }, { status: 201 });
      }
      if (url === "/api/settings/tokens/cli_token_1" && options.method === "DELETE") {
        return jsonResponse({
          ok: true,
          data: {
            tokenRecord: {
              id: "cli_token_1",
              label: "CI token",
              revokedAt: "2026-06-10T00:00:00.000Z"
            }
          }
        });
      }
      return jsonResponse({
        ok: true,
        data: {
          tokens: [
            {
              id: "cli_token_1",
              label: "CI token"
            }
          ]
        }
      });
    }
  });

  const tokens = await client.listSettingsTokens();
  const created = await client.createSettingsToken({ label: "CI token" });
  const revoked = await client.revokeSettingsToken("cli_token_1");

  assert.equal(requests[0].url, "/api/settings/tokens");
  assert.equal(requests[0].options.credentials, "same-origin");
  assert.equal(requests[0].options.headers.accept, "application/json");

  assert.equal(requests[1].url, "/api/settings/tokens");
  assert.equal(requests[1].options.method, "POST");
  assert.equal(requests[1].options.credentials, "same-origin");
  assert.equal(requests[1].options.headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    label: "CI token"
  });

  assert.equal(requests[2].url, "/api/settings/tokens/cli_token_1");
  assert.equal(requests[2].options.method, "DELETE");
  assert.equal(requests[2].options.credentials, "same-origin");

  assert.equal(tokens[0].id, "cli_token_1");
  assert.equal(created.token, "cup_raw_token");
  assert.equal(created.tokenRecord.id, "cli_token_1");
  assert.equal(revoked.revokedAt, "2026-06-10T00:00:00.000Z");
});

test("surfaces settings token limit errors with code and status", async () => {
  const client = createProfileApiClient({
    fetchImpl: async () => jsonResponse({
      ok: false,
      error: {
        code: "conflict",
        message: "Active CLI token limit reached"
      }
    }, { status: 409 })
  });

  await assert.rejects(
    () => client.createSettingsToken({ label: "CI token" }),
    (error) => {
      assert.equal(error instanceof ProfileApiError, true);
      assert.equal(error.code, "conflict");
      assert.equal(error.status, 409);
      assert.equal(error.message, "Active CLI token limit reached");
      return true;
    }
  );
});

test("manages settings devices with session credentials", async () => {
  const requests = [];
  const client = createProfileApiClient({
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      if (url === "/api/settings/devices/device_1" && options.method === "PATCH") {
        return jsonResponse({
          ok: true,
          data: {
            device: {
              id: "device_1",
              deviceKey: "machine-1",
              displayName: "Desk Mac",
              customName: "Desk Mac"
            }
          }
        });
      }
      return jsonResponse({
        ok: true,
        data: {
          devices: [
            {
              id: "device_1",
              deviceKey: "machine-1",
              displayName: "Office Mac",
              customName: "Office Mac"
            }
          ]
        }
      });
    }
  });

  const devices = await client.listSettingsDevices();
  const renamed = await client.renameSettingsDevice("device_1", "Desk Mac");

  assert.equal(requests[0].url, "/api/settings/devices");
  assert.equal(requests[0].options.credentials, "same-origin");
  assert.equal(requests[0].options.headers.accept, "application/json");

  assert.equal(requests[1].url, "/api/settings/devices/device_1");
  assert.equal(requests[1].options.method, "PATCH");
  assert.equal(requests[1].options.credentials, "same-origin");
  assert.equal(requests[1].options.headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    name: "Desk Mac"
  });

  assert.equal(devices[0].displayName, "Office Mac");
  assert.equal(renamed.customName, "Desk Mac");
});

test("throws ProfileApiError for API error envelopes", async () => {
  const client = createProfileApiClient({
    fetchImpl: async () => jsonResponse({
      ok: false,
      error: {
        code: "validation_failed",
        message: "Snapshot payload is invalid"
      }
    }, { status: 400 })
  });

  await assert.rejects(
    () => client.submitSnapshot({
      token: "cup_test_token",
      payload: {}
    }),
    (error) => {
      assert.equal(error instanceof ProfileApiError, true);
      assert.equal(error.status, 400);
      assert.equal(error.code, "validation_failed");
      return true;
    }
  );
});

test("validates required client inputs", async () => {
  assert.throws(
    () => createProfileApiClient({ fetchImpl: null }),
    /fetch implementation is required/
  );

  const client = createProfileApiClient({ fetchImpl: async () => jsonResponse({}) });

  await assert.rejects(
    () => client.getPublicSnapshot(""),
    (error) => {
      assert.equal(error instanceof ProfileApiError, true);
      assert.equal(error.code, "validation_failed");
      return true;
    }
  );
  await assert.rejects(
    () => client.submitSnapshot({ token: "", payload: {} }),
    (error) => {
      assert.equal(error instanceof ProfileApiError, true);
      assert.equal(error.code, "validation_failed");
      return true;
    }
  );
  await assert.rejects(
    () => client.authorizeDeviceLogin({ userCode: "" }),
    (error) => {
      assert.equal(error instanceof ProfileApiError, true);
      assert.equal(error.code, "validation_failed");
      return true;
    }
  );
  await assert.rejects(
    () => client.revokeSettingsToken(""),
    (error) => {
      assert.equal(error instanceof ProfileApiError, true);
      assert.equal(error.code, "validation_failed");
      return true;
    }
  );
  await assert.rejects(
    () => client.createSettingsToken({ label: 42 }),
    (error) => {
      assert.equal(error instanceof ProfileApiError, true);
      assert.equal(error.code, "validation_failed");
      return true;
    }
  );
  await assert.rejects(
    () => client.renameSettingsDevice("", "Desk Mac"),
    (error) => {
      assert.equal(error instanceof ProfileApiError, true);
      assert.equal(error.code, "validation_failed");
      return true;
    }
  );
  await assert.rejects(
    () => client.renameSettingsDevice("device_1", 42),
    (error) => {
      assert.equal(error instanceof ProfileApiError, true);
      assert.equal(error.code, "validation_failed");
      return true;
    }
  );
});

test("builds API URLs for relative and absolute bases", () => {
  assert.equal(buildApiUrl("", "/api/snapshots/public/me"), "/api/snapshots/public/me");
  assert.equal(
    buildApiUrl("https://profiles.example.test/base", "/api/snapshots/public/me"),
    "https://profiles.example.test/api/snapshots/public/me"
  );
});

test("builds GitHub login URLs for browser and CLI approval flows", () => {
  assert.equal(
    buildGitHubLoginUrl("", {
      cliLoginChallengeId: "cli_login_1",
      redirectTo: "/u/postmelee"
    }),
    "/api/auth/github/login?cli_login_challenge=cli_login_1&redirect_to=%2Fu%2Fpostmelee"
  );
  assert.equal(
    buildGitHubLoginUrl("https://profiles.example.test/app", {
      redirectTo: "/u/postmelee"
    }),
    "https://profiles.example.test/api/auth/github/login?redirect_to=%2Fu%2Fpostmelee"
  );

  const client = createProfileApiClient({ fetchImpl: async () => jsonResponse({}) });
  assert.equal(
    client.buildGitHubLoginUrl({ cliLoginChallengeId: "cli_login_1" }),
    "/api/auth/github/login?cli_login_challenge=cli_login_1"
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
