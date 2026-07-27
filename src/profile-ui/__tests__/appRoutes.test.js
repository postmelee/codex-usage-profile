import assert from "node:assert/strict";
import test from "node:test";

import {
  APP_ROUTE_TYPES,
  isDeviceApprovalRoute,
  isSettingsRoute,
  resolveAppRoute
} from "../appRoutes.js";

test("resolves reserved app routes before profile routes", () => {
  assert.deepEqual(resolveAppRoute(new URL("http://localhost/device")), {
    pathname: "/device",
    type: APP_ROUTE_TYPES.DEVICE
  });
  assert.deepEqual(
    resolveAppRoute(new URL("http://localhost/?view=device&user_code=ABCD-1234")),
    {
      pathname: "/",
      type: APP_ROUTE_TYPES.DEVICE
    }
  );
  assert.deepEqual(resolveAppRoute(new URL("http://localhost/settings/")), {
    pathname: "/settings",
    type: APP_ROUTE_TYPES.SETTINGS
  });
  assert.deepEqual(resolveAppRoute(new URL("http://localhost/?view=settings")), {
    pathname: "/",
    type: APP_ROUTE_TYPES.SETTINGS
  });
  assert.deepEqual(resolveAppRoute(new URL("http://localhost/?profile=postmelee")), {
    pathname: "/",
    type: APP_ROUTE_TYPES.PUBLIC_PROFILE
  });
  assert.deepEqual(resolveAppRoute(new URL("http://localhost/u/postmelee")), {
    pathname: "/u/postmelee",
    type: APP_ROUTE_TYPES.PUBLIC_PROFILE
  });
  assert.deepEqual(resolveAppRoute(new URL("http://localhost/")), {
    pathname: "/",
    type: APP_ROUTE_TYPES.HOME
  });
  assert.deepEqual(resolveAppRoute(new URL("http://localhost/profile/")), {
    pathname: "/profile",
    type: APP_ROUTE_TYPES.OWNER_PROFILE
  });
});

test("checks route predicates", () => {
  assert.equal(isDeviceApprovalRoute(new URL("http://localhost/device")), true);
  assert.equal(
    isDeviceApprovalRoute(
      new URL("http://localhost/?view=device&user_code=ABCD-1234")
    ),
    true
  );
  assert.equal(isDeviceApprovalRoute(new URL("http://localhost/settings")), false);
  assert.equal(isSettingsRoute(new URL("http://localhost/settings")), true);
  assert.equal(isSettingsRoute(new URL("http://localhost/?view=settings")), true);
  assert.equal(isSettingsRoute(new URL("http://localhost/u/postmelee")), false);
});
