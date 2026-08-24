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
  "migrate",
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
const DEFAULT_DELETE_ACCOUNT_MAX_ITERATIONS = 128;
const MAX_DELETE_ACCOUNT_MAX_ITERATIONS = 256;

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
  const createOperationId = options.createOperationId ??
    (() => `maintenance_delete_${randomUUID().replaceAll("-", "")}`);
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
  const request = (requestPayload) => sendMaintenanceRequest(requestPayload, {
    fetchImpl,
    origin,
    requestTimeoutMs,
    token
  });

  if (parsed.command === "delete-account") {
    return runDeleteAccount(request, payload, {
      createOperationId,
      maxIterations: requireDeleteAccountMaxIterations(
        options.deleteAccountMaxIterations ??
          DEFAULT_DELETE_ACCOUNT_MAX_ITERATIONS
      ),
      sleep: options.sleep ?? sleep,
      stdout
    });
  }

  const result = await request(payload);

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
    : parsed.command === "migrate"
      ? normalizeMigrationSummary(result.summary)
      : result.summary;
  const progress = parsed.command === "plan" && result.progress !== undefined
    ? normalizeOwnerDeletionProgress(result.progress)
    : null;
  if (progress) stdout(JSON.stringify(progress));
  stdout(JSON.stringify(summary));
  return { ...(progress ? { progress } : {}), summary };
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
    "  migrate             Apply exact pending D1 migrations (idempotent)",
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
    "Delete-account may resume an exact operation with --operation-id.",
    "Repair additionally requires dark/light en/ko application ETags and the stable ETag.",
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
  if (["migrate", "readiness"].includes(parsed.command)) {
    assertIdentitylessOptions(parsed);
    return { operation: parsed.command };
  }
  if (
    parsed.operationId !== undefined &&
    parsed.command !== "delete-account"
  ) {
    throw new TypeError("--operation-id is accepted only by delete-account");
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
  if (parsed.command === "delete-account" && parsed.operationId !== undefined) {
    payload.operationId = requireKeySegment(parsed.operationId, "operationId");
  }
  if (parsed.command === "repair-publication") {
    payload.expectedStorageEtag = parsed.expectedStorageEtag === "missing"
      ? null
      : requireNonEmptyString(
        parsed.expectedStorageEtag,
        "expectedStorageEtag"
      );
    payload.expectedApplicationEtags = {
      dark: {
        en: requireApplicationEtag(
          parsed.expectedDarkEnEtag,
          "expectedDarkEnEtag"
        ),
        ko: requireApplicationEtag(
          parsed.expectedDarkKoEtag,
          "expectedDarkKoEtag"
        )
      },
      light: {
        en: requireApplicationEtag(
          parsed.expectedLightEnEtag,
          "expectedLightEnEtag"
        ),
        ko: requireApplicationEtag(
          parsed.expectedLightKoEtag,
          "expectedLightKoEtag"
        )
      }
    };
  }
  return payload;
}

function assertIdentitylessOptions(parsed) {
  if (parsed.apply === true) {
    throw new TypeError(`${parsed.command} does not accept --apply`);
  }
  const allowed = new Set(["apply", "command", "help", "origin"]);
  const unexpected = Object.keys(parsed)
    .filter((key) => !allowed.has(key) && parsed[key] !== undefined);
  if (unexpected.length > 0) {
    throw new TypeError(`${parsed.command} accepts only --origin`);
  }
}

function normalizeMigrationSummary(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw cliError("invalid_response");
  }
  const keys = Object.keys(value).sort();
  if (
    keys.length !== 3 ||
    keys[0] !== "appliedVersions" ||
    keys[1] !== "newlyAppliedVersions" ||
    keys[2] !== "operation" ||
    value.operation !== "migrate"
  ) {
    throw cliError("invalid_response");
  }
  const appliedVersions = normalizeMigrationVersions(value.appliedVersions);
  const newlyAppliedVersions = normalizeNewMigrationVersions(
    value.newlyAppliedVersions,
    appliedVersions
  );
  return Object.freeze({
    appliedVersions,
    newlyAppliedVersions,
    operation: "migrate"
  });
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

function normalizeNewMigrationVersions(value, appliedVersions) {
  if (!Array.isArray(value)) throw cliError("invalid_response");
  const allowed = new Set(appliedVersions);
  const normalized = [...value];
  if (
    normalized.some((version, index) =>
      !Number.isSafeInteger(version) ||
      !allowed.has(version) ||
      (index > 0 && version <= normalized[index - 1])
    )
  ) {
    throw cliError("invalid_response");
  }
  return Object.freeze(normalized);
}

