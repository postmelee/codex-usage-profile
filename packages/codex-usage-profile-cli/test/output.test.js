import assert from "node:assert/strict";
import test from "node:test";

import { projectSubmitOutput, writeSubmitOutput } from "../src/output.js";

const README_EMBED = '<a href="https://profiles.example.test/api/share/postmelee">'
  + '<img width="50%" '
  + 'src="https://profiles.example.test/u/postmelee/card.png" '
  + 'alt="Codex usage profile" /></a>';

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

  assert.match(human.value, /^✓ Usage submitted successfully\./);
  assert.match(human.value, /Captured:/);
  assert.match(human.value, /\n\nLinks\n/);
  assert.match(human.value, /  Profile:/);
  assert.match(human.value, /  Card:/);
  assert.match(human.value, /  README:/);
  assert.equal(human.value.includes("usage_private_revision"), false);
  assert.equal(JSON.parse(json.value).submission.status, "accepted");
  assert.equal(json.value.includes("cup_secret_value"), false);
});

test("renders only Profile and Card as cyan terminal hyperlinks", () => {
  const stdout = createOutput({ isTTY: true });
  const result = writeSubmitOutput(createResponse(), {
    env: { TERM_PROGRAM: "iTerm.app" },
    stdout
  });

  assert.match(
    stdout.value,
    /  Profile: \u001B\[36m\u001B\]8;;https:\/\/profiles\.example\.test\/profile/
  );
  assert.match(
    stdout.value,
    /  Card:    \u001B\[36m\u001B\]8;;https:\/\/profiles\.example\.test\/u\/postmelee\/card\.png/
  );
  assert.match(stdout.value, /\n\n\u001B\[90mLinks\u001B\[0m\n/);
  assert.match(stdout.value, /\u001B\]8;;\u001B\\\u001B\[39m/);
  assert.equal(
    stdout.value.split("\n").find((line) => line.startsWith("  README:")),
    `  README:  ${README_EMBED}`
  );
  assert.equal(result.profile.profileUrl, "https://profiles.example.test/profile");
  assert.equal(result.profile.imageUrl, "https://profiles.example.test/u/postmelee/card.png");
});

test("keeps submit links plain when hyperlink output is disabled", () => {
  const cases = [
    { env: { TERM_PROGRAM: "iTerm.app" }, stdout: createOutput() },
    {
      env: { NO_COLOR: "", TERM_PROGRAM: "iTerm.app" },
      stdout: createOutput({ isTTY: true })
    },
    {
      env: { TERM: "dumb", TERM_PROGRAM: "iTerm.app" },
      stdout: createOutput({ isTTY: true })
    },
    {
      env: { TERM_PROGRAM: "iTerm.app" },
      hyperlinks: false,
      expectColor: true,
      stdout: createOutput({ isTTY: true })
    },
    {
      env: { TERM_PROGRAM: "iTerm.app" },
      json: true,
      stdout: createOutput({ isTTY: true })
    }
  ];

  for (const options of cases) {
    writeSubmitOutput(createResponse(), options);
    assert.equal(options.stdout.value.includes("\u001B]8;;"), false);
    if (options.expectColor) {
      assert.match(options.stdout.value, /\u001B\[90mLinks\u001B\[0m/);
    } else {
      assert.equal(options.stdout.value.includes("\u001B"), false);
    }
    if (options.json) {
      assert.equal(
        JSON.parse(options.stdout.value).profile.profileUrl,
        "https://profiles.example.test/profile"
      );
    } else {
      assert.match(options.stdout.value, /  Profile: https:\/\/profiles\.example\.test\/profile/);
      assert.match(options.stdout.value, /  Card:    https:\/\/profiles\.example\.test/);
    }
  }
});

test("never creates terminal hyperlinks for non-HTTP profile values", () => {
  const stdout = createOutput({ isTTY: true });
  writeSubmitOutput({
    ...createResponse(),
    profile: {
      ...createResponse().profile,
      profileUrl: "javascript:alert(1)",
      imageUrl: "file:///tmp/card.png"
    }
  }, {
    env: { TERM_PROGRAM: "iTerm.app" },
    stdout
  });

  assert.equal(stdout.value.includes("\u001B]8;;"), false);
  assert.match(stdout.value, /  Profile: javascript:alert\(1\)/);
  assert.match(stdout.value, /  Card:    file:\/\/\/tmp\/card\.png/);
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

  assert.match(stdout.value, /^✓ Usage is already up to date\./);
});

test("omits the Links block when the response has no profile output", () => {
  const stdout = createOutput({ isTTY: true });
  writeSubmitOutput({
    ...createResponse(),
    profile: null
  }, {
    env: { TERM_PROGRAM: "iTerm.app" },
    stdout
  });

  assert.equal(
    stdout.value,
    "✓ Usage submitted successfully.\nCaptured: 2026-07-13T00:00:00.000Z\n"
  );
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
      readmeMarkdown: README_EMBED,
      ownerId: "owner_1"
    },
    usage: { lifetimeTokens: 999 }
  };
}

function createOutput(options = {}) {
  return {
    isTTY: options.isTTY === true,
    value: "",
    write(value) { this.value += value; }
  };
}
