import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPublicSharePath,
  buildPublicShareUrl,
  parsePublicSharePath,
  parsePublicShareRevision,
  resolvePublicShareRevision
} from "../public-share-url.js";

const ORIGIN = "https://profiles.example.test";
const OWNER_UPDATED_AT = "2026-06-11T09:05:00.000Z";
const USAGE_UPLOADED_AT = "2026-06-12T10:06:00.001Z";
const REVISION = Date.parse(USAGE_UPLOADED_AT);

test("resolves the latest valid profile timestamp as a revision token", () => {
  assert.equal(
    resolvePublicShareRevision(OWNER_UPDATED_AT, USAGE_UPLOADED_AT),
    REVISION
  );
  assert.equal(
    resolvePublicShareRevision(new Date(OWNER_UPDATED_AT)),
    Date.parse(OWNER_UPDATED_AT)
  );
  assert.equal(resolvePublicShareRevision(REVISION), REVISION);
});

test("rejects missing, invalid, and pre-epoch revision timestamps", () => {
  assert.throws(() => resolvePublicShareRevision(), TypeError);
  assert.throws(() => resolvePublicShareRevision(null, undefined), TypeError);
  assert.throws(
    () => resolvePublicShareRevision(OWNER_UPDATED_AT, "not-a-date"),
    TypeError
  );
  assert.throws(
    () => resolvePublicShareRevision("1969-12-31T23:59:59.999Z"),
    TypeError
  );
});

test("parses only canonical safe integer revision tokens", () => {
  assert.equal(parsePublicShareRevision("0"), 0);
  assert.equal(parsePublicShareRevision(String(REVISION)), REVISION);
  assert.equal(parsePublicShareRevision(REVISION), REVISION);

  for (const value of [
    "",
    "001",
    "-1",
    "1.5",
    "+1",
    "1e3",
    "9007199254740992",
    Number.MAX_SAFE_INTEGER + 1,
    null,
    undefined
  ]) {
    assert.equal(parsePublicShareRevision(value), null);
  }
});

test("builds fixed and queryless revision share URLs", () => {
  assert.equal(
    buildPublicSharePath("postmelee"),
    "/api/share/postmelee"
  );
  assert.equal(
    buildPublicSharePath("foo bar", REVISION),
    `/api/share/foo%20bar/r/${REVISION}`
  );
  assert.equal(
    buildPublicShareUrl(`${ORIGIN}/ignored?query=yes#hash`, "postmelee"),
    `${ORIGIN}/api/share/postmelee`
  );
  assert.equal(
    buildPublicShareUrl(ORIGIN, "foo bar", REVISION),
    `${ORIGIN}/api/share/foo%20bar/r/${REVISION}`
  );
});

test("rejects unsupported handles, origins, and revision arguments", () => {
  assert.throws(() => buildPublicSharePath(""), TypeError);
  assert.throws(() => buildPublicSharePath("a/b"), TypeError);
  assert.throws(() => buildPublicSharePath("a?b"), TypeError);
  assert.throws(() => buildPublicSharePath("postmelee", "001"), TypeError);
  assert.throws(() => buildPublicSharePath("postmelee", -1), TypeError);
  assert.throws(
    () => buildPublicShareUrl("ftp://profiles.test", "postmelee"),
    TypeError
  );
});

test("parses fixed and revision share paths with encoded handles", () => {
  assert.deepEqual(
    parsePublicSharePath("/api/share/postmelee"),
    { handle: "postmelee", revision: null, versioned: false }
  );
  assert.deepEqual(
    parsePublicSharePath("/api/share/foo%20bar/"),
    { handle: "foo bar", revision: null, versioned: false }
  );
  assert.deepEqual(
    parsePublicSharePath(`/api/share/postmelee/r/${REVISION}`),
    { handle: "postmelee", revision: REVISION, versioned: true }
  );
  assert.deepEqual(
    parsePublicSharePath(`/api/share/foo%20bar/r/${REVISION}/`),
    { handle: "foo bar", revision: REVISION, versioned: true }
  );
});

test("rejects malformed and non-canonical share paths", () => {
  for (const pathname of [
    "",
    "/api/share/",
    "/api/share/postmelee/more",
    "/api/share/postmelee/r/",
    "/api/share/postmelee/r/001",
    "/api/share/postmelee/r/-1",
    "/api/share/postmelee/r/1.5",
    `/api/share/postmelee/r/${REVISION}/more`,
    `/api/share/foo%2Fbar/r/${REVISION}`,
    `/api/share/%zz/r/${REVISION}`,
    `/api/share/postmelee/r/${REVISION}?locale=ko`
  ]) {
    assert.equal(parsePublicSharePath(pathname), null);
  }
});
