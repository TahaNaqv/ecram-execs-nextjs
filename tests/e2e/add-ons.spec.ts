import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { fillAdminLogin } from "./helpers";
import { carChoice, chooseExtras, confirmedReference, fillJourney, forgetRecentRequests, nextYear } from "./booking-helpers";
import en from "../../lib/i18n/dictionaries/en.json";
import { formatCents } from "../../lib/pricing/rates";

const euro = (cents: number) => formatCents(cents, "en");

test("add-ons are chosen after the car, kept when going back, priced on the review and stored with the booking", async ({ page }) => {
  test.slow();
  const email = `addons-${Date.now()}@e2e.ecramexecs.test`;
  await page.goto("/en");
  // A Monday, so the Audi is €95 an hour (the 2027 card)
  await fillJourney(page, { from: "Kurhaus, Scheveningen", to: "Hotel Des Indes, The Hague", at: nextYear("14-06", "10:00") });
  await expect(page.getByRole("heading", { name: en.booking.carTitle })).toBeVisible();
  await carChoice(page, "Audi e-tron GT").click();
  await page.getByRole("button", { name: /^Continue/ }).click();

  // The four add-ons, each with its price before VAT
  await expect(page.getByRole("heading", { name: en.booking.extrasTitle })).toBeVisible();
  for (const name of [en.addOns.champagne, en.addOns.chocolates, en.addOns.flowers, en.addOns.newspapers]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByText(`${euro(7800)} excl. 21% BTW / VAT`)).toBeVisible();
  await expect(page.getByText(`${euro(6600)} excl. 9% BTW / VAT`)).toBeVisible();
  await expect(page.getByRole("button", { name: en.booking.extrasSkip })).toBeVisible();

  // Two bottles of champagne and the dairy-free chocolates; the selection can change after the box is added
  const chocolates = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: en.addOns.chocolates, exact: true }) });
  await chocolates.getByRole("button", { name: `${en.booking.extrasAdd}: ${en.addOns.chocolates}` }).click();
  // The focus moves from Add to the stepper, so a keyboard user stays on the card
  await expect(chocolates.getByRole("button", { name: en.booking.extrasMore.replace("{item}", en.addOns.chocolates) })).toBeFocused();
  await chocolates.getByText(en.addOns.chocolatesDairyFree, { exact: true }).click();
  await expect(chocolates.getByRole("radio", { name: en.addOns.chocolatesDairyFree })).toBeChecked();
  const champagne = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: en.addOns.champagne, exact: true }) });
  await champagne.getByRole("button", { name: `${en.booking.extrasAdd}: ${en.addOns.champagne}` }).click();
  await champagne.getByRole("button", { name: en.booking.extrasMore.replace("{item}", en.addOns.champagne) }).click();
  // Added and removed again: the flowers are not in the booking
  const flowers = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: en.addOns.flowers, exact: true }) });
  await flowers.getByRole("button", { name: `${en.booking.extrasAdd}: ${en.addOns.flowers}` }).click();
  await flowers.getByRole("button", { name: en.booking.extrasFewer.replace("{item}", en.addOns.flowers) }).click();
  // 2 × €78 + €42 before VAT
  await expect(page.getByText(`Add-ons: ${euro(19800)} excl. BTW / VAT`)).toBeVisible();

  // Back to the car and forward again: the add-ons are still chosen
  await page.getByRole("button", { name: en.booking.back }).click();
  await expect(page.getByRole("heading", { name: en.booking.carTitle })).toBeVisible();
  await page.getByRole("button", { name: /^Continue/ }).click();
  await expect(page.getByText(`Add-ons: ${euro(19800)} excl. BTW / VAT`)).toBeVisible();
  await page.getByRole("button", { name: en.booking.extrasContinue, exact: true }).click();

  // The review lists them, prices them and groups the VAT by rate
  await expect(page.getByRole("heading", { name: en.booking.detailsTitle })).toBeVisible();
  await page.getByLabel(en.booking.yourName, { exact: true }).fill("Anna Bakker");
  await page.getByLabel(en.booking.email, { exact: true }).fill(email);
  await page.getByLabel(en.booking.mobile, { exact: true }).fill("6 1234 5678");
  await page.getByRole("button", { name: en.booking.purposePrivate }).click(); // a business trip also asks for the company and its KVK
  await forgetRecentRequests();
  await page.getByRole("button", { name: en.booking.reviewButton }).click();
  await expect(page.getByRole("heading", { name: en.booking.reviewTitle })).toBeVisible();
  const ride = page.getByRole("region", { name: en.booking.reviewRide });
  await expect(ride).toContainText(`2 × ${en.addOns.champagne}`);
  await expect(ride).toContainText(`1 × ${en.addOns.chocolates} (${en.addOns.chocolatesDairyFree})`);
  const price = page.getByRole("region", { name: en.booking.reviewPrice });
  await expect(price).toContainText(en.addOns.champagne);
  await expect(price).toContainText(euro(15600));
  await expect(price).toContainText(euro(4200));
  await expect(price).toContainText(en.booking.priceVatHigh);
  // 21% on the service fee and on the champagne and chocolates: €2.63 + €32.76 + €8.82
  await expect(price).toContainText(euro(4421));
  await page.getByLabel(new RegExp(`^${en.booking.reviewAgree}`)).check();
  await page.getByRole("button", { name: en.booking.submit }).click();
  const reference = await confirmedReference(page, "Thank you, Anna");

  // The receipt lists the add-ons and splits the VAT by rate, as the review did
  await page.getByRole("button", { name: en.booking.receiptTitle }).click();
  const receipt = page.getByRole("dialog");
  await expect(receipt).toContainText(en.booking.receiptRides);
  await expect(receipt).toContainText(`2 × ${en.addOns.champagne}`);
  await expect(receipt).toContainText(`1 × ${en.addOns.chocolates} (${en.addOns.chocolatesDairyFree})`);
  await expect(receipt).toContainText(en.booking.receiptNet);
  await expect(receipt).toContainText(en.booking.priceVatHigh);
  await expect(receipt).toContainText(euro(4421));
  await receipt.getByRole("button", { name: "Close", exact: true }).last().click();

  const db = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  const [row] = await db`select id, extras, price_estimate from quote_requests where reference = ${reference}`;
  await db.end();
  expect(row.extras).toEqual([
    { key: "champagne", count: 2 },
    { key: "chocolates", option: "dairy_free", count: 1 },
  ]);
  // The server prices them the same way, on top of the ride (whose hours depend on the drive Google gives)
  const p = row.price_estimate;
  expect(p.extrasVat).toBe(3276 + 882);
  expect(p.total).toBe(p.rides + p.vat + p.fee + p.feeVat + 15600 + 4200 + 4158);

  // The team's booking PDF lists the add-ons and the VAT by rate, so its lines add up to the total
  await page.goto("/admin/login");
  await fillAdminLogin(page);
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
  await page.goto(`/admin/requests/${row.id}`);
  await page.getByText(en.admin.pricing.pdfQuote, { exact: true }).click();
  const quote = page.locator("#official-quote");
  await expect(quote.getByText(`2 × ${en.addOns.champagne}`, { exact: true })).toBeVisible();
  await expect(quote.getByText(`1 × ${en.addOns.chocolates} (${en.addOns.chocolatesDairyFree})`, { exact: true })).toBeVisible();
  await expect(quote.getByText(en.admin.pricing.serviceFeeAddOnsVat, { exact: true })).toBeVisible();
});

test("skipping the add-ons sends none", async ({ page }) => {
  await page.goto("/en");
  await fillJourney(page, { from: "Kurhaus, Scheveningen", to: "Hotel Des Indes, The Hague", at: nextYear("15-06", "10:00") });
  await carChoice(page, "Audi e-tron GT").click();
  await page.getByRole("button", { name: /^Continue/ }).click();
  await chooseExtras(page, []);
  await expect(page.getByRole("heading", { name: en.booking.detailsTitle })).toBeVisible();
  // Back from the details leads to the add-ons, not the car
  await page.getByRole("button", { name: en.booking.back }).click();
  await expect(page.getByRole("heading", { name: en.booking.extrasTitle })).toBeVisible();
});
