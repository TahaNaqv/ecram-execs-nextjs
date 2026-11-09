import { expect, test } from "@playwright/test";
import { carsToPrice } from "../../lib/pricing/booking";
import { billedHours, dayKind, hourlyRate, hoursByDay, kmPerHour, priceBooking, priceNet, vatByRate } from "../../lib/pricing/rates";
import { carsCapacityProblem, cleanCars, MAX_GROUP, MAX_PER_CAR } from "../../app/[locale]/_components/booking/trip";
import { FLEET, fitConvoy, LARGEST_CAR_SEATS, vehicleByKey } from "../../lib/fleet/vehicles";
import { cleanExtras, priceExtras } from "../../lib/pricing/extras";
import { heldKeys } from "../../lib/fleet/held";

// The client's 2027 rate card (sent 8 Nov 2026): per car per hour, in whole hours and at least 2, each hour including some
// kilometres; then 9% VAT on the rides, then a €12.50 service fee with 21% VAT on it (€2.63). 2027-06-14 is a Monday, 2027-06-19 a Saturday, 2027-06-20 a Sunday.

test("the rate card's columns follow the day of the pick-up, in either wall-clock format", () => {
  expect(dayKind("2027-06-14T08:30")).toBe("weekday");
  expect(dayKind("2027-06-18 23:59:00")).toBe("weekday");
  expect(dayKind("2027-06-19T00:00")).toBe("saturday");
  expect(dayKind("2027-06-20 10:00:00")).toBe("sunday");
  expect(dayKind("soon")).toBeNull();
});

test("every car has the rate and the kilometres the 2027 card gives it", () => {
  const card: Record<string, [number[], number[], number]> = {
    hongqi_e_hs9: [[7500, 9375, 11719], [9000, 11250, 14063], 45],
    audi: [[8000, 10000, 12500], [9500, 11875, 14844], 45],
    mercedes_vle_300: [[8500, 9500, 10000], [10000, 11000, 11500], 40],
    range_rover: [[10000, 12500, 15625], [12000, 15000, 18750], 35],
    cadillac_escalade: [[10500, 13125, 16406], [12500, 15625, 19531], 35],
  };
  for (const [key, [corporate, standard, km]] of Object.entries(card)) {
    expect([hourlyRate(key, "corporate", "weekday"), hourlyRate(key, "corporate", "saturday"), hourlyRate(key, "corporate", "sunday")]).toEqual(corporate);
    expect([hourlyRate(key, "public", "weekday"), hourlyRate(key, "public", "saturday"), hourlyRate(key, "public", "sunday")]).toEqual(standard);
    expect(kmPerHour(key)).toBe(km);
  }
  // A car named as the admin's Vehicles page names it is the same car
  expect(hourlyRate("Audi e-tron GT", "public", "weekday")).toBe(9500);
  expect(hourlyRate("a bicycle", "public", "weekday")).toBeNull();
});

test("a transfer is billed in whole hours for its drive and its waits, never under two", () => {
  // A 45-minute ride is two hours
  expect(billedHours({ driveSeconds: 45 * 60 })).toBe(2);
  expect(billedHours({ driveSeconds: 120 * 60 })).toBe(2);
  expect(billedHours({ driveSeconds: 121 * 60 })).toBe(3);
  // Waiting at a stop is time on the clock: a 1 h 1 m drive with a 90-minute wait is 2 h 31 m, so three hours
  expect(billedHours({ driveSeconds: 61 * 60, waitMinutes: 90 })).toBe(3);
  expect(billedHours({ driveSeconds: 30 * 60, waitMinutes: 30 })).toBe(2);
  expect(billedHours({ hours: 5 })).toBe(5);
  // Not timed: nothing to bill on yet
  expect(billedHours({ driveSeconds: null, waitMinutes: 90 })).toBeNull();
});

test("the waits are in the price, and an untimed ride still counts them as a lower bound", () => {
  // Schiphol → The Hague (90-minute wait) → Rotterdam airport in an Escalade on a weekday, the case the client reported
  const timed = priceBooking({ segment: "public", pickupAt: "2026-11-12T20:09", driveSeconds: 61 * 60, waitMinutes: 90, cars: [{ key: "cadillac_escalade", count: 1 }] })!;
  expect(timed.legs[0].hours).toBe(3);
  expect(timed.rides).toBe(3 * 12500);
  const untimed = priceBooking({ segment: "public", pickupAt: "2026-11-12T20:09", driveSeconds: null, waitMinutes: 150, cars: [{ key: "cadillac_escalade", count: 1 }] })!;
  expect(untimed.legs[0].hours).toBe(3);
  expect(untimed.exact).toBe(false);
});

