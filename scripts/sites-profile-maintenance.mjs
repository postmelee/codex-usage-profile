import {
  chmod,
  link,
  open,
  readFile,
  realpath,
  stat,
  unlink
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve
} from "node:path";
import { fileURLToPath } from "node:url";

import {
  PROFILE_SITES_MAINTENANCE_PATH
} from "../src/profile-runtime/sites/maintenance.js";

const MUTATING_COMMANDS = new Set([
  "restore",
  "retention",
  "delete-account",
  "repair-publication"
]);
const APPLY_REQUIRED_COMMANDS = new Set([
  "restore",
  "delete-account",
  "repair-publication"
]);
const OWNER_COMMANDS = new Set([
  "plan",
  "export",
  "restore",
  "delete-account",
  "repair-publication"
]);
const COMMANDS = new Set([
  "readiness",
  "plan",
  "export",
  "restore",
  "retention",
  "delete-account",
  "repair-publication"
]);
const MAX_BACKUP_FILE_BYTES = 512 * 1024;
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const MAX_REQUEST_TIMEOUT_MS = 60_000;

export async function runSitesProfileMaintenanceCli(args = [], options = {}) {
  const parsed = parseSitesProfileMaintenanceArgs(args);
  const stdout = options.stdout ?? console.log;
  if (parsed.help) {
    stdout(sitesProfileMaintenanceHelpText());
    return { help: true };
  }

  const environment = options.environment ?? process.env;
  const token = requireToken(environment.PROFILE_MAINTENANCE_TOKEN);
  const origin = normalizeOrigin(parsed.origin);
  const payload = await createOperationPayload(parsed, {
    readBackup: options.readBackup ?? readBackupFile,
    repositoryRoot: options.repositoryRoot ?? resolve(".")
  });
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw cliError("network_unavailable");
  }
  const requestTimeoutMs = requireRequestTimeoutMs(
    options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
  );

  let response;
  const controller = new AbortController();
  let timeout;
  try {
    response = await Promise.race([
      fetchImpl(
        new URL(PROFILE_SITES_MAINTENANCE_PATH, `${origin}/`),
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            origin
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        }
      ),
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(cliError("network_unavailable"));
        }, requestTimeoutMs);
      })
    ]);
  } catch {
    throw cliError("network_unavailable");
  } finally {
    clearTimeout(timeout);
  }
  const result = await readSafeResponse(response);
  if (!response.ok || result?.ok !== true) {
    throw cliError(result?.error?.code ?? "maintenance_failed");
  }

  if (parsed.command === "export") {
    if (!result.backup || typeof result.backup !== "object") {
      throw cliError("invalid_response");
    }
    const writeBackup = options.writeBackup ?? writeBackupFile;
    await writeBackup(parsed.output, result.backup, {
      repositoryRoot: options.repositoryRoot ?? resolve(".")
    });
  }
  const summary = parsed.command === "readiness"
    ? normalizeReadinessSummary(result.summary)
    : result.summary;
  stdout(JSON.stringify(summary));
  return { summary };
}

export function parseSitesProfileMaintenanceArgs(args = []) {
  const values = {};
  let apply = false;
  let help = false;
  const command = args[0];
  if (!command || command === "--help" || command === "-h") {
    return { command: null, help: true };
  }
  if (!COMMANDS.has(command)) {
    throw new TypeError("Unsupported Sites maintenance command");
  }

  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--apply") {
      apply = true;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      help = true;
      continue;
    }
    if (!argument.startsWith("--")) {
      throw new TypeError("Sites maintenance options must be named");
    }
    const key = OPTION_KEYS[argument];
    if (!key) throw new TypeError("Unsupported Sites maintenance option");
    if (Object.hasOwn(values, key)) {
      throw new TypeError("Sites maintenance option was provided more than once");
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new TypeError("Sites maintenance option value is missing");
    }
    values[key] = value;
    index += 1;
  }

  return {
    apply,
    command,
    help,
    ...values
  };
}

export function sitesProfileMaintenanceHelpText() {
  return [
    "Usage: npm run sites:profile-maintenance -- <command> --origin <https-origin> [options]",
    "",
    "Commands:",
    "  readiness           Verify the exact D1 migration set (read-only)",
    "  plan                Create an owner deletion plan",
    "  export              Export one durable owner backup",
    "  restore             Restore a backup (requires --apply)",
    "  retention           Plan or apply transient/orphan retention",
    "  delete-account      Delete one exact owner (requires --apply)",
    "  repair-publication  Repair one exact stable publication (requires --apply)",
    "",
    "Owner commands require --owner-id and --handle.",
    "Mutations require --apply, --expected-digest, --expected-count, and exact owner options.",
    "The maintenance token is read only from PROFILE_MAINTENANCE_TOKEN.",
    "Export requires --output outside the repository and writes a new 0600 file."
  ].join("\n");
}

