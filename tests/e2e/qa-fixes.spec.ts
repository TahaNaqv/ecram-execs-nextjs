import { expect, test, type Page } from "@playwright/test";
import en from "../../lib/i18n/dictionaries/en.json";
import { FLEET } from "../../lib/fleet/vehicles";
import { newEmail, seedBooking, sql } from "./corporate-helpers";
import { fillAdminLogin } from "./helpers";
import { carChoice, carChoices } from "./booking-helpers";

/** A complete trip, so /book opens on the car step. */
const READY_TRIP = `/en/book?from=Kurhaus&to=Hotel+Des+Indes&at=${new Date().getFullYear() + 1}-03-14T08:30&pax=2&bags=2`;

// Regression tests for the QA team's bug report (the "Ecram website bugs" document). The public-site ones need no database.

test("the Corporate Partner screens keep their own colours on hover instead of turning white on white", async ({ page }) => {
  await page.goto("/en/corporate-partner/login");
  const link = page.getByRole("link", { name: en.corporatePartner.signupLink });
  const colour = () => link.evaluate((el) => getComputedStyle(el).color);
  const before = await colour();
  await link.hover();
  await page.waitForTimeout(700); // longer than the site's colour transitions
  expect(await colour()).not.toBe("rgb(255, 255, 255)");
  expect(await colour()).toBe(before);

  // The same on the white strip of the footer, and the dark page still goes white as before
  const privacy = page.locator("footer").getByRole("link", { name: en.footer.privacy });
  await privacy.hover();
  await page.waitForTimeout(700);
  expect(await privacy.evaluate((el) => getComputedStyle(el).color)).not.toBe("rgb(255, 255, 255)");
  // …and on the Drive with us form
  await page.goto("/en/drive-with-us");
  const applyPrivacy = page.locator("#apply").getByRole("link", { name: /privacy/i }).first();
  await applyPrivacy.hover();
  await page.waitForTimeout(700);
  expect(await applyPrivacy.evaluate((el) => getComputedStyle(el).color)).not.toBe("rgb(255, 255, 255)");
  await page.goto("/en");
  const nav = page.getByRole("navigation", { name: en.nav.primaryLabel }).getByRole("link", { name: en.nav.services });
  await nav.hover();
  await page.waitForTimeout(700);
  expect(await nav.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(255, 255, 255)");
});

test("the log-in and sign-up forms sit in the middle of their panel", async ({ page }) => {
  for (const path of ["/en/corporate-partner/login", "/en/corporate-partner/signup", "/en/corporate-partner/forgot-password"]) {
    await page.goto(path);
    const box = await page.locator("main form").first().boundingBox();
    const panel = await page.locator("main .light-surface").boundingBox();
    expect(box && panel, path).toBeTruthy();
    expect(Math.abs(box!.x + box!.width / 2 - (panel!.x + panel!.width / 2)), path).toBeLessThan(4);
  }
});

test("the footer's contact column holds contact details only", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("footer")).not.toContainText("Serving the whole of the Netherlands");
});

