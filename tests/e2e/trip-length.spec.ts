import { randomInt } from "node:crypto";
import http from "node:http";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { MAX_TRIP_MINUTES } from "../../lib/fleet/schedule";
import { amsterdamInstant, blockMinutesFor, parseDuration } from "../../lib/fleet/trip";
import { fillAdminLogin } from "./helpers";

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
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ routes: [{ duration: `${driveSeconds}s` }] }));
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

  type Seed = { status?: string; vehicle?: string; at: string; service?: string; block?: number | null; hours?: number | null; placeIds?: boolean; stops?: string[]; waits?: number[] };

  async function seed(s: Seed) {
    const db = sql();
    try {
      const [row] = await db`
        insert into quote_requests (reference, status, service, collection, destination, destinations, destination_waits, pickup_at, duration_hours, block_minutes, pickup_place_id, destination_place_id, vehicle, name, email, phone, source)
        values (${makeRef()}, ${s.status ?? "quoted"}, ${s.service ?? "airport_transfer"}, 'Schiphol Airport', 'Hotel Des Indes, The Hague',
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
      const [r] = await db`select status, block_minutes from quote_requests where id = ${id}`;
      return r as { status: string; block_minutes: number | null };
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
    expect(await block(id)).toEqual({ status: "confirmed", block_minutes: 80 });

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call.key).toBe("test");
    expect(call.mask).toBe("routes.duration");
    expect(call.body.origin).toEqual({ placeId: "ChIJschiphol00000" });
    expect(call.body.destination).toEqual({ address: "Hotel Des Indes, The Hague" });
    expect(call.body).toMatchObject({ travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE", regionCode: "NL" });
    // 09:00 in the Dutch summer is 07:00 UTC
    expect(call.body.departureTime).toBe(`${DAY}T07:00:00.000Z`);

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
    expect(calls[0].body.intermediates).toEqual([{ address: "Utrecht Centraal" }]);
  });

  test("when Google cannot answer, the booking is still confirmed and keeps the estimate", async ({ page }) => {
    test.slow();
    answer = "down";
    const id = await seed({ at: `${DAY}T09:00` });
    await signIn(page);

    expect((await confirm(page, id)).status()).toBe(200);
    expect(await block(id)).toEqual({ status: "confirmed", block_minutes: null });
    expect(calls).toHaveLength(1);
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
