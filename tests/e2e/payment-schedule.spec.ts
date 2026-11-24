import { expect, test } from "@playwright/test";
import { addMonths, balanceDueOn, chargeAllowed, confirmsAutomatically, feeWithVatCents, noticeOn, planFor, requiresManualConfirmation, upfrontCents } from "../../lib/payments/schedule";

/**
 * Launch payment rules (lib/payments/schedule.ts), at their edges. Pure: no page, no database.
 * A: 6 calendar months or more ahead (confirmed on its own, then the service fee, rest 30 days before).
 * B: 31 days up to 6 months (a person confirms first, then the fee, rest 30 days before).
 * C: 30 days or less (a person confirms first, then the full amount).
 * Nothing is collected before the booking is confirmed.
 */
test.describe("payment plan", () => {
  test("30 days or less is C, 31 days is B", () => {
    expect(planFor("2027-01-15T10:00", "2026-12-16")).toBe("C"); // 30 days
    expect(planFor("2027-01-16T10:00", "2026-12-16")).toBe("B"); // 31 days
    expect(planFor("2026-12-16T23:00", "2026-12-16")).toBe("C"); // today
  });

  test("exactly 6 calendar months ahead is A, a day less is B", () => {
    expect(planFor("2027-05-15T08:00", "2026-11-15")).toBe("A");
    expect(planFor("2027-05-14T08:00", "2026-11-15")).toBe("B");
  });

  test("two months ahead is still reviewed by hand, like every ride under six months", () => {
    expect(planFor(`${addMonths("2026-11-15", 2)}T10:00`, "2026-11-15")).toBe("B");
    expect(planFor("2027-01-14T10:00", "2026-11-15")).toBe("B"); // 60 days
    expect(planFor("2027-01-13T10:00", "2026-11-15")).toBe("B"); // 59 days
  });

  test("only a ride six months ahead confirms itself, and nothing is charged before confirmation", () => {
    expect(confirmsAutomatically("A")).toBe(true);
    expect(confirmsAutomatically("B")).toBe(false);
    expect(confirmsAutomatically("C")).toBe(false);
    expect(requiresManualConfirmation("A")).toBe(false);
    expect(requiresManualConfirmation("B")).toBe(true);
    expect(requiresManualConfirmation("C")).toBe(true);
    expect(chargeAllowed("A", "new")).toBe(false);
    expect(chargeAllowed("A", "confirmed")).toBe(true);
    expect(chargeAllowed("B", "new")).toBe(false);
    expect(chargeAllowed("B", "quoted")).toBe(false);
    expect(chargeAllowed("B", "confirmed")).toBe(true);
    expect(chargeAllowed("C", "new")).toBe(false);
    expect(chargeAllowed("C", "confirmed")).toBe(true);
    expect(chargeAllowed("C", "cancelled")).toBe(false);
  });

  test("month ends and leap years clamp to the month's last day", () => {
    expect(addMonths("2026-08-31", 6)).toBe("2027-02-28");
    expect(addMonths("2027-08-31", 6)).toBe("2028-02-29");
    expect(planFor("2027-02-28T09:00", "2026-08-31")).toBe("A");
    expect(planFor("2027-02-27T09:00", "2026-08-31")).toBe("B");
  });

  test("no date, no plan (a bespoke programme is quoted by hand)", () => {
    expect(planFor(null, "2026-11-15")).toBeNull();
  });

  test("the balance is due 30 days before the ride, the notice 5 days before that", () => {
    expect(balanceDueOn("B", "2027-03-01T08:00")).toBe("2027-01-30");
    expect(noticeOn("B", "2027-03-01T08:00")).toBe("2027-01-25");
    expect(balanceDueOn("A", "2027-03-01 08:00:00")).toBe("2027-01-30");
    expect(balanceDueOn("C", "2027-03-01T08:00")).toBeNull();
    expect(balanceDueOn(null, "2027-03-01T08:00")).toBeNull();
  });

  test("the fee at booking is €15.13; plan C pays everything; never more than the total", () => {
    const price = { fee: 1250, feeVat: 263 };
    expect(feeWithVatCents(price)).toBe(1513);
    expect(feeWithVatCents(null)).toBe(1513);
    expect(upfrontCents("A", 45752, price)).toBe(1513);
    expect(upfrontCents("B", 45752, price)).toBe(1513);
    expect(upfrontCents("C", 45752, price)).toBe(45752);
    expect(upfrontCents("B", 1000, price)).toBe(1000);
  });
});