test("the car step names the vehicles in full, and every car answers the luggage question", async ({ page }) => {
  await page.goto(READY_TRIP);
  await expect(carChoice(page, "Range Rover EV")).toBeVisible();
  const dialog = page.getByRole("dialog");
  const luggage = async (name: string) => {
    await page.getByRole("button", { name: en.booking.carDetails.replace("{car}", name) }).click();
    await expect(dialog).toBeVisible();
    return dialog.locator("details").filter({ hasText: en.fleetSection.qaLuggageQ });
  };
  // The Range Rover shows five questions, the luggage one among them, answered with the figure the client gave
  const rover = await luggage("Range Rover EV");
  await expect(dialog.locator("details")).toHaveCount(5);
  await rover.locator("summary").click();
  await expect(rover.getByText("About 818 litres with the rear seats in place.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  // Every vehicle that has specifications answers the luggage question, so no car is a question short of its neighbours
  for (const v of FLEET.filter((f) => f.specs?.luggage)) {
    const item = await luggage(v.name);
    await expect(item, v.name).toHaveCount(1);
    await dialog.getByRole("button", { name: en.fleetSection.galleryClose }).click();
    await expect(dialog).toBeHidden();
  }
});

test("the date and time picker has a Done button, is chosen in rather than typed into, and works from the keyboard", async ({ page }) => {
  const d = en.dateTimePicker;
  await page.goto("/en");
  // The booking bar in the hero: what it sends on to /book is its `at` field
  const field = page.locator("#enquire").getByLabel(en.booking.when, { exact: true });
  const hidden = page.locator("#enquire input[name=at]");
  await field.scrollIntoViewIfNeeded();
  const dialog = page.getByRole("dialog", { name: d.dialog });

  // Open, go to next month, choose a day, then the time: the form's value follows each step
  await page.getByRole("button", { name: d.open }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: d.nextMonth }).click();
  await dialog.locator("[data-day$='-15']").click();
  await expect(hidden).toHaveValue(/^\d{4}-\d{2}-15T\d{2}:\d{2}$/); // the time it is now, until another is chosen (see the QA round 2 spec)
  await dialog.getByLabel(d.hour).selectOption("14");
  await dialog.getByLabel(d.minute).selectOption("30");
  await expect(hidden).toHaveValue(/^\d{4}-\d{2}-15T14:30$/);
  await expect(field).toHaveValue(/^15-\d{2}-\d{4} 14:30$/);

  // Done closes it and puts the cursor back in the field; the choice stays
  await dialog.getByRole("button", { name: d.done }).click();
  await expect(dialog).toBeHidden();
  await expect(field).toBeFocused();
  await expect(hidden).toHaveValue(/T14:30$/);

  // Days that have gone are not offered: with nothing chosen, the calendar opens on this month and yesterday is greyed out
  await page.getByRole("button", { name: d.open }).click();
  await dialog.getByRole("button", { name: d.clear }).click();
  await expect(hidden).toHaveCount(0); // nothing chosen, nothing to send
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: d.open }).click();
  // ("today" is the date in the Netherlands, where pick-ups are booked, whatever zone this machine is in)
  const dutchToday = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", day: "numeric" }).format(new Date()));
  await expect(dialog.locator("button[data-day]:disabled")).toHaveCount(dutchToday - 1);
  // Escape closes it too
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // The box cannot be typed into (QA round 3, bug 10): the picker is the only way to set it
  await expect(field).not.toBeEditable();

  // Keyboard: the calendar opens on a day you can move with the arrow keys and choose with Enter
  await page.getByRole("button", { name: d.open }).click();
  const focusedDay = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.day ?? "");
  const start = await focusedDay();
  expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await page.keyboard.press("ArrowRight");
  expect(await focusedDay()).not.toBe(start);
  await page.keyboard.press("Enter");
  await expect(hidden).toHaveValue(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
});

// --- the admin panel -------------------------------------------------------------------------------------------

async function adminSignIn(page: Page) {
  await page.goto("/admin/login");
  await fillAdminLogin(page);
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

test("the admin requests list shows ten to a page with numbered pages, and searches while you type", async ({ page }) => {
  test.slow();
  const tag = `qa${Date.now()}`;
  for (let i = 0; i < 11; i++) await seedBooking({ contactId: null, email: `${tag}-${i}@e2e.ecramexecs.test` });
  await adminSignIn(page);

  // No Enter and no Search button: the list narrows on its own after a short pause
  await page.getByRole("searchbox").fill(tag);
  await expect(page).toHaveURL(new RegExp(`\\?q=${tag}`));
  const rows = page.locator("table tbody tr");
  await expect(rows).toHaveCount(10);
  await expect(page.getByText(/Showing 1–10 of 11/)).toBeVisible();

  const pager = page.getByRole("navigation", { name: en.admin.common.pagination });
  await expect(pager.getByRole("link", { name: "1" })).toHaveAttribute("aria-current", "page");
  await pager.getByRole("link", { name: "2" }).click();
  await expect(rows).toHaveCount(1);
  await expect(page.getByText(/Showing 11–11 of 11/)).toBeVisible();
});

test("the admin panel declares the language it is in", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.locator("html")).toHaveAttribute("lang", /^(nl|en)$/);
  await adminSignIn(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "en"); // the test admin's panel is English
});

