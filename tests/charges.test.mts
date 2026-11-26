import assert from "node:assert/strict";
import { chargeBilling, vatInside } from "../lib/payments/charges.ts";

const base = { today: "2026-11-27", paidCents: 1513, totalCents: 50000, balanceAttempted: false };
assert.equal(chargeBilling({ ...base, pickupAt: "2027-02-01T10:00" }), "balance"); // months away, fee paid only
assert.equal(chargeBilling({ ...base, pickupAt: "2026-12-28T10:00" }), "balance"); // 31 days away
assert.equal(chargeBilling({ ...base, pickupAt: "2026-12-27T10:00" }), "separate"); // exactly 30 days away
assert.equal(chargeBilling({ ...base, pickupAt: "2026-12-01T10:00" }), "separate");
assert.equal(chargeBilling({ ...base, pickupAt: "2027-02-01T10:00", paidCents: 50000 }), "separate"); // already paid in full
assert.equal(chargeBilling({ ...base, pickupAt: "2027-02-01T10:00", balanceAttempted: true }), "separate");
assert.equal(chargeBilling({ ...base, pickupAt: "2027-02-01T10:00", paidCents: 0, totalCents: null }), "balance");
assert.equal(chargeBilling({ ...base, pickupAt: null }), "separate");
assert.equal(chargeBilling({ ...base, pickupAt: "2027-02-01T10:00", paidCents: 0, invoicePaid: true }), "separate"); // paid by transfer
assert.equal(vatInside(12100, 2100), 2100);
console.log("charges: ok");
