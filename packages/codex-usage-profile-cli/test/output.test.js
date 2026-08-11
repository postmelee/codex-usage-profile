import assert from "node:assert/strict";
import test from "node:test";

import { projectSubmitOutput, writeSubmitOutput } from "../src/output.js";

test("projects submit output without credentials, owner ids, or private revision", () => {
  const output = projectSubmitOutput(createResponse());
  const serialized = JSON.stringify(output);

  assert.equal(output.submission.status, "accepted");
  assert.equal(output.profile.handle, "postmelee");
  assert.equal(serialized.includes("usage_private_revision"), false);
  assert.equal(serialized.includes("cup_secret_value"), false);
  assert.equal(serialized.includes("owner_1"), false);
  assert.equal(serialized.includes("lifetimeTokens"), false);
});

test("writes useful human and JSON submit results", () => {
  const human = createOutput();
  const json = createOutput();

  writeSubmitOutput(createResponse(), { stdout: human });
  writeSubmitOutput(createResponse(), { stdout: json, json: true });

  assert.match(human.value, /Usage submitted successfully/);
  assert.match(human.value, /Captured:/);
  assert.match(human.value, /Profile:/);
  assert.match(human.value, /Card:/);
  assert.match(human.value, /README:/);
  assert.equal(human.value.includes("usage_private_revision"), false);
  assert.equal(JSON.parse(json.value).submission.status, "accepted");
  assert.equal(json.value.includes("cup_secret_value"), false);
});

test("labels idempotent retries as already up to date", () => {
  const stdout = createOutput();
  writeSubmitOutput({
    ...createResponse(),
    submission: {
      ...createResponse().submission,
      status: "unchanged",
      idempotent: true
    }
  }, { stdout });

  assert.match(stdout.value, /already up to date/);
});

test("redacts a credential echoed inside otherwise allowed fields", () => {
  const stdout = createOutput();
  writeSubmitOutput({
    ...createResponse(),
    profile: {
      ...createResponse().profile,
      profileUrl: "https://profiles.example.test/cup_secret_value"
    }
  }, {
    stdout,
    json: true,
    forbiddenValues: ["cup_secret_value"]
  });

  assert.equal(stdout.value.includes("cup_secret_value"), false);
  assert.equal(JSON.parse(stdout.value).profile.profileUrl, null);
});

function createResponse() {
  return {
    submission: {
      status: "accepted",
      idempotent: false,
      contractVersion: 1,
      capturedAt: "2026-07-13T00:00:00.000Z",
      uploadedAt: "2026-07-13T00:01:00.000Z",
      revision: "usage_private_revision",
      ownerId: "owner_1",
      token: "cup_secret_value"
    },
    profile: {
      handle: "postmelee",
      visibility: "public",
      profileUrl: "https://profiles.example.test/profile",
      imageUrl: "https://profiles.example.test/u/postmelee/card.png",
      readmeMarkdown: "![Codex usage profile](https://profiles.example.test/u/postmelee/card.png)",
      ownerId: "owner_1"
    },
    usage: { lifetimeTokens: 999 }
  };
}

function createOutput() {
  return {
    value: "",
    write(value) { this.value += value; }
  };
}
