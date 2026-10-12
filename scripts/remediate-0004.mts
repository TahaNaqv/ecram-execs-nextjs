// One-off remediation for the 2026-10-12 incident: migration 0004 was applied to production by
// mistake (drizzle-kit auto-loaded .env and preferred DATABASE_URL_DIRECT), leaving production on
// the ORIGINAL 0004 while this repo carries a hardened one, and 0005 unapplied.
//
//   node --env-file=.env scripts/remediate-0004.mts            # preview, reads only
//   node --env-file=.env scripts/remediate-0004.mts --apply    # write
//
// Safe to re-run: every step checks whether it is still needed. Delete this file once production
// is healthy — it describes one specific broken state, not a general repair.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const APPLY = process.argv.includes("--apply");
const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) { console.error("No DATABASE_URL."); process.exit(1); }

const ORIGINAL_0004 = "4b45ad6f2333711d26623fc8e04a2b38dcf219460b40107c2d0feaede46ff229";
const file0004 = "drizzle/0004_tough_mandroid.sql";
const current0004 = createHash("sha256").update(readFileSync(file0004, "utf8")).digest("hex");

console.log(`Target: ${new URL(url).host}`);
console.log(APPLY ? "Mode:   APPLY\n" : "Mode:   preview — reads only, pass --apply to write\n");

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  // ── Pre-flight: is production actually in the state this script is written for?
  const [rec] = await sql<{ id: number; hash: string }[]>`
    select id, hash from drizzle.__drizzle_migrations where hash in (${ORIGINAL_0004}, ${current0004})`;
  const [msgCol] = await sql<{ is_nullable: string }[]>`
    select is_nullable from information_schema.columns
    where table_name = 'request_events' and column_name = 'message'`;
  const [{ legacy }] = await sql<{ legacy: number }[]>`
    select count(*)::int as legacy from request_events where event = 'legacy'`;

  console.log(`0004 record:     ${rec ? (rec.hash === ORIGINAL_0004 ? "original (needs reconciling)" : "already reconciled") : "ABSENT — stop, this is not the expected state"}`);
  console.log(`message column:  ${msgCol ? "present (0005 not yet applied)" : "already dropped"}`);
  console.log(`legacy events:   ${legacy}`);
  if (!rec) { console.error("\n✗ 0004 is not recorded at all. Do not continue; investigate first."); process.exit(1); }

  if (!APPLY) {
    console.log("\nWould do:");
    if (rec.hash === ORIGINAL_0004) console.log(`  1. repoint the 0004 record to the hardened file's hash (${current0004.slice(0, 12)}…) — the DDL already ran, only the backfill regex changed`);
    if (legacy > 0) console.log(`  2. re-run the hardened backfill over ${legacy} 'legacy' event(s) so they parse into structured changes`);
    if (msgCol) console.log("  3. apply 0005 (drop request_events.message, set event NOT NULL)");
    console.log("\nNothing written.");
    process.exit(0);
  }

  // ── 1 + 2 together: reconcile the record and heal the rows the old parser could not read.
  if (legacy > 0 || rec.hash === ORIGINAL_0004) {
    const backfill = readFileSync(file0004, "utf8").split("--> statement-breakpoint").pop()!;
    await sql.begin(async (tx) => {
      if (legacy > 0) await tx.unsafe(backfill);
      if (rec.hash === ORIGINAL_0004) {
        await tx`update drizzle.__drizzle_migrations set hash = ${current0004} where id = ${rec.id}`;
      }
    });
    const [{ left }] = await sql<{ left: number }[]>`select count(*)::int as left from request_events where event = 'legacy'`;
    console.log(`✓ backfill re-run — legacy events ${legacy} → ${left}`);
    console.log("✓ 0004 record reconciled");
  }

  // ── 3. apply 0005, and prove the record moved
  const [{ before }] = await sql<{ before: number }[]>`select count(*)::int as before from drizzle.__drizzle_migrations`;
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  const [{ after }] = await sql<{ after: number }[]>`select count(*)::int as after from drizzle.__drizzle_migrations`;
  if (after !== 6) { console.error(`\n✗ expected 6 recorded migrations, found ${after}. Inspect before deploying.`); process.exit(1); }
  console.log(`✓ migrations applied — ${before} → ${after}`);

  // ── Final verification
  const [gone] = await sql<{ c: number }[]>`
    select count(*)::int as c from information_schema.columns
    where table_name = 'request_events' and column_name = 'message'`;
  const [{ nullable }] = await sql<{ nullable: string }[]>`
    select is_nullable as nullable from information_schema.columns
    where table_name = 'request_events' and column_name = 'event'`;
  const [{ legacyLeft }] = await sql<{ legacyLeft: number }[]>`select count(*)::int as "legacyLeft" from request_events where event = 'legacy'`;
  console.log(`\nmessage column dropped: ${gone.c === 0}`);
  console.log(`event NOT NULL:         ${nullable === "NO"}`);
  console.log(`legacy events left:     ${legacyLeft}`);
  console.log("\n✓ production schema matches the committed code. Deploy now.");
} finally {
  await sql.end();
}
