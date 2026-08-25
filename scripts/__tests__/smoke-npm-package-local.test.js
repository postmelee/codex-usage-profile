import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  runNpmPackageLocalSmoke
} from "../smoke-npm-package-local.mjs";

test("local npm smoke isolates install and verifies the installed CLI boundaries", async () => {
  const commands = [];
  const result = await runNpmPackageLocalSmoke({
    processEnvironment: {
      PATH: process.env.PATH,
      CODEX_USAGE_PROFILE_TOKEN: "must_not_reach_child",
      NODE_AUTH_TOKEN: "must_not_reach_child",
      NPM_TOKEN: "must_not_reach_child",
      OPENAI_API_KEY: "must_not_reach_child"
    },
    createCandidate: createFakeCandidate,
    async runCommand(executable, args, options) {
      commands.push({ executable, args, options });
      return fakeSmokeResult(args);
    }
  });

  assert.equal(result.packageId, "codex-usage-profile@0.1.4");
  assert.equal(result.entryCount, 13);
  assert.equal(result.checksVerified, 6);
  assert.equal(commands.length, 7);
  assert.equal(commands[0].args[0], "install");
  assert.ok(commands[0].args.includes("--ignore-scripts"));
  assert.ok(commands[0].args.includes("--package-lock=false"));
  assert.ok(commands[1].args.includes("--input-type=module"));
  assert.ok(commands[2].args.includes("--input-type=module"));
  assert.match(commands[2].args.at(-1), /codex-usage-analyzer/);
  assert.match(commands[2].args.at(-1), /0\.4\.1/);
  assert.deepEqual(
    commands.slice(3).map((command) => command.args[0]),
    ["--help", "status", "status", "status"]
  );

  for (const command of commands) {
    const env = command.options.env;
    assert.equal(env.CODEX_USAGE_PROFILE_TOKEN, undefined);
    assert.equal(env.NODE_AUTH_TOKEN, undefined);
    assert.equal(env.NPM_TOKEN, undefined);
    assert.equal(env.OPENAI_API_KEY, undefined);
    assert.match(env.HOME, /codex-usage-profile-npm-smoke-/);
    assert.match(env.NPM_CONFIG_CACHE, /codex-usage-profile-npm-smoke-/);
    assert.equal(env.NPM_CONFIG_IGNORE_SCRIPTS, "true");
    assert.equal(env.NPM_CONFIG_REGISTRY, "https://registry.npmjs.org/");
  }
});

test("local npm smoke fails closed when an unsafe service origin is accepted", async () => {
  await assert.rejects(
    () => runNpmPackageLocalSmoke({
      processEnvironment: { PATH: process.env.PATH },
      createCandidate: createFakeCandidate,
      async runCommand(executable, args) {
        if (
          args[0] === "status" &&
          args.includes("http://profiles.example.test")
        ) {
          return { code: 0, stderr: "", stdout: "unexpected success\n" };
        }
        return fakeSmokeResult(args);
      }
    }),
    /accepted an unsafe service origin/
  );
});

test("local npm smoke fails closed when the installed analyzer contract drifts", async () => {
  await assert.rejects(
    () => runNpmPackageLocalSmoke({
      processEnvironment: { PATH: process.env.PATH },
      createCandidate: createFakeCandidate,
      async runCommand(executable, args) {
        if (
          executable === process.execPath &&
          args.at(-1).includes("codex-usage-analyzer")
        ) {
          return { code: 2, stderr: "", stdout: "" };
        }
        return fakeSmokeResult(args);
      }
    }),
    /installed analyzer contract failed/
  );
});

function createFakeCandidate({ candidateDirectory }) {
  return {
    candidateDirectory,
    tarballPath: join(
      candidateDirectory,
      "artifact",
      "codex-usage-profile-0.1.4.tgz"
    ),
    packageId: "codex-usage-profile@0.1.4",
    entryCount: 13,
    packedBytes: 1000,
    unpackedBytes: 5000,
    shasum: "a".repeat(40),
    integrity: `sha512-${"b".repeat(86)}==`
  };
}

function fakeSmokeResult(args) {
  if (args[0] === "install" || args.includes("--input-type=module")) {
    return { code: 0, stderr: "", stdout: "" };
  }
  if (args[0] === "--help") {
    return {
      code: 0,
      stderr: "",
      stdout:
        "Usage: codex-usage-profile <command> [options]\n" +
        "https://codex-usage-profile.meleeisdeveloping.chatgpt.site\n"
    };
  }
  if (args[0] === "status") {
    return {
      code: 1,
      stderr: args.includes("http://profiles.example.test")
        ? "Service URL must use HTTPS, except for loopback development URLs.\n"
        : "No credential found. Run login first.\n",
      stdout: ""
    };
  }
  throw new Error(`Unexpected smoke command: ${args[0]}`);
}
