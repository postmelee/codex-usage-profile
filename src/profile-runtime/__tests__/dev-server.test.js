import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";

import {
  CLI_TOKEN_PREFIX,
  PROFILE_VISIBILITY,
  createCliTokenService,
  createMemoryProfileBackendStore,
  createSessionService
} from "../../profile-backend/index.js";
import {
  ACCOUNT_USAGE_CONTRACT_VERSION
} from "../../profile-card/index.js";
import {
  sampleAccountUsageReadResult
} from "../../profile-card/fixtures/sample-account-usage.js";
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
      const pathname = new URL(request.url).pathname;
      calls.push(["api", request.method, pathname]);
      if (pathname.endsWith("/card.png")) {
        return new Response("png", {
          headers: { "content-type": "image/png", etag: '"card-etag"' }
        });
      }
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
  const cardResponse = createNodeResponseRecorder();
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
    headers: { host: "127.0.0.1:5173" },
    method: "HEAD",
    url: "/u/meleeisdeveloping/card.png"
  }), cardResponse);
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
  assert.equal(cardResponse.statusCode, 200);
  assert.equal(cardResponse.headers["content-type"], "image/png");
  assert.equal(cardResponse.headers.etag, '"card-etag"');
  assert.equal(frontendResponse.statusCode, 200);
  assert.equal(frontendResponse.body, "<html>app</html>");
  assert.deepEqual(calls, [
    ["api", "POST", "/api/cli/login/start"],
    ["api", "HEAD", "/u/meleeisdeveloping/card.png"],
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

test("keeps public HTML JSON and PNG synchronized across usage revisions and visibility", async () => {
  const store = createMemoryProfileBackendStore();
  let current = new Date("2026-07-15T00:05:00.000Z");
  const createId = createIdFactory();
  const owner = store.saveOwner({
    id: "owner_runtime_1",
    authProvider: "github",
    providerUserId: "github_runtime_1",
    displayName: "Runtime User",
    githubLogin: "runtime-user",
    handle: "runtime-user",
    visibility: PROFILE_VISIBILITY.PRIVATE,
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z"
  });
  const tokenService = createCliTokenService({
    store,
    now: () => current,
    createId,
    createToken: () => `${CLI_TOKEN_PREFIX}runtime_secret_token`
  });
  const sessionService = createSessionService({
    store,
    now: () => current,
    createId
  });
  const { token } = await tokenService.issueCliToken({ ownerId: owner.id });
  const { cookie } = await sessionService.createSession({ ownerId: owner.id });
  const apiHandler = createProfileRuntimeBackendHandler({
    backendOptions: {
      createId,
      now: () => current,
      sessionService,
      tokenService
    },
    config: {
      githubClientId: null,
      githubClientSecret: null,
      profileStoreFile: ".data/profile-store.json",
      publicBaseUrl: "http://127.0.0.1:5173",
      secureCookies: false
    },
    store
  });
  const runtimeHandler = createProfileRuntimeNodeHandler({
    apiHandler,
    frontendMiddleware: (_request, response) => {
      response.statusCode = 200;
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end('<html><div id="root"></div></html>');
    },
    publicBaseUrl: "http://127.0.0.1:5173"
  });
  const firstDocument = createAccountUsageDocument({
    capturedAt: "2026-07-15T00:00:00.000Z"
  });

  const firstSubmit = await requestRuntimeApi(apiHandler, "POST", "/api/account-usage/submit", {
    body: firstDocument,
    headers: { authorization: `Bearer ${token}` }
  });
  const privateJson = await requestRuntimeApi(
    apiHandler, "GET", "/api/profiles/public/runtime-user"
  );
  const privatePng = await requestRuntimeApi(
    apiHandler, "GET", "/u/runtime-user/card.png", { parseJson: false }
  );

  assert.equal(firstSubmit.status, 201);
  assert.equal(privateJson.status, 404);
  assert.equal(privatePng.status, 404);
  assert.deepEqual(await privatePng.response.json(), privateJson.body);

  const published = await requestRuntimeApi(apiHandler, "PATCH", "/api/profile", {
    body: { visibility: PROFILE_VISIBILITY.PUBLIC },
    headers: { cookie }
  });
  const publicJson = await requestRuntimeApi(
    apiHandler, "GET", "/api/profiles/public/runtime-user"
  );
  const firstPng = await requestRuntimeApi(
    apiHandler, "GET", "/u/runtime-user/card.png", { parseJson: false }
  );
  const firstPngBody = Buffer.from(await firstPng.response.arrayBuffer());
  const firstEtag = firstPng.response.headers.get("etag");
  const headPng = await requestRuntimeApi(
    apiHandler, "HEAD", "/u/runtime-user/card.png", { parseJson: false }
  );
  const publicHtml = await requestRuntimeNode(runtimeHandler, "/u/runtime-user");

  assert.equal(published.status, 200);
  assert.equal(publicJson.status, 200);
  assert.equal(publicJson.response.headers.get("cache-control"), "no-store");
  assert.equal(publicJson.body.data.owner.displayName, "Runtime User");
  assert.equal(
    publicJson.body.data.usage.usage.summary.lifetimeTokens,
    firstDocument.summary.lifetimeTokens
  );
  assert.equal(publicJson.body.data.publicCardUrl, "http://127.0.0.1:5173/u/runtime-user/card.png");
  assert.equal(firstPng.status, 200);
  assert.equal(firstPng.response.headers.get("content-type"), "image/png");
  assert.equal(
    firstPng.response.headers.get("cache-control"),
    "public, no-cache, must-revalidate"
  );
  assert.equal(firstPngBody.subarray(1, 4).toString(), "PNG");
  assert.match(firstEtag, /^"[A-Za-z0-9_-]+"$/);
  assert.equal(headPng.status, 200);
  assert.equal(headPng.response.headers.get("etag"), firstEtag);
  assert.equal(
    headPng.response.headers.get("cache-control"),
    "public, no-cache, must-revalidate"
  );
  assert.equal((await headPng.response.arrayBuffer()).byteLength, 0);
  assert.equal(publicHtml.statusCode, 200);
  assert.equal(publicHtml.body, '<html><div id="root"></div></html>');
  assert.equal(publicHtml.body.includes(owner.githubLogin), false);

  const serializedPublicJson = JSON.stringify(publicJson.body.data);
  for (const internalValue of [
    owner.id,
    owner.providerUserId,
    token,
    "contentDigest",
    "revision",
    "tokenDigest"
  ]) {
    assert.equal(serializedPublicJson.includes(internalValue), false);
  }

  current = new Date("2026-07-15T00:07:00.000Z");
  const exactRetry = await requestRuntimeApi(apiHandler, "POST", "/api/account-usage/submit", {
    body: firstDocument,
    headers: { authorization: `Bearer ${token}` }
  });
  const notModified = await requestRuntimeApi(
    apiHandler,
    "GET",
    "/u/runtime-user/card.png",
    { headers: { "if-none-match": firstEtag }, parseJson: false }
  );

  assert.equal(exactRetry.status, 200);
  assert.equal(exactRetry.body.data.submission.status, "unchanged");
  assert.equal(notModified.status, 304);
  assert.equal(notModified.response.headers.get("etag"), firstEtag);

  current = new Date("2026-07-15T00:10:00.000Z");
  const changedDocument = createAccountUsageDocument({
    capturedAt: "2026-07-15T00:08:00.000Z",
    summary: {
      ...firstDocument.summary,
      lifetimeTokens: firstDocument.summary.lifetimeTokens + 1_000_000_000
    }
  });
  const changedSubmit = await requestRuntimeApi(apiHandler, "POST", "/api/account-usage/submit", {
    body: changedDocument,
    headers: { authorization: `Bearer ${token}` }
  });
  const changedJson = await requestRuntimeApi(
    apiHandler, "GET", "/api/profiles/public/runtime-user"
  );
  const changedPng = await requestRuntimeApi(
    apiHandler,
    "GET",
    "/u/runtime-user/card.png",
    { headers: { "if-none-match": firstEtag }, parseJson: false }
  );
  const changedPngBody = Buffer.from(await changedPng.response.arrayBuffer());

  assert.equal(changedSubmit.status, 201);
  assert.equal(changedJson.body.data.usage.capturedAt, changedDocument.capturedAt);
  assert.equal(
    changedJson.body.data.usage.usage.summary.lifetimeTokens,
    changedDocument.summary.lifetimeTokens
  );
  assert.equal(changedPng.status, 200);
  assert.notEqual(changedPng.response.headers.get("etag"), firstEtag);
  assert.notDeepEqual(changedPngBody, firstPngBody);

  await requestRuntimeApi(apiHandler, "PATCH", "/api/profile", {
    body: { visibility: PROFILE_VISIBILITY.PRIVATE },
    headers: { cookie }
  });
  const hiddenJson = await requestRuntimeApi(
    apiHandler, "GET", "/api/profiles/public/runtime-user"
  );
  const hiddenPng = await requestRuntimeApi(
    apiHandler, "GET", "/u/runtime-user/card.png", { parseJson: false }
  );
  const missingJson = await requestRuntimeApi(
    apiHandler, "GET", "/api/profiles/public/missing-user"
  );
  const hiddenHtml = await requestRuntimeNode(runtimeHandler, "/u/runtime-user");

  assert.equal(hiddenJson.status, 404);
  assert.equal(hiddenPng.status, 404);
  assert.deepEqual(await hiddenPng.response.json(), hiddenJson.body);
  assert.deepEqual(hiddenJson.body, missingJson.body);
  assert.equal(hiddenHtml.statusCode, 200);
  assert.equal(hiddenHtml.body.includes(owner.githubLogin), false);
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

function createAccountUsageDocument(overrides = {}) {
  return {
    contractVersion: ACCOUNT_USAGE_CONTRACT_VERSION,
    capturedAt: "2026-07-15T00:00:00.000Z",
    summary: structuredClone(sampleAccountUsageReadResult.summary),
    dailyUsageBuckets: structuredClone(sampleAccountUsageReadResult.dailyUsageBuckets),
    ...overrides
  };
}

async function requestRuntimeApi(handler, method, path, options = {}) {
  const headers = new Headers(options.headers);
  const init = { headers, method };

  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    init.body = JSON.stringify(options.body);
  }

  const response = await handler(new Request(`http://127.0.0.1:5173${path}`, init));
  return {
    body: options.parseJson === false ? null : await response.json(),
    response,
    status: response.status
  };
}

async function requestRuntimeNode(handler, path) {
  const response = createNodeResponseRecorder();
  await handler(createReadableRequest({
    headers: { host: "127.0.0.1:5173" },
    method: "GET",
    url: path
  }), response);
  return response;
}

function createIdFactory() {
  let nextId = 1;

  return (prefix) => {
    const id = `${prefix}_${nextId}`;
    nextId += 1;
    return id;
  };
}
