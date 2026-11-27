import assert from "node:assert/strict";
import { alertTier, dispatchBlock, driverCompliance, normaliseBtw, normaliseIban, normaliseKvk, type DispatchDriver } from "../lib/drivers/compliance.ts";

const today = "2026-11-28";

const agency: DispatchDriver = {
  driverType: "agency",
  accountStatus: "active",
  licenceNumber: "5012345678",
  licenceExpiry: "2030-01-01",
  catB: true,
  catBeCode96: false,
  catDCode95: false,
  code95Expiry: null,
  noPrivateCodes: true,
  kiwaCardNumber: "CK123",
  kiwaCardType: "full",
  taxipasExpiry: "2031-05-01",
  cdtCheckedOn: "2026-11-01",
  vogIssuedOn: "2026-10-01",
  vogVerified: true,
  medicalStatus: "approved",
  kvk: null,
  iban: null,
  permitNumber: null,
  permitExpiry: null,
  ondernemerskaartNumber: null,
  ondernemerskaartExpiry: null,
  insurer: null,
  insurancePolicy: null,
  insuranceExpiry: null,
  evInduction: true,
  trailerInduction: true,
  authorisedModels: ["mercedes_vle_300", "mercedes_esprinter"],
};

// A complete agency profile is active
assert.equal(driverCompliance(agency, [], today).status, "active");

// The team's "active" is not enough while something required is missing: pending, with what is missing
const noMedical = driverCompliance({ ...agency, medicalStatus: "submitted" }, [], today);
assert.equal(noMedical.status, "pending");
assert.deepEqual(noMedical.missing, ["medical"]);

// An expired licence suspends the driver on its own, and renewing it lifts that
const expired = driverCompliance({ ...agency, licenceExpiry: "2026-11-27" }, [], today);
assert.equal(expired.status, "suspended");
assert.equal(expired.autoSuspended, true);
assert.deepEqual(expired.expired.map((e) => e.key), ["licence"]);
assert.equal(driverCompliance({ ...agency, licenceExpiry: "2036-11-27" }, [], today).status, "active");

// The expiry day itself still counts as valid
assert.equal(driverCompliance({ ...agency, licenceExpiry: today }, [], today).status, "active");

// A suspension set by hand stays, whatever the dates
assert.equal(driverCompliance({ ...agency, accountStatus: "suspended" }, [], today).status, "suspended");
assert.equal(driverCompliance({ ...agency, accountStatus: "suspended" }, [], today).autoSuspended, false);

// Alerts at 60, 30 and 7 days
assert.equal(alertTier(61), null);
assert.equal(alertTier(60), 60);
assert.equal(alertTier(31), 60);
assert.equal(alertTier(30), 30);
assert.equal(alertTier(8), 30);
assert.equal(alertTier(7), 7);
assert.equal(alertTier(0), 7);
const due = driverCompliance({ ...agency, taxipasExpiry: "2026-12-05" }, [], today);
assert.deepEqual(due.dueSoon.map((d) => [d.key, d.days, d.tier]), [["chauffeurskaart", 7, 7]]);

// A freelancer also needs their permits, insurance and an own car with an APK; an expired APK suspends
const freelance: DispatchDriver = {
  ...agency,
  driverType: "freelance",
  kvk: "12345678",
  iban: "NL91ABNA0417164300",
  permitNumber: "P12345",
  permitExpiry: "2029-01-01",
  ondernemerskaartNumber: "OK1",
  ondernemerskaartExpiry: "2029-01-01",
  insurer: "Insurer",
  insurancePolicy: "POL-1",
  insuranceExpiry: "2027-06-01",
};
assert.deepEqual(driverCompliance(freelance, [], today).missing, ["ownVehicle"]);
const car = { id: "own-1", label: "Tesla · AB123C", apkExpiry: "2027-03-01" };
assert.equal(driverCompliance(freelance, [car], today).status, "active");
assert.equal(driverCompliance(freelance, [{ ...car, apkExpiry: "2026-11-01" }], today).status, "suspended");
assert.equal(driverCompliance({ ...freelance, insuranceExpiry: "2026-11-01" }, [car], today).expired[0].key, "insurance");
// An agency driver's insurance date is not theirs to keep (they drive our cars)
assert.equal(driverCompliance({ ...agency, insuranceExpiry: "2026-11-01" }, [], today).status, "active");

// Dispatch
const vle = { key: "mercedes_vle_300", apkExpiry: "2027-09-01", insuranceExpiry: "2027-09-01" };
const sprinter = { key: "mercedes_esprinter", apkExpiry: "2027-09-01", insuranceExpiry: "2027-09-01" };
const base = { ownVehicles: [], today, endDate: today, trailerBooking: null };
assert.equal(dispatchBlock({ ...base, driver: agency, car: vle }), null);
// The eSprinter needs D1 / D + Code 95
assert.deepEqual(dispatchBlock({ ...base, driver: agency, car: sprinter }), { reason: "eSprinter" });
assert.deepEqual(dispatchBlock({ ...base, driver: { ...agency, catDCode95: true }, car: sprinter }), { reason: "code95Expired" });
assert.equal(dispatchBlock({ ...base, driver: { ...agency, catDCode95: true, code95Expiry: "2030-01-01" }, car: sprinter }), null);
// An expired Code 95 is a reminder, not a suspension
assert.equal(driverCompliance({ ...agency, catDCode95: true, code95Expiry: "2026-01-01" }, [], today).status, "active");
assert.deepEqual(driverCompliance({ ...agency, catDCode95: true, code95Expiry: "2026-12-20" }, [], today).dueSoon.map((d) => d.key), ["code95"]);
// A trailer job needs BE / Code 96
assert.deepEqual(dispatchBlock({ ...base, driver: agency, car: vle, trailerBooking: "EX-1" }), { reason: "trailer", reference: "EX-1" });
assert.equal(dispatchBlock({ ...base, driver: { ...agency, catBeCode96: true }, car: vle, trailerBooking: "EX-1" }), null);
// A licence running out before the link ends blocks it
assert.equal(dispatchBlock({ ...base, driver: { ...agency, licenceExpiry: "2026-11-28" }, car: vle, endDate: "2026-11-29" })?.reason, "suspended");
// The car's own APK too
assert.deepEqual(dispatchBlock({ ...base, driver: agency, car: { ...vle, apkExpiry: "2026-11-01" } }), { reason: "carApk" });
// A pending driver cannot be linked
assert.equal(dispatchBlock({ ...base, driver: { ...agency, accountStatus: "pending" }, car: vle })?.reason, "pending");
// An agency driver only drives the cars they are authorised for
assert.deepEqual(dispatchBlock({ ...base, driver: agency, car: { ...vle, key: "range_rover" } }), { reason: "notAuthorised" });
assert.deepEqual(dispatchBlock({ ...base, driver: { ...agency, evInduction: false }, car: vle }), { reason: "induction", which: "ev" });

// Typed numbers
assert.equal(normaliseIban("nl91 abna 0417 1643 00"), "NL91ABNA0417164300");
assert.equal(normaliseIban("NL91ABNA0417164301"), null);
assert.equal(normaliseKvk("1234 5678"), "12345678");
assert.equal(normaliseKvk("1234567"), null);
assert.equal(normaliseBtw("nl 123456789 b01"), "NL123456789B01");
assert.equal(normaliseBtw("NL123456789"), null);

console.log("driver compliance: ok");
