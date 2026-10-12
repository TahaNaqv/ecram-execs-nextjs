// Demo data for client previews: realistic quote requests in every status.
//   npm run db:seed-demo            add the demo requests (replaces earlier demo rows)
//   npm run db:seed-demo -- --clear remove all demo requests
// Rows are tagged source = 'demo', so real requests are never touched.
// All clients are fictional: example.com addresses and phone numbers from ranges reserved
// for fiction (UK 07700 900xxx, US 555-01xx, AU 0491 570xxx) or never issued (NL 06-0000).
import { randomInt } from "node:crypto";
import postgres from "postgres";

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (add it to .env.local).");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, max: 1 });

const removed = await sql`delete from quote_requests where source = 'demo' returning id`;
if (process.argv.includes("--clear")) {
  console.log(`Removed ${removed.length} demo requests.`);
  await sql.end();
  process.exit(0);
}

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ref = () => "EE-" + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const DAY = 86_400_000;
const now = Date.now();
/** Netherlands wall-clock time, `days` from today at hh:mm. Inserted as text and cast in SQL:
 *  postgres.js would otherwise parse it as a Date in this machine's time zone and shift it. */
const pickup = (days: number, hhmm: string) => {
  const d = new Date(now + days * DAY);
  const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam", dateStyle: "short" }).format(d);
  return `${date} ${hhmm}:00`;
};
const ago = (hours: number) => new Date(now - hours * 3_600_000);

type Demo = {
  status: "new" | "contacted" | "quoted" | "confirmed" | "completed" | "cancelled";
  createdHoursAgo: number;
  collection: string;
  destination: string;
  pickup: string;
  service: "airport_transfer" | "business_travel" | "hourly" | "private_occasion" | "bespoke";
  /** The language the client used, so the admin knows which language to reply in. */
  locale: "en" | "nl";
  passengers: number | null;
  name: string;
  email: string;
  phone: string;
  notes: string | null;
  quote: string | null;
  internal: string | null;
  history: DemoEvent[];
};

/**
 * History is stored as keys + values, never prose, so the admin can render it in either
 * language (see lib/admin/events.ts). These helpers keep the demo data readable.
 */
type Change =
  | { kind: "status"; from: Demo["status"]; to: Demo["status"] }
  | { kind: "quote"; from: string | null; to: string | null }
  | { kind: "notes" };
type DemoEvent = { event: "changes"; params: { changes: Change[] } };

const st = (from: Demo["status"], to: Demo["status"]): Change => ({ kind: "status", from, to });
const qt = (from: string | null, to: string | null): Change => ({ kind: "quote", from, to });
const nt = (): Change => ({ kind: "notes" });
const ch = (...changes: Change[]): DemoEvent => ({ event: "changes", params: { changes } });

