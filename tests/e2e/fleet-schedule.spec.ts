import { randomInt } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { blocksOf, BUFFER_MINUTES, layOut, overlaps, tripMinutes, wallMinutes, wallText } from "../../lib/fleet/schedule";
import en from "../../lib/i18n/dictionaries/en.json";
import { carChoice, fillJourney } from "./booking-helpers";
import { fillAdminLogin } from "./helpers";

/**
 * The day schedule: a confirmed booking holds its car for the trip and the turnaround after it. The booking forms stop
 * offering a car that is held, and nothing can confirm a booking into a car that is held.
 */
try {
  process.loadEnvFile?.(".env.local");
} catch {
  // No .env.local (CI sets the variables directly)
}
const t = en.admin.schedule;
const DAY = `${new Date().getFullYear() + 1}-06-15`;
const sql = () => postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
const REF = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const makeRef = () => `EE-${Array.from({ length: 6 }, () => REF[randomInt(REF.length)]).join("")}`;

type Seed = { status?: string; vehicle?: string | null; at: string; ret?: string | null; service?: string; hours?: number | null; name?: string };

async function seed(s: Seed) {
  const db = sql();
  try {
    const reference = makeRef();
    const [row] = await db`
      insert into quote_requests (reference, status, service, collection, destination, pickup_at, return_at, duration_hours, vehicle, name, email, phone, source)
      values (${reference}, ${s.status ?? "confirmed"}, ${s.service ?? "airport_transfer"}, 'Schiphol Airport', 'Hotel Des Indes, The Hague',
              ${s.at}::text::timestamp, ${s.ret ?? null}::text::timestamp, ${s.hours ?? null}, ${s.vehicle ?? null}, ${s.name ?? "Schedule Test"}, 'schedule@ecramexecs.test', '+31 6 1234 5678', 'admin')
      returning id`;
    await db`insert into request_events (request_id, event) values (${row.id}, 'received')`;
    return { id: row.id as string, reference };
  } finally {
    await db.end();
  }
}

async function clean() {
  const db = sql();
  try {
    await db`delete from quote_requests where email = 'schedule@ecramexecs.test'`;
  } finally {
    await db.end();
  }
}

async function row(id: string) {
  const db = sql();
  try {
    const [r] = await db`select status, vehicle from quote_requests where id = ${id}`;
    return r as { status: string; vehicle: string | null };
  } finally {
    await db.end();
  }
}

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await fillAdminLogin(page);
  await expect(page.getByRole("heading", { name: en.admin.dashboard.title })).toBeVisible();
}

test.beforeEach(clean);
test.afterAll(clean);

test("a trip holds its car for its length and the turnaround after it, and a return journey holds it twice", () => {
  const at = wallMinutes("2031-03-14T08:30")!;
  expect(wallText(at)).toBe("2031-03-14T08:30");
  // The database's text and the form's text are the same moment
  expect(wallMinutes("2031-03-14 08:30:00")).toBe(at);

  const [one] = blocksOf({ id: "a", status: "confirmed", service: "airport_transfer", pickupAt: "2031-03-14 08:30:00", returnAt: null, durationHours: null, blockMinutes: null });
  expect(one.start).toBe(at);
  expect(one.tripEnd - one.start).toBe(tripMinutes({ service: "airport_transfer", durationHours: null, blockMinutes: null }));
  expect(one.end - one.tripEnd).toBe(BUFFER_MINUTES);

  // An hourly booking is as long as its hours; the team's own figure wins over both
  expect(tripMinutes({ service: "hourly", durationHours: 4, blockMinutes: null })).toBe(240);
  expect(tripMinutes({ service: "hourly", durationHours: 4, blockMinutes: 90 })).toBe(90);

  const both = blocksOf({ id: "b", status: "confirmed", service: "business_travel", pickupAt: "2031-03-14T08:30", returnAt: "2031-03-14T18:00", durationHours: null, blockMinutes: null });
  expect(both.map((b) => b.leg)).toEqual(["outward", "return"]);

  // Back to back is not an overlap; a minute over is
  expect(overlaps({ start: 0, end: 60 }, { start: 60, end: 120 })).toBe(false);
  expect(overlaps({ start: 0, end: 61 }, { start: 60, end: 120 })).toBe(true);

  // Blocks that overlap are spread side by side; the others keep the whole width
  const laid = layOut([
    { start: 0, end: 60 },
    { start: 30, end: 90 },
    { start: 120, end: 180 },
  ]);
  expect(laid.map((b) => [b.lane, b.lanes])).toEqual([[0, 2], [1, 2], [0, 1]]);
});

test("the availability endpoint names the cars a confirmed booking holds at that time, and only those", async ({ request }) => {
  // Audi is held 09:00 to 11:00 (90 minutes of trip and 30 of turnaround); a quote does not hold Cadillac
  await seed({ vehicle: "audi", at: `${DAY}T09:00` });
  await seed({ vehicle: "cadillac_escalade", status: "quoted", at: `${DAY}T09:00` });
  const busy = async (at: string, extra = "") => ((await (await request.get(`/api/vehicles/unavailable?at=${at}${extra}`)).json()) as { busy: string[] }).busy;

  expect(await busy(`${DAY}T10:30`)).toEqual(["audi"]);
  expect(await busy(`${DAY}T08:30`)).toEqual(["audi"]); // would still be on the road when the next job starts
  expect(await busy(`${DAY}T07:15`)).toEqual(["audi"]); // and needs its turnaround before it
  // Before the service is known a trip is taken as two hours long, so the turnaround after it must also fit before 09:00
  expect(await busy(`${DAY}T06:15`)).toEqual([]);
  expect(await busy(`${DAY}T06:45`)).toEqual(["audi"]);
  expect(await busy(`${DAY}T11:00`)).toEqual([]); // free again the minute the turnaround ends
  // An hourly booking holds the car for its hours, and a return journey for its second trip too
  expect(await busy(`${DAY}T06:00`, "&hours=4")).toEqual(["audi"]);
  expect(await busy(`${DAY}T05:00`, `&returnAt=${DAY}T10:15`)).toEqual(["audi"]);
  // Nothing is said about the past, or when no time is given
  expect(await busy("2020-01-01T09:00")).toEqual([]);
  expect(await busy(`${DAY}T15:00`, `&returnAt=2001-01-01T09:00`)).toEqual([]); // nor through a return journey in the past
  const plain = (await (await request.get("/api/vehicles/unavailable")).json()) as { busy: string[] };
  expect(plain.busy).toEqual([]);
});

