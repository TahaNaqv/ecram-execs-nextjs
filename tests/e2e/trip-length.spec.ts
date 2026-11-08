import { randomInt } from "node:crypto";
import { execFile } from "node:child_process";
import http from "node:http";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { MAX_TRIP_MINUTES } from "../../lib/fleet/schedule";
import { amsterdamInstant, blockMinutesFor, parseDuration } from "../../lib/fleet/trip";
import { fillAdminLogin } from "./helpers";

const run = promisify(execFile);
// Google's own example of an encoded route: three points
const LINE = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

/**
 * A confirmed booking holds its car for the length of the route (Google Routes) plus an allowance, not for a guess.
 * The unit checks always run. The rest need a stand-in Routes server, which this file starts itself, and the site started with
 *   GOOGLE_MAPS_API_KEY=test ROUTES_API_URL=http://127.0.0.1:4597/computeRoutes E2E_FAKE_ROUTES=4597 npx playwright test trip-length
 */
try {
  process.loadEnvFile?.(".env.local");
} catch {
  // No .env.local (CI sets the variables directly)
}
const PORT = Number(process.env.E2E_FAKE_ROUTES ?? 0);
const DAY = `${new Date().getFullYear() + 1}-06-15`;
const sql = () => postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
const REF = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const makeRef = () => `EE-${Array.from({ length: 6 }, () => REF[randomInt(REF.length)]).join("")}`;
const EMAIL = "trip-length@ecramexecs.test";

test("a trip is held for the drive, the service's allowance and the waits, to the next 5 minutes", () => {
  // Airport: 50 min drive + 30 allowance
  expect(blockMinutesFor({ service: "airport_transfer", driveSeconds: 3000 })).toBe(80);
  expect(blockMinutesFor({ service: "business_travel", driveSeconds: 3000 })).toBe(60);
  // 61 minutes + 30 = 91, held to 95
  expect(blockMinutesFor({ service: "airport_transfer", driveSeconds: 3660 })).toBe(95);
  // Waiting at a stop is time the car is not free
  expect(blockMinutesFor({ service: "business_travel", driveSeconds: 3000, waitMinutes: 30 })).toBe(90);
  // A drive across the road is still held for a booking's worth of time; an absurd route is capped
  expect(blockMinutesFor({ service: "private_occasion", driveSeconds: 60 })).toBe(20);
  expect(blockMinutesFor({ service: "business_travel", driveSeconds: 40 * 3600 })).toBe(MAX_TRIP_MINUTES);
  // Hourly and bespoke bookings are not routed, and nothing is made of no drive at all
  expect(blockMinutesFor({ service: "hourly", driveSeconds: 3000 })).toBeNull();
  expect(blockMinutesFor({ service: "bespoke", driveSeconds: 3000 })).toBeNull();
  expect(blockMinutesFor({ service: "airport_transfer", driveSeconds: 0 })).toBeNull();
  expect(blockMinutesFor({ service: "airport_transfer", driveSeconds: Number.NaN })).toBeNull();
});

test("Google's duration text is read, and anything else is not", () => {
  expect(parseDuration("1234s")).toBe(1234);
  expect(parseDuration("12.5s")).toBe(12.5);
  for (const bad of ["", "12", "-5s", "5m", "abc", null, undefined, 12]) expect(parseDuration(bad)).toBeNull();
});

test("a Dutch pick-up time becomes the right instant, in summer, in winter and either side of a clock change", () => {
  const at = (wall: string) => amsterdamInstant(wall)?.toISOString();
  expect(at("2031-01-15T08:30")).toBe("2031-01-15T07:30:00.000Z");
  expect(at("2031-07-15T08:30")).toBe("2031-07-15T06:30:00.000Z");
  // The database's text reads the same as the form's
  expect(at("2031-07-15 08:30:00")).toBe("2031-07-15T06:30:00.000Z");
  // Clocks go forward on 30 March 2031 (02:00 becomes 03:00) and back on 26 October
  expect(at("2031-03-30T01:30")).toBe("2031-03-30T00:30:00.000Z");
  expect(at("2031-03-30T03:30")).toBe("2031-03-30T01:30:00.000Z");
  expect(at("2031-10-26T01:30")).toBe("2031-10-25T23:30:00.000Z");
  expect(at("2031-10-26T03:30")).toBe("2031-10-26T02:30:00.000Z");
  expect(amsterdamInstant(null)).toBeNull();
  expect(amsterdamInstant("soon")).toBeNull();
});

