// Removes uploaded documents that no application ever claimed.
//   node --env-file=.env scripts/sweep-documents.mts            # dry run: lists what it would remove
//   node --env-file=.env scripts/sweep-documents.mts --apply    # removes it
//
// A document is uploaded before the application is saved. If the applicant then closes the tab, a second upload
// fails, or the form is abandoned, those files are left behind: sensitive scans (chauffeur card, VOG, KvK, insurance)
// of people who never applied. This deletes any folder under DOCUMENTS_DIR that is older than three hours (longer than
// either signed link lives) and is not referenced by a row in driver_applications. Run nightly (docs/server-setup.md).
import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const apply = process.argv.includes("--apply");
const dir = process.env.DOCUMENTS_DIR;
const url = process.env.DATABASE_URL;
if (!dir || !url) {
  console.error("DOCUMENTS_DIR and DATABASE_URL must be set (run with --env-file=.env).");
  process.exit(1);
}

const MIN_AGE_MS = 3 * 60 * 60 * 1000;
const FOLDER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const sql = postgres(url, { prepare: false, max: 1 });
try {
  const rows = await sql<{ documents: { path: string }[] | null }[]>`select documents from driver_applications where documents is not null`;
  const claimed = new Set(rows.flatMap((r) => (r.documents ?? []).map((d) => d.path.split("/")[0])));

  const folders = (await readdir(dir).catch(() => [] as string[])).filter((name) => FOLDER.test(name));
  let removed = 0;
  for (const name of folders) {
    if (claimed.has(name)) continue;
    const full = path.join(dir, name);
    const info = await stat(full).catch(() => null);
    if (!info || Date.now() - info.mtimeMs < MIN_AGE_MS) continue;
    console.log(`${apply ? "removing" : "would remove"} ${name} (${Math.round((Date.now() - info.mtimeMs) / 3_600_000)} h old)`);
    if (apply) await rm(full, { recursive: true, force: true });
    removed++;
  }
  console.log(`${folders.length} folder(s) checked, ${claimed.size} claimed by applications, ${removed} ${apply ? "removed" : "would be removed"}.`);
  if (!apply && removed) console.log("Dry run — nothing deleted. Re-run with --apply.");
} finally {
  await sql.end();
}
