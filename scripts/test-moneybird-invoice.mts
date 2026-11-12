import assert from "node:assert/strict";
import { creditSplit, dueInDays, guestCustomerId, invoiceCents, invoiceLines, invoiceReference, rideSummary } from "@/lib/moneybird/invoice";
import en from "@/lib/i18n/dictionaries/en.json" with { type: "json" };
import type { Price } from "@/lib/pricing/rates";

const labels = { services: en.services, addOns: en.addOns };
const price = {
  version: "2027-01", segment: "public", exact: true,
  legs: [{ leg: "outward", at: "2026-11-14T10:00", day: "saturday", hours: 2, lines: [{ key: "audi", count: 1, rate: 9500, amount: 19000 }] }],
  rides: 19000, vat: 1710, fee: 1250, feeVat: 263,
  extras: [
    { key: "champagne", count: 1, unit: 7800, amount: 7800, vatRate: 0.21, vat: 1638 },
    { key: "chocolates", option: "classic", count: 1, unit: 4200, amount: 4200, vatRate: 0.21, vat: 882 },
    { key: "flowers", count: 1, unit: 6600, amount: 6600, vatRate: 0.09, vat: 594 },
    { key: "newspapers", count: 1, unit: 1500, amount: 1500, vatRate: 0.21, vat: 315 },
  ],
  extrasVat: 1638 + 882 + 594 + 315,
  total: 45752,
} as unknown as Price;
const booking = {
  reference: "EE-ABC123", service: "hourly", collection: "Schiphol", destination: null, durationHours: 2,
  pickupAt: "2026-11-14T10:00", returnAt: null, passengers: 2, vehicle: "audi", vehicles: [{ key: "audi", count: 1 }],
  locale: "en" as const, quotedAmount: "457.52", priceEstimate: price,
};
const sum = (lines: { cents: number }[]) => lines.reduce((n, l) => n + l.cents, 0);

// 1. The client's example: each line is its part plus its own VAT, adding up to the exact total
const cents = invoiceCents(booking)!;
assert.equal(cents, 45752);
const lines = invoiceLines(booking, labels, cents);
assert.equal(sum(lines), 45752);
assert.deepEqual(lines.map((l) => [l.cents, l.rate, l.ledger]), [
  [20710, "low", "rides"], [9438, "high", "extras"], [5082, "high", "extras"], [7194, "low", "extras"], [1815, "high", "extras"], [1513, "high", "extras"],
]);
assert.equal(sum(lines.filter((l) => l.rate === "low")), 19000 + 1710 + 6600 + 594);
console.log("example lines:", lines.map((l) => `${l.description} = ${l.cents}`).join(" | "));

// 2. The team set another price: two lines split in the snapshot's proportion, summing exactly
const override = { ...booking, quotedAmount: "400.00" };
const o = invoiceLines(override, labels, invoiceCents(override)!);
assert.equal(sum(o), 40000);
assert.equal(o.length, 2);
assert.equal(o[0].cents, Math.round((40000 * (20710 + 7194)) / 45752));

// 3. Bespoke: no snapshot, one 9% line
const bespoke = { ...booking, service: "bespoke", priceEstimate: null, quotedAmount: "1234.56" };
const b = invoiceLines(bespoke, labels, invoiceCents(bespoke)!);
assert.deepEqual(b.map((l) => [l.cents, l.rate]), [[123456, "low"]]);

// 4. Extra kilometres: their own line, with their share of the rides' VAT; the sum still holds
const kmPrice = { ...price, legs: [{ ...price.legs[0], km: { distance: 300, lines: [{ key: "audi", count: 1, included: 100, extra: 40, rate: 50, amount: 2000 }] } }], rides: 21000, vat: 1890, total: 45752 + 2000 + 180 } as unknown as Price;
const km = invoiceLines({ ...booking, priceEstimate: kmPrice, quotedAmount: null }, labels, kmPrice.total);
assert.equal(sum(km), kmPrice.total);
assert.equal(km[1].cents, 2180);
assert.equal(km[0].cents, 21000 + 1890 - 2180);

// 5. No amount: no invoice
assert.equal(invoiceCents({ quotedAmount: null, priceEstimate: null }), null);
assert.equal(invoiceCents({ quotedAmount: "0", priceEstimate: null }), null);

// 6. Credit with a cancellation fee: taken from each VAT group in proportion, the rest given back exactly
const groups = [{ key: "low", cents: 27904 }, { key: "high", cents: 17848 }];
const full = creditSplit(groups, 0);
assert.equal(sum(full), 45752);
const fee = creditSplit(groups, 5000);
assert.equal(sum(fee), 40752);
assert.equal(creditSplit(groups, 99999).length, 0);

// 7. Due dates, references, customer numbers
assert.equal(dueInDays(true, "2026-11-20T10:00", "2026-11-13", 30), 30);
assert.equal(dueInDays(false, "2026-11-20T10:00", "2026-11-13", 30), 7);
assert.equal(dueInDays(false, "2026-11-01T10:00", "2026-11-13", 30), 0);
assert.equal(invoiceReference("EE-ABC123", 1), "EE-ABC123");
assert.equal(invoiceReference("EE-ABC123", 2), "EE-ABC123-R2");
assert.equal(guestCustomerId("Jan@Example.com ", null), guestCustomerId("jan@example.com", ""));
assert.notEqual(guestCustomerId("jan@example.com", "Acme BV"), guestCustomerId("jan@example.com", null));
console.log("summary nl:", rideSummary({ ...booking, locale: "nl" }, labels));
console.log("all invoice unit checks passed");
