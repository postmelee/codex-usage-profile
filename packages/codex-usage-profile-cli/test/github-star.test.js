import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";

import {
  createGhRunner,
  maybePromptGithubStar
} from "../src/github-star.js";

const ACCOUNT_ARGS = ["api", "user", "--jq", ".login"];
const STATUS_ARGS = [
  "api",
  "--silent",
  "--method",
  "GET",
  "/user/starred/postmelee/codex-usage-profile"
];
const STAR_ARGS = [
  "api",
  "--silent",
  "--method",
  "PUT",
  "/user/starred/postmelee/codex-usage-profile"
];

test("skips gh entirely for JSON, CI, and non-TTY output", async () => {
  for (const options of [
    { json: true, stdinTty: true, stdoutTty: true },
    { json: false, ci: "true", stdinTty: true, stdoutTty: true },
    { json: false, stdinTty: false, stdoutTty: true },
    { json: false, stdinTty: true, stdoutTty: false }
  ]) {
    let ghCalls = 0;
    const io = createIo(options);

    assert.equal(await maybePromptGithubStar({
      ...io,
      env: options.ci ? { CI: options.ci } : {},
      json: options.json,
      runGh: async () => {
        ghCalls += 1;
        return { ok: true, stdout: "postmelee\n" };
      }
    }), false);
    assert.equal(ghCalls, 0);
    assert.equal(io.stdout.value, "");
  }
});

test("treats EOF from the default readline prompt as decline", async () => {
  const calls = [];
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  stdin.isTTY = true;
  stdout.isTTY = true;
  stdout.setEncoding("utf8");
  let output = "";
  stdout.on("data", (chunk) => {
    output += chunk;
  });

  const result = maybePromptGithubStar({
    stdin,
    stdout,
    env: {},
    runGh: createSequenceRunner(calls, [
      { ok: true, stdout: "octocat\n" },
      { ok: false, statusCode: 404 }
    ])
  });
  setImmediate(() => stdin.end());

  assert.equal(await result, false);
  assert.deepEqual(calls, [ACCOUNT_ARGS, STATUS_ARGS]);
  assert.equal(
    output.includes(
      "Star postmelee/codex-usage-profile on GitHub as @octocat? (Y/n) "
    ),
    true
  );
});

test("skips the prompt when the active account already starred the repository", async () => {
  const calls = [];
  let promptCalls = 0;
  const io = createIo();

  assert.equal(await maybePromptGithubStar({
    ...io,
    runGh: async (args) => {
      calls.push([...args]);
      return calls.length === 1
        ? { ok: true, stdout: "octocat\n" }
        : { ok: true, stdout: "" };
    },
    prompt: async () => {
      promptCalls += 1;
      return "";
    }
  }), false);

  assert.deepEqual(calls, [ACCOUNT_ARGS, STATUS_ARGS]);
  assert.equal(promptCalls, 0);
  assert.equal(io.stdout.value, "");
});

test("treats Enter, y, and yes as consent for the fixed repository", async () => {
  for (const response of ["", "y", "YES"]) {
    const calls = [];
    const messages = [];
    const io = createIo();

    assert.equal(await maybePromptGithubStar({
      ...io,
      runGh: createSequenceRunner(calls, [
        { ok: true, stdout: "octocat\n" },
        { ok: false, statusCode: 404 },
        { ok: true, stdout: "" }
      ]),
      prompt: async ({ message }) => {
        messages.push(message);
        return response;
      }
    }), true);

    assert.deepEqual(calls, [ACCOUNT_ARGS, STATUS_ARGS, STAR_ARGS]);
    assert.deepEqual(messages, [
      "Star postmelee/codex-usage-profile on GitHub as @octocat? (Y/n) "
    ]);
    assert.equal(
      io.stdout.value,
      "Starred postmelee/codex-usage-profile as @octocat.\n"
    );
  }
});

test("treats n and no as decline without a PUT request", async () => {
  for (const response of ["n", "NO"]) {
    const calls = [];
    const io = createIo();

    assert.equal(await maybePromptGithubStar({
      ...io,
      runGh: createSequenceRunner(calls, [
        { ok: true, stdout: "octocat\n" },
        { ok: false, statusCode: 404 }
      ]),
      prompt: async () => response
    }), false);

    assert.deepEqual(calls, [ACCOUNT_ARGS, STATUS_ARGS]);
    assert.equal(io.stdout.value, "");
  }
});

