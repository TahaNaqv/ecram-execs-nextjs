// Applies pending migrations, with the safeguards `drizzle-kit migrate` does not give you.
//
//   node --env-file=.env.local scripts/migrate.mts            # local, dry run
//   node --env-file=.env.local scripts/migrate.mts --apply    # local, apply
//   node --env-file=.env       scripts/migrate.mts            # production, dry run
//   node --env-file=.env       scripts/migrate.mts --apply    # production, apply
//
// Why this exists rather than `drizzle-kit migrate`:
//   1. drizzle-kit has printed "migrations applied successfully" while applying nothing. This
//      verifies against drizzle.__drizzle_migrations afterwards and fails loudly if the count
//      did not move.
//   2. The target database is chosen by which --env-file you pass, so pointing at production is
//      a deliberate act. It also prints the host and refuses to apply without --apply.
//   3. It runs a pre-flight check for data the migrations cannot map, before changing anything.
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { LEGACY_SERVICE_LABELS, SERVICES } from "../lib/quotes/constants.ts";

const APPLY = process.argv.includes("--apply");
const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  console.error("No DATABASE_URL. Pass one with --env-file=.env.local or --env-file=.env");
  process.exit(1);
}

const { host, pathname } = new URL(url);
const isLocal = host.startsWith("127.0.0.1") || host.startsWith("localhost");
console.log(`Target: ${host}${pathname}  ${isLocal ? "(local)" : "*** NOT LOCAL ***"}`);

/**
 * `--local` is passed by the local npm scripts and makes hitting a remote database impossible.
 *
 * This exists because it already happened: `drizzle-kit` bundles tsx/esbuild-kit, which loads
 * `.env` on its own. `--env-file-if-exists=.env.local` set DATABASE_URL to the local Docker
 * instance, but `.env` also set DATABASE_URL_DIRECT to Supabase — and drizzle.config.ts prefers
 * DATABASE_URL_DIRECT. A migration meant for local went to production. This script does not use
 * drizzle-kit and loads nothing implicitly, but the guard makes the mistake unrepeatable.
 */
if (process.argv.includes("--local") && !isLocal) {
  console.error(`\n✗ refusing: this script was invoked as a LOCAL migration but ${host} is not local.`);
  console.error("  Something is injecting a remote DATABASE_URL — check .env and your shell before continuing.");
  console.error("  To migrate production deliberately: npm run db:migrate:prod -- --apply");
  process.exit(1);
}
console.log(APPLY ? "Mode:   apply\n" : "Mode:   dry run (pass --apply to write)\n");

const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  // ── Pre-flight: values the migrations are not able to map
  const tables = await sql<{ table_name: string }[]>`
    select table_name from information_schema.tables where table_schema = 'public'`;
  const names = new Set(tables.map((t) => t.table_name));

  if (names.has("quote_requests")) {
    const cols = await sql<{ data_type: string }[]>`
      select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'quote_requests' and column_name = 'service'`;
    if (cols[0]?.data_type === "text") {
      const known = [...Object.keys(LEGACY_SERVICE_LABELS), ...SERVICES];
      const rows = await sql<{ service: string; n: number }[]>`
        select service, count(*)::int as n from quote_requests
        where service <> all(${sql.array(known)}) group by 1 order by 2 desc`;
      if (rows.length) {
        console.error("✗ quote_requests.service holds values the migration cannot map:\n");
        for (const r of rows) console.error(`    ${r.n.toString().padStart(6)}  ${JSON.stringify(r.service)}`);
        console.error("\n  Add them to LEGACY_SERVICE_LABELS and extend drizzle/0004_*.sql, then re-run.");
        process.exit(1);
      }
      console.log("✓ pre-flight: every quote_requests.service value is mappable");
    }
  }

  // ── What is pending
  const applied = names.has("quote_requests")
    ? await sql<{ hash: string }[]>`select hash from drizzle.__drizzle_migrations`.catch(() => [])
    : [];
  const appliedHashes = new Set(applied.map((r) => r.hash));
  const files = readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort();
  const pending = files.filter(
    (f) => !appliedHashes.has(createHash("sha256").update(readFileSync(`drizzle/${f}`, "utf8")).digest("hex")),
  );

  console.log(`\n${applied.length} applied, ${pending.length} pending`);
  for (const f of pending) console.log(`    pending: ${f}`);
  if (!pending.length) {
    console.log("\nNothing to do.");
    process.exit(0);
  }
  if (!APPLY) {
    console.log("\nDry run — nothing written. Re-run with --apply to migrate.");
    process.exit(0);
  }

  // ── Apply, then prove it actually happened
  const before = applied.length;
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  const [{ count: after }] = await sql<{ count: number }[]>`
    select count(*)::int as count from drizzle.__drizzle_migrations`;

  if (after !== before + pending.length) {
    console.error(`\n✗ migration reported success but the record did not move: ${before} → ${after}, expected ${before + pending.length}.`);
    console.error("  The schema may be partially migrated. Inspect before retrying.");
    process.exit(1);
  }
  console.log(`\n✓ applied ${pending.length} migration(s) — ${before} → ${after} recorded`);
} finally {
  await sql.end();
}
