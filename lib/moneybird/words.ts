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
  /** The kept service fee, invoiced on its own when the customer cancels before approval */
  feeKept: string;
  /** Standard payment terms when no card balance charge is scheduled */
  paymentConditions: string;
  /** On a booking paid at booking: when the rest is charged to the card */
  balanceByCard: (date: string) => string;
};

/** The invoice email Moneybird sends. English bookings must not inherit the Dutch workflow labels. */
export type InvoiceMail = {
  subject: (number: string) => string;
  greeting: (name: string) => string;
  intro: string;
  invoice: string;
  sender: string;
  reference: string;
  invoiceDate: string;
  dueDate: string;
  outstanding: string;
  view: string;
};

export const INVOICE_MAIL: Record<Locale, InvoiceMail> = {
  en: {
    subject: (number) => `Invoice ${number}`,
    greeting: (name) => `Dear ${name},`,
    intro: "Please find your invoice for this booking below.",
    invoice: "Invoice",
    sender: "Sender",
    reference: "Reference",
    invoiceDate: "Invoice date",
    dueDate: "Due date",
    outstanding: "Outstanding amount",
    view: "View invoice",
  },
  nl: {
    subject: (number) => `Factuur ${number}`,
    greeting: (name) => `Geachte ${name},`,
    intro: "Hieronder vindt u de factuur voor deze boeking.",
    invoice: "Factuur",
    sender: "Afzender",
    reference: "Kenmerk",
    invoiceDate: "Factuurdatum",
    dueDate: "Vervaldatum",
    outstanding: "Openstaand bedrag",
    view: "Bekijk factuur",
  },
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
    feeKept: "Service fee (non-refundable, booking cancelled)",
    paymentConditions: "We kindly request you to pay the amount of {document.total_price} before {document.due_date} to our bank account stating reference {document.reference}. For questions, please contact us by email.",
    balanceByCard: (date) => `The service fee was paid at booking. The balance is charged to the card used then on ${date}.`,
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
    feeKept: "Servicekosten (niet restitueerbaar, boeking geannuleerd)",
    paymentConditions: "We verzoeken u vriendelijk het bovenstaande bedrag van {document.total_price} voor {document.due_date} te voldoen op onze bankrekening onder vermelding van de omschrijving {document.reference}. Voor vragen kunt u contact opnemen per e-mail.",
    balanceByCard: (date) => `De servicekosten zijn bij het boeken betaald. Het resterende bedrag wordt op ${date} van dezelfde kaart afgeschreven.`,
  },
};
