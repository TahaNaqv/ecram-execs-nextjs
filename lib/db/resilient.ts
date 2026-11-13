import type { Sql } from "postgres";

/**
 * Connection drops from the pooler (idle kill, cold start, reset) that a second attempt
 * on a fresh connection can clear. Business errors are left to the caller.
 */
const TRANSIENT_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "ENOTFOUND",
  "EAI_AGAIN",
  "57P01",
  "57P02",
  "57P03",
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "08P01",
  "40001",
  "40P01",
  "53300",
  "55P03",
]);

const TRANSIENT_MESSAGE =
  /connection (?:ended|closed|reset|terminated)|CONNECT_TIMEOUT|CONNECTION_CLOSED|CONNECTION_ENDED|CONNECTION_DESTROYED|ECONNRESET|socket hang up|Client has encountered a connection error|too many clients|remaining connection slots|timeout expired/i;

/** Bump when the wrapper changes so a hot reload drops a client that was wrapped by an older version. */
export const DB_RETRY_VERSION = 3;

type Pending = {
  then: Promise<unknown>["then"];
  execute?: () => Pending;
  values?: (...args: unknown[]) => Pending;
  raw?: (...args: unknown[]) => Pending;
  simple?: (...args: unknown[]) => Pending;
};

type ChainMethod = "values" | "raw" | "simple";

const MARK = Symbol.for("ecram.db.retry");

export function isTransientDbError(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== "object" || depth > 5) return false;
  const e = error as { code?: string; errno?: string; message?: string; cause?: unknown };
  if (e.code && TRANSIENT_CODES.has(e.code)) return true;
  if (typeof e.errno === "string" && TRANSIENT_CODES.has(e.errno)) return true;
  if (TRANSIENT_MESSAGE.test(e.message ?? "")) return true;
  return isTransientDbError(e.cause, depth + 1);
}

function describe(error: unknown) {
  if (error instanceof Error) {
    const extra = error as Error & { code?: string };
    return { name: extra.name, code: extra.code, message: extra.message, stack: extra.stack };
  }
  return { message: String(error) };
}

function logDb(error: unknown, context: string) {
  console.error(`[db] ${context}`, describe(error));
}

const RETRY_DELAYS_MS = [200, 600];

/** The pooler often answers the next query on the socket it just closed. Wait so that socket is dropped first. */
function retryAsync<T>(run: () => Promise<T>, label: string): Promise<T> {
  const attempt = async (left: number): Promise<T> => {
    try {
      return await run();
    } catch (error) {
      if (left <= 0 || !isTransientDbError(error)) throw error;
      const n = RETRY_DELAYS_MS.length - left + 1;
      logDb(error, `${label} dropped, retry ${n}`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[n - 1]));
      return attempt(left - 1);
    }
  };
  return attempt(RETRY_DELAYS_MS.length).catch((error: unknown) => {
    if (isTransientDbError(error)) logDb(error, `${label} failed after retries`);
    throw error;
  });
}

/**
 * Drizzle awaits `unsafe().values()`. postgres.js `begin` calls `unsafe().execute()` and expects
 * the real query back, because `execute` starts the statement and returns that same query.
 * The chain is recorded and the real query is built only when something waits for it, so a retry
 * opens one new query rather than a second copy of the first.
 */
function chain(create: () => Pending, steps: { method: ChainMethod; args: unknown[] }[] = []): Pending {
  const build = () => {
    let query = create();
    for (const step of steps) query = query[step.method]!.call(query, ...step.args);
    return query;
  };

  return new Proxy({} as Pending, {
    get(_target, prop) {
      if (prop === "then") {
        return (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
          retryAsync(() => Promise.resolve(build()), "query").then(onFulfilled, onRejected);
      }
      if (prop === "catch") {
        return (onRejected?: (reason: unknown) => unknown) => retryAsync(() => Promise.resolve(build()), "query").catch(onRejected);
      }
      if (prop === "finally") {
        return (onFinally?: () => void) => retryAsync(() => Promise.resolve(build()), "query").finally(onFinally);
      }
      if (prop === "execute") return () => build().execute?.() ?? build();
      if (prop === "values" || prop === "raw" || prop === "simple") {
        const method = prop;
        return (...args: unknown[]) => chain(create, [...steps, { method, args }]);
      }
      const query = build();
      const value = query[prop as keyof Pending];
      return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(query) : value;
    },
  });
}

/** Retry a dropped connection once, on the shared client Drizzle and `sql.begin` use. */
export function installDbRetry(client: Sql): void {
  const marked = client as Sql & { [MARK]?: number };
  if (marked[MARK] === DB_RETRY_VERSION) return;
  marked[MARK] = DB_RETRY_VERSION;

  const unsafe = client.unsafe.bind(client);
  client.unsafe = ((query: string, params?: unknown[], options?: unknown) =>
    chain(() => unsafe(query, params as never, options as never))) as typeof client.unsafe;

  const begin = client.begin.bind(client);
  client.begin = ((first: unknown, second?: unknown) => {
    const run = () => (typeof first === "function" ? begin(first as never) : begin(first as never, second as never));
    return retryAsync(() => Promise.resolve(run()), "transaction");
  }) as typeof client.begin;
}