const demos: Demo[] = [
  {
    status: "new", createdHoursAgo: 0.4, collection: "Schiphol Airport, Arrivals 2", destination: "Hotel Des Indes, The Hague",
    pickup: pickup(3, "08:30"), service: "airport_transfer", locale: "en", passengers: 2, name: "Charlotte Bennett",
    email: "charlotte.bennett@example.com", phone: "+44 7700 900123", notes: "Flight BA428 from London Heathrow, two large cases",
    quote: null, internal: null, history: [],
  },
  {
    status: "new", createdHoursAgo: 2, collection: "Rotterdam Centraal", destination: "World Port Center, Rotterdam",
    pickup: pickup(1, "09:15"), service: "business_travel", locale: "nl", passengers: 1, name: "Daan Visser",
    email: "d.visser@example.com", phone: "+31 6 0000 0001", notes: "Waiting time approx. 3 hours, then return to Rotterdam Centraal",
    quote: null, internal: null, history: [],
  },
  {
    status: "contacted", createdHoursAgo: 20, collection: "Amstel Hotel, Amsterdam", destination: "Keukenhof, Lisse",
    pickup: pickup(9, "10:00"), service: "private_occasion", locale: "en", passengers: 4, name: "Sophie Laurent",
    email: "sophie.laurent@example.com", phone: "+44 7700 900456", notes: "Family day out, return around 17:00",
    quote: null, internal: "Called client — wants a child seat for a 4-year-old. Checking availability.",
    history: [ch(st("new", "contacted")), ch(nt())],
  },
  {
    status: "quoted", createdHoursAgo: 30, collection: "Eindhoven Airport", destination: "High Tech Campus, Eindhoven",
    pickup: pickup(5, "07:45"), service: "airport_transfer", locale: "en", passengers: 3, name: "Markus Weber",
    email: "m.weber@example.com", phone: "+1 202 555 0181", notes: "Flight from Munich, KL1798",
    quote: "145.00", internal: "Quote sent by email. Corporate account possible — ask about monthly volume.",
    history: [ch(st("new", "contacted")), ch(st("contacted", "quoted"), qt(null, "145.00"), nt())],
  },
  {
    status: "quoted", createdHoursAgo: 52, collection: "Zuidas, Amsterdam", destination: "Binnenhof, The Hague",
    pickup: pickup(6, "13:00"), service: "hourly", locale: "en", passengers: 2, name: "Eleanor Hughes",
    email: "eleanor.hughes@example.com", phone: "+31 6 0000 0002", notes: "Ministry meetings, chauffeur to wait as directed (approx. 5 hours)",
    quote: "520.00", internal: "Hourly rate x 5h + travel. Awaiting PA's confirmation.",
    history: [ch(st("new", "quoted"), qt(null, "520.00"), nt())],
  },
  {
    status: "confirmed", createdHoursAgo: 75, collection: "Schiphol Airport, VIP Centre", destination: "Conservatorium Hotel, Amsterdam",
    pickup: pickup(2, "16:20"), service: "airport_transfer", locale: "en", passengers: 1, name: "James Whitmore",
    email: "j.whitmore@example.com", phone: "+1 202 555 0147", notes: "Arriving on DL48 from New York JFK",
    quote: "125.00", internal: "Confirmed and paid. Chauffeur: Pieter. Name board at VIP Centre.",
    history: [ch(st("new", "quoted"), qt(null, "125.00")), ch(st("quoted", "confirmed"), nt())],
  },
  {
    status: "confirmed", createdHoursAgo: 100, collection: "Kurhaus, Scheveningen", destination: "Kasteel de Haar, Utrecht",
    pickup: pickup(16, "14:00"), service: "private_occasion", locale: "nl", passengers: 2, name: "Noor & Thomas de Jong",
    email: "noor.dejong@example.com", phone: "+31 6 0000 0003", notes: "Wedding — bride and groom, champagne on arrival please",
    quote: "395.00", internal: "Wedding package. Ribbons on vehicle. Second car not needed.",
    history: [ch(st("new", "contacted")), ch(st("contacted", "quoted"), qt(null, "395.00")), ch(st("quoted", "confirmed"), nt())],
  },
  {
    status: "confirmed", createdHoursAgo: 140, collection: "Hotel Okura, Amsterdam", destination: "Maastricht (MECC)",
    pickup: pickup(12, "06:30"), service: "bespoke", locale: "en", passengers: 6, name: "Akira Tanaka",
    email: "a.tanaka@example.com", phone: "+61 491 570 156", notes: "Delegation of 6 for TEFAF, 3-day programme",
    quote: "2150.00", internal: "3 days, 1 vehicle at full capacity. Itinerary agreed with their office.",
    history: [ch(st("new", "contacted")), ch(st("contacted", "quoted"), qt(null, "2150.00")), ch(st("quoted", "confirmed"))],
  },
  {
    status: "completed", createdHoursAgo: 260, collection: "Rotterdam The Hague Airport", destination: "Peace Palace, The Hague",
    pickup: pickup(-6, "11:10"), service: "airport_transfer", locale: "en", passengers: 1, name: "Isabella Rossi",
    email: "isabella.rossi@example.com", phone: "+44 7700 900789", notes: null,
    quote: "95.00", internal: "Completed on time. Client asked for our corporate brochure.",
    history: [ch(st("new", "quoted"), qt(null, "95.00")), ch(st("quoted", "confirmed")), ch(st("confirmed", "completed"), nt())],
  },
  {
    status: "completed", createdHoursAgo: 330, collection: "Utrecht Centraal", destination: "Jaarbeurs, Utrecht",
    pickup: pickup(-9, "08:00"), service: "business_travel", locale: "en", passengers: 3, name: "Lars Johansson",
    email: "lars.johansson@example.com", phone: "+1 202 555 0112", notes: "Return trip at 18:00",
    quote: "180.00", internal: null,
    history: [ch(st("new", "quoted"), qt(null, "180.00")), ch(st("quoted", "confirmed")), ch(st("confirmed", "completed"))],
  },
  {
    status: "cancelled", createdHoursAgo: 190, collection: "Schiphol Airport", destination: "Groningen city centre",
    pickup: pickup(-2, "19:30"), service: "airport_transfer", locale: "en", passengers: 2, name: "Priya Sharma",
    email: "priya.sharma@example.com", phone: "+31 6 0000 0004", notes: "Flight may be delayed",
    quote: "260.00", internal: "Client cancelled — flight rebooked to next week. Follow up for new date.",
    history: [ch(st("new", "quoted"), qt(null, "260.00")), ch(st("quoted", "cancelled"), nt())],
  },
  {
    status: "new", createdHoursAgo: 5, collection: "The Grand, Amsterdam", destination: "Delft & Kinderdijk tour",
    pickup: pickup(20, "09:30"), service: "bespoke", locale: "en", passengers: 5, name: "Olivia Carter",
    email: "olivia.carter@example.com", phone: "+61 491 570 157", notes: "Full-day sightseeing for visiting board members",
    quote: null, internal: null, history: [],
  },
];

for (const d of demos) {
  const created = ago(d.createdHoursAgo);
  const [row] = await sql`
    insert into quote_requests
      (reference, status, collection, destination, pickup_at, service, passengers, name, email, phone, notes,
       locale, quoted_amount, internal_notes, source, created_at, updated_at)
    values
      (${ref()}, ${d.status}, ${d.collection}, ${d.destination}, (${d.pickup}::text)::timestamp, ${d.service}, ${d.passengers}, ${d.name},
       ${d.email}, ${d.phone}, ${d.notes}, ${d.locale}, ${d.quote}, ${d.internal}, 'demo', ${created}, ${created})
    returning id`;
  await sql`insert into request_events (request_id, event, created_at) values (${row.id}, 'received', ${created})`;
  // Spread follow-up events between creation and now
  for (const [i, e] of d.history.entries()) {
    const at = new Date(created.getTime() + ((i + 1) / (d.history.length + 1)) * (now - created.getTime()));
    await sql`insert into request_events (request_id, event, params, created_at)
              values (${row.id}, ${e.event}, ${sql.json(e.params)}, ${at})`;
  }
}
await sql.end();
console.log(`Added ${demos.length} demo requests${removed.length ? ` (replaced ${removed.length})` : ""}.`);
