import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { fillAdminLogin } from "./helpers";
import { bar, chooseCar, confirmedReference, fillDetails, fillJourney, nextYear, pickDateTime } from "./booking-helpers";
import en from "../../lib/i18n/dictionaries/en.json";
import nl from "../../lib/i18n/dictionaries/nl.json";

async function signIn(page: Page) {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await fillAdminLogin(page);
  // Signing in lands on the dashboard; the requests have their own page
  await expect(page.getByRole("heading", { name: en.admin.dashboard.title })).toBeVisible();
  await page.goto("/admin/requests");
  await expect(page.getByRole("heading", { name: "Quote requests" })).toBeVisible();
}

test("the booking flow checks the journey in the bar, then the details on the server", async ({ page }) => {
  await page.goto("/en");
  // Nothing filled in: the bar says what is missing and stays on the page
  await bar(page).getByRole("button", { name: en.booking.continue }).click();
  const alert = page.locator("#enquire [role=alert]");
  await expect(alert).toContainText(en.forms.collectionRequired);
  await expect(alert).toContainText(en.forms.destinationRequired);
  await expect(alert).toContainText(en.forms.guestsRequired); // the guests are chosen by the visitor; the time starts as the time it is now
  await expect(page).toHaveURL(/\/en$/);

  // A return journey before the pick-up is caught before anything is sent
  await fillJourney(page, { from: "Kurhaus, Scheveningen", to: "Hotel Des Indes, The Hague", at: nextYear("14-03", "18:00"), ret: nextYear("14-03", "09:00") });
  await expect(alert).toContainText(en.forms.returnBeforePickup);

  // A complete journey reaches /book; empty details come back from the server, field by field
  await pickDateTime(page, page.getByLabel(en.booking.returnLabel, { exact: true }), nextYear("15-03", "09:00"));
  await bar(page).getByRole("button", { name: en.booking.continue }).click();
  await expect(page).toHaveURL(/\/en\/book\?/);
  await chooseCar(page, null);
  await page.getByRole("button", { name: en.booking.submit }).click();
  await expect(page.getByText("Please enter your name.")).toBeVisible();
  await expect(page.getByText(en.forms.emailInvalid)).toBeVisible();
});

test("a quote request flows from the website into the admin panel and can be managed and deleted", async ({ page }) => {
  test.slow();
  const email = `client-${Date.now()}@e2e.ecramexecs.test`;

  // 1. Visitor books from the homepage bar: an airport pick-up asks for the flight
  await page.goto("/en");
  await expect(page.getByLabel(en.booking.flight, { exact: true })).toHaveCount(0);
  await fillJourney(page, { from: "Schiphol Airport, Arrivals 2", to: "Hotel Des Indes, The Hague", at: nextYear("14-03", "08:30"), flight: "kl 1234", pax: 3, bags: 4 });
  await chooseCar(page, "Mercedes-Benz VLE 300");
  await fillDetails(page, { name: "Jan de Vries", email, country: "31", phone: "6 1234 5678", notes: "Meet at the KLM desk", passenger: { name: "Sophie de Vries", phone: "6 8765 4321" } });
  const reference = await confirmedReference(page, "Thank you, Jan");

  // Stored as the team needs it: the service follows from the airport, the passenger apart from the booker
  const db = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  const [row] = await db`select service, flight_number, passengers, luggage, vehicle, passenger_name, passenger_phone, name from quote_requests where reference = ${reference}`;
  await db.end();
  expect(row).toEqual({
    service: "airport_transfer",
    flight_number: "KL 1234",
    passengers: 3,
    luggage: 4,
    vehicle: "mercedes_vle_300",
    passenger_name: "Sophie de Vries",
    passenger_phone: "+31 687654321",
    name: "Jan de Vries",
  });

  // 2. Admin finds it
  await signIn(page);
  await page.getByPlaceholder(/search/i).fill(reference);
  await page.getByRole("button", { name: "Search" }).click();
  await page.locator("table").getByRole("link", { name: /Jan de Vries/ }).click();
  await expect(page).toHaveURL(/\/admin\/requests\//);
  // Next.js keeps the previous page mounted (hidden), so only match visible text
  await expect(page.getByText(reference).filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Meet at the KLM desk").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("KL 1234").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Sophie de Vries").filter({ visible: true })).toBeVisible();

  // 3. Admin quotes it
  await page.getByLabel("Status", { exact: true }).selectOption("quoted");
  await page.getByLabel("Quoted amount (EUR)").fill("185,50");
  await page.getByRole("button", { name: "Save changes" }).click();
  // History is stored as keys + params and rendered with the reader's locale formatting, so the
  // amount now appears both in the activity log and in the summary. Assert the whole log line,
  // then that the amount is on the page at all (first match, since it is in two places).
  await expect(page.getByText("Status: new → quoted · Quote: — → € 185,50").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("€ 185,50").filter({ visible: true }).first()).toBeVisible();

  // 4. Invalid amount is rejected
  await page.getByLabel("Quoted amount (EUR)").fill("abc");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/Enter an amount/).filter({ visible: true })).toBeVisible();

  // 5. GDPR deletion
  await page.getByRole("button", { name: /delete this request/i }).click();
  await page.getByRole("button", { name: /yes, delete permanently/i }).click();
  await expect(page.getByRole("heading", { name: "Quote requests" })).toBeVisible();
  await page.goto(`/admin/requests?q=${reference}`);
  await expect(page.getByText("No requests match these filters").first()).toBeAttached();
});

