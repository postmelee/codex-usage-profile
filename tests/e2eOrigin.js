const DEFAULT_E2E_PORT_BASE = 5200;
const DEFAULT_E2E_PORT_COUNT = 1000;
const E2E_ORIGIN_ERROR =
  "PROFILE_E2E_ORIGIN must be an HTTP 127.0.0.1 origin with an explicit port";

export function resolveE2eOrigin(value, workspacePath = process.cwd()) {
  const candidate = typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : `http://127.0.0.1:${deriveWorkspacePort(workspacePath)}`;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new TypeError(E2E_ORIGIN_ERROR);
  }

  if (
    url.protocol !== "http:"
    || url.hostname !== "127.0.0.1"
    || !url.port
    || url.pathname !== "/"
    || url.search
    || url.hash
    || url.username
    || url.password
  ) {
    throw new TypeError(E2E_ORIGIN_ERROR);
  }

  return Object.freeze({ origin: url.origin, port: url.port });
}

export function deriveWorkspacePort(workspacePath) {
  if (typeof workspacePath !== "string" || workspacePath.trim() === "") {
    throw new TypeError("E2E workspace path must be a non-empty string");
  }

  let hash = 2166136261;
  for (const character of workspacePath) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return String(
    DEFAULT_E2E_PORT_BASE + ((hash >>> 0) % DEFAULT_E2E_PORT_COUNT)
  );
}
