// Gives the upcoming confirmed bookings that still carry an estimated trip length their real one, from the Google Routes API.
// Bookings confirmed before Google was switched on hold their car for the service's estimate (90 or 120 minutes); this looks
// each one up as confirming it again would. Run it on the server, from /srv/ecram-execs:
//   node --env-file=.env scripts/backfill-trip-lengths.mts           (shows what would change, changes nothing)
//   node --env-file=.env scripts/backfill-trip-lengths.mts --apply   (saves the lengths)
// A booking whose real length would overlap another confirmed booking of the same car is left alone and listed, for the team
// to sort out: the length is only saved where it fits. Bookings whose route cannot be found keep their estimate.
import postgres from "postgres";
import { routeBlockMinutes, routesEnabled, type RoutedBooking } from "../lib/fleet/route-core.ts";
import { blocksOf, overlaps, tripMinutes, wallText } from "../lib/fleet/schedule.ts";
import { normalizeVehicleKey } from "../lib/fleet/vehicles.ts";

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
  collection: string;
  destination: string;
  destinations: string[] | null;
  destination_waits: number[] | null;
  pickup_at: string | null;
  return_at: string | null;
  pickup_place_id: string | null;
  destination_place_id: string | null;
  duration_hours: number | null;
  drive_back_minutes: number | null;
};

const carKey = (vehicle: string | null) => (!vehicle || vehicle === "advise" ? null : (normalizeVehicleKey(vehicle) ?? vehicle));

/** The reference of the confirmed booking that holds the same car at some point of this trip once it lasts `minutes`, or null. */
async function clash(tx: Tx, row: Row, minutes: number): Promise<string | null> {
  const key = carKey(row.vehicle);
  if (!key) return null;
  const mine = blocksOf({ id: row.id, status: "confirmed", service: row.service, pickupAt: row.pickup_at, returnAt: row.return_at, durationHours: row.duration_hours, blockMinutes: minutes, driveBackMinutes: row.drive_back_minutes });
  if (mine.length === 0) return null;
  // A trip plus its drive home is under a day; two days leaves room (as lib/fleet/availability.ts)
  const lo = wallText(Math.min(...mine.map((b) => b.start)) - 2 * 24 * 60);
  const hi = wallText(Math.max(...mine.map((b) => b.end)));
  const others = await tx<{ id: string; reference: string; vehicle: string | null; service: string; pickup_at: string | null; return_at: string | null; duration_hours: number | null; block_minutes: number | null; drive_back_minutes: number | null }[]>`
    select id, reference, vehicle, service, to_char(pickup_at, 'YYYY-MM-DD HH24:MI:SS') as pickup_at, to_char(return_at, 'YYYY-MM-DD HH24:MI:SS') as return_at, duration_hours, block_minutes, drive_back_minutes
    from quote_requests
    where status = 'confirmed' and vehicle is not null and vehicle <> 'advise' and id <> ${row.id}
      and (pickup_at between ${lo}::text::timestamp and ${hi}::text::timestamp or return_at between ${lo}::text::timestamp and ${hi}::text::timestamp)`;
  for (const other of others) {
    if (carKey(other.vehicle) !== key) continue;
    const theirs = blocksOf({ id: other.id, status: "confirmed", service: other.service, pickupAt: other.pickup_at, returnAt: other.return_at, durationHours: other.duration_hours, blockMinutes: other.block_minutes, driveBackMinutes: other.drive_back_minutes });
    if (theirs.some((t) => mine.some((m) => overlaps(t, m)))) return other.reference;
  }
  return null;
}

const rows = await sql<Row[]>`
  select id, reference, service, vehicle, collection, destination, destinations, destination_waits,
         to_char(pickup_at, 'YYYY-MM-DD HH24:MI:SS') as pickup_at, to_char(return_at, 'YYYY-MM-DD HH24:MI:SS') as return_at,
         pickup_place_id, destination_place_id, duration_hours, drive_back_minutes
  from quote_requests
  where status = 'confirmed' and block_minutes is null
    and service in ('airport_transfer', 'business_travel', 'private_occasion')
    and collection is not null and destination is not null
    and (pickup_at > (now() at time zone 'Europe/Amsterdam') or return_at > (now() at time zone 'Europe/Amsterdam'))
  order by pickup_at`;

console.log(`${rows.length} upcoming confirmed booking(s) with an estimated trip length.${apply ? "" : " (Dry run: nothing is saved. Add --apply to save.)"}\n`);

const tally = { saved: 0, same: 0, clash: 0, notFound: 0 };
for (const row of rows) {
  const estimate = tripMinutes({ service: row.service, durationHours: row.duration_hours, blockMinutes: null });
  const booking: RoutedBooking = {
    service: row.service,
    collection: row.collection,
    destination: row.destination,
    destinations: row.destinations,
    destinationWaits: row.destination_waits,
    pickupAt: row.pickup_at,
    pickupPlaceId: row.pickup_place_id,
    destinationPlaceId: row.destination_place_id,
  };
  const label = `${row.reference}  ${row.pickup_at?.slice(0, 16) ?? "?"}  ${row.collection} → ${row.destination}`;
  const routed = await routeBlockMinutes(booking);
  if (routed === null) {
    tally.notFound++;
    console.log(`  not found  ${label}  (keeps ${estimate} min)`);
    continue;
  }
  // The look for a clash and the save go together under the fleet lock, as the site does when it confirms a booking.
  // The booking is read again under the lock: it may have been changed or cancelled since it was listed.
  const result = await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${FLEET_LOCK})`;
    const [fresh] = await tx<Row[]>`
      select id, reference, service, vehicle, collection, destination, destinations, destination_waits,
             to_char(pickup_at, 'YYYY-MM-DD HH24:MI:SS') as pickup_at, to_char(return_at, 'YYYY-MM-DD HH24:MI:SS') as return_at,
             pickup_place_id, destination_place_id, duration_hours, drive_back_minutes
      from quote_requests where id = ${row.id} and status = 'confirmed' and block_minutes is null`;
    if (!fresh) return { changed: true as const };
    // A length equal to the estimate takes no new time, so it cannot clash; it is still saved, so that the booking says "from the route"
    const other = routed === estimate ? null : await clash(tx, fresh, routed);
    if (other) return { other };
    if (apply) await tx`update quote_requests set block_minutes = ${routed} where id = ${row.id} and status = 'confirmed' and block_minutes is null`;
    return { other: null };
  });
  if ("changed" in result) {
    console.log(`  changed    ${label}  (confirmed, cancelled or given a length since the list was made: skipped)`);
    continue;
  }
  if (result.other) {
    tally.clash++;
    console.log(`  CLASH      ${label}  (${estimate} → ${routed} min would overlap ${result.other}: left at ${estimate})`);
  } else {
    if (routed === estimate) tally.same++;
    else tally.saved++;
    console.log(`  ${apply ? "saved     " : "would save"} ${label}  (${routed === estimate ? `${estimate} min, as estimated` : `${estimate} → ${routed} min`})`);
  }
}

console.log(`\n${apply ? "Saved" : "Would save"}: ${tally.saved}. Same as the estimate (also saved): ${tally.same}. Overlap another booking, left alone: ${tally.clash}. Route not found: ${tally.notFound}.`);
await sql.end();