test("re-prompts invalid input before accepting the default Yes", async () => {
  const calls = [];
  const responses = ["later", ""];
  let promptCalls = 0;
  const io = createIo();

  assert.equal(await maybePromptGithubStar({
    ...io,
    runGh: createSequenceRunner(calls, [
      { ok: true, stdout: "octocat\n" },
      { ok: false, statusCode: 404 },
      { ok: true, stdout: "" }
    ]),
    prompt: async () => responses[promptCalls++]
  }), true);

  assert.equal(promptCalls, 2);
  assert.deepEqual(calls, [ACCOUNT_ARGS, STATUS_ARGS, STAR_ARGS]);
  assert.equal(
    io.stdout.value,
    "Please answer y or n.\nStarred postmelee/codex-usage-profile as @octocat.\n"
  );
});

test("fails soft when account or star status cannot be established", async () => {
  for (const responses of [
    [{ ok: false, statusCode: null }],
    [{ ok: true, stdout: "invalid account\n" }],
    [
      { ok: true, stdout: "octocat\n" },
      { ok: false, statusCode: 401 }
    ]
  ]) {
    const calls = [];
    let promptCalls = 0;
    const io = createIo();

    assert.equal(await maybePromptGithubStar({
      ...io,
      runGh: createSequenceRunner(calls, responses),
      prompt: async () => {
        promptCalls += 1;
        return "";
      }
    }), false);
    assert.equal(promptCalls, 0);
    assert.equal(io.stdout.value, "");
  }
});

test("fails soft without exposing raw errors when prompt or PUT fails", async () => {
  const promptFailureIo = createIo();
  assert.equal(await maybePromptGithubStar({
    ...promptFailureIo,
    runGh: createSequenceRunner([], [
      { ok: true, stdout: "octocat\n" },
      { ok: false, statusCode: 404 }
    ]),
    prompt: async () => {
      throw new Error("cup_prompt_secret");
    }
  }), false);
  assert.equal(promptFailureIo.stdout.value, "");

  const putFailureIo = createIo();
  assert.equal(await maybePromptGithubStar({
    ...putFailureIo,
    runGh: createSequenceRunner([], [
      { ok: true, stdout: "octocat\n" },
      { ok: false, statusCode: 404 },
      { ok: false, statusCode: 403, stderr: "cup_put_secret" }
    ]),
    prompt: async () => ""
  }), false);
  assert.equal(
    putFailureIo.stdout.value,
    "Could not star the GitHub repository. Continuing.\n"
  );
  assert.equal(putFailureIo.stdout.value.includes("cup_put_secret"), false);
});

test("runs gh without a shell using bounded execution options", async () => {
  let invocation;
  const runner = createGhRunner({
    execFileImpl(executable, args, options, callback) {
      invocation = { executable, args, options };
      callback(null, "octocat\n", "");
    }
  });

  assert.deepEqual(await runner(ACCOUNT_ARGS), {
    ok: true,
    stdout: "octocat\n"
  });
  assert.equal(invocation.executable, "gh");
  assert.deepEqual(invocation.args, ACCOUNT_ARGS);
  assert.deepEqual(invocation.options, {
    encoding: "utf8",
    maxBuffer: 16 * 1_024,
    timeout: 5_000,
    windowsHide: true
  });
  assert.equal("shell" in invocation.options, false);
});

test("keeps only an HTTP status classification from gh failures", async () => {
  const runner = createGhRunner({
    execFileImpl(_executable, _args, _options, callback) {
      callback(
        new Error("cup_error_secret"),
        "",
        "gh: private body cup_stderr_secret (HTTP 404)"
      );
    }
  });

  const result = await runner(STATUS_ARGS);

  assert.deepEqual(result, { ok: false, statusCode: 404 });
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("normalizes synchronous runner failures", async () => {
  const runner = createGhRunner({
    execFileImpl() {
      throw new Error("cup_sync_secret");
    }
  });

  assert.deepEqual(await runner(ACCOUNT_ARGS), {
    ok: false,
    statusCode: null
  });
});

function createIo(options = {}) {
  return {
    env: options.env ?? {},
    stdin: { isTTY: options.stdinTty ?? true },
    stdout: createOutput({ isTTY: options.stdoutTty ?? true })
  };
}

function createOutput({ isTTY }) {
  return {
    isTTY,
    value: "",
    write(chunk) {
      this.value += String(chunk);
    }
  };
}

function createSequenceRunner(calls, responses) {
  return async (args) => {
    calls.push([...args]);
    const result = responses[calls.length - 1];
    if (!result) throw new Error("Unexpected gh call");
    return result;
  };
}
