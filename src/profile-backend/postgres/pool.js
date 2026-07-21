import pg from "pg";

export const DEFAULT_POSTGRES_POOL_MAX = 4;
export const DEFAULT_POSTGRES_QUERY_TIMEOUT_MS = 15_000;
export const DEFAULT_POSTGRES_CONNECTION_TIMEOUT_MS = 10_000;
export const DEFAULT_POSTGRES_IDLE_TIMEOUT_MS = 30_000;

// The connection string is a server-only secret. It is read here, at pool
// creation, and is never copied into runtime config objects or logs.
export function resolvePostgresConnectionString(env = process.env) {
  const value = env?.NEON_DATABASE_URL ?? env?.DATABASE_URL ?? "";

  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(
      "NEON_DATABASE_URL is required for the Postgres store"
    );
  }

  return value.trim();
}

// Cloud Run scales 0..N instances that each hold their own pool, so the
// per-instance pool stays small and idle connections are released quickly.
// NEON_DATABASE_URL should point at Neon's pooled (pgbouncer) endpoint.
// Statement timeouts are applied per transaction with SET LOCAL inside the
// store adapter (safe under transaction pooling, where session-level SET
// does not stick); query_timeout below is the client-side backstop for
// non-transactional reads.
export function createPostgresPool(options = {}) {
  const connectionString = options.connectionString
    ?? resolvePostgresConnectionString(options.env);

  return new pg.Pool({
    connectionString,
    max: options.max ?? DEFAULT_POSTGRES_POOL_MAX,
    query_timeout: options.queryTimeoutMs ?? DEFAULT_POSTGRES_QUERY_TIMEOUT_MS,
    connectionTimeoutMillis:
      options.connectionTimeoutMs ?? DEFAULT_POSTGRES_CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: options.idleTimeoutMs ?? DEFAULT_POSTGRES_IDLE_TIMEOUT_MS
  });
}
