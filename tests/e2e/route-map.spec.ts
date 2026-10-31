import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { routeMapLinks } from "../../lib/fleet/map";
import { fillAdminLogin } from "./helpers";

/** A booking's page shows its route on a map, and always a link that opens the same route in Google Maps. */
try {
  process.loadEnvFile?.(".env.local");
} catch {
  // No .env.local (CI sets the variables directly)
}
const sql = () => postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
const REF = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const makeRef = () => `EE-${Array.from({ length: 6 }, () => REF[randomInt(REF.length)]).join("")}`;
const EMAIL = "route-map@ecramexecs.test";
const DAY = `${new Date().getFullYear() + 1}-06-15`;

test("a route becomes an embedded map and a link, with the stops on the way, and only the link when there is no key", () => {
  const trip = { collection: "Schiphol Airport", destination: "Hotel Des Indes, The Hague", destinations: ["Utrecht Centraal", " "] };

  const withKey = routeMapLinks(trip, "k1")!;
  const embed = new URL(withKey.embed!);
  expect(embed.origin + embed.pathname).toBe("https://www.google.com/maps/embed/v1/directions");
  expect(Object.fromEntries(embed.searchParams)).toEqual({
    key: "k1",
    origin: "Schiphol Airport",
    destination: "Hotel Des Indes, The Hague",
    waypoints: "Utrecht Centraal",
    mode: "driving",
    region: "nl",
  });

  const open = new URL(withKey.open);
  expect(open.origin + open.pathname).toBe("https://www.google.com/maps/dir/");
  expect(open.searchParams.get("origin")).toBe("Schiphol Airport");
  expect(open.searchParams.get("waypoints")).toBe("Utrecht Centraal");
  expect(open.searchParams.get("travelmode")).toBe("driving");

  // No key: nothing to embed, and the link is still there
  expect(routeMapLinks(trip)!.embed).toBeNull();
  expect(routeMapLinks(trip, "")!.embed).toBeNull();
  expect(routeMapLinks(trip)!.open).toContain("google.com/maps/dir/");

  // Several stops are joined with a bar; addresses with special characters are encoded, not broken
  const many = new URL(routeMapLinks({ collection: "A & B", destination: "C", destinations: ["D", "E"] }, "k")!.embed!);
  expect(many.searchParams.get("waypoints")).toBe("D|E");
  expect(many.searchParams.get("origin")).toBe("A & B");

  // An hourly booking has one place and no destination
  const hourly = routeMapLinks({ collection: "Schiphol Airport", destination: null }, "k")!;
  expect(new URL(hourly.embed!).pathname).toBe("/maps/embed/v1/place");
  expect(new URL(hourly.embed!).searchParams.get("q")).toBe("Schiphol Airport");
  expect(new URL(hourly.open).searchParams.get("query")).toBe("Schiphol Airport");

  // Nowhere to show
  expect(routeMapLinks({ collection: null, destination: "x" }, "k")).toBeNull();
  expect(routeMapLinks({ collection: "  ", destination: "x" }, "k")).toBeNull();
});

test.describe("on the booking page", () => {
  async function seed(fields: { destination: string | null; stops?: string[]; service?: string }) {
    const db = sql();
    try {
      const [row] = await db`
        insert into quote_requests (reference, status, service, collection, destination, destinations, pickup_at, duration_hours, vehicle, name, email, phone, source)
        values (${makeRef()}, 'quoted', ${fields.service ?? "airport_transfer"}, 'Schiphol Airport', ${fields.destination}, ${fields.stops ? db.array(fields.stops, 1009) : null},
                ${`${DAY}T09:00`}::text::timestamp, ${fields.destination ? null : 3}, 'audi', 'Route Map', ${EMAIL}, '+31 6 1234 5678', 'admin')
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
  test.beforeEach(clean);
  test.afterAll(clean);

  test("the route is on the page with a link that opens it in Google Maps, and Google's frame is allowed by the page's policy", async ({ page }) => {
    test.slow();
    const id = await seed({ destination: "Hotel Des Indes, The Hague", stops: ["Utrecht Centraal"] });
    await page.goto("/admin/login");
    await fillAdminLogin(page);
    await expect(page).toHaveURL(/\/admin(?!\/login)/);

    const response = await page.goto(`/admin/requests/${id}`);
    const link = page.getByRole("link", { name: "Open in Google Maps" });
    await expect(link).toBeVisible();
    const href = new URL((await link.getAttribute("href"))!);
    expect(href.searchParams.get("origin")).toBe("Schiphol Airport");
    expect(href.searchParams.get("destination")).toBe("Hotel Des Indes, The Hague");
    expect(href.searchParams.get("waypoints")).toBe("Utrecht Centraal");

    // With a key the map is a frame; without one the card says the map is not set up
    const frame = page.locator('iframe[title="Map of the booking\'s route"]');
    if (await frame.count()) {
      await expect(frame).toHaveAttribute("src", /^https:\/\/www\.google\.com\/maps\/embed\/v1\/directions\?/);
    } else {
      await expect(page.getByText("The map is not set up yet")).toBeVisible();
    }

    // The policy (set in production builds) lets the page frame Google's map, and nothing else
    const csp = response?.headers()["content-security-policy"];
    if (csp) expect(csp).toContain("frame-src https://www.google.com;");
  });

  test("an hourly booking, which has no destination, shows the one place", async ({ page }) => {
    test.slow();
    const id = await seed({ destination: null, service: "hourly" });
    await page.goto("/admin/login");
    await fillAdminLogin(page);
    await expect(page).toHaveURL(/\/admin(?!\/login)/);
    await page.goto(`/admin/requests/${id}`);
    const href = new URL((await page.getByRole("link", { name: "Open in Google Maps" }).getAttribute("href"))!);
    expect(href.pathname).toBe("/maps/search/");
    expect(href.searchParams.get("query")).toBe("Schiphol Airport");
  });
});
