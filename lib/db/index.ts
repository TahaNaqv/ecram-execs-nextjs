import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { DB_RETRY_VERSION, installDbRetry } from "./resilient";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

// Reuse one client across hot reloads in development. The version drops a client wrapped by an older retry layer.
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres>; pgRetry?: number };

// Connect through Supabase's *session* pooler (port 5432). The transaction pooler (6543)
// hangs when a page runs several queries in parallel, which streamed pages do.
// - prepare: false keeps the client compatible with either pooler mode
// - idle_timeout frees session-pool slots held by idle serverless instances
// - max_lifetime recycles a connection before the pooler drops it out from under a query
// - connect_timeout makes an unreachable database fail fast instead of hanging the request
// - backoff waits briefly before opening a replacement after a reset
if (globalForDb.pgClient && globalForDb.pgRetry !== DB_RETRY_VERSION) {
  void globalForDb.pgClient.end({ timeout: 1 }).catch(() => undefined);
  globalForDb.pgClient = undefined;
}

const client =
  globalForDb.pgClient ??
  postgres(url, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    max_lifetime: 60 * 5,
    connect_timeout: 10,
    backoff: (attempt) => Math.min(attempt * 200, 2_000),
  });
if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
  globalForDb.pgRetry = DB_RETRY_VERSION;
}
installDbRetry(client);

export const db = drizzle(client, { schema });
/** The postgres.js client under `db`, for code that takes one (lib/retention.ts). */
export const sqlClient = client;
export { schema };