test("a standard weekday ride: hours × rate, 9% VAT, then the €12.50 service fee with its 21% VAT", () => {
  const price = priceBooking({ segment: "public", pickupAt: "2027-06-14T08:30", driveSeconds: 45 * 60, distanceMeters: 30_000, cars: [{ key: "audi", count: 1 }] })!;
  // 2 hours × €95 = €190 (30 km, within the 90 included), + 9% (€17.10) = €207.10, + €12.50 + 21% of it (€2.63) = €222.23
  expect(price.rides).toBe(19000);
  expect(price.legs[0].km).toEqual({ distance: 30, lines: [] });
  expect(price.vat).toBe(1710);
  expect(price.fee).toBe(1250);
  expect(price.feeVat).toBe(263);
  expect(price.total).toBe(22223);
  expect(priceNet(price)).toBe(19000 + 1250);
  expect(price.exact).toBe(true);
  // A timed drive whose distance is not known may still owe kilometres: a lower bound
  expect(priceBooking({ segment: "public", pickupAt: "2027-06-14T08:30", driveSeconds: 45 * 60, cars: [{ key: "audi", count: 1 }] })!.exact).toBe(false);
});

test("corporate, a mix of cars, and a return on a Sunday priced at Sunday's rate", () => {
  const price = priceBooking({
    segment: "corporate",
    pickupAt: "2027-06-19T09:00",
    returnAt: "2027-06-20T18:00",
    driveSeconds: 150 * 60,
    cars: [{ key: "mercedes_vle_300", count: 2 }, { key: "range_rover", count: 1 }],
  })!;
  expect(price.legs.map((l) => [l.day, l.hours])).toEqual([["saturday", 3], ["sunday", 3]]);
  // Saturday: 2 × 3 × €95 + 3 × €125; Sunday: 2 × 3 × €100 + 3 × €156.25
  const rides = 57000 + 37500 + 60000 + 46875;
  expect(price.rides).toBe(rides);
  expect(price.vat).toBe(Math.round(rides * 0.09));
  expect(price.total).toBe(rides + Math.round(rides * 0.09) + 1250 + 263);
});

test("hours past midnight into the weekend are billed at the next day's rate (the client, 7 Nov 2026)", () => {
  // The client's example: six hours from Friday 22:11 are two weekday hours and four Saturday hours
  expect(hoursByDay("2026-11-20T22:11", 6)).toEqual([{ day: "weekday", hours: 2 }, { day: "saturday", hours: 4 }]);
  expect(hoursByDay("2026-11-21 23:30:00", 3)).toEqual([{ day: "saturday", hours: 1 }, { day: "sunday", hours: 2 }]);
  expect(hoursByDay("2026-11-22T22:00", 4)).toEqual([{ day: "sunday", hours: 2 }, { day: "weekday", hours: 2 }]);
  expect(hoursByDay("2026-11-18T10:00", 3)).toEqual([{ day: "weekday", hours: 3 }]);
  const price = priceBooking({ segment: "public", pickupAt: "2026-11-20T22:11", hours: 6, cars: [{ key: "audi", count: 2 }] })!;
  expect(price.legs[0].lines.map((l) => [l.day, l.hours, l.rate, l.amount])).toEqual([
    ["weekday", 2, 9500, 2 * 2 * 9500],
    ["saturday", 4, 11875, 2 * 4 * 11875],
  ]);
  expect(price.rides).toBe(2 * (2 * 9500 + 4 * 11875));
});

