import type { Locale } from "@/lib/i18n/config";
import { formatCurrency } from "@/lib/pricing/rates";

const intl = (locale: Locale) => (locale === "nl" ? "nl-NL" : "en-GB");

/**
 * A pick-up time is stored as the wall-clock time in the Netherlands ("2026-10-30T09:15"), with no zone. It is read as
 * if it were UTC and printed as UTC, which prints the same wall-clock back whatever zone the server runs in.
 */
export function formatPickup(pickupAt: string, locale: Locale) {
  // The database returns "2031-03-14 08:30:00": with a space instead of the T, JavaScript reads it as local time
  const wallClock = pickupAt.slice(0, 16).replace(" ", "T");
  return new Intl.DateTimeFormat(intl(locale), { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(`${wallClock}:00Z`));
}

/** Partner invoices use the same Dutch euros as the rate card, in either language. */
export const formatPartnerAmount = (amount: string, locale: Locale) => {
  void locale;
  const value = Number(amount);
  return Number.isFinite(value) ? formatCurrency(value) : amount;
};

export const formatStamp = (at: Date, locale: Locale) =>
  new Intl.DateTimeFormat(intl(locale), { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam" }).format(at);

export const formatDay = (at: Date, locale: Locale) =>
  new Intl.DateTimeFormat(intl(locale), { dateStyle: "medium", timeZone: "Europe/Amsterdam" }).format(at);

export const formatBytes = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