test.describe("with a stand-in Routes server", () => {
  test.skip(!PORT, "Set E2E_FAKE_ROUTES (and the Google variables, see the top of this file) to run the route tests");

  type Call = { body: Record<string, unknown>; key: string | undefined; mask: string | undefined };
  const calls: Call[] = [];
  let answer: "ok" | "down" = "ok";
  let driveSeconds = 3000;
  let server: http.Server;

  test.beforeAll(async () => {
    server = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        calls.push({ body: JSON.parse(raw || "{}"), key: req.headers["x-goog-api-key"] as string | undefined, mask: req.headers["x-goog-fieldmask"] as string | undefined });
        if (answer === "down") {
          res.writeHead(500).end("boom");
          return;
        }
        const wantsLine = String(req.headers["x-goog-fieldmask"]).includes("polyline");
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ routes: [{ duration: `${driveSeconds}s`, ...(wantsLine ? { polyline: { encodedPolyline: LINE } } : {}) }] }));
      });
    });
    await new Promise<void>((resolve) => server.listen(PORT, "127.0.0.1", resolve));
  });
  test.afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await clean();
  });
  test.beforeEach(async () => {
    calls.length = 0;
    answer = "ok";
    driveSeconds = 3000;
    await clean();
  });

  type Seed = { status?: string; vehicle?: string; at: string; service?: string; block?: number | null; hours?: number | null; placeIds?: boolean; stops?: string[]; waits?: number[]; from?: string; to?: string };

  async function seed(s: Seed) {
    const db = sql();
    try {
      const [row] = await db`
        insert into quote_requests (reference, status, service, collection, destination, destinations, destination_waits, pickup_at, duration_hours, block_minutes, pickup_place_id, destination_place_id, vehicle, name, email, phone, source)
        values (${makeRef()}, ${s.status ?? "quoted"}, ${s.service ?? "airport_transfer"}, ${s.from ?? "Schiphol Airport"}, ${s.to ?? "Hotel Des Indes, The Hague"},
                ${s.stops ? db.array(s.stops, 1009) : null}, ${s.waits ? db.array(s.waits, 1007) : null}, ${s.at}::text::timestamp, ${s.hours ?? null}, ${s.block ?? null},
                ${s.placeIds ? "ChIJschiphol00000" : null}, ${null}, ${s.vehicle ?? "audi"}, 'Trip Length', ${EMAIL}, '+31 6 1234 5678', 'admin')
        returning id`;
      await db`insert into request_events (request_id, event) values (${row.id}, 'received')`;
      return row.id as string;
    } finally {
      await db.end();
    }
  }

  async function clean() {
    const db = sql();
    try {
      await db`delete from quote_requests where email = ${EMAIL}`;
    } finally {
      await db.end();
    }
  }

  async function block(id: string) {
    const db = sql();
    try {
      const [r] = await db`select status, block_minutes, drive_back_minutes from quote_requests where id = ${id}`;
      return r as { status: string; block_minutes: number | null; drive_back_minutes: number | null };
    } finally {
      await db.end();
    }
  }

  async function signIn(page: Page) {
    await page.goto("/admin/login");
    await fillAdminLogin(page);
    await expect(page).toHaveURL(/\/admin(?!\/login)/);
  }

  const confirm = (page: Page, id: string) => page.request.post(`/api/admin/requests/${id}/authorise`, { data: { status: "confirmed", amount: 120, sendMail: false } });

  test("confirming asks for the route and keeps its length, with the place id and the pick-up's traffic", async ({ page }) => {
    test.slow();
    const id = await seed({ at: `${DAY}T09:00`, placeIds: true });
    await signIn(page);

    expect((await confirm(page, id)).status()).toBe(200);
    // 50 minutes of driving and 30 for the airport
    expect(await block(id)).toEqual({ status: "confirmed", block_minutes: 80, drive_back_minutes: 50 });

    // Two questions: the trip, and the drive home after it (from the drop-off back to the pick-up while no home base is set)
    expect(calls).toHaveLength(2);
    const call = calls.find((c) => c.body.routingPreference === "TRAFFIC_AWARE")!;
    expect(call.key).toBe("test");
    expect(call.mask).toBe("routes.duration,routes.distanceMeters");
    expect(call.body.origin).toEqual({ placeId: "ChIJschiphol00000" });
    expect(call.body.destination).toEqual({ address: "Hotel Des Indes, The Hague" });
    expect(call.body).toMatchObject({ travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE", regionCode: "NL" });
    // 09:00 in the Dutch summer is 07:00 UTC
    expect(call.body.departureTime).toBe(`${DAY}T07:00:00.000Z`);
    const home = calls.find((c) => c.body.routingPreference === "TRAFFIC_UNAWARE")!;
    expect(home.body.origin).toEqual({ address: "Hotel Des Indes, The Hague" });
    expect(home.body.destination).toEqual({ placeId: "ChIJschiphol00000" });
    expect(home.body.departureTime).toBeUndefined();

    // The booking page says where the length comes from, and the schedule holds the car for it (09:00 to 10:20)
    await page.goto(`/admin/requests/${id}`);
    await expect(page.getByText(/\b80 min\b/).first()).toBeVisible();
    await page.goto(`/admin/requests/schedule?date=${DAY}`);
    await expect(page.getByRole("link", { name: /Trip Length/ }).first()).toContainText("09:00 – 10:20");
  });

  test("stops on the way are asked about, and the waits at them are added", async ({ page }) => {
    test.slow();
    const id = await seed({ at: `${DAY}T09:00`, service: "business_travel", stops: ["Utrecht Centraal"], waits: [30] });
    await signIn(page);

    expect((await confirm(page, id)).status()).toBe(200);
    // 50 + 10 for the service + 30 waiting
    expect((await block(id)).block_minutes).toBe(90);
    expect(calls.find((c) => c.body.routingPreference === "TRAFFIC_AWARE")!.body.intermediates).toEqual([{ address: "Utrecht Centraal" }]);
    // The drive home goes straight back
    expect(calls.find((c) => c.body.routingPreference === "TRAFFIC_UNAWARE")!.body.intermediates).toEqual([]);
  });

  test("when Google cannot answer, the booking is still confirmed and keeps the estimate", async ({ page }) => {
    test.slow();
    answer = "down";
    const id = await seed({ at: `${DAY}T09:00` });
    await signIn(page);

    expect((await confirm(page, id)).status()).toBe(200);
    expect(await block(id)).toEqual({ status: "confirmed", block_minutes: null, drive_back_minutes: null });
    expect(calls).toHaveLength(2);
    await page.goto(`/admin/requests/schedule?date=${DAY}`);
    await expect(page.getByRole("link", { name: /Trip Length/ }).first()).toContainText("09:00 – 10:30");
  });

  test("an hourly booking is not routed, and a booking already confirmed is not routed again", async ({ page }) => {
    test.slow();
    const hourly = await seed({ at: `${DAY}T09:00`, service: "hourly", hours: 3, vehicle: "range_rover" });
    const done = await seed({ at: `${DAY}T14:00`, status: "confirmed", block: 75, vehicle: "mercedes_vle" });
    await signIn(page);

    expect((await confirm(page, hourly)).status()).toBe(200);
    expect((await block(hourly)).block_minutes).toBeNull();
    // Saving a confirmed booking again (a new amount, a resent email) leaves its length alone
    expect((await confirm(page, done)).status()).toBe(200);
    expect((await block(done)).block_minutes).toBe(75);
    expect(calls).toHaveLength(0);
  });

  async function backfill(...args: string[]) {
    const { stdout } = await run(process.execPath, ["scripts/backfill-trip-lengths.mts", ...args], { env: { ...process.env, DATABASE_URL_DIRECT: process.env.DATABASE_URL } });
    return stdout;
  }

  test("the backfill script looks up the bookings confirmed before Google, saves what fits and leaves an overlap alone", async () => {
    test.slow();
    driveSeconds = 9000; // 150 minutes of driving and 30 for the airport: three hours
    // A would run 09:00 to 12:00 (and its turnaround to 12:30), which runs into B at 11:00 in the same car; C has a car of its own
    const a = await seed({ at: `${DAY}T09:00`, status: "confirmed", vehicle: "audi" });
    const b = await seed({ at: `${DAY}T11:00`, status: "confirmed", vehicle: "audi" });
    const c = await seed({ at: `${DAY}T09:00`, status: "confirmed", vehicle: "mercedes_vle" });
    const hourly = await seed({ at: `${DAY}T14:00`, status: "confirmed", service: "hourly", hours: 3, vehicle: "range_rover" });
    const known = await seed({ at: `${DAY}T16:00`, status: "confirmed", block: 75, vehicle: "cadillac_escalade" });

    const dry = await backfill();
    expect(dry).toContain("Dry run");
    expect(dry).toContain("CLASH");
    expect(dry).toContain("would save");
    for (const id of [a, b, c, hourly, known]) expect((await block(id)).block_minutes).toBe(id === known ? 75 : null);

    const done = await backfill("--apply");
    expect(done).toContain("Saved: 2.");
    expect((await block(a)).block_minutes).toBeNull(); // left at the estimate, for the team to sort out
    expect((await block(b)).block_minutes).toBe(180);
    expect((await block(c)).block_minutes).toBe(180);
    expect((await block(hourly)).block_minutes).toBeNull(); // not routed
    expect((await block(known)).block_minutes).toBe(75); // already has a length

    // A second run finds A again (still an overlap now B is longer) and nothing else
    const again = await backfill("--apply");
    expect(again).toContain("1 upcoming confirmed booking(s)");
    expect(again).toContain("Saved: 0.");
  });

  test("the drive-home backfill gives the confirmed trips their drive home, and leaves one that would overlap alone", async () => {
    test.slow();
    driveSeconds = 3 * 3600;
    const script = (...args: string[]) =>
      run(process.execPath, ["scripts/backfill-drive-back.mts", ...args], { env: { ...process.env, DATABASE_URL_DIRECT: process.env.DATABASE_URL } }).then((r) => r.stdout);
    // A: 09:00 to 10:00, then three hours home until 13:00, which runs into B at 11:00 in the same car. C has its own car.
    const a = await seed({ at: `${DAY}T09:00`, status: "confirmed", block: 60, vehicle: "audi" });
    const b = await seed({ at: `${DAY}T11:00`, status: "confirmed", block: 60, vehicle: "audi" });
    const c = await seed({ at: `${DAY}T09:00`, status: "confirmed", block: 60, vehicle: "mercedes_vle" });

    const dry = await script();
    expect(dry).toContain("Dry run");
    expect(dry).toContain("CLASH");
    for (const id of [a, b, c]) expect((await block(id)).drive_back_minutes).toBeNull();

    const done = await script("--apply");
    expect(done).toContain("Saved: 2.");
    expect((await block(a)).drive_back_minutes).toBeNull(); // left at the turnaround, for the team to sort out
    expect((await block(b)).drive_back_minutes).toBe(180);
    expect((await block(c)).drive_back_minutes).toBe(180);
  });

  test("the day map asks Google for each confirmed trip once, and a trip Google could not find is asked about again", async ({ page }) => {
    test.skip(!process.env.GOOGLE_MAPS_EMBED_KEY, "Set GOOGLE_MAPS_EMBED_KEY (as the site is started) to run the day map tests");
    test.slow();
    const from = `Day Map Start ${randomInt(1e6)}`;
    const id = await seed({ at: `${DAY}T09:00`, status: "confirmed", vehicle: "audi", from, to: "Day Map End" });
    await seed({ at: `${DAY}T10:00`, status: "quoted", vehicle: "audi", from: `${from} quoted`, to: "Day Map End" });
    await signIn(page);
    const violations: string[] = [];
    page.on("console", (m) => m.text().includes("Content Security Policy") && violations.push(m.text()));
    const lines = () => calls.filter((c) => c.mask?.includes("polyline")).length;

    // Google cannot answer: the map says so, and nothing is remembered
    answer = "down";
    await page.goto(`/admin/requests/schedule?date=${DAY}`);
    await expect(page.getByText("None of this day's routes could be found.")).toBeVisible();
    expect(lines()).toBe(1);

    // Google can: the trip is on the map, and only the confirmed one (a quote holds nothing)
    answer = "ok";
    await page.goto(`/admin/requests/schedule?date=${DAY}`);
    const trips = page.getByRole("list").filter({ has: page.getByRole("button", { name: new RegExp(from) }) });
    await expect(trips.getByRole("button")).toHaveCount(1);
    await expect(trips.getByRole("link", { name: "Open" })).toHaveAttribute("href", `/admin/requests/${id}`);
    expect(lines()).toBe(2);

    // Opened again (by anyone), it is not asked for again
    await page.reload();
    await expect(trips.getByRole("button")).toHaveCount(1);
    expect(lines()).toBe(2);
    // Google's script is let through by the admin's policy
    expect(violations).toEqual([]);
  });

  test("the dashboard draws today's confirmed trips on its map", async ({ page }) => {
    test.skip(!process.env.GOOGLE_MAPS_EMBED_KEY, "Set GOOGLE_MAPS_EMBED_KEY (as the site is started) to run the map tests");
    test.slow();
    const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    await seed({ at: `${today}T23:00`, status: "confirmed", vehicle: "audi", from: `Dashboard Start ${randomInt(1e6)}`, to: "Dashboard End" });
    await signIn(page);
    await page.goto("/admin");
    await expect(page.getByText("Trips on the map")).toBeVisible();
    await expect(page.getByText("No confirmed trips with a route today.")).toHaveCount(0);
  });

  test("a long drive holds the car for its drive home too, not just the turnaround (the client, 8 Nov 2026)", async ({ page, request }) => {
    test.slow();
    driveSeconds = 5 * 3600; // Five hours each way: the trip is 09:00 to 14:30 (with the airport's 30), then the drive home to 19:30
    const paris = await seed({ at: `${DAY}T09:00`, to: "Paris, France", placeIds: true });
    const tooSoon = await seed({ at: `${DAY}T15:00` }); // the 30-minute turnaround alone would have let this through
    const home = await seed({ at: `${DAY}T19:30` });
    await signIn(page);

    expect((await confirm(page, paris)).status()).toBe(200);
    expect(await block(paris)).toEqual({ status: "confirmed", block_minutes: 330, drive_back_minutes: 300 });
    // The car step does not offer the car while it drives home
    const busy = async (at: string) => ((await (await request.get(`/api/vehicles/unavailable?at=${at}`)).json()) as { busy: string[] }).busy;
    expect(await busy(`${DAY}T17:00`)).toContain("audi");
    expect(await busy(`${DAY}T19:30`)).not.toContain("audi");

    expect((await confirm(page, tooSoon)).status()).toBe(409);
    expect((await block(tooSoon)).status).toBe("quoted");
    expect((await confirm(page, home)).status()).toBe(200);

    // The booking page says so
    await page.goto(`/admin/requests/${paris}`);
    await expect(page.getByText("Drive home after the trip: 300 min, also held.")).toBeVisible();
  });

  test("a real length that is longer than the estimate holds the car longer", async ({ page }) => {
    test.slow();
    // The route took three hours: 09:00 to 12:00, and the turnaround until 12:30. The estimate would have freed the car at 11:00.
    await seed({ at: `${DAY}T09:00`, status: "confirmed", block: 180 });
    const early = await seed({ at: `${DAY}T12:00` });
    const after = await seed({ at: `${DAY}T12:30` });
    await signIn(page);

    const refused = await confirm(page, early);
    expect(refused.status()).toBe(409);
    expect(((await refused.json()) as { error: string }).error).toContain("already booked");
    expect((await block(early)).status).toBe("quoted");
    // Back to back is not a clash
    expect((await confirm(page, after)).status()).toBe(200);
  });
});