test("kilometres beyond each car's allowance are charged per car, as in the client's example (8 Nov 2026)", () => {
  // John's VLE 300 from Amsterdam Centraal to Paris, about 600 km and 7 hours, at the corporate rates on a weekday:
  // 7 × 40 km = 280 km included, 320 km extra × €1.50 = €480, and 7 × €85 = €595: €1,075 before VAT and the fee
  const john = priceBooking({ segment: "corporate", pickupAt: "2027-06-14T08:00", driveSeconds: 6.5 * 3600, distanceMeters: 600_000, cars: [{ key: "mercedes_vle_300", count: 1 }] })!;
  expect(john.legs[0].hours).toBe(7);
  expect(john.legs[0].km).toEqual({ distance: 600, lines: [{ key: "mercedes_vle_300", count: 1, included: 280, extra: 320, rate: 150, amount: 48000 }] });
  expect(john.rides).toBe(59500 + 48000);
  // The kilometres are part of the rides, so they carry the rides' 9% VAT
  expect(john.vat).toBe(Math.round(107500 * 0.09));
  expect(john.total).toBe(107500 + Math.round(107500 * 0.09) + 1250 + 263);
  expect(john.exact).toBe(true);

  // Each car drives the distance: two Audis at the public rate, and the return journey drives it again
  const two = priceBooking({ segment: "public", pickupAt: "2027-06-14T08:00", returnAt: "2027-06-16T08:00", driveSeconds: 2.5 * 3600, distanceMeters: 210_400, cars: [{ key: "audi", count: 2 }] })!;
  // 3 hours × 45 km = 135 km included; 210 km driven, so 75 km extra per car × €1.75 × 2 cars, on each leg
  for (const leg of two.legs) expect(leg.km).toEqual({ distance: 210, lines: [{ key: "audi", count: 2, included: 135, extra: 75, rate: 175, amount: 26250 }] });
  expect(two.rides).toBe(2 * (2 * 3 * 9500 + 26250));

  // An hourly booking's kilometres are only known after the trip: none are charged upfront
  const hourly = priceBooking({ segment: "public", pickupAt: "2027-06-14T08:00", hours: 3, distanceMeters: 900_000, cars: [{ key: "range_rover", count: 1 }] })!;
  expect(hourly.legs[0].km).toBeUndefined();
  expect(hourly.rides).toBe(3 * 12000);
});

test("several cars are checked together: their seats and boots add up", () => {
  expect(carsCapacityProblem([{ key: "audi", count: 1 }], 10, 2)).toEqual({ passengers: true, luggage: false });
  expect(carsCapacityProblem([{ key: "audi", count: 2 }, { key: "mercedes_vle_300", count: 1 }], 14, 4)).toEqual({ passengers: false, luggage: false });
  expect(carsCapacityProblem([], 20, 10)).toEqual({ passengers: false, luggage: false });
  // One entry per model, at most five of it, in fleet order
  expect(cleanCars([{ key: "audi", count: 4 }, { key: "mercedes_vle_300", count: 1 }, { key: "audi", count: 3 }])).toEqual([
    { key: "mercedes_vle_300", count: 1 },
    { key: "audi", count: 5 },
  ]);
  expect(MAX_PER_CAR).toBe(5);
  expect(MAX_GROUP).toBe(5 * LARGEST_CAR_SEATS);
  // The largest group the flow takes still gets a full suggestion: five of the largest car
  const convoy = fitConvoy(FLEET, MAX_GROUP)!;
  expect(convoy.reduce((n, c) => n + c.count, 0)).toBe(5);
  expect(convoy.reduce((n, c) => n + c.count * (vehicleByKey(c.key)?.specs?.passengers ?? 0), 0)).toBeGreaterThanOrEqual(MAX_GROUP);
});

test("an hourly booking is billed for its hours; an untimed transfer or a suggested car is a 'from' price", () => {
  const hourly = priceBooking({ segment: "public", pickupAt: "2027-06-20T10:00", hours: 4, cars: [{ key: "cadillac_escalade", count: 1 }] })!;
  expect(hourly.rides).toBe(4 * 19531);
  expect(hourly.exact).toBe(true);

  const untimed = priceBooking({ segment: "public", pickupAt: "2027-06-14T10:00", driveSeconds: null, cars: [{ key: "audi", count: 1 }] })!;
  expect(untimed.rides).toBe(2 * 9500);
  expect(untimed.exact).toBe(false);

  const { cars, suggested } = carsToPrice({ vehicle: "advise", passengers: 2, luggage: 1 });
  expect(suggested).toBe(true);
  expect(cars).toHaveLength(1);
  expect(priceBooking({ segment: "public", pickupAt: "2027-06-14T10:00", driveSeconds: 3600, cars, suggested })!.exact).toBe(false);

  // A price stored before the fee carried VAT still reads correctly
  expect(priceNet({ ...hourly, feeVat: undefined, total: hourly.rides + hourly.vat + hourly.fee })).toBe(hourly.rides + hourly.fee);

  // No car the card knows, or no date: no price at all
  expect(priceBooking({ segment: "public", pickupAt: "2027-06-14T10:00", hours: 2, cars: [] })).toBeNull();
  expect(priceBooking({ segment: "public", pickupAt: "", hours: 2, cars: [{ key: "audi", count: 1 }] })).toBeNull();
});

