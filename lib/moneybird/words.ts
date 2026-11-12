import type { Locale } from "@/lib/i18n/config";

/**
 * The words printed on a Moneybird invoice's lines, in the booking's language. Kept here rather than in the site's
 * dictionaries: they belong to the invoice, and an accountant reads them in Moneybird.
 */
export type InvoiceWords = {
  rides: string;
  km: string;
  fee: string;
  agreed: string;
  feeAndExtras: string;
  hours: (n: number) => string;
  returnJourney: string;
  credit: (number: string) => string;
  cancellationFee: string;
};

export const INVOICE_WORDS: Record<Locale, InvoiceWords> = {
  en: {
    rides: "Chauffeur service",
    km: "Kilometres beyond the included allowance",
    fee: "Service fee",
    agreed: "Chauffeur service (agreed price)",
    feeAndExtras: "Service fee and add-ons (agreed price)",
    hours: (n) => `${n} ${n === 1 ? "hour" : "hours"}, as directed`,
    returnJourney: "return journey",
    credit: (number) => `Credit for invoice ${number}`,
    cancellationFee: "cancellation fee kept",
  },
  nl: {
    rides: "Chauffeursdienst",
    km: "Kilometers boven het inbegrepen aantal",
    fee: "Servicekosten",
    agreed: "Chauffeursdienst (afgesproken prijs)",
    feeAndExtras: "Servicekosten en extra's (afgesproken prijs)",
    hours: (n) => `${n} uur, naar wens`,
    returnJourney: "retourrit",
    credit: (number) => `Creditering van factuur ${number}`,
    cancellationFee: "annuleringskosten ingehouden",
  },
};