test("the admin panel rejects wrong passwords and signs out", async ({ page }) => {
  await page.goto("/admin/login");
  await fillAdminLogin(page, "definitely-wrong");
  await expect(page.locator("form [role=alert]")).toHaveText("Incorrect email or password.");

  await signIn(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});


test("a Dutch visitor's request stores a language-independent service key", async ({ page }) => {
  // The point of storing `airport_transfer` rather than a label: a visitor books in Dutch (the service follows from
  // the airport), and the team reads it in whichever language their panel is set to. If this ever regresses, the
  // admin shows a Dutch label (or a raw key) to an English reader.
  const email = `client-nl-${Date.now()}@e2e.ecramexecs.test`;

  await page.goto("/nl");
  await expect(page.locator("html")).toHaveAttribute("lang", "nl");
  await fillJourney(page, { from: "Schiphol, Aankomsthal 2", to: "Hotel Des Indes, Den Haag", at: nextYear("02-04", "09:15"), pax: 3 }, nl.booking);
  await chooseCar(page, null, nl.booking);
  await fillDetails(page, { name: "Sanne Bakker", email, country: "31", phone: "6 9876 5432" }, nl.booking);
  const reference = await confirmedReference(page, "Dank u, Sanne");
  await expect(page.getByRole("status").filter({ hasText: reference })).toContainText(nl.booking.doneNote);

  // The admin is English, so the same request must read back as the English label.
  await page.goto("/admin/login");
  await fillAdminLogin(page);
  await expect(page.getByRole("heading", { name: en.admin.dashboard.title })).toBeVisible();
  await page.goto("/admin/requests");
  await page.getByPlaceholder(en.admin.requests.searchPlaceholder).fill(reference);
  await page.getByRole("button", { name: en.admin.common.search }).click();

  const row = page.locator("table tr").filter({ hasText: "Sanne Bakker" });
  await expect(row).toContainText(en.services.airport_transfer);
  await expect(row).not.toContainText(nl.services.airport_transfer);
});

test("an admin can switch the panel language and it sticks", async ({ page }) => {
  await page.goto("/admin/login");
  await fillAdminLogin(page);
  await expect(page.getByRole("heading", { name: en.admin.dashboard.title })).toBeVisible();

  const switcher = page.getByRole("form", { name: en.admin.common.language });
  await switcher.getByRole("button", { name: "nl" }).click();
  await expect(page.getByRole("heading", { name: nl.admin.dashboard.title })).toBeVisible();
  await expect(page.getByRole("link", { name: nl.admin.nav.requests })).toBeVisible();

  // The preference is on the account, not the URL, so it survives navigating elsewhere.
  await page.goto("/admin/drivers");
  await expect(page.getByRole("heading", { name: nl.admin.drivers.title })).toBeVisible();

  // Put it back so the rest of the suite sees an English panel.
  await page.goto("/admin");
  await page.getByRole("form", { name: nl.admin.common.language }).getByRole("button", { name: "en" }).click();
  await expect(page.getByRole("link", { name: en.admin.nav.requests })).toBeVisible();
});

test("a stopover carries its waiting time to the team", async ({ page }) => {
  const email = `client-wait-${Date.now()}@e2e.ecramexecs.test`;
  await page.goto("/en");
  // Two stops; the first is a half-hour wait, the second is left at "no waiting"
  await fillJourney(page, {
    from: "Kurhaus, Scheveningen",
    to: "Hotel Des Indes, The Hague",
    at: nextYear("14-03", "08:30"),
    stops: [{ place: "Rotterdam Centraal", wait: 30 }, { place: "Utrecht Centraal" }],
  });
  await chooseCar(page, null);
  await fillDetails(page, { name: "Jan de Vries", email, phone: "6 1234 5678", purpose: "private" });
  const reference = await confirmedReference(page, "Thank you, Jan");

  // Stored beside the stops, in the same order
  const db = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  const [row] = await db`select id, service, destinations, destination_waits from quote_requests where reference = ${reference}`;
  await db.end();
  expect(row.destinations).toEqual(["Rotterdam Centraal", "Utrecht Centraal"]);
  expect(row.destination_waits).toEqual([30, 0]);
  // Not an airport and not hourly: the visitor's own answer decides
  expect(row.service).toBe("private_occasion");

  // The team sees the wait under the stop it belongs to
  await page.goto("/admin/login");
  await fillAdminLogin(page);
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
  await page.goto(`/admin/requests/${row.id}`);
  await expect(page.getByText(en.admin.requestDetail.stopWait.replace("{minutes}", "30"))).toBeVisible();
  await expect(page.getByText(/^Waiting \d+ min$/)).toHaveCount(1);
});

test("an hourly booking needs no destination, and a return journey reaches the team", async ({ page }) => {
  const email = `client-hourly-${Date.now()}@e2e.ecramexecs.test`;
  await page.goto("/en");
  await fillJourney(page, { from: "Kurhaus, Scheveningen", hours: 4, at: nextYear("20-05", "10:00"), ret: nextYear("20-05", "18:30") });
  await expect(page.getByRole("button", { name: /4 hours, as directed/ })).toBeVisible();
  await chooseCar(page, "advise");
  await fillDetails(page, { name: "Uma Hourly", email, phone: "6 1234 5678" });
  const reference = await confirmedReference(page, "Thank you, Uma");

  const db = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  const [row] = await db`select id, service, destination, duration_hours, to_char(return_at, 'HH24:MI') as return_time, vehicle from quote_requests where reference = ${reference}`;
  await db.end();
  expect(row).toMatchObject({ service: "hourly", destination: null, duration_hours: 4, return_time: "18:30", vehicle: "advise" });

  await page.goto("/admin/login");
  await fillAdminLogin(page);
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
  await page.goto(`/admin/requests/${row.id}`);
  await expect(page.getByText("4 hours, as directed").filter({ visible: true })).toBeVisible();
  await expect(page.getByText(en.admin.requestDetail.returnJourney).filter({ visible: true })).toBeVisible();
});
