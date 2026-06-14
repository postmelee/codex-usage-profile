import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAccountLoginHref,
  getAccountAuthError,
  getAccountAvatar,
  getAccountDisplayName,
  getAccountLogin,
  getAccountMenuSummary,
  getAccountRedirectPath,
  getAccountStatus
} from "../accountUi.js";

test("summarizes authenticated account identity", () => {
  const owner = {
    avatarUrl: "https://avatars.example/postmelee.png",
    displayName: "Taegyu Lee",
    githubLogin: "postmelee",
    handle: "meleeisdeveloping"
  };
  const summary = getAccountMenuSummary({
    account: { owner },
    status: "authenticated"
  });

  assert.equal(getAccountDisplayName(owner), "Taegyu Lee");
  assert.equal(getAccountLogin(owner), "postmelee");
  assert.deepEqual(getAccountAvatar(owner), {
    alt: "Taegyu Lee avatar",
    initial: "P",
    url: "https://avatars.example/postmelee.png"
  });
  assert.equal(summary.displayName, "Taegyu Lee");
  assert.equal(summary.login, "postmelee");
  assert.equal(summary.status.label, "Signed in");
});

test("falls back to handle, generic labels, and avatar initials", () => {
  const owner = {
    avatarUrl: "",
    displayName: "",
    githubLogin: "",
    handle: "fallback-user"
  };

  assert.equal(getAccountDisplayName(owner), "fallback-user");
  assert.equal(getAccountLogin(owner), "fallback-user");
  assert.deepEqual(getAccountAvatar(owner), {
    alt: "fallback-user avatar",
    initial: "F",
    url: null
  });
  assert.equal(getAccountDisplayName(null), "GitHub user");
});

test("maps account status labels", () => {
  assert.deepEqual(getAccountStatus({ status: "anonymous" }), {
    label: "Not signed in",
    status: "anonymous"
  });
  assert.deepEqual(getAccountStatus({ status: "loading" }), {
    label: "Checking account",
    status: "loading"
  });
  assert.deepEqual(getAccountStatus({ status: "unavailable" }), {
    label: "Account unavailable",
    status: "unavailable"
  });
  assert.deepEqual(getAccountStatus({ status: "custom" }), {
    label: "Account status unknown",
    status: "custom"
  });
});

test("builds account login redirect URLs", () => {
  const location = {
    pathname: "/u/meleeisdeveloping",
    search: "?tab=profile"
  };
  const client = {
    buildGitHubLoginUrl(options) {
      assert.deepEqual(options, {
        redirectTo: "/u/meleeisdeveloping?tab=profile"
      });
      return `/login?redirect_to=${encodeURIComponent(options.redirectTo)}`;
    }
  };

  assert.equal(
    getAccountRedirectPath(location),
    "/u/meleeisdeveloping?tab=profile"
  );
  assert.equal(
    buildAccountLoginHref(client, location),
    "/login?redirect_to=%2Fu%2Fmeleeisdeveloping%3Ftab%3Dprofile"
  );
  assert.equal(
    buildAccountLoginHref(null, { pathname: "/settings", search: "" }),
    "/api/auth/github/login?redirect_to=%2Fsettings"
  );
});

test("maps account auth error query parameters to user-facing copy", () => {
  assert.deepEqual(
    getAccountAuthError({
      search: "?auth_error=github_oauth_not_configured"
    }),
    {
      action: null,
      code: "github_oauth_not_configured",
      message: "GitHub sign in is not configured for this environment.",
      title: "Sign in unavailable"
    }
  );
  assert.deepEqual(
    getAccountAuthError({
      search: "?auth_error=github_login_failed"
    }),
    {
      action: "Sign in with GitHub",
      code: "github_login_failed",
      message: "GitHub sign in could not be completed.",
      title: "Sign in failed"
    }
  );
  assert.equal(getAccountAuthError({ search: "" }), null);
});