test("the cars priced are the ones chosen, else the car or the set of cars we would suggest", () => {
  expect(carsToPrice({ vehicles: [{ key: "audi", count: 2 }], vehicle: "audi", passengers: 6 })).toEqual({ cars: [{ key: "audi", count: 2 }], suggested: false });
  expect(carsToPrice({ vehicle: "range_rover", passengers: 2 })).toEqual({ cars: [{ key: "range_rover", count: 1 }], suggested: false });
  const large = carsToPrice({ vehicle: "advise", passengers: 12 });
  expect(large.suggested).toBe(true);
  expect(large.cars.reduce((n, c) => n + c.count, 0)).toBeGreaterThan(1);
});

test("add-ons are added at their own prices, each with its own VAT", () => {
  // Champagne €78 + 21%, flowers €66 + 9%, on the same two-hour weekday ride in an Audi
  const price = priceBooking({
    segment: "public",
    pickupAt: "2027-06-14T08:30",
    driveSeconds: 45 * 60,
    cars: [{ key: "audi", count: 1 }],
    extras: [{ key: "champagne", count: 1 }, { key: "flowers", count: 1 }],
  })!;
  expect(price.extras?.map((e) => [e.key, e.amount, e.vat])).toEqual([["champagne", 7800, 1638], ["flowers", 6600, 594]]);
  expect(price.extrasVat).toBe(1638 + 594);
  expect(price.total).toBe(19000 + 1710 + 1250 + 263 + 7800 + 1638 + 6600 + 594);
  expect(priceNet(price)).toBe(19000 + 1250 + 7800 + 6600);
  // On the invoice: 9% on the rides and the flowers, 21% on the service fee and the champagne
  expect(vatByRate(price)).toEqual({ low: 1710 + 594, high: 263 + 1638 });

  // Without add-ons the price is as it was
  const plain = priceBooking({ segment: "public", pickupAt: "2027-06-14T08:30", driveSeconds: 45 * 60, cars: [{ key: "audi", count: 1 }] })!;
  expect(plain.extras).toBeUndefined();
  expect(plain.total).toBe(22223);
  expect(vatByRate(plain)).toEqual({ low: 1710, high: 263 });
});

test("only the add-ons on the list are taken, each once, with the chocolate box in one of its two selections", () => {
  expect(
    cleanExtras([
      { key: "newspapers", count: 2, option: "classic" },
      { key: "caviar", count: 1 },
      { key: "chocolates", count: 9 },
      { key: "chocolates", option: "dairy_free", count: 1 },
      { key: "champagne", count: 0 },
      "nonsense",
    ]),
  ).toEqual([
    { key: "chocolates", option: "classic", count: 5 },
    { key: "newspapers", count: 2 },
  ]);
  expect(cleanExtras([{ key: "chocolates", option: "dairy_free", count: 1 }])).toEqual([{ key: "chocolates", option: "dairy_free", count: 1 }]);
  expect(cleanExtras("champagne")).toEqual([]);
  expect(priceExtras([{ key: "newspapers", count: 3 }])).toEqual([{ key: "newspapers", count: 3, unit: 1500, amount: 4500, vatRate: 0.21, vat: 945 }]);
});

test("a confirmed booking holds every one of its cars, led by the car the team gave it", () => {
  expect([...heldKeys({ vehicle: "audi", vehicles: null })]).toEqual(["audi"]);
  expect([...heldKeys({ vehicle: "mercedes_vle_300", vehicles: [{ key: "mercedes_vle_300", count: 1 }, { key: "audi", count: 2 }] })]).toEqual(["mercedes_vle_300", "audi"]);
  // The team gave it the Cadillac in place of the Mercedes: the Mercedes is free again, the Audis are still held
  expect([...heldKeys({ vehicle: "cadillac_escalade", vehicles: [{ key: "mercedes_vle_300", count: 1 }, { key: "audi", count: 2 }] })]).toEqual(["cadillac_escalade", "audi"]);
  // "Let us choose" holds nothing until the team gives it a car
  expect(heldKeys({ vehicle: "advise", vehicles: [{ key: "audi", count: 2 }] }).size).toBe(0);
  expect(heldKeys({ vehicle: null }).size).toBe(0);
});
