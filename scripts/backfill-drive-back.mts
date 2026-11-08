// Gives the upcoming confirmed bookings their drive home (the client, 8 Nov 2026). Bookings confirmed before the drive home was
// counted hold their car for the trip and a 30-minute turnaround only; this looks the drive home up as confirming them would.
// Run it on the server, from /srv/ecram-execs:
//   node --env-file=.env scripts/backfill-drive-back.mts           (shows what would change, changes nothing)
//   node --env-file=.env scripts/backfill-drive-back.mts --apply   (saves the drives home)
// A booking whose longer hold would overlap another confirmed booking of one of its cars is left alone and listed, for the team
// to sort out. Bookings whose drive home cannot be found keep the turnaround.
import postgres from "postgres";
import { heldKeys } from "../lib/fleet/held.ts";
import { routeDriveBackMinutes, routesEnabled } from "../lib/fleet/route-core.ts";
import { BUFFER_MINUTES, blocksOf, overlaps, wallText } from "../lib/fleet/schedule.ts";

const apply = process.argv.includes("--apply");
const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (run with --env-file=.env).");
  process.exit(1);
}
if (!routesEnabled()) {
  console.error("GOOGLE_MAPS_API_KEY is not set: there is nothing to look the routes up with.");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });
// The same key the site's own lock uses (lib/fleet/availability.ts): this waits for anyone confirming a booking at that moment
const FLEET_LOCK = 7_311_901;

type Tx = postgres.Sql | postgres.TransactionSql;
type Row = {
  id: string;
  reference: string;
  service: string;
  vehicle: string | null;
  vehicles: unknown;
  collection: string;
  destination: string;
  pickup_at: string | null;
  return_at: string | null;
  pickup_place_id: string | null;
  destination_place_id: string | null;
  duration_hours: number | null;
  block_minutes: number | null;
  drive_back_minutes: number | null;
};

const scheduled = (r: Pick<Row, "id" | "service" | "pickup_at" | "return_at" | "duration_hours" | "block_minutes">, driveBackMinutes: number | null) =>
  blocksOf({ id: r.id, status: "confirmed", service: r.service, pickupAt: r.pickup_at, returnAt: r.return_at, durationHours: r.duration_hours, blockMinutes: r.block_minutes, driveBackMinutes });

/** The reference of a confirmed booking that holds one of this booking's cars once it drives home for `minutes`, or null. */
async function clash(tx: Tx, row: Row, minutes: number): Promise<string | null> {
  const keys = heldKeys(row);
  if (keys.size === 0) return null;
  const mine = scheduled(row, minutes);
  if (mine.length === 0) return null;
  // A trip plus its drive home is under a day; two days leaves room (as lib/fleet/availability.ts)
  const lo = wallText(Math.min(...mine.map((b) => b.start)) - 2 * 24 * 60);
  const hi = wallText(Math.max(...mine.map((b) => b.end)));
  const others = await tx<Row[]>`
    select id, reference, service, vehicle, vehicles, collection, destination,
           to_char(pickup_at, 'YYYY-MM-DD HH24:MI:SS') as pickup_at, to_char(return_at, 'YYYY-MM-DD HH24:MI:SS') as return_at,
           pickup_place_id, destination_place_id, duration_hours, block_minutes, drive_back_minutes
    from quote_requests
    where status = 'confirmed' and vehicle is not null and vehicle <> 'advise' and id <> ${row.id}
      and (pickup_at between ${lo}::text::timestamp and ${hi}::text::timestamp or return_at between ${lo}::text::timestamp and ${hi}::text::timestamp)`;
  for (const other of others) {
    if (![...heldKeys(other)].some((k) => keys.has(k))) continue;
    const theirs = scheduled(other, other.drive_back_minutes);
    if (theirs.some((t) => mine.some((m) => overlaps(t, m)))) return other.reference;
  }
  return null;
}

const COLUMNS = sql`
  id, reference, service, vehicle, vehicles, collection, destination,
  to_char(pickup_at, 'YYYY-MM-DD HH24:MI:SS') as pickup_at, to_char(return_at, 'YYYY-MM-DD HH24:MI:SS') as return_at,
  pickup_place_id, destination_place_id, duration_hours, block_minutes, drive_back_minutes`;

const rows = await sql<Row[]>`
  select ${COLUMNS}
  from quote_requests
  where status = 'confirmed' and drive_back_minutes is null
    and service in ('airport_transfer', 'business_travel', 'private_occasion')
    and collection is not null and destination is not null
    and (pickup_at > (now() at time zone 'Europe/Amsterdam') or return_at > (now() at time zone 'Europe/Amsterdam'))
  order by pickup_at`;

console.log(`${rows.length} upcoming confirmed booking(s) without a drive home.${apply ? "" : " (Dry run: nothing is saved. Add --apply to save.)"}\n`);

const tally = { saved: 0, short: 0, clash: 0, notFound: 0 };
for (const row of rows) {
  const label = `${row.reference}  ${row.pickup_at?.slice(0, 16) ?? "?"}  ${row.collection} → ${row.destination}`;
  const back = await routeDriveBackMinutes({
    service: row.service,
    collection: row.collection,
    destination: row.destination,
    pickupPlaceId: row.pickup_place_id,
    destinationPlaceId: row.destination_place_id,
  });
  if (back === null) {
    tally.notFound++;
    console.log(`  not found  ${label}  (keeps the ${BUFFER_MINUTES}-minute turnaround)`);
    continue;
  }
  // The look for a clash and the save go together under the fleet lock, as the site does when it confirms a booking.
  // The booking is read again under the lock: it may have been changed or cancelled since it was listed.
  const result = await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${FLEET_LOCK})`;
    const [fresh] = await tx<Row[]>`select ${COLUMNS} from quote_requests where id = ${row.id} and status = 'confirmed' and drive_back_minutes is null`;
    if (!fresh) return { changed: true as const };
    // A drive home within the turnaround takes no new time, so it cannot clash; it is still saved
    const other = back <= BUFFER_MINUTES ? null : await clash(tx, fresh, back);
    if (other) return { other };
    if (apply) await tx`update quote_requests set drive_back_minutes = ${back} where id = ${row.id} and status = 'confirmed' and drive_back_minutes is null`;
    return { other: null };
  });
  if ("changed" in result) {
    console.log(`  changed    ${label}  (cancelled or given a drive home since the list was made: skipped)`);
    continue;
  }
  if (result.other) {
    tally.clash++;
    console.log(`  CLASH      ${label}  (a ${back}-minute drive home would overlap ${result.other}: left at the turnaround)`);
  } else {
    if (back <= BUFFER_MINUTES) tally.short++;
    else tally.saved++;
    console.log(`  ${apply ? "saved     " : "would save"} ${label}  (${back} min home${back <= BUFFER_MINUTES ? ", within the turnaround" : ""})`);
  }
}

console.log(`\n${apply ? "Saved" : "Would save"}: ${tally.saved}. Within the turnaround (also saved): ${tally.short}. Overlap another booking, left alone: ${tally.clash}. Not found: ${tally.notFound}.`);
await sql.end();
