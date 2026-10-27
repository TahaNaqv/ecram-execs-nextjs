// Removes personal data that is past the retention periods in the privacy policy.
//   node --env-file=.env scripts/retention.mts            # dry run: lists what it would remove
//   node --env-file=.env scripts/retention.mts --apply    # removes it
//
// The periods and the rules live in lib/retention.ts (RETENTION). In short: requests 24 months after the last contact
// (completed or invoiced bookings 7 years after the end of that year, stripped of notes and messages from 24 months), driver applications that did not become a partnership 12 months, Corporate
// Partner accounts nobody has used for 24 months, sign-ups never finished after 30 days, chats with the concierge 90 days after their last message (a year for those that belong to a confirmed booking). Run weekly from cron (docs/server-setup.md).
//
// Nothing is deleted without --apply, no rule removes more than RETENTION.maxPerRule rows in one run (run again if it says
// "more remain"), and the output holds references and ids only: no names, emails or notes, so the log is not itself personal data.
import { rm, rmdir } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { RETENTION, runRetention } from "../lib/retention.ts";

const apply = process.argv.includes("--apply");
const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (run with --env-file=.env).");
  process.exit(1);
}

// The only shape of path the document store ever creates (lib/storage-local.ts): a UUID folder and a plain file name
const PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z]{1,20}\.(pdf|jpg|png)$/;
const root = process.env.DOCUMENTS_DIR ? path.resolve(process.env.DOCUMENTS_DIR) : null;

/** Deletes files (and their folder once empty). Without DOCUMENTS_DIR (Supabase Storage) there is nothing this script can reach. */
async function removeFiles(paths: string[]) {
  if (paths.length === 0) return;
  if (!root) {
    console.warn(`DOCUMENTS_DIR is not set: ${paths.length} stored file(s) were not removed`);
    return;
  }
  for (const relative of paths) {
    const absolute = PATH_RE.test(relative) ? path.join(root, relative) : null;
    if (!absolute || !absolute.startsWith(root + path.sep)) continue;
    try {
      await rm(absolute, { force: true });
      await rmdir(path.dirname(absolute)).catch(() => {}); // only succeeds when the folder is empty
    } catch (err) {
      console.error(`could not delete ${relative}`, err);
    }
  }
}

const { host, pathname } = new URL(url);
console.log(`Target: ${host}${pathname}`);
console.log(
  `Rules: requests ${RETENTION.requestMonths} months (financial ${RETENTION.financialYears} years), applications ${RETENTION.applicationMonths} months, ` +
    `idle partner accounts ${RETENTION.accountInactiveMonths} months, unfinished sign-ups ${RETENTION.abandonedSignupDays} days, concierge chats ${RETENTION.chatDays} days (${RETENTION.chatBookingDays} for a confirmed booking); at most ${RETENTION.maxPerRule} per rule per run`,
);

const sql = postgres(url, { prepare: false, max: 1 });
try {
  // Every cutoff is computed from the database's clock, so a wrong clock there would make everything look old
  const [{ seconds }] = await sql<{ seconds: string }[]>`select extract(epoch from now()) as seconds`;
  const skew = Math.abs(Number(seconds) - Date.now() / 1000);
  if (skew > 300) {
    console.error(`The database clock and this machine's clock differ by ${Math.round(skew)} seconds: not running. Fix the clocks first.`);
    process.exit(1);
  }
  // One run at a time (this connection is the only one the script uses, so the lock lasts as long as it does)
  const [{ locked }] = await sql<{ locked: boolean }[]>`select pg_try_advisory_lock(73130017) as locked`;
  if (!locked) {
    console.error("Another retention run is in progress: not running.");
    process.exit(1);
  }
  const report = await runRetention({ sql, apply, removeFiles });
  const verb = apply ? "removed" : "would remove";
  const list = (label: string, items: string[]) => console.log(`${label}: ${items.length} ${verb}${items.length ? ` (${items.slice(0, 50).join(", ")}${items.length > 50 ? ", …" : ""})` : ""}`);
  list("requests", report.requests);
  console.log(`bookings kept for the financial records, stripped of notes and messages: ${report.scrubbed.length} ${apply ? "done" : "would be done"}${report.scrubbed.length ? ` (${report.scrubbed.slice(0, 50).join(", ")}${report.scrubbed.length > 50 ? ", …" : ""})` : ""}`);
  list("driver applications", report.applications);
  list("partner accounts", report.accounts);
  if (report.blocked.length) console.log(`partner accounts left alone because they hold an open upcoming booking: ${report.blocked.length}`);
  list("unfinished sign-ups", report.signups);
  list("concierge chats", report.chats);
  if (report.capped) console.log("More remain: a rule reached its cap for one run. Run again to continue.");
  if (!apply && report.requests.length + report.scrubbed.length + report.applications.length + report.accounts.length + report.signups.length + report.chats.length > 0) {
    console.log("Dry run — nothing deleted. Re-run with --apply.");
  }
} finally {
  await sql.end();
}
