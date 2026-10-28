import { expect, test, type Locator, type Page } from "@playwright/test";
import en from "../../lib/i18n/dictionaries/en.json";
import { HOURLY_DURATIONS } from "../../lib/quotes/constants";
import { bar, chooseCar, confirmedReference, fillDetails, fillJourney, nextYear, pickDateTime } from "./booking-helpers";
import { newEmail, signedInPartner, sql } from "./corporate-helpers";

/**
 * The third client QA report ("Ecram Execs Bug Report"): eleven findings in the corporate pages, the booking bar and the booking
 * flow. Each test is named after the bug it checks.
 */
const b = en.booking;
const t = en.corporatePartner;

/** The date and time in the Netherlands now, as the minute count the bar's box is compared with. */
const netherlandsMinutes = () => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")) / 60_000;
};
const boxMinutes = (text: string) => {
  const m = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})$/.exec(text)!;
  return Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]) / 60_000;
};

const when = (page: Page) => page.locator("#enquire").getByLabel(b.when, { exact: true });
/** Next keeps the page the visitor came from in the document, hidden: only what is on screen counts. */
const shown = (l: Locator) => l.locator("visible=true");
const guestsButton = (scope: Locator) => scope.getByRole("button", { name: new RegExp(`^${b.guests}`) });

test("bug 1 and 6: Become a Corporate Partner offers Login Account and Create New Account, and each opens its own form", async ({ page }) => {
  await page.goto("/en/corporate-partner");
  const login = page.getByRole("link", { name: t.optionLoginCta });
  const signup = page.getByRole("link", { name: t.optionSignupCta });
  await expect(login).toBeVisible();
  await expect(signup).toBeVisible();
  expect(t.optionLoginCta).toBe("Login Account");
  expect(t.optionSignupCta).toBe("Create New Account");
  // The forms are not on this page: they open from the links
  await expect(page.locator("#c-email")).toHaveCount(0);
  await login.click();
  await expect(page).toHaveURL(/\/en\/corporate-partner\/login$/);
  await expect(page.locator("#c-email")).toBeVisible();
  await expect(page.locator("#c-password")).toBeVisible();
  await page.goto("/en/corporate-partner");
  await signup.click();
  await expect(page).toHaveURL(/\/en\/corporate-partner\/signup$/);
  await expect(page.getByLabel(t.labelEmail, { exact: true })).toBeVisible();
});

test("bug 1: a signed-in visitor on Become a Corporate Partner still reaches the login", async ({ page, context }) => {
  await signedInPartner(page, context, "bug1");
  await page.goto("/en/corporate-partner");
  await expect(page.getByRole("link", { name: t.goToAccount })).toBeVisible();
  await expect(page.getByRole("link", { name: t.optionLoginCta })).toBeVisible();
  await page.getByRole("link", { name: t.optionLoginCta }).click();
  await expect(page.locator("#c-email")).toBeVisible();
});

test("bug 2: a Corporate Partner page shows the current sign-in when the visitor comes back to it", async ({ page, context }) => {
  const { contactId } = await signedInPartner(page, context, "bug2");
  await page.goto("/en/corporate-partner");
  const notice = page.getByText(t.signedInAs.replace("{email}", "").replace(".", ""), { exact: false });
  await expect(notice).toBeVisible();
  // Leave for another page of the site, as a visitor does
  await page.getByRole("link", { name: t.optionLoginCta }).click();
  await expect(page).toHaveURL(/\/corporate-partner\/login$/);
  // Signed out somewhere else (another tab, the other end of a session) while this page was away
  const db = sql();
  await db`delete from corporate_access where contact_id = ${contactId}`;
  await db.end();
  await page.goBack();
  await expect(page).toHaveURL(/\/en\/corporate-partner$/);
  await expect(page.getByRole("link", { name: t.goToAccount })).toHaveCount(0, { timeout: 15_000 });
});

test("bug 3: the booking bar is empty again after a booking was sent and the visitor comes back to the home page", async ({ page }) => {
  test.slow();
  await page.goto("/en");
  await fillJourney(page, { from: "Schiphol Airport, Arrivals 2", to: "Hotel Des Indes, The Hague", at: nextYear("14-03", "08:30"), flight: "KL 1234", pax: 3, bags: 2 }, b, bar(page));
  await chooseCar(page, null);
  await fillDetails(page, { name: "Jan de Vries", email: newEmail("bug3"), country: "31", phone: "6 1234 5678" });
  await confirmedReference(page, "Thank you, Jan");
  // Back to the home page through the site's own link (the page is kept, not loaded again)
  await page.getByRole("link", { name: /ECRAM EXECS/i }).first().click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator("#enquire").getByLabel(b.from, { exact: true })).toHaveValue("");
  await expect(page.locator("#enquire").getByLabel(b.to, { exact: true })).toHaveValue("");
  await expect(guestsButton(page.locator("#enquire"))).toContainText(b.guestsPlaceholder);
  // ...and it starts on the time it is now, not on the date that was booked
  await expect.poll(async () => Math.abs(boxMinutes(await when(page).inputValue()) - netherlandsMinutes())).toBeLessThanOrEqual(3);
});

