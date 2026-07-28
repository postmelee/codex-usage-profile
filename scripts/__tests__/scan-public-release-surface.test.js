import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { promisify } from "node:util";

import {
  scanPublicReleaseSurface,
  verifyPublishWorkflowContract
} from "../scan-public-release-surface.mjs";

const execFileAsync = promisify(execFileCallback);

test("scanner covers current, deleted, tag, and remote-tracking blobs", async () => {
  const repository = await createRepository();
  const githubValue = [
    "github",
    "_pat_",
    "Qp7xM2vN8cR4tY6uI9oP3aS5dF1gH7jK2lZ8xC4v"
  ].join("");
  const openAiValue = [
    "sk-proj-",
    "zN4qB8vC2xM7aD5fG9hJ3kL6pR1sT8wY4uE7iO2P"
  ].join("");
  const awsValue = ["AKIA", "Q7W4E9R2T6Y8U3I5"].join("");
  let serialized;

  try {
    await writeFile(join(repository, "deleted-secret.txt"), githubValue);
    await git(repository, "add", "deleted-secret.txt");
    await git(repository, "commit", "-m", "add deleted history fixture");
    await git(repository, "tag", "exposure-audit");

    await unlink(join(repository, "deleted-secret.txt"));
    await git(repository, "add", "-u");
    await git(repository, "commit", "-m", "remove deleted history fixture");

    await writeFile(join(repository, ".env"), `OPENAI_API_KEY=${openAiValue}\n`);
    await git(repository, "add", ".env");
    await git(repository, "commit", "-m", "add remote-only fixture");
    const remoteCommit = (await git(repository, "rev-parse", "HEAD")).trim();
    await git(repository, "update-ref", "refs/remotes/origin/audit", remoteCommit);
    await git(repository, "reset", "--hard", "HEAD~1");

    await writeFile(join(repository, "current-secret.txt"), awsValue);
    await git(repository, "add", "current-secret.txt");
    await git(repository, "commit", "-m", "add current fixture");

    const result = await scanPublicReleaseSurface({
      repositoryRoot: repository
    });
    serialized = JSON.stringify(result);

    assert.equal(result.ok, false);
    assert.ok(result.refCount >= 3);
    assert.ok(result.blockerCount >= 3);
    assert.ok(result.findings.some((finding) => (
      finding.category === "GitHub credential" &&
      finding.path === "deleted-secret.txt" &&
      finding.refs.includes("refs/tags/exposure-audit")
    )));
    assert.ok(result.findings.some((finding) => (
      finding.category === "environment file" &&
      finding.path === ".env" &&
      finding.refs.includes("refs/remotes/origin/audit")
    )));
    assert.ok(result.findings.some((finding) => (
      finding.category === "AWS access key" &&
      finding.path === "current-secret.txt"
    )));
  } finally {
    await rm(repository, { force: true, recursive: true });
  }

  for (const sensitiveValue of [githubValue, openAiValue, awsValue]) {
    assert.equal(serialized.includes(sensitiveValue), false);
  }
});

test("scanner allows documented placeholders and synthetic test credentials", async () => {
  const repository = await createRepository();
  try {
    await writeFile(join(repository, ".env.example"), "TOKEN=<replace-me>\n");
    await writeFile(
      join(repository, "credential.test.js"),
      ["const token = \"gho_", "1234567890abcdefghijklmnopqrstuvwxyz", "\";\n"]
        .join("")
    );
    await git(repository, "add", ".env.example", "credential.test.js");
    await git(repository, "commit", "-m", "add safe fixtures");

    const result = await scanPublicReleaseSurface({
      repositoryRoot: repository
    });

    assert.equal(result.ok, true);
    assert.equal(result.blockerCount, 0);
    assert.ok(result.categories.some((category) => (
      category.category === "credential test fixture" &&
      category.severity === "info"
    )));
  } finally {
    await rm(repository, { force: true, recursive: true });
  }
});

test("publish workflow is pinned and fail-closed", async () => {
  const workflow = await readFile(
    new URL("../../.github/workflows/publish-npm.yml", import.meta.url),
    "utf8"
  );
  assert.equal(verifyPublishWorkflowContract(workflow), true);
  assert.throws(
    () => verifyPublishWorkflowContract(
      workflow.replace(
        "github.ref == 'refs/tags/codex-usage-profile-v0.1.0'",
        "startsWith(github.ref, 'refs/tags/')"
      )
    ),
    /missing/
  );
  assert.throws(
    () => verifyPublishWorkflowContract(`${workflow}\nworkflow_dispatch:\n`),
    /unapproved/
  );
});

async function createRepository() {
  const directory = await mkdtemp(join(tmpdir(), "public-release-scan-test-"));
  await git(directory, "init", "--initial-branch=main");
  await git(directory, "config", "user.name", "Release Test");
  await git(directory, "config", "user.email", "release@example.invalid");
  await writeFile(join(directory, "README.md"), "# fixture\n");
  await git(directory, "add", "README.md");
  await git(directory, "commit", "-m", "initial fixture");
  return directory;
}

async function git(directory, ...args) {
  const result = await execFileAsync("git", args, {
    cwd: directory,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024
  });
  return result.stdout;
}
