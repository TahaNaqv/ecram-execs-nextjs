import { expect, test, type Page } from "@playwright/test";
import en from "../../lib/i18n/dictionaries/en.json";
import { FLEET } from "../../lib/fleet/vehicles";
import { newEmail, seedBooking, sql } from "./corporate-helpers";
import { fillAdminLogin } from "./helpers";

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
  const nav = page.getByRole("navigation", { name: en.nav.primaryLabel }).getByRole("link", { name: en.nav.fleet });
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

test("each Services card is one link: the whole card works, and Corporate Accounts leads to the Corporate Partner page", async ({ page }) => {
  await page.goto("/en");
  const cards = page.locator("#services a.card");
  await expect(cards).toHaveCount(6);
  // Clicking the empty lower part of the sixth card (not its heading) reaches the booking form
  const sixth = cards.nth(5);
  await sixth.scrollIntoViewIfNeeded();
  const box = (await sixth.boundingBox())!;
  await page.mouse.click(box.x + 20, box.y + box.height - 20); // lower left: the floating up/down arrows sit at the lower right
  await expect(page).toHaveURL(/#enquire$/);

  await page.goto("/en");
  const corporate = page.locator("#services a.card").nth(2);
  await expect(corporate).toHaveAttribute("href", "/en/corporate-partner");
  await corporate.scrollIntoViewIfNeeded();
  const c = (await corporate.boundingBox())!;
  await page.mouse.click(c.x + 20, c.y + c.height - 20);
  await expect(page).toHaveURL(/\/en\/corporate-partner$/);
});

test("the footer's contact column holds contact details only", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("footer")).not.toContainText("Serving the whole of the Netherlands");
});

test("the fleet lists complete names, and every car answers the luggage question", async ({ page }) => {
  await page.goto("/en");
  const names = await page.locator("#fleet li h3").allTextContents();
  expect(names).toContain("Range Rover EV");
  expect(names).not.toContain("Range Rover");
  const roverCard = page.locator("#fleet li").filter({ has: page.getByRole("heading", { name: "Range Rover EV" }) });
  await expect(roverCard.locator("summary")).toHaveCount(5);
  await roverCard.getByText(en.fleetSection.qaLuggageQ).click();
  await expect(roverCard.getByText("About 818 litres with the rear seats in place.")).toBeVisible();
  // Every vehicle that has specifications shows the luggage question, so no card is a question short of its neighbours
  for (const v of FLEET.filter((f) => f.specs?.luggage)) {
    const card = page.locator("#fleet li").filter({ has: page.getByRole("heading", { name: v.name, exact: true }) });
    await expect(card.getByText(en.fleetSection.qaLuggageQ)).toHaveCount(1);
  }
});

test("the date and time picker has a Done button, can be typed into, and works from the keyboard", async ({ page }) => {
  const d = en.dateTimePicker;
  await page.goto("/en");
  const field = page.locator("#q-pickupAt");
  const hidden = page.locator("input[name=pickupAt]");
  await field.scrollIntoViewIfNeeded();
  const dialog = page.getByRole("dialog", { name: d.dialog });

  // Open, go to next month, choose a day, then the time: the form's value follows each step
  await page.getByRole("button", { name: d.open }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: d.nextMonth }).click();
  await dialog.locator("[data-day$='-15']").click();
  await expect(hidden).toHaveValue(/^\d{4}-\d{2}-15T09:00$/);
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
  await field.fill("");
  await page.getByRole("button", { name: d.open }).click();
  await expect(dialog.locator("button[data-day]:disabled")).toHaveCount(new Date().getDate() - 1);
  // Escape closes it too
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // Typing works as well, in either order of day and year, and is tidied when the cursor leaves
  await field.fill("2031-03-14T08:30");
  await expect(hidden).toHaveValue("2031-03-14T08:30");
  await field.blur();
  await expect(field).toHaveValue("14-03-2031 08:30");
  await field.fill("31-02-2031 08:30"); // there is no 31 February
  await expect(hidden).toHaveValue("");

  // Keyboard: the calendar opens on a day you can move with the arrow keys and choose with Enter
  await field.fill("");
  await page.getByRole("button", { name: d.open }).click();
  const focusedDay = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.day ?? "");
  const start = await focusedDay();
  expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await page.keyboard.press("ArrowRight");
  expect(await focusedDay()).not.toBe(start);
  await page.keyboard.press("Enter");
  await expect(hidden).toHaveValue(/^\d{4}-\d{2}-\d{2}T08:30$/); // the time already set (from the typed value above) is kept
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

test("a vehicle the team switches off disappears from the booking form, and the page itself does not wait for the table", async ({ page, request }) => {
  const db = sql();
  try {
    await db`insert into vehicles (id, name, status) values ('audi', 'Audi', 'unavailable') on conflict (id) do update set status = 'unavailable'`;
    // Only keys are shared, nothing about bookings
    expect(await (await request.get("/api/vehicles/unavailable")).json()).toEqual({ unavailable: ["audi"] });
    await page.goto("/en");
    await expect(page.locator("#q-vehicle option")).toHaveCount(FLEET.length + 1); // "Select", the four left, "Advise me"
    await expect(page.locator("#q-vehicle option[value=audi]")).toHaveCount(0);
  } finally {
    await db`delete from vehicles where id = 'audi'`;
    await db.end();
  }
});

test("the booking form is on the page from the first paint, with the whole fleet, so nothing below it moves", async ({ page }) => {
  await page.goto("/en", { waitUntil: "commit" });
  await expect(page.locator("#q-collection")).toBeVisible();
  await expect(page.locator("#q-vehicle option")).toHaveCount(FLEET.length + 2); // "Select", every vehicle, "Advise me"
  await expect(page.locator("#q-collection")).toHaveCount(1); // one form, never a placeholder form that is swapped for another
});