async function sendMaintenanceRequest(payload, options) {
  const controller = new AbortController();
  let timeout;
  let response;
  try {
    response = await Promise.race([
      options.fetchImpl(
        new URL(PROFILE_SITES_MAINTENANCE_PATH, `${options.origin}/`),
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${options.token}`,
            "content-type": "application/json",
            origin: options.origin
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        }
      ),
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(cliError("network_unavailable"));
        }, options.requestTimeoutMs);
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
  return result;
}

async function runDeleteAccount(request, payload, options) {
  const planPayload = Object.freeze({
    operation: "plan",
    ownerId: payload.ownerId,
    handle: payload.handle
  });
  const approval = Object.freeze({
    contentDigest: payload.expectedContentDigest,
    objectCount: payload.expectedObjectCount
  });
  let operationId = payload.operationId ?? null;
  let initialSummary;
  let lastProgress = null;
  let applyAttempted = false;
  let unchangedRetryAvailable = true;

  const emitProgress = (progress, source = "plan") => {
    assertDeleteProgress(progress, { approval, operationId });
    if (operationId === null) operationId = progress.operationId;
    assertMonotonicDeleteProgress(lastProgress, progress, source);
    if (!lastProgress || !sameDeleteProgress(lastProgress, progress)) {
      options.stdout(JSON.stringify(progress));
    }
    lastProgress = progress;
  };

  const reconcile = async () => {
    let result;
    try {
      result = await request(planPayload);
    } catch (error) {
      if (applyAttempted && error?.code === "not_found") {
        return { completed: true };
      }
      throw error;
    }
    const summary = normalizeMaintenanceSummary(result.summary, "plan");
    initialSummary ??= summary;
    if (result.progress !== undefined) {
      const progress = normalizeOwnerDeletionProgress(result.progress);
      if (progress.status !== "in_progress") {
        throw cliError("invalid_response");
      }
      if (
        operationId !== null &&
        operationId !== progress.operationId
      ) {
        throw cliError("maintenance_conflict");
      }
      emitProgress(progress, "plan");
      return { progress };
    }
    assertDeleteApproval(summary, approval);
    if (!applyAttempted) return { unchanged: true };
    if (unchangedRetryAvailable) {
      unchangedRetryAvailable = false;
      return { unchanged: true };
    }
    throw cliError("maintenance_conflict");
  };

  const first = await reconcile();
  if (first.completed) {
    throw cliError("not_found");
  }
  if (operationId === null) {
    operationId = requireKeySegment(options.createOperationId(), "operationId");
  }
  const applyPayload = Object.freeze({ ...payload, operationId });

  for (let iteration = 0; iteration < options.maxIterations; iteration += 1) {
    if (lastProgress?.retryAfterSeconds !== undefined) {
      await options.sleep(lastProgress.retryAfterSeconds * 1_000);
      const waited = await reconcile();
      if (waited.completed) {
        return completeDeleteAccount({
          approval,
          initialSummary,
          lastProgress,
          operationId,
          stdout: options.stdout
        });
      }
      if (lastProgress?.retryAfterSeconds !== undefined) continue;
    }

    let result;
    try {
      applyAttempted = true;
      result = await request(applyPayload);
    } catch (error) {
      if (error?.code === "not_found") {
        return completeDeleteAccount({
          approval,
          initialSummary,
          lastProgress,
          operationId,
          stdout: options.stdout
        });
      }
      if (
        error?.code !== "network_unavailable" &&
        error?.code !== "maintenance_conflict"
      ) {
        throw error;
      }
      const reconciled = await reconcile();
      if (reconciled.completed) {
        return completeDeleteAccount({
          approval,
          initialSummary,
          lastProgress,
          operationId,
          stdout: options.stdout
        });
      }
      continue;
    }

    const summary = normalizeMaintenanceSummary(
      result.summary,
      "delete-account"
    );
    assertDeleteApproval(summary, approval);
    const progress = normalizeOwnerDeletionProgress(result.progress);
    emitProgress(progress, "apply");
    if (progress.status === "completed") {
      options.stdout(JSON.stringify(summary));
      return { progress, summary };
    }
  }
  throw cliError("delete_account_iteration_limit");
}

function completeDeleteAccount(options) {
  const progress = Object.freeze({
    contractVersion: 1,
    status: "completed",
    phase: "completed",
    operationId: options.operationId,
    deletedRevisionCount: options.lastProgress?.deletedRevisionCount ?? 0,
    remainingRevisionCount: 0
  });
  assertMonotonicDeleteProgress(options.lastProgress, progress, "plan");
  if (!options.lastProgress || !sameDeleteProgress(options.lastProgress, progress)) {
    options.stdout(JSON.stringify(progress));
  }
  const summary = Object.freeze({
    contentDigest: options.approval.contentDigest,
    contractVersion: 1,
    createdAt: options.initialSummary.createdAt,
    objectCount: options.approval.objectCount,
    operation: "delete-account",
    ownerCount: 1,
    schemaVersion: 1
  });
  options.stdout(JSON.stringify(summary));
  return { progress, summary };
}

function normalizeMaintenanceSummary(value, operation) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw cliError("invalid_response");
  }
  const keys = Object.keys(value).sort();
  const expected = [
    "contentDigest",
    "contractVersion",
    "createdAt",
    "objectCount",
    "operation",
    "ownerCount",
    "schemaVersion"
  ];
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index]) ||
    value.contractVersion !== 1 ||
    value.schemaVersion !== 1 ||
    value.operation !== operation ||
    value.ownerCount !== 1 ||
    !Number.isSafeInteger(value.objectCount) ||
    value.objectCount < 0 ||
    typeof value.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt))
  ) {
    throw cliError("invalid_response");
  }
  let contentDigest;
  try {
    contentDigest = requireDigest(value.contentDigest);
  } catch {
    throw cliError("invalid_response");
  }
  return Object.freeze({ ...value, contentDigest });
}

function normalizeOwnerDeletionProgress(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw cliError("invalid_response");
  }
  const completedKeys = [
    "contractVersion",
    "deletedRevisionCount",
    "operationId",
    "phase",
    "remainingRevisionCount",
    "status"
  ];
  const inProgressKeys = [
    "contractVersion",
    "deletedRevisionCount",
    "expectedContentDigest",
    "expectedObjectCount",
    "operationId",
    "phase",
    "remainingRevisionCount",
    "status"
  ];
  const keys = Object.keys(value).sort();
  const expectedKeys = value.status === "completed"
    ? completedKeys
    : value.retryAfterSeconds === undefined
      ? inProgressKeys
      : [...inProgressKeys, "retryAfterSeconds"].sort();
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index]) ||
    value.contractVersion !== 1 ||
    !Number.isSafeInteger(value.deletedRevisionCount) ||
    value.deletedRevisionCount < 0 ||
    !Number.isSafeInteger(value.remainingRevisionCount) ||
    value.remainingRevisionCount < 0
  ) {
    throw cliError("invalid_response");
  }
  try {
    requireKeySegment(value.operationId, "operationId");
  } catch {
    throw cliError("invalid_response");
  }
  if (value.status === "completed") {
    if (value.phase !== "completed" || value.remainingRevisionCount !== 0) {
      throw cliError("invalid_response");
    }
    return Object.freeze({ ...value });
  }
  if (
    value.status !== "in_progress" ||
    !["prepare", "media", "structured"].includes(value.phase) ||
    !Number.isSafeInteger(value.expectedObjectCount) ||
    value.expectedObjectCount < 0
  ) {
    throw cliError("invalid_response");
  }
  try {
    requireDigest(value.expectedContentDigest);
  } catch {
    throw cliError("invalid_response");
  }
  if (
    value.retryAfterSeconds !== undefined &&
    (!Number.isSafeInteger(value.retryAfterSeconds) ||
      value.retryAfterSeconds < 1 ||
      value.retryAfterSeconds > 120)
  ) {
    throw cliError("invalid_response");
  }
  return Object.freeze({ ...value });
}

function assertDeleteApproval(summary, approval) {
  if (
    summary.contentDigest !== approval.contentDigest ||
    summary.objectCount !== approval.objectCount
  ) {
    throw cliError("maintenance_conflict");
  }
}

function assertDeleteProgress(progress, options) {
  if (
    options.operationId !== null &&
    progress.operationId !== options.operationId
  ) {
    throw cliError("maintenance_conflict");
  }
  if (
    progress.status === "in_progress" &&
    (progress.expectedContentDigest !== options.approval.contentDigest ||
      progress.expectedObjectCount !== options.approval.objectCount)
  ) {
    throw cliError("maintenance_conflict");
  }
}

function assertMonotonicDeleteProgress(previous, current, source) {
  if (!previous) return;
  const ranks = { prepare: 0, media: 1, structured: 2, completed: 3 };
  if (
    current.operationId !== previous.operationId ||
    ranks[current.phase] < ranks[previous.phase] ||
    current.remainingRevisionCount > previous.remainingRevisionCount
  ) {
    throw cliError("maintenance_conflict");
  }
  if (
    source === "apply" &&
    current.status === "in_progress" &&
    current.phase === previous.phase &&
    current.remainingRevisionCount === previous.remainingRevisionCount &&
    current.retryAfterSeconds === undefined
  ) {
    throw cliError("progress_stalled");
  }
}

function sameDeleteProgress(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requireDeleteAccountMaxIterations(value) {
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_DELETE_ACCOUNT_MAX_ITERATIONS
  ) {
    throw new TypeError("deleteAccountMaxIterations must be bounded");
  }
  return value;
}

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
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
  "--expected-dark-en-etag": "expectedDarkEnEtag",
  "--expected-dark-ko-etag": "expectedDarkKoEtag",
  "--expected-light-en-etag": "expectedLightEnEtag",
  "--expected-light-ko-etag": "expectedLightKoEtag",
  "--expected-storage-etag": "expectedStorageEtag",
  "--handle": "handle",
  "--input": "input",
  "--origin": "origin",
  "--operation-id": "operationId",
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
