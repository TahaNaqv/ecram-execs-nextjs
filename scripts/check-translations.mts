// Guards the dictionaries. Run in CI alongside lint and typecheck:
//   node scripts/check-translations.mts
//
// Key parity is already enforced by the compiler (every locale is loaded through the
// `Dictionary` type), so this catches what types cannot:
//   1. empty values
//   2. values identical across locales, which usually means a string was never translated
//      — except where being identical is correct, which ALLOW_IDENTICAL records explicitly.
import en from "../lib/i18n/dictionaries/en.json" with { type: "json" };
import nl from "../lib/i18n/dictionaries/nl.json" with { type: "json" };

/**
 * Paths whose English and Dutch values are deliberately the same: brand names, place names,
 * model names, and words Dutch has borrowed unchanged. Anything not listed here that matches
 * is reported, so a genuinely untranslated string cannot slip through unnoticed.
 */
const ALLOW_IDENTICAL = new Set([
  // Google's own attribution wording, required as they word it
  "booking.poweredByGoogle",
  // "Concierge" is the same word in Dutch
  "nav.concierge",
  "conciergeSection.launcherShort",
  "booking.summaryRoute",
  "booking.phonePlaceholder",
  "cookieConsent.marketingTitle",
  "cookieConsent.colName",
  "admin.nav.brand",
  "admin.requestDetail.fieldStatus",
  "email.fieldStatus",
  "admin.nav.dashboard",
  "admin.dashboard.title",
  "admin.dashboard.svcDatabase",
  "admin.dashboard.svcCdt",
  "admin.dashboard.svcWhatsappBusiness",
  "admin.enquiries.answeredIn",
  "admin.chats.concierge",
  "admin.applicationDetail.fieldStatus",
  "admin.drivers.partner",
  "admin.drivers.partners",
  "admin.requests.colStatus",
  "admin.drivers.statTeam",
  "admin.drivers.phonePlaceholder",
  "admin.applicationDetail.contact",
  "admin.events.statusChanged",
  "admin.events.none",
  "admin.newBooking.status",
  "quoteForm.waitMinutes",
  "quoteForm.addStopShort",
  "corporatePartner.charCount",
  "admin.messages.fromPartner",
  "admin.messages.fromTeam",
  "portal.stopLabel",
  "portal.labelStatus",
  "portal.events.statusChanged",
  "portal.events.none",
  "criteria.colours.BEIGE",
  "criteria.fuels.Diesel",
  "documents.vog.label",
  "documents.chauffeurCard.hint",
  "driveWithUs.phExperience",
  "driveWithUs.phKvk",
  "driveWithUs.phPhone",
  "driveWithUs.phPlate",
  "bespokeSection.contactOptions.whatsapp",
  "bespokeSection.phPhone",
  "bespokeSection.vehicleClasses.executive_sedan",
  "bespokeSection.vehicleClasses.executive_suv",
  "conciergeSection.eyebrow",
  "email.channelWhatsapp",
  "conciergeSection.panelTitle",
  "footer.contactLabel",
  "footer.linkContact",
  "footer.privacy",
  "hero.scroll",
  "nav.menu",
  "privacy.eyebrow",
  "privacy.s6Link",
  "notFound.eyebrow",
  "privacy.s1End",
  "privacy.s1Kvk",
  "privacy.s3Title",
  "privacy.s6p3",
  "quoteForm.phPhone",
  "fleetSection.qaFeaturesA",
  "corporatePartner.phCode",
  "corporatePartner.phBookerPhone",
  "corporatePartner.contact_whatsapp",
  "whoWeServe.valueDetail",
]);

type Json = string | { [k: string]: Json };

function flatten(value: Json, prefix = "", out: Record<string, string> = {}) {
  if (typeof value === "string") {
    out[prefix] = value;
    return out;
  }
  for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

const a = flatten(en as Json);
const b = flatten(nl as Json);
const problems: string[] = [];

for (const [path, value] of Object.entries(a)) {
  if (value.trim() === "") problems.push(`empty in en: ${path}`);
  const other = b[path];
  if (other === undefined) {
    problems.push(`missing in nl: ${path}`);
    continue;
  }
  if (other.trim() === "") problems.push(`empty in nl: ${path}`);
  if (other === value && !ALLOW_IDENTICAL.has(path)) {
    problems.push(`identical (untranslated?): ${path} = ${JSON.stringify(value.slice(0, 60))}`);
  }
}
for (const path of Object.keys(b)) {
  if (!(path in a)) problems.push(`missing in en: ${path}`);
}
// A stale allowlist entry hides a real problem later, so flag it.
for (const path of ALLOW_IDENTICAL) {
  if (!(path in a)) problems.push(`stale ALLOW_IDENTICAL entry (no such key): ${path}`);
  else if (a[path] !== b[path]) problems.push(`ALLOW_IDENTICAL entry is now translated, remove it: ${path}`);
}

const total = Object.keys(a).length;
if (problems.length) {
  console.error(`✗ ${problems.length} dictionary problem(s) across ${total} keys:\n`);
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log(`✓ dictionaries clean — ${total} keys, en/nl in parity`);
