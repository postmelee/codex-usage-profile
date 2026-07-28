import { execFile as execFileCallback, spawn } from "node:child_process";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFileCallback);
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, "..");
const MAX_TEXT_SCAN_BYTES = 2 * 1024 * 1024;
const REVIEW_SIZE_BYTES = 1024 * 1024;
const BLOCK_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_REPORTED_FINDINGS = 100;

const CREDENTIAL_PATTERNS = Object.freeze([
  Object.freeze({
    category: "GitHub credential",
    pattern: /\b(?:github_pat_[A-Za-z0-9_]{40,}|gh[pousr]_[A-Za-z0-9]{30,})\b/g
  }),
  Object.freeze({
    category: "npm credential",
    pattern: /\bnpm_[A-Za-z0-9]{30,}\b/g
  }),
  Object.freeze({
    category: "OpenAI credential",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/g
  }),
  Object.freeze({
    category: "AWS access key",
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g
  }),
  Object.freeze({
    category: "private key",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g
  })
]);

const SECRET_ASSIGNMENT_PATTERN =
  /\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|ACCESS_KEY|PRIVATE_KEY)[A-Z0-9_]*)\b\s*[:=]\s*["'`]([^"'`\r\n]{16,})["'`]/gi;
const ABSOLUTE_USER_PATH_PATTERNS = Object.freeze([
  /\/Users\/([^/\s"'`]+)\//g,
  /\/home\/([^/\s"'`]+)\//g,
  /[A-Za-z]:\\Users\\([^\\\s"'`]+)\\/g
]);
const SAFE_PATH_USERS = new Set([
  "example",
  "runner",
  "runneradmin",
  "user",
  "username"
]);
const EXPECTED_BINARY_EXTENSIONS = new Set([
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".otf",
  ".png",
  ".ttf",
  ".wasm",
  ".webp",
  ".woff",
  ".woff2"
]);
const BLOCKED_ARTIFACT_EXTENSIONS = new Set([
  ".7z",
  ".bak",
  ".backup",
  ".db",
  ".dump",
  ".gz",
  ".orig",
  ".rar",
  ".sqlite",
  ".sqlite3",
  ".swp",
  ".tar",
  ".tgz",
  ".zip"
]);

export async function scanPublicReleaseSurface(options = {}) {
  const repositoryRoot = resolve(
    options.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT
  );
  const refs = await listPublicRefs(repositoryRoot);
  const objects = await collectRefObjects(repositoryRoot, refs);
  const objectMetadata = await inspectObjects(repositoryRoot, objects.keys());
  const blobs = [...objectMetadata.values()]
    .filter((metadata) => metadata.type === "blob");
  const contentOids = blobs
    .filter((metadata) => metadata.size <= MAX_TEXT_SCAN_BYTES)
    .map((metadata) => metadata.oid);
  const contentByOid = await readBlobContents(repositoryRoot, contentOids);
  const findings = [];

  for (const blob of blobs) {
    const refObject = objects.get(blob.oid);
    const paths = [...refObject.paths].sort();
    const refsForBlob = [...refObject.refs].sort();
    const representativePath = paths[0] ?? "(path unavailable)";

    for (const path of paths) {
      findings.push(...classifyPath({
        blob: blob.oid,
        path,
        refs: refsForBlob,
        size: blob.size
      }));
    }

    const content = contentByOid.get(blob.oid);
    if (!content) continue;
    findings.push(...classifyContent({
      blob: blob.oid,
      content,
      path: representativePath,
      refs: refsForBlob
    }));
  }

  const metadata = await inspectCommitMetadata(repositoryRoot);
  if (metadata.reviewEmailCount > 0) {
    findings.push({
      blob: "(commit metadata)",
      category: "public commit email",
      count: metadata.reviewEmailCount,
      path: "(author/committer metadata)",
      refs: ["--all"],
      severity: "review"
    });
  }

  return buildSummary({
    blobCount: blobs.length,
    findings,
    metadata,
    refCount: refs.length,
    scannedBlobCount: contentByOid.size
  });
}

export function verifyPublishWorkflowContract(workflow) {
  const requiredFragments = [
    "pull_request:",
    "push:",
    "branches: [devel, publish/task44]",
    "tags: [codex-usage-profile-v0.1.0]",
    "matrix:",
    "node: [20, 22, 24]",
    "package-manager-cache: false",
    "persist-credentials: false",
    "npm ci --ignore-scripts",
    "npm test --workspace packages/codex-usage-profile-cli",
    "npm run verify:npm-release",
    "npm run smoke:npm-package:local",
    "github.ref == 'refs/tags/codex-usage-profile-v0.1.0'",
    "environment: npm-publish",
    "id-token: write",
    "npm install --global npm@12.0.1 --ignore-scripts",
    "npm publish --workspace packages/codex-usage-profile-cli --access public --provenance",
    "NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}",
    "3d3c42e5aac5ba805825da76410c181273ba90b1",
    "249970729cb0ef3589644e2896645e5dc5ba9c38"
  ];
  const missing = requiredFragments.filter(
    (fragment) => !workflow.includes(fragment)
  );
  if (missing.length > 0) {
    throw new Error(
      `npm publish workflow is missing ${missing.length} release controls`
    );
  }
  if (
    workflow.includes("workflow_dispatch:") ||
    workflow.includes("npm stage publish")
  ) {
    throw new Error("npm publish workflow enables an unapproved release path");
  }
  const tokenUses = workflow.match(/\$\{\{\s*secrets\.NPM_TOKEN\s*\}\}/g) ?? [];
  if (tokenUses.length !== 1) {
    throw new Error("NPM_TOKEN must be scoped to exactly one publish step");
  }
  const idTokenWrites = workflow.match(/\bid-token:\s*write\b/g) ?? [];
  if (idTokenWrites.length !== 1) {
    throw new Error("OIDC write permission must exist only in the publish job");
  }
  return true;
}

async function listPublicRefs(repositoryRoot) {
  const output = await runGit(repositoryRoot, [
    "for-each-ref",
    "--format=%(refname)",
    "refs/heads",
    "refs/remotes",
    "refs/tags"
  ]);
  const refs = output.split("\n").map((value) => value.trim()).filter(Boolean);
  if (refs.length === 0) {
    throw new Error("public release scan requires at least one Git ref");
  }
  return refs;
}

async function collectRefObjects(repositoryRoot, refs) {
  const objects = new Map();
  for (const ref of refs) {
    const output = await runGit(repositoryRoot, [
      "-c",
      "core.quotePath=false",
      "rev-list",
      "--objects",
      ref,
      "--"
    ]);
    for (const line of output.split("\n")) {
      if (!line) continue;
      const separator = line.indexOf(" ");
      const oid = separator === -1 ? line : line.slice(0, separator);
      const path = separator === -1 ? null : line.slice(separator + 1);
      let object = objects.get(oid);
      if (!object) {
        object = { paths: new Set(), refs: new Set() };
        objects.set(oid, object);
      }
      object.refs.add(ref);
      if (path) object.paths.add(path);
    }
  }
  return objects;
}

async function inspectObjects(repositoryRoot, oids) {
  const oidList = [...oids];
  if (oidList.length === 0) return new Map();
  const output = await runGitWithInput(
    repositoryRoot,
    ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
    `${oidList.join("\n")}\n`
  );
  const metadata = new Map();
  for (const line of output.toString("utf8").trim().split("\n")) {
    const [oid, type, rawSize] = line.split(" ");
    const size = Number.parseInt(rawSize, 10);
    if (!oid || !type || !Number.isSafeInteger(size)) {
      throw new Error("git cat-file returned invalid object metadata");
    }
    metadata.set(oid, { oid, size, type });
  }
  return metadata;
}

async function readBlobContents(repositoryRoot, oids) {
  if (oids.length === 0) return new Map();
  const output = await runGitWithInput(
    repositoryRoot,
    ["cat-file", "--batch"],
    `${oids.join("\n")}\n`
  );
  const contents = new Map();
  let offset = 0;
  while (offset < output.length) {
    const headerEnd = output.indexOf(0x0a, offset);
    if (headerEnd === -1) {
      throw new Error("git cat-file returned a truncated blob header");
    }
    const header = output.subarray(offset, headerEnd).toString("utf8");
    const [oid, type, rawSize] = header.split(" ");
    const size = Number.parseInt(rawSize, 10);
    if (type !== "blob" || !Number.isSafeInteger(size)) {
      throw new Error("git cat-file returned a non-blob batch entry");
    }
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + size;
    if (contentEnd >= output.length || output[contentEnd] !== 0x0a) {
      throw new Error("git cat-file returned truncated blob content");
    }
    contents.set(oid, Buffer.from(output.subarray(contentStart, contentEnd)));
    offset = contentEnd + 1;
  }
  return contents;
}

function classifyPath({ blob, path, refs, size }) {
  const findings = [];
  const normalized = path.replaceAll("\\", "/");
  const basename = normalized.split("/").at(-1).toLowerCase();
  const extension = extname(basename).toLowerCase();
  const fixture = isFixturePath(normalized);

  if (
    (basename === ".env" || basename.startsWith(".env.")) &&
    ![".env.example", ".env.sample", ".env.template"].includes(basename)
  ) {
    findings.push(finding({
      blob,
      category: "environment file",
      path,
      refs,
      severity: fixture ? "info" : "blocker"
    }));
  }
  if (
    normalized.includes(".codex/sessions/") ||
    /(?:^|\/)(?:auth|credentials?|session|storage-state)\.(?:json|sqlite)$/i
      .test(normalized)
  ) {
    findings.push(finding({
      blob,
      category: "local auth or session payload",
      path,
      refs,
      severity: fixture ? "info" : "blocker"
    }));
  }
  if (BLOCKED_ARTIFACT_EXTENSIONS.has(extension)) {
    findings.push(finding({
      blob,
      category: "archive, backup, or database artifact",
      path,
      refs,
      severity: fixture ? "info" : "blocker"
    }));
  }
  if (size > BLOCK_SIZE_BYTES) {
    findings.push(finding({
      blob,
      category: "oversized blob",
      path,
      refs,
      severity: "blocker"
    }));
  } else if (size > REVIEW_SIZE_BYTES) {
    findings.push(finding({
      blob,
      category: "large blob",
      path,
      refs,
      severity: "review"
    }));
  }
  return findings;
}

function classifyContent({ blob, content, path, refs }) {
  const findings = [];
  const fixture = isFixturePath(path);
  const binary = looksBinary(content);
  if (binary) {
    const extension = extname(path).toLowerCase();
    const expectedFontBin =
      extension === ".bin" &&
      path.replaceAll("\\", "/").includes("src/profile-card/assets/");
    findings.push(finding({
      blob,
      category: expectedFontBin || EXPECTED_BINARY_EXTENSIONS.has(extension)
        ? "expected binary asset"
        : "unexpected binary blob",
      path,
      refs,
      severity: expectedFontBin || EXPECTED_BINARY_EXTENSIONS.has(extension)
        ? "info"
        : "review"
    }));
    return findings;
  }

  const text = content.toString("utf8");
  for (const scanner of CREDENTIAL_PATTERNS) {
    const matches = [...text.matchAll(scanner.pattern)];
    const actual = matches.filter((match) => !isSyntheticValue(match[0]));
    const synthetic = matches.length - actual.length;
    if (actual.length > 0) {
      findings.push(finding({
        blob,
        category: scanner.category,
        count: actual.length,
        path,
        refs,
        severity: fixture ? "review" : "blocker"
      }));
    }
    if (synthetic > 0) {
      findings.push(finding({
        blob,
        category: "credential test fixture",
        count: synthetic,
        path,
        refs,
        severity: fixture ? "info" : "review"
      }));
    }
  }

  const assignments = [...text.matchAll(SECRET_ASSIGNMENT_PATTERN)]
    .map((match) => ({ key: match[1], value: match[2] }))
    .filter(({ key, value }) => looksLikeAssignedSecret(key, value));
  if (assignments.length > 0) {
    findings.push(finding({
      blob,
      category: "credential-like assignment",
      count: assignments.length,
      path,
      refs,
      severity: fixture ? "review" : "blocker"
    }));
  }

  let privatePathCount = 0;
  for (const pattern of ABSOLUTE_USER_PATH_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      if (!SAFE_PATH_USERS.has(match[1].toLowerCase())) privatePathCount += 1;
    }
  }
  if (privatePathCount > 0) {
    findings.push(finding({
      blob,
      category: "private absolute path",
      count: privatePathCount,
      path,
      refs,
      severity: "review"
    }));
  }
  if (
    path !== "scripts/scan-public-release-surface.mjs" &&
    /\.codex[\\/]sessions(?:[\\/]|["'`])/i.test(text)
  ) {
    findings.push(finding({
      blob,
      category: "local Codex session reference",
      path,
      refs,
      severity: "review"
    }));
  }
  return findings;
}

function finding({ blob, category, count = 1, path, refs, severity }) {
  return { blob, category, count, path, refs, severity };
}

function buildSummary({ blobCount, findings, metadata, refCount, scannedBlobCount }) {
  const merged = new Map();
  for (const item of findings) {
    const key = [
      item.severity,
      item.category,
      item.blob,
      item.path,
      item.refs.join(",")
    ].join("\0");
    const current = merged.get(key);
    if (current) current.count += item.count;
    else merged.set(key, { ...item });
  }
  const normalized = [...merged.values()].sort(compareFindings);
  const categories = new Map();
  for (const item of normalized) {
    const key = `${item.severity}\0${item.category}`;
    const current = categories.get(key) ?? {
      category: item.category,
      count: 0,
      paths: new Set(),
      severity: item.severity
    };
    current.count += item.count;
    current.paths.add(item.path);
    categories.set(key, current);
  }
  const blockerCount = normalized
    .filter((item) => item.severity === "blocker")
    .reduce((total, item) => total + item.count, 0);
  const reviewCount = normalized
    .filter((item) => item.severity === "review")
    .reduce((total, item) => total + item.count, 0);
  return Object.freeze({
    ok: blockerCount === 0,
    blockerCount,
    reviewCount,
    refCount,
    blobCount,
    scannedBlobCount,
    skippedLargeBlobCount: blobCount - scannedBlobCount,
    metadata: {
      commitCount: metadata.commitCount,
      reviewEmailCount: metadata.reviewEmailCount
    },
    categories: [...categories.values()].map((item) => ({
      category: item.category,
      count: item.count,
      pathCount: item.paths.size,
      severity: item.severity
    })),
    findings: normalized.slice(0, MAX_REPORTED_FINDINGS).map((item) => ({
      blob: item.blob.length === 40 ? item.blob.slice(0, 12) : item.blob,
      category: item.category,
      count: item.count,
      path: item.path,
      refs: item.refs,
      severity: item.severity
    })),
    truncatedFindingCount: Math.max(0, normalized.length - MAX_REPORTED_FINDINGS)
  });
}

async function inspectCommitMetadata(repositoryRoot) {
  const output = await runGit(repositoryRoot, [
    "log",
    "--all",
    "--format=%H%x00%ae%x00%ce"
  ]);
  const reviewEmails = new Set();
  let commitCount = 0;
  for (const line of output.split("\n")) {
    if (!line) continue;
    const [, authorEmail, committerEmail] = line.split("\0");
    commitCount += 1;
    for (const email of [authorEmail, committerEmail]) {
      if (email && isReviewEmail(email)) reviewEmails.add(email.toLowerCase());
    }
  }
  return {
    commitCount,
    reviewEmailCount: reviewEmails.size
  };
}

function isReviewEmail(email) {
  const lower = email.toLowerCase();
  return !(
    lower.endsWith("@users.noreply.github.com") ||
    lower.endsWith("@example.com") ||
    lower.endsWith("@example.invalid") ||
    lower === "noreply@localhost"
  );
}

function isFixturePath(path) {
  const normalized = path.replaceAll("\\", "/").toLowerCase();
  return (
    normalized.includes("/__tests__/") ||
    normalized.includes("/fixtures/") ||
    normalized.includes("/test/") ||
    normalized.startsWith("test/") ||
    /(?:^|\/)[^/]+\.(?:spec|test)\.[cm]?[jt]sx?$/.test(normalized)
  );
}

function looksBinary(content) {
  const inspected = content.subarray(0, Math.min(content.length, 8192));
  return inspected.includes(0);
}

function isSyntheticValue(value) {
  const lower = value.toLowerCase();
  if (
    /(?:example|fixture|invalid|placeholder|replace|sample|secret|test|value)/
      .test(lower)
  ) {
    return true;
  }
  const compact = lower.replace(/[^a-z0-9]/g, "");
  if (
    /0123456789|1234567890|abcdefghijklmnopqrstuvwxyz/.test(compact) ||
    /(.)\1{11,}/.test(compact)
  ) {
    return true;
  }
  return false;
}

function looksLikeAssignedSecret(key, value) {
  if (/(?:CONSTRAINT|DIGEST|ERROR|LABEL|LIMIT|MESSAGE|TABLE)/i.test(key)) {
    return false;
  }
  if (
    value.startsWith("<") ||
    value.includes("${{") ||
    value.includes("process.env") ||
    /^https?:\/\//i.test(value) ||
    /^[A-Z0-9_]+$/.test(value) ||
    isSyntheticValue(value)
  ) {
    return false;
  }
  return (
    value.length >= 20 &&
    /[a-z]/.test(value) &&
    (/[A-Z]/.test(value) || /\d/.test(value))
  );
}

function compareFindings(left, right) {
  const severityOrder = { blocker: 0, review: 1, info: 2 };
  return (
    severityOrder[left.severity] - severityOrder[right.severity] ||
    left.category.localeCompare(right.category) ||
    left.path.localeCompare(right.path) ||
    left.blob.localeCompare(right.blob)
  );
}

async function runGit(repositoryRoot, args) {
  try {
    const result = await execFileAsync("git", args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      windowsHide: true
    });
    return result.stdout;
  } catch {
    throw new Error(`git ${args[0]} failed during public release scan`);
  }
}

async function runGitWithInput(repositoryRoot, args, input) {
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("git", args, {
      cwd: repositoryRoot,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code !== 0) {
        rejectPromise(new Error(
          `git ${args[0]} failed during public release scan`
        ));
        return;
      }
      resolvePromise(Buffer.concat(stdout));
    });
    child.stdin.end(input);
  });
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;

if (invokedPath === import.meta.url) {
  try {
    const result = await scanPublicReleaseSurface();
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
