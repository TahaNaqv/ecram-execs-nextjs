import { expect, type Locator, type Page } from "@playwright/test";
import postgres from "postgres";
import en from "../../lib/i18n/dictionaries/en.json";
import nl from "../../lib/i18n/dictionaries/nl.json";

type Copy = typeof en.booking;

export type Journey = {
  from: string;
  to?: string;
  /** "By the hour" with this many hours instead of a destination */
  hours?: number;
  /** "dd-mm-yyyy hh:mm" as a visitor types it */
  at: string;
  ret?: string;
  stops?: { place: string; wait?: number }[];
  flight?: string;
  pax?: number;
  bags?: number;
};

/** A date next year, so a test never runs into "in the past". */
export const nextYear = (dayMonth: string, time: string) => `${dayMonth}-${new Date().getFullYear() + 1} ${time}`;

/** The booking bar: in the homepage hero (`#enquire`) or as the first step on /book and in the portal. */
export const bar = (page: Page) => page.locator("form").filter({ has: page.getByRole("button", { name: en.booking.continue }) }).first();

/**
 * Chooses a date and time in the picker the way a visitor does: the box cannot be typed into (QA round 3, bug 10). `at` is
 * "dd-mm-yyyy hh:mm"; the months are stepped through until the day is on screen.
 */
export async function pickDateTime(page: Page, field: Locator, at: string, copy: typeof en.dateTimePicker = en.dateTimePicker) {
  const [, dd, mm, yyyy, hh, min] = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})$/.exec(at)!;
  await field.click();
  const dialog = page.getByRole("dialog", { name: copy.dialog });
  const day = dialog.locator(`[data-day="${yyyy}-${mm}-${dd}"]`);
  for (let i = 0; i < 36 && (await day.count()) === 0; i++) await dialog.getByRole("button", { name: copy.nextMonth }).click();
  await day.click();
  await dialog.getByLabel(copy.hour).selectOption(String(Number(hh)));
  await dialog.getByLabel(copy.minute).selectOption(String(Number(min)));
  await dialog.getByRole("button", { name: copy.done }).click();
}

/** Fills step one of the booking flow the way a visitor does, and presses Continue. */
export async function fillJourney(page: Page, j: Journey, t: Copy = en.booking, scope?: Locator) {
  const root = scope ?? page.locator("main");
  const dt = t === en.booking ? en.dateTimePicker : nl.dateTimePicker;
  if (j.hours) {
    await root.getByRole("button", { name: t.modeHourly, exact: true }).click();
    await root.getByLabel(t.duration).selectOption(String(j.hours));
  }
  const from = root.getByLabel(t.from, { exact: true });
  await from.fill(j.from);
  await from.press("Escape");
  if (j.to) {
    const to = root.getByLabel(t.to, { exact: true });
    await to.fill(j.to);
    await to.press("Escape");
  }
  await pickDateTime(page, root.getByLabel(t.when, { exact: true }), j.at, dt);
  for (const [i, stop] of (j.stops ?? []).entries()) {
    await root.getByRole("button", { name: t.addStop }).click();
    await root.getByLabel(t.stopLabel.replace("{number}", String(i + 1)), { exact: true }).fill(stop.place);
    if (stop.wait) await root.getByLabel(t.stopWaitLabel.replace("{number}", String(i + 1))).selectOption(String(stop.wait));
  }
  if (j.ret) {
    await root.getByRole("button", { name: t.addReturn }).click();
    await pickDateTime(page, root.getByLabel(t.returnLabel, { exact: true }), j.ret, dt);
  }
  if (j.flight) await root.getByLabel(t.flight, { exact: true }).fill(j.flight);
  // The guests are always chosen by the visitor (the bar starts with a prompt, QA round 3, bug 7); the dialog opens on one guest and no bags
  {
    await root.getByRole("button", { name: new RegExp(`^${t.guests}`) }).click();
    const dialog = page.getByRole("dialog", { name: t.guestsDialog });
    for (let n = 1; n < (j.pax ?? 2); n++) await dialog.getByRole("button", { name: t.morePassengers }).click();
    for (let n = 0; n < (j.bags ?? 2); n++) await dialog.getByRole("button", { name: t.moreSuitcases }).click();
    await dialog.getByRole("button", { name: t.done }).click();
  }
  await root.getByRole("button", { name: t.continue }).click();
}

/** The car step's choices (cars and "No preference"): buttons that are pressed when chosen. */
export const carChoices = (page: Page) => page.getByRole("list", { name: en.booking.carTitle }).locator("button[aria-pressed]");
/** One car's choice, by the name it starts with (its details button is named "Photos and details of …"). */
export const carChoice = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) });

/** Step two: a car by name, "no preference", or skip. */
export async function chooseCar(page: Page, car: string | "advise" | null, t: Copy = en.booking) {
  await expect(page.getByRole("heading", { name: t.carTitle })).toBeVisible();
  if (car === "advise") await carChoice(page, t.noPreference).click();
  else if (car) await carChoice(page, car).click();
  await page.getByRole("button", { name: /^(Continue|Skip|Verder|Overslaan)/ }).click();
}

export type Details = { name?: string; email?: string; phone: string; country?: string; passenger?: { name: string; phone?: string }; notes?: string; purpose?: "business" | "private" };

/**
 * The website allows five requests per visitor per quarter of an hour, and the suite sends more than that from one
 * address: forget the earlier ones (in the test database only) so each test is judged on its own.
 */
export async function forgetRecentRequests() {
  const db = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  await db`update quote_requests set ip_hash = null where source = 'website' and ip_hash is not null`;
  await db.end();
}

/** Step three: who is travelling and how to reach them, then send. */
export async function fillDetails(page: Page, d: Details, t: Copy = en.booking) {
  await expect(page.getByRole("heading", { name: new RegExp(`${t.detailsTitle}|${t.detailsTitlePortal}`.replace(/\?/g, "\\?")) })).toBeVisible();
  if (d.passenger) await page.getByRole("button", { name: t.whoOther }).click();
  if (d.name !== undefined) await page.getByLabel(t.yourName, { exact: true }).fill(d.name);
  if (d.email !== undefined) await page.getByLabel(t.email, { exact: true }).fill(d.email);
  if (d.country) await page.getByLabel(t.phoneCountry).first().selectOption(d.country);
  await page.getByLabel(t.mobile, { exact: true }).fill(d.phone);
  if (d.passenger) {
    await page.getByLabel(t.passengerName, { exact: true }).fill(d.passenger.name);
    if (d.passenger.phone) await page.getByLabel(t.passengerPhone, { exact: true }).fill(d.passenger.phone);
  }
  if (d.purpose === "private") await page.getByRole("button", { name: t.purposePrivate }).click();
  if (d.notes) await page.getByLabel(t.notes, { exact: true }).fill(d.notes);
  if (d.name !== undefined) await forgetRecentRequests(); // website requests only (the portal has its own limit)
  await page.getByRole("button", { name: t.submit }).click();
}

/** The reference on the thank-you screen, after checking it greets the booker (`greeting`: "Thank you, Jan"). */
export async function confirmedReference(page: Page, greeting: string) {
  const status = page.getByRole("status").filter({ hasText: /EE-[A-Z0-9]{6}/ });
  await expect(status).toContainText(greeting);
  return (await status.innerText()).match(/EE-[A-Z0-9]{6}/)![0];
}
