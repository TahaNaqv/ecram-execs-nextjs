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

// Neon’s pooled host is PgBouncer in transaction mode. Prepared statements stay off.
// A suspended compute often needs more than 10s for the first TCP handshake, which was
// surfacing as CONNECT_TIMEOUT and a retry. postgres.js multiplies `backoff` by 1000,
// so the value is seconds — a millisecond return waits minutes before the next socket.
if (globalForDb.pgClient && globalForDb.pgRetry !== DB_RETRY_VERSION) {
  void globalForDb.pgClient.end({ timeout: 1 }).catch(() => undefined);
  globalForDb.pgClient = undefined;
}

const client =
  globalForDb.pgClient ??
  postgres(url, {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    max_lifetime: 60 * 5,
    connect_timeout: 25,
    keep_alive: 30,
    backoff: (attempt) => Math.min(attempt * 0.2, 2),
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
