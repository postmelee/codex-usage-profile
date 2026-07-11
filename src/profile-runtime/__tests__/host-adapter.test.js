import assert from "node:assert/strict";
import test from "node:test";

import {
  createNotFoundFrontendHandler,
  createProfileHostAdapter,
  isApiRoutePath,
  isProfileBackendRoutePath,
  isPublicCardRoutePath,
  normalizeApiPrefix
} from "../host-adapter.js";

const BASE_URL = "http://localhost";

test("routes /api requests to the backend handler and non-api requests to frontend", async () => {
  const calls = [];
  const handler = createProfileHostAdapter({
    apiHandler: async (request) => {
      calls.push(["api", request.method, new URL(request.url).pathname]);
      return jsonResponse({ source: "api" });
    },
    frontendHandler: async (request) => {
      calls.push(["frontend", request.method, new URL(request.url).pathname]);
      return new Response("<html>app</html>", {
        headers: {
          "content-type": "text/html; charset=utf-8"
        }
      });
    }
  });

  const apiResponse = await handler(new Request(`${BASE_URL}/api/auth/me`));
  const apiRootResponse = await handler(new Request(`${BASE_URL}/api`));
  const cardResponse = await handler(new Request(`${BASE_URL}/u/meleeisdeveloping/card.png`));
  const frontendResponse = await handler(new Request(`${BASE_URL}/u/meleeisdeveloping`));

  assert.equal(apiResponse.status, 200);
  assert.deepEqual(await apiResponse.json(), { source: "api" });
  assert.equal(apiRootResponse.status, 200);
  assert.equal(cardResponse.status, 200);
  assert.equal(frontendResponse.status, 200);
  assert.equal(frontendResponse.headers.get("content-type"), "text/html; charset=utf-8");
  assert.deepEqual(calls, [
    ["api", "GET", "/api/auth/me"],
    ["api", "GET", "/api"],
    ["api", "GET", "/u/meleeisdeveloping/card.png"],
    ["frontend", "GET", "/u/meleeisdeveloping"]
  ]);
});

test("preserves backend response status, headers, cookies, and request body", async () => {
  const handler = createProfileHostAdapter({
    apiHandler: async (request) => {
      assert.equal(request.method, "POST");
      assert.equal(request.headers.get("cookie"), "cup_session=session_1");
      assert.deepEqual(JSON.parse(await request.text()), {
        label: "macbook"
      });

      return new Response("", {
        status: 302,
        headers: {
          location: "https://github.com/login/oauth/authorize?state=oauth_state_1",
          "set-cookie": "cup_session=session_1; Path=/; HttpOnly",
          "x-profile-runtime": "api"
        }
      });
    }
  });
  const response = await handler(new Request(`${BASE_URL}/api/cli/login/start`, {
    body: JSON.stringify({ label: "macbook" }),
    headers: {
      cookie: "cup_session=session_1",
      "content-type": "application/json"
    },
    method: "POST"
  }));

  assert.equal(response.status, 302);
  assert.equal(
    response.headers.get("location"),
    "https://github.com/login/oauth/authorize?state=oauth_state_1"
  );
  assert.equal(
    response.headers.get("set-cookie"),
    "cup_session=session_1; Path=/; HttpOnly"
  );
  assert.equal(response.headers.get("x-profile-runtime"), "api");
});

test("uses a default frontend 404 fallback when no frontend handler is provided", async () => {
  const handler = createProfileHostAdapter({
    apiHandler: async () => jsonResponse({ source: "api" })
  });
  const response = await handler(new Request(`${BASE_URL}/settings`));

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(await response.text(), "Not found");
});

test("supports custom API prefixes without matching partial path segments", async () => {
  const calls = [];
  const handler = createProfileHostAdapter({
    apiHandler: async (request) => {
      calls.push(["api", new URL(request.url).pathname]);
      return jsonResponse({ source: "api" });
    },
    apiPrefix: "/runtime/api/",
    frontendHandler: async (request) => {
      calls.push(["frontend", new URL(request.url).pathname]);
      return new Response("app");
    }
  });

  await handler(new Request(`${BASE_URL}/runtime/api/auth/me`));
  await handler(new Request(`${BASE_URL}/runtime/apiary`));

  assert.equal(normalizeApiPrefix("/runtime/api/"), "/runtime/api");
  assert.equal(isApiRoutePath("/runtime/api/auth/me", "/runtime/api/"), true);
  assert.equal(isApiRoutePath("/runtime/apiary", "/runtime/api/"), false);
  assert.equal(isPublicCardRoutePath("/u/postmelee/card.png"), true);
  assert.equal(isPublicCardRoutePath("/u/postmelee"), false);
  assert.equal(isProfileBackendRoutePath("/u/postmelee/card.png", "/runtime/api/"), true);
  assert.deepEqual(calls, [
    ["api", "/runtime/api/auth/me"],
    ["frontend", "/runtime/apiary"]
  ]);
});

test("validates host adapter inputs", () => {
  assert.throws(
    () => createProfileHostAdapter(),
    /apiHandler must be a function/
  );
  assert.throws(
    () => createProfileHostAdapter({
      apiHandler: async () => new Response("ok"),
      frontendHandler: "missing"
    }),
    /frontendHandler must be a function/
  );
  assert.throws(
    () => normalizeApiPrefix("api"),
    /apiPrefix must start with \//
  );
  assert.throws(
    () => normalizeApiPrefix("/"),
    /apiPrefix cannot be \//
  );
  assert.throws(
    () => isApiRoutePath("api/auth/me"),
    /pathname must start with \//
  );
});

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}
