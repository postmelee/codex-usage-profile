import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";

import { createMemoryProfileBackendStore } from "../../profile-backend/index.js";
import {
  createNodeRequestUrl,
  createProfileRuntimeBackendHandler,
  createProfileRuntimeNodeHandler,
  createWebRequestFromNodeRequest,
  loadRuntimeEnvFile,
  parseRuntimeEnvFile,
  writeWebResponseToNodeResponse
} from "../dev-server.js";

test("parses and loads local runtime env files without overriding existing values", () => {
  const directory = mkdtempSync(join(tmpdir(), "cup-env-"));
  const env = {
    PUBLIC_BASE_URL: "http://existing.local"
  };

  try {
    writeFileSync(
      join(directory, ".env"),
      [
        "# local runtime",
        "GITHUB_CLIENT_ID=github_client_1",
        "PUBLIC_BASE_URL=http://127.0.0.1:5173",
        "PROFILE_STORE_FILE=\".data/profile-store.json\""
      ].join("\n"),
      "utf8"
    );

    assert.deepEqual(parseRuntimeEnvFile("A=1\nB='two'\n"), [
      ["A", "1"],
      ["B", "two"]
    ]);
    assert.equal(loadRuntimeEnvFile(".env", { cwd: directory, env }), true);
    assert.deepEqual(env, {
      GITHUB_CLIENT_ID: "github_client_1",
      PROFILE_STORE_FILE: ".data/profile-store.json",
      PUBLIC_BASE_URL: "http://existing.local"
    });
  } finally {
    rmSync(directory, { recursive: true });
  }
});

test("creates fetch Request objects from Node requests", async () => {
  const nodeRequest = createReadableRequest({
    body: JSON.stringify({ label: "macbook" }),
    headers: {
      cookie: "cup_session=session_1",
      host: "127.0.0.1:5173",
      "content-type": "application/json"
    },
    method: "POST",
    url: "/api/cli/login/start?source=test"
  });
  const request = createWebRequestFromNodeRequest(nodeRequest);

  assert.equal(createNodeRequestUrl(nodeRequest), "http://127.0.0.1:5173/api/cli/login/start?source=test");
  assert.equal(request.method, "POST");
  assert.equal(request.url, "http://127.0.0.1:5173/api/cli/login/start?source=test");
  assert.equal(request.headers.get("cookie"), "cup_session=session_1");
  assert.deepEqual(JSON.parse(await request.text()), { label: "macbook" });
});

test("writes fetch Response objects to Node responses", async () => {
  const nodeResponse = createNodeResponseRecorder();
  const webResponse = new Response("created", {
    status: 201,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "set-cookie": "cup_session=session_1; Path=/; HttpOnly",
      "x-profile-runtime": "api"
    }
  });

  await writeWebResponseToNodeResponse(webResponse, nodeResponse);

  assert.equal(nodeResponse.statusCode, 201);
  assert.equal(nodeResponse.headers["content-type"], "text/plain; charset=utf-8");
  assert.deepEqual(nodeResponse.headers["set-cookie"], [
    "cup_session=session_1; Path=/; HttpOnly"
  ]);
  assert.equal(nodeResponse.headers["x-profile-runtime"], "api");
  assert.equal(nodeResponse.body, "created");
});

test("routes API requests through the runtime node handler and delegates frontend requests", async () => {
  const calls = [];
  const handler = createProfileRuntimeNodeHandler({
    apiHandler: async (request) => {
      calls.push(["api", request.method, new URL(request.url).pathname]);
      return new Response(JSON.stringify({
        body: await request.json(),
        source: "api"
      }), {
        status: 201,
        headers: {
          "content-type": "application/json; charset=utf-8"
        }
      });
    },
    frontendMiddleware: (request, response) => {
      calls.push(["frontend", request.method, request.url]);
      response.statusCode = 200;
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end("<html>app</html>");
    }
  });
  const apiResponse = createNodeResponseRecorder();
  const frontendResponse = createNodeResponseRecorder();

  await handler(createReadableRequest({
    body: JSON.stringify({ label: "macbook" }),
    headers: {
      host: "127.0.0.1:5173",
      "content-type": "application/json"
    },
    method: "POST",
    url: "/api/cli/login/start"
  }), apiResponse);
  await handler(createReadableRequest({
    headers: {
      host: "127.0.0.1:5173"
    },
    method: "GET",
    url: "/u/meleeisdeveloping"
  }), frontendResponse);

  assert.equal(apiResponse.statusCode, 201);
  assert.deepEqual(JSON.parse(apiResponse.body), {
    body: { label: "macbook" },
    source: "api"
  });
  assert.equal(frontendResponse.statusCode, 200);
  assert.equal(frontendResponse.body, "<html>app</html>");
  assert.deepEqual(calls, [
    ["api", "POST", "/api/cli/login/start"],
    ["frontend", "GET", "/u/meleeisdeveloping"]
  ]);
});

test("creates a runtime backend handler that can start GitHub login redirects", async () => {
  const handler = createProfileRuntimeBackendHandler({
    backendOptions: {
      createId: createIdFactory()
    },
    config: {
      githubClientId: "github_client_1",
      githubClientSecret: null,
      profileStoreFile: ".data/profile-store.json",
      publicBaseUrl: "http://127.0.0.1:5173",
      secureCookies: false
    },
    store: createMemoryProfileBackendStore()
  });
  const response = await handler(
    new Request("http://127.0.0.1:5173/api/auth/github/login?redirect_to=/u/postmelee")
  );
  const location = new URL(response.headers.get("location"));

  assert.equal(response.status, 302);
  assert.equal(`${location.origin}${location.pathname}`, "https://github.com/login/oauth/authorize");
  assert.equal(location.searchParams.get("client_id"), "github_client_1");
  assert.equal(location.searchParams.get("redirect_uri"), "http://127.0.0.1:5173/api/auth/github/callback");
  assert.equal(location.searchParams.get("state"), "oauth_state_1");
});

function createReadableRequest(options = {}) {
  const request = Readable.from(options.body ? [options.body] : []);

  request.headers = options.headers ?? {};
  request.method = options.method ?? "GET";
  request.url = options.url ?? "/";

  return request;
}

function createNodeResponseRecorder() {
  return {
    body: "",
    headers: {},
    statusCode: 200,
    statusMessage: "",
    writableEnded: false,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(chunk = "") {
      if (chunk) {
        this.body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
      }
      this.writableEnded = true;
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
