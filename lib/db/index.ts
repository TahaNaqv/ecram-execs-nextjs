import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

// Reuse one client across hot reloads in development.
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };

// Connect through Supabase's *session* pooler (port 5432). The transaction pooler (6543)
// hangs when a page runs several queries in parallel, which streamed pages do.
// - prepare: false keeps the client compatible with either pooler mode
// - idle_timeout frees session-pool slots held by idle serverless instances
// - connect_timeout makes an unreachable database fail fast instead of hanging the request
const client =
  globalForDb.pgClient ?? postgres(url, { prepare: false, max: 5, idle_timeout: 20, connect_timeout: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
export { schema };
