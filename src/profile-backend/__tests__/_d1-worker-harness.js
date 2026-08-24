import {
  assertProfileBackendStoreContract
} from "../store-contract.js";
import {
  createD1ProfileBackendStore
} from "../d1/store.js";
import {
  createD1AccountUsageRateLimiter
} from "../d1/rate-limiter.js";
import {
  createD1ProfileMaintenance
} from "../d1/maintenance.js";
import {
  migrateD1Database
} from "../d1/migration-runner.js";

export default {
  async fetch(request, environment) {
    try {
      const payload = request.method === "POST"
        ? await request.json()
        : {};
      const store = createD1ProfileBackendStore({
        database: environment.DB,
        createNonce: () => crypto.randomUUID()
      });
      const pathname = new URL(request.url).pathname;

      if (pathname === "/migrate") {
        return json(await migrateD1Database(environment.DB, {
          migrations: payload.migrations,
          now: () => new Date(payload.now ?? "2026-07-23T00:00:00.000Z")
        }));
      }
      if (pathname === "/rpc") {
        return json(await store[payload.method](...(payload.args ?? [])));
      }
      if (pathname === "/atomic") {
        return json(await store.atomic[payload.operation](payload.command));
      }
      if (pathname === "/maintenance") {
        const maintenance = createD1ProfileMaintenance({
          database: environment.DB,
          now: () => new Date(
            payload.options?.now ?? "2026-07-23T00:00:00.000Z"
          )
        });
        return json(await maintenance[payload.method](payload.options));
      }
      if (pathname === "/contract") {
        assertProfileBackendStoreContract(store);
        return json({
          hasAtomic: true,
          hasTransaction: typeof store.transaction === "function"
        });
      }
      if (pathname === "/rate") {
        const limiter = createD1AccountUsageRateLimiter({
          database: environment.DB,
          now: () => new Date(payload.now),
          ...payload.options
        });
        await limiter.consume(payload.key);
        return json({ consumed: true });
      }
      if (pathname === "/inspect") {
        return json(await inspect(environment.DB, payload.name));
      }

      return json({ message: "not found" }, 404);
    } catch (error) {
      return json({
        __error: true,
        code: error?.code ?? null,
        message: error instanceof Error ? error.message : String(error),
        status: error?.status ?? 500,
        headers: error?.headers ?? null
      });
    }
  }
};

async function inspect(database, name) {
  if (name === "tables") {
    return (
      await database.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
      ).all()
    ).results;
  }
  if (name === "rateLimits") {
    return (
      await database.prepare(
        "SELECT rate_key, window_kind, window_start_ms, window_end_ms, request_count " +
        "FROM account_usage_rate_limits ORDER BY window_kind"
      ).all()
    ).results;
  }
  if (name === "atomicClaims") {
    return {
      assertions: (
        await database.prepare(
          "SELECT nonce FROM atomic_operation_assertions"
        ).all()
      ).results,
      claims: (
        await database.prepare(
          "SELECT operation, claim_key, nonce, outcome FROM atomic_operation_claims"
        ).all()
      ).results
    };
  }
  if (name === "deletionOperations") {
    return (
      await database.prepare(
        "SELECT owner_id, handle, operation_id, approved_content_digest, " +
        "approved_object_count, phase, lease_nonce, lease_expires_at, " +
        "created_at, updated_at FROM account_deletion_operations " +
        "ORDER BY owner_id"
      ).all()
    ).results;
  }
  throw new TypeError("unknown inspection");
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value === undefined ? null : value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}