export async function writeBackupFile(path, backup, options = {}) {
  const target = await resolveExternalOutputPath(
    path,
    options.repositoryRoot ?? resolve(".")
  );
  const directory = dirname(target);
  const temporary = resolve(
    directory,
    `.${randomUUID().replaceAll("-", "")}.profile-backup.tmp`
  );
  const text = `${JSON.stringify(backup)}\n`;
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(text, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await chmod(temporary, 0o600);
    await link(temporary, target);
  } finally {
    await handle?.close().catch(() => {});
    await unlink(temporary).catch(() => {});
  }
}

export async function readBackupFile(path) {
  const target = requirePath(path, "input");
  const metadata = await stat(target);
  if (!metadata.isFile() || metadata.size > MAX_BACKUP_FILE_BYTES) {
    throw new TypeError("maintenance backup input is invalid");
  }
  return JSON.parse(await readFile(target, "utf8"));
}

async function createOperationPayload(parsed, options) {
  if (parsed.help) return { operation: parsed.command };
  if (!parsed.origin) throw new TypeError("--origin is required");
  if (parsed.command === "readiness") {
    assertReadinessOptions(parsed);
    return { operation: "readiness" };
  }
  if (OWNER_COMMANDS.has(parsed.command)) {
    requireKeySegment(parsed.ownerId, "ownerId");
    requireHandle(parsed.handle);
  }
  if (APPLY_REQUIRED_COMMANDS.has(parsed.command) && parsed.apply !== true) {
    throw new TypeError(`${parsed.command} requires --apply`);
  }

  const payload = {
    operation: parsed.command
  };
  if (OWNER_COMMANDS.has(parsed.command)) {
    payload.ownerId = parsed.ownerId;
    payload.handle = parsed.handle;
  }
  if (parsed.retentionDays !== undefined) {
    payload.retentionDays = requirePositiveIntegerText(
      parsed.retentionDays,
      "retentionDays"
    );
  }
  if (parsed.recentRevisions !== undefined) {
    payload.recentRevisions = requirePositiveIntegerText(
      parsed.recentRevisions,
      "recentRevisions"
    );
  }
  if (parsed.command === "export") {
    parsed.output = await resolveExternalOutputPath(
      parsed.output,
      options.repositoryRoot
    );
  }
  if (parsed.command === "restore") {
    payload.backup = await options.readBackup(
      requirePath(parsed.input, "input")
    );
  }
  if (MUTATING_COMMANDS.has(parsed.command) && parsed.apply === true) {
    payload.apply = true;
    payload.expectedContentDigest = requireDigest(parsed.expectedContentDigest);
    payload.expectedObjectCount = requireNonNegativeIntegerText(
      parsed.expectedObjectCount,
      "expectedObjectCount"
    );
  }
  if (OWNER_COMMANDS.has(parsed.command) && parsed.apply === true) {
    payload.confirmOwner = {
      handle: parsed.handle,
      ownerId: parsed.ownerId
    };
  }
  if (parsed.command === "repair-publication") {
    payload.expectedStorageEtag = parsed.expectedStorageEtag === "missing"
      ? null
      : requireNonEmptyString(
        parsed.expectedStorageEtag,
        "expectedStorageEtag"
      );
    payload.expectedApplicationEtags = {
      en: requireApplicationEtag(parsed.expectedEnEtag, "expectedEnEtag"),
      ko: requireApplicationEtag(parsed.expectedKoEtag, "expectedKoEtag")
    };
  }
  return payload;
}

function assertReadinessOptions(parsed) {
  if (parsed.apply === true) {
    throw new TypeError("readiness does not accept --apply");
  }
  const allowed = new Set(["apply", "command", "help", "origin"]);
  const unexpected = Object.keys(parsed)
    .filter((key) => !allowed.has(key) && parsed[key] !== undefined);
  if (unexpected.length > 0) {
    throw new TypeError("readiness accepts only --origin");
  }
}

function normalizeReadinessSummary(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw cliError("invalid_response");
  }
  const keys = Object.keys(value).sort();
  if (
    keys.length !== 4 ||
    keys[0] !== "appliedVersions" ||
    keys[1] !== "expectedVersions" ||
    keys[2] !== "operation" ||
    keys[3] !== "ready" ||
    value.operation !== "readiness" ||
    value.ready !== true
  ) {
    throw cliError("invalid_response");
  }
  const appliedVersions = normalizeMigrationVersions(value.appliedVersions);
  const expectedVersions = normalizeMigrationVersions(value.expectedVersions);
  if (
    appliedVersions.length !== expectedVersions.length ||
    appliedVersions.some((version, index) => version !== expectedVersions[index])
  ) {
    throw cliError("invalid_response");
  }
  return Object.freeze({
    appliedVersions,
    expectedVersions,
    operation: "readiness",
    ready: true
  });
}