test("the day schedule shows a column per car with the confirmed bookings, and those without a car apart", async ({ page }) => {
  const held = await seed({ vehicle: "audi", at: `${DAY}T09:00`, name: "Held Audi" });
  const loose = await seed({ vehicle: "advise", at: `${DAY}T13:00`, name: "No Car Yet" });
  const quoted = await seed({ vehicle: "audi", status: "quoted", at: `${DAY}T14:00`, name: "Only Quoted" });
  await signIn(page);

  await page.goto("/admin/requests");
  await page.getByRole("link", { name: t.viewSchedule }).click();
  await expect(page).toHaveURL(/\/admin\/requests\/schedule/);
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  await page.goto(`/admin/requests/schedule?date=${DAY}`);
  const block = page.getByRole("link", { name: new RegExp(held.reference) });
  await expect(block).toBeVisible();
  await expect(block).toHaveAttribute("href", `/admin/requests/${held.id}`);
  await expect(block).toContainText("09:00 – 10:30");
  await expect(page.getByRole("link", { name: new RegExp(loose.reference) })).toBeVisible();
  await expect(page.getByText(t.unassigned, { exact: true })).toBeVisible();
  // A quoted booking does not hold a car, and it is still on the day it was booked for
  await expect(page.getByRole("link", { name: new RegExp(quoted.reference) })).toBeVisible();
  // Another day has none of them
  await page.getByRole("link", { name: t.nextDay }).click();
  await expect(page.getByRole("link", { name: new RegExp(held.reference) })).toHaveCount(0);
  await expect(page.getByText(t.empty)).toBeVisible();
});

test("confirming a booking into a car that is held is refused; into a free car it goes through", async ({ page }) => {
  test.slow();
  await seed({ vehicle: "audi", at: `${DAY}T09:00` });
  const blocked = await seed({ vehicle: "audi", status: "quoted", at: `${DAY}T10:00` });
  const free = await seed({ vehicle: "audi", status: "quoted", at: `${DAY}T16:00` });
  await signIn(page);

  const confirm = (id: string) => page.request.post(`/api/admin/requests/${id}/authorise`, { data: { status: "confirmed", amount: 120, sendMail: false } });
  const refused = await confirm(blocked.id);
  expect(refused.status()).toBe(409);
  expect(((await refused.json()) as { error: string }).error).toContain("already booked");
  expect((await row(blocked.id)).status).toBe("quoted");

  expect((await confirm(free.id)).status()).toBe(200);
  expect((await row(free.id)).status).toBe("confirmed");
  // A status that does not exist is not stored
  expect((await page.request.post(`/api/admin/requests/${free.id}/authorise`, { data: { status: "banana" } })).status()).toBe(400);
});

test("the booking page gives the booking its car, and refuses one that is held at that time", async ({ page }) => {
  test.slow();
  await seed({ vehicle: "audi", at: `${DAY}T09:00` });
  const mine = await seed({ vehicle: null, at: `${DAY}T10:00`, name: "Needs A Car" });
  await signIn(page);
  await page.goto(`/admin/requests/${mine.id}`);

  const car = page.getByLabel(t.carLabel);
  // A booking that is still only a request keeps any choice until it is confirmed
  await expect(car).toBeVisible();
  const db = sql();
  await db`update quote_requests set status = 'confirmed' where id = ${mine.id}`;
  await db.end();
  await page.reload();

  await car.selectOption("audi");
  await page.getByRole("button", { name: t.carSave }).click();
  await expect(page.getByText(/already booked/)).toBeVisible();
  expect((await row(mine.id)).vehicle).toBeNull();

  await car.selectOption("range_rover");
  await page.getByRole("button", { name: t.carSave }).click();
  await expect(page.getByText(t.carSaved)).toBeVisible();
  expect((await row(mine.id)).vehicle).toBe("range_rover");
  // The change is in the booking's history
  await expect(page.getByText(/Car: .* → Range Rover/)).toBeVisible();
});

test("a car held at the time of the trip is not offered in the booking flow", async ({ page }) => {
  await seed({ vehicle: "audi", at: `${DAY}T09:00` });
  await page.goto("/en/book");
  const [day, month, year] = [DAY.slice(8, 10), DAY.slice(5, 7), DAY.slice(0, 4)];
  await fillJourney(page, { from: "Schiphol Airport", to: "Hotel Des Indes, The Hague", at: `${day}-${month}-${year} 10:00`, flight: "KL1234" });
  await expect(page.getByRole("heading", { name: en.booking.carTitle })).toBeVisible();
  await expect(carChoice(page, "Mercedes-Benz VLE 300")).toBeVisible();
  await expect(carChoice(page, "Audi")).toHaveCount(0);
  await expect(page.getByText(/already booked at this time/)).toBeVisible();
});