test("bug 4: Guests and Duration show a dropdown arrow, and a press anywhere in the field opens them", async ({ page }) => {
  await page.goto("/en");
  const hero = page.locator("#enquire");
  const guests = guestsButton(hero);
  await expect(guests.locator("svg")).toBeVisible();
  // The label above the button is part of the field: pressing it opens the dialog too
  // (a real press at the label's own position: the label lies under the button's press area, which is the point)
  const label = (await hero.getByText(b.guests, { exact: true }).boundingBox())!;
  await page.mouse.click(label.x + 4, label.y + 4);
  await expect(page.getByRole("dialog", { name: b.guestsDialog })).toBeVisible();
  await page.keyboard.press("Escape");

  await hero.getByRole("button", { name: b.modeHourly, exact: true }).click();
  const duration = hero.getByLabel(b.duration);
  const cell = duration.locator("xpath=..");
  await expect(cell.locator("svg")).toBeVisible();
  // The list covers the whole field, so any press in it opens the list; its choices are the hours the team offers
  const [box, cellBox] = [await duration.boundingBox(), await cell.boundingBox()];
  expect(Math.abs(box!.width - cellBox!.width)).toBeLessThan(2);
  expect(Math.abs(box!.height - cellBox!.height)).toBeLessThan(2);
  const options = await duration.locator("option:not([disabled])").allTextContents();
  expect(options).toEqual(HOURLY_DURATIONS.map((h) => en.booking.hoursOption.replace("{hours}", String(h))));
  await duration.selectOption("4");
  await expect(cell).toContainText(en.booking.hoursOption.replace("{hours}", "4"));
});

test("bug 5: the car photo stays inside the rounded corners of the summary panel", async ({ page }) => {
  await page.goto("/en");
  await fillJourney(page, { from: "Schiphol Airport, Arrivals 2", to: "Hotel Des Indes, The Hague", at: nextYear("14-03", "08:30") }, b, bar(page));
  await chooseCar(page, null);
  const panel = page.getByRole("complementary", { name: b.summaryLabel });
  await expect(panel).toBeVisible();
  // The photo fills the top of the panel, and the panel's rounded corners and hidden overflow are what shape it (QA of 28 Oct, bug 15)
  const gallery = panel.locator("[aria-roledescription=carousel]");
  await expect(gallery).toBeVisible();
  expect(await panel.evaluate((node) => getComputedStyle(node).overflow)).toBe("hidden");
  expect(await panel.evaluate((node) => parseFloat(getComputedStyle(node).borderTopLeftRadius))).toBeGreaterThan(0);
  // Measured in one go: the panel is sticky and the page may still be scrolling to the step
  const inside = await gallery.evaluate((node) => {
    const g = node.getBoundingClientRect();
    const f = node.closest("aside")!.getBoundingClientRect();
    return g.left >= f.left - 1.5 && g.right <= f.right + 1.5 && g.top >= f.top - 1.5 && g.bottom <= f.bottom + 0.5;
  });
  expect(inside).toBe(true);
});

test("bug 7: Guests and bags start as a prompt, must be chosen, and then show the choice", async ({ page }) => {
  await page.goto("/en");
  const hero = page.locator("#enquire");
  await expect(guestsButton(hero)).toContainText(b.guestsPlaceholder);
  await expect(guestsButton(hero)).not.toContainText(/\d/);
  await hero.getByRole("button", { name: b.continue }).click();
  await expect(hero.getByRole("alert")).toContainText(en.forms.guestsRequired);
  // Choosing opens on one guest and no bags; Done confirms them
  await guestsButton(hero).click();
  const dialog = page.getByRole("dialog", { name: b.guestsDialog });
  await expect(dialog.getByRole("status").first()).toHaveText("1");
  await dialog.getByRole("button", { name: b.done }).click();
  await expect(guestsButton(hero)).toContainText(`${b.guestOne} · ${b.bagNone}`);
  await guestsButton(hero).click();
  await page.getByRole("dialog", { name: b.guestsDialog }).getByRole("button", { name: b.morePassengers }).click();
  await page.getByRole("dialog", { name: b.guestsDialog }).getByRole("button", { name: b.moreSuitcases }).click();
  await page.getByRole("dialog", { name: b.guestsDialog }).getByRole("button", { name: b.done }).click();
  await expect(guestsButton(hero)).toContainText(`${b.guestMany.replace("{count}", "2")} · ${b.bagOne}`);
});