function normalizeMigrationVersions(value) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((version, index) =>
      !Number.isSafeInteger(version) ||
      version !== index + 1
    )
  ) {
    throw cliError("invalid_response");
  }
  return Object.freeze([...value]);
}

async function readSafeResponse(response) {
  try {
    return await response.json();
  } catch {
    throw cliError("invalid_response");
  }
}

function normalizeOrigin(value) {
  const origin = requireNonEmptyString(value, "origin");
  let url;
  try {
    url = new URL(origin);
  } catch {
    throw new TypeError("--origin must be an absolute HTTP origin");
  }
  const loopback = ["127.0.0.1", "::1", "localhost"].includes(url.hostname);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    (url.protocol !== "https:" && !loopback) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new TypeError("--origin must be HTTPS or an explicit loopback origin");
  }
  return url.origin;
}

function requireExternalPath(value, repositoryRoot) {
  const path = requirePath(value, "output");
  const root = resolve(repositoryRoot);
  const relation = relative(root, path);
  if (relation === "" || (!relation.startsWith("..") && !isAbsolute(relation))) {
    throw new TypeError("backup output must be outside the repository");
  }
  return path;
}

async function resolveExternalOutputPath(value, repositoryRoot) {
  const lexical = requireExternalPath(value, repositoryRoot);
  const [actualDirectory, actualRepository] = await Promise.all([
    realpath(dirname(lexical)),
    realpath(resolve(repositoryRoot))
  ]);
  const actualTarget = resolve(actualDirectory, basename(lexical));
  const relation = relative(actualRepository, actualTarget);
  if (
    relation === "" ||
    (!relation.startsWith("..") && !isAbsolute(relation))
  ) {
    throw new TypeError("backup output must be outside the repository");
  }
  return actualTarget;
}

function requirePath(value, label) {
  const path = requireNonEmptyString(value, label);
  if (!isAbsolute(path)) {
    throw new TypeError(`${label} must be an absolute path`);
  }
  return resolve(path);
}

function requireToken(value) {
  if (typeof value !== "string" || value === "") {
    throw cliError("maintenance_token_missing");
  }
  return value;
}

function requireKeySegment(value, label) {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(value)
  ) {
    throw new TypeError(`${label} must be a safe key segment`);
  }
  return value;
}

function requireHandle(value) {
  if (
    typeof value !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  ) {
    throw new TypeError("handle must be canonical");
  }
  return value;
}

function requireDigest(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new TypeError("--expected-digest must be a SHA-256 digest");
  }
  return value;
}

function requireApplicationEtag(value, label) {
  if (typeof value !== "string" || !/^"[A-Za-z0-9_-]{43}"$/.test(value)) {
    throw new TypeError(`${label} must be a quoted application ETag`);
  }
  return value;
}

function requirePositiveIntegerText(value, label) {
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new TypeError(`${label} must be a positive integer`);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    throw new TypeError(`${label} must be a safe integer`);
  }
  return number;
}

function requireNonNegativeIntegerText(value, label) {
  if (!/^(?:0|[1-9][0-9]*)$/.test(value ?? "")) {
    throw new TypeError(`${label} must be a non-negative integer`);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    throw new TypeError(`${label} must be a safe integer`);
  }
  return number;
}

function requireRequestTimeoutMs(value) {
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_REQUEST_TIMEOUT_MS
  ) {
    throw new TypeError("requestTimeoutMs must be a bounded positive integer");
  }
  return value;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} is required`);
  }
  return value.trim();
}

function cliError(code) {
  const error = new Error(`Sites profile maintenance failed (${code})`);
  error.name = "SitesProfileMaintenanceCliError";
  error.code = code;
  return error;
}

const OPTION_KEYS = Object.freeze({
  "--expected-count": "expectedObjectCount",
  "--expected-digest": "expectedContentDigest",
  "--expected-en-etag": "expectedEnEtag",
  "--expected-ko-etag": "expectedKoEtag",
  "--expected-storage-etag": "expectedStorageEtag",
  "--handle": "handle",
  "--input": "input",
  "--origin": "origin",
  "--output": "output",
  "--owner-id": "ownerId",
  "--recent-revisions": "recentRevisions",
  "--retention-days": "retentionDays"
});

async function main() {
  await runSitesProfileMaintenanceCli(process.argv.slice(2));
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error?.code
      ? `Sites profile maintenance failed (${error.code}).`
      : "Sites profile maintenance failed.");
    process.exitCode = 1;
  });
}