test("the admin's New booking phone has a country-code drop-down", async ({ page }) => {
  await adminSignIn(page);
  await page.goto("/admin/requests/new");
  await expect(page.locator("#nb-phoneCountry")).toHaveValue("31");
  expect(await page.locator("#nb-phoneCountry option").count()).toBeGreaterThan(30);
});

test("the request page keeps its journey details readable on a small laptop", async ({ page }) => {
  const { id } = await seedBooking({ contactId: null, email: newEmail("narrow") });
  const db = sql();
  await db.unsafe("update quote_requests set destinations = array['Rotterdam Centraal','Utrecht Centraal'] where id = $1", [id]);
  await db.end();
  await adminSignIn(page);
  for (const width of [1024, 1100, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`/admin/requests/${id}`);
    await expect(page.getByText(en.admin.requestDetail.pickupDate).first()).toBeVisible();
    // Each detail cell (date, time, passengers, vehicle) keeps a usable width, and nothing runs out of the card
    const narrow = await page.evaluate(() =>
      [...document.querySelectorAll("dl > div")].filter((el) => el.getBoundingClientRect().width < 120 || el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent?.slice(0, 20)),
    );
    expect(narrow, `${width}px`).toEqual([]);
  }
});

test("the Corporate export says the download started, and Driver applications has a Drive with us button", async ({ page }) => {
  await adminSignIn(page);
  await page.goto("/admin/corporate");
  await expect(page.getByRole("status")).toHaveText("");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: en.admin.corporate.exportAll }).click();
  await download;
  await expect(page.getByRole("status")).toHaveText(en.admin.corporate.exportStarted);

  await page.goto("/admin/drivers/applications");
  const button = page.getByRole("link", { name: en.admin.common.driveWithUs }).last();
  await expect(button).toHaveAttribute("href", "/drive-with-us");
  expect(await button.evaluate((el) => getComputedStyle(el).borderTopWidth)).not.toBe("0px"); // drawn as a button
});

test("the admin sidebar shows the whole email address", async ({ page }) => {
  await adminSignIn(page);
  await expect(page.getByText("e2e-admin@ecramexecs.test")).toBeVisible();
  const clipped = await page.getByText("e2e-admin@ecramexecs.test").first().evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  expect(clipped).toBe(false);
});

test("the fleet page of the admin proves the session itself, and the unused availability endpoint is gone", async ({ page, context, request, baseURL }) => {
  // A cookie that merely exists is enough to pass the proxy; the page must still refuse it
  await context.addCookies([{ name: "ee_admin_session", value: "not-a-real-session", url: baseURL! }]);
  await page.goto("/admin/vehicles");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByText(/Registered Vehicles|Total Fleet/)).toHaveCount(0);

  expect((await request.get("/api/vehicles/availability")).status()).toBe(404);
});

test("a vehicle the team switches off is not offered, and the homepage itself does not wait for the table", async ({ page, request }) => {
  const db = sql();
  try {
    await db`insert into vehicles (id, name, status) values ('audi', 'Audi', 'unavailable') on conflict (id) do update set status = 'unavailable'`;
    // Only keys are shared, nothing about bookings
    expect(await (await request.get("/api/vehicles/unavailable")).json()).toEqual({ unavailable: ["audi"] });
    await page.goto(READY_TRIP);
    await expect(carChoice(page, "Mercedes-Benz VLE 300")).toBeVisible();
    await expect(carChoice(page, "Audi e-tron GT")).toHaveCount(0);
    await expect(carChoices(page)).toHaveCount(FLEET.length); // the four left, and "No preference"
  } finally {
    await db`delete from vehicles where id = 'audi'`;
    await db.end();
  }
});

test("the booking bar is on the page from the first paint, once", async ({ page }) => {
  await page.goto("/en", { waitUntil: "commit" });
  const from = page.locator("#enquire").getByLabel(en.booking.from, { exact: true });
  await expect(from).toBeVisible();
  await expect(page.getByLabel(en.booking.from, { exact: true })).toHaveCount(1); // one bar, never a placeholder that is swapped for another
});