test("bug 7 in the portal: a new booking asks for the guests too", async ({ page, context }) => {
  await signedInPartner(page, context, "bug7");
  await page.goto("/en/corporate-partner/account/new-booking");
  const form = bar(page);
  await expect(guestsButton(form)).toContainText(b.guestsPlaceholder);
  await expect(guestsButton(form)).not.toContainText(/\d/);
});

test("bug 9: Edit on the trip chip goes back to the journey step of the same booking, not to the home page", async ({ page }) => {
  await page.goto("/en");
  await fillJourney(page, { from: "Schiphol Airport, Arrivals 2", to: "Hotel Des Indes, The Hague", at: nextYear("14-03", "08:30"), pax: 2, bags: 1 }, b, bar(page));
  await chooseCar(page, null);
  await expect(page).toHaveURL(/\/en\/book/);
  await page.getByRole("button", { name: new RegExp(b.edit) }).click();
  await expect(page).toHaveURL(/\/en\/book/);
  await expect(page.getByRole("heading", { name: b.heading })).toBeVisible();
  // The journey is as the visitor left it
  await expect(shown(page.getByLabel(b.from, { exact: true }))).toHaveValue(/Schiphol/);
  await expect(shown(page.getByLabel(b.to, { exact: true }))).toHaveValue(/Des Indes/);
  await expect(shown(guestsButton(page.locator("main")))).toContainText(`${b.guestMany.replace("{count}", "2")} · ${b.bagOne}`);
});

test("bug 9 in the portal: Edit stays in the partner's booking panel", async ({ page, context }) => {
  test.slow();
  await signedInPartner(page, context, "bug9");
  await page.goto("/en/corporate-partner/account/new-booking");
  await fillJourney(page, { from: "Schiphol Airport, Arrivals 2", to: "Hotel Des Indes, The Hague", at: nextYear("14-03", "08:30") }, b, bar(page));
  await chooseCar(page, null);
  await page.getByRole("button", { name: new RegExp(b.edit) }).click();
  await expect(page).toHaveURL(/\/en\/corporate-partner\/account\/new-booking/);
  await expect(shown(page.getByLabel(b.from, { exact: true }))).toHaveValue(/Schiphol/);
});

test("bug 10: the date and time are chosen in the picker; typing changes nothing", async ({ page }) => {
  await page.goto("/en");
  const field = when(page);
  await expect(field).not.toBeEditable();
  const before = await field.inputValue();
  await field.focus();
  await page.keyboard.type("345345454");
  await expect(field).toHaveValue(before);
  // It opens the picker (press or keyboard), and the picker sets the value
  await field.click();
  const dialog = page.getByRole("dialog", { name: en.dateTimePicker.dialog });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(field).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: en.dateTimePicker.done }).click();
  await pickDateTime(page, field, nextYear("14-03", "08:30"));
  await expect(field).toHaveValue(nextYear("14-03", "08:30"));
});

test("bug 11: the booking bar opens on the current date and time in the Netherlands, and the picker's lists start there", async ({ page }) => {
  await page.goto("/en");
  const field = when(page);
  await expect.poll(async () => Math.abs(boxMinutes(await field.inputValue()) - netherlandsMinutes()), { timeout: 10_000 }).toBeLessThanOrEqual(2);
  // The picker shows that time, not midnight or 01:00
  await field.click();
  const dialog = page.getByRole("dialog", { name: en.dateTimePicker.dialog });
  const [, , , , hh, mm] = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})$/.exec(await field.inputValue())!;
  await expect(dialog.getByLabel(en.dateTimePicker.hour)).toHaveValue(String(Number(hh)));
  await expect(dialog.getByLabel(en.dateTimePicker.minute)).toHaveValue(String(Number(mm)));
  await page.keyboard.press("Escape");
});

test("bug 11: a bar left on its starting time is accepted when the visitor continues a few minutes later", async ({ page }) => {
  await page.goto("/en");
  const hero = page.locator("#enquire");
  await hero.getByLabel(b.from, { exact: true }).fill("Schiphol Airport, Arrivals 2");
  await hero.getByLabel(b.from, { exact: true }).press("Escape");
  await hero.getByLabel(b.to, { exact: true }).fill("Hotel Des Indes, The Hague");
  await hero.getByLabel(b.to, { exact: true }).press("Escape");
  await guestsButton(hero).click();
  await page.getByRole("dialog", { name: b.guestsDialog }).getByRole("button", { name: b.done }).click();
  await hero.getByRole("button", { name: b.continue }).click();
  await expect(page).toHaveURL(/\/en\/book\?/);
  await expect(page.getByRole("heading", { name: b.carTitle })).toBeVisible();
});
