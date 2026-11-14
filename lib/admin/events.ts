import { vehicleByKey } from "@/lib/fleet/vehicles";
import type { RequestStatus } from "@/lib/quotes/constants";

/**
 * The request history is stored as keys plus values, never as prose — prose would freeze the
 * audit trail in whichever language wrote it. `event` is the key; `params` carries what the
 * label interpolates. Shared by the schema, the writers and the admin renderer.
 */

/** One field that changed in a single save. */
export type RequestEventChange =
  | { kind: "status"; from: RequestStatus; to: RequestStatus }
  | { kind: "quote"; from: string | null; to: string | null }
  | { kind: "notes" }
  /** The team sent the client the email for this status (confirm, cancel, complete). */
  | { kind: "dispatch"; to: RequestStatus }
  /** The car that does the job: a fleet key, "advise" for none in particular, or null when it was left open. */
  | { kind: "vehicle"; from: string | null; to: string | null }
  /** The booking's cars, changed by the team in review (the client, 8 Nov 2026): fleet keys and counts, "audi:2|range_rover:1" */
  | { kind: "cars"; from: string; to: string };

export type RequestEventParams = {
  /** For `event: "changes"` — several fields can change in one save. */
  changes?: RequestEventChange[];
  /** For `event: "legacy"` — prose written before events were structured, rendered verbatim. */
  text?: string;
  /** `partner_accepted`: the amount that was accepted. */
  amount?: string | null;
  /** `attached` / `detached`: the partner's name, kept as it was at the time. */
  partner?: string;
  /** `attached`: how it happened — the partner created their account (`signup`) or the team did it (`team`). */
  by?: "signup" | "team";
  /** `partner_declined`: what the partner wrote, if anything. Partner-authored: always shown as plain text. */
  reason?: string;
  /** `invoice_added`: the name of the file as the partner sees it. */
  fileName?: string;
  /** `car_clash`: the reference of the confirmed booking that already held the car. */
  clashWith?: string;
  /** `mb_invoice` / `mb_credit`: the Moneybird invoice number. */
  number?: string;
  /** `paid`: how the customer paid online (Mollie's method: ideal, creditcard, …). */
  method?: string;
};

export const REQUEST_EVENTS = [
  "received",
  "changes",
  "legacy",
  "partner_accepted",
  "partner_declined",
  "attached",
  "detached",
  "invoice_added",
  "partner_erased",
  "car_clash",
  "mb_invoice",
  "mb_credit",
  "paid",
  "refunded",
  "charged_back",
] as const;
export type RequestEventKey = (typeof REQUEST_EVENTS)[number];

/** The strings the renderer needs, assembled by {@link eventLabels} from the admin's dictionary. */
export type EventLabels = {
  received: string;
  /** A request the team entered themselves (phone, email) */
  createdByTeam: string;
  /** Interpolates {from} and {to} */
  statusChanged: string;
  /** Interpolates {from} and {to} */
  quoteChanged: string;
  notesUpdated: string;
  /** Interpolates {status}: the team sent the client the email for this status */
  dispatched: string;
  /** Interpolates {amount} */
  partnerAccepted: string;
  partnerDeclined: string;
  /** Interpolates {reason} */
  partnerDeclinedReason: string;
  /** Interpolates {partner} */
  attached: string;
  /** Interpolates {partner} */
  attachedSignup: string;
  /** Interpolates {partner} */
  detached: string;
  /** Interpolates {file} */
  invoiceAdded: string;
  /** The partner's account was deleted; this booking stays for the financial records, stripped of personal details */
  partnerErased: string;
  /** Interpolates {from} and {to}: the car that does the job */
  vehicleChanged: string;
  /** Interpolates {from} and {to}: the booking's cars ("2 × Audi e-tron GT, 1 × Range Rover EV") */
  carsChanged: string;
  /** Interpolates {reference}: a partner accepted a quote for a car that another confirmed booking already holds */
  carClash: string;
  /** Interpolates {number}: the Moneybird invoice was sent */
  mbInvoice: string;
  /** Interpolates {number}: the Moneybird credit invoice was sent */
  mbCredit: string;
  /** Interpolates {amount} and {method}: paid online (Mollie) */
  paid: string;
  /** Interpolates {amount}: the team refunded through Mollie */
  refunded: string;
  /** Interpolates {amount}: the customer's bank took a payment back */
  chargedBack: string;
  /** Shown for an absent amount */
  none: string;
  statuses: Record<RequestStatus, string>;
};

/**
 * Built from the reader's dictionary: `{ ...d.admin.events, statuses: d.admin.statuses }`.
 * Kept as a helper so every caller assembles it the same way.
 */
export const eventLabels = (events: Omit<EventLabels, "statuses">, statuses: Record<RequestStatus, string>): EventLabels => ({
  ...events,
  statuses,
});

/** "audi:2|range_rover:1" as "2 × Audi e-tron GT, 1 × Range Rover EV". */
const carsLine = (value: unknown) =>
  (typeof value === "string" ? value : "")
    .split("|")
    .filter(Boolean)
    .map((part) => {
      const [key, count] = part.split(":");
      return `${count} × ${vehicleByKey(key)?.name ?? key}`;
    })
    .join(", ");

const fill = (template: string | undefined, values: Record<string, string>) =>
  (template ?? "").replace(/\{(\w+)\}/g, (token, key: string) => values[key] ?? token);

/**
 * One history line, in the reader's language.
 *
 * `formatAmount` is injected rather than imported so this module stays free of formatting
 * concerns (and so the schema can import the types above without pulling them in).
 * An unrecognised event renders as its raw key rather than disappearing from the audit trail.
 */
export function renderEvent(
  event: string,
  params: RequestEventParams | null,
  labels: EventLabels,
  formatAmount: (value: string | null) => string,
): string {
  if (event === "received") return params?.by === "team" ? labels.createdByTeam : labels.received;
  if (event === "legacy") return params?.text ?? "";
  if (event === "partner_accepted") return fill(labels.partnerAccepted, { amount: formatAmount(params?.amount ?? null) });
  if (event === "partner_declined") {
    return params?.reason ? fill(labels.partnerDeclinedReason, { reason: params.reason }) : labels.partnerDeclined;
  }
  if (event === "attached") return fill(params?.by === "signup" ? labels.attachedSignup : labels.attached, { partner: params?.partner ?? "" });
  if (event === "detached") return fill(labels.detached, { partner: params?.partner ?? "" });
  if (event === "invoice_added") return fill(labels.invoiceAdded, { file: params?.fileName ?? "" });
  if (event === "partner_erased") return labels.partnerErased;
  if (event === "car_clash") return fill(labels.carClash, { reference: params?.clashWith ?? "" });
  if (event === "mb_invoice") return fill(labels.mbInvoice, { number: params?.number ?? "" });
  if (event === "mb_credit") return fill(labels.mbCredit, { number: params?.number ?? "" });
  if (event === "paid") return fill(labels.paid, { amount: formatAmount(params?.amount ?? null), method: params?.method ?? "" });
  if (event === "refunded") return fill(labels.refunded, { amount: formatAmount(params?.amount ?? null) });
  if (event === "charged_back") return fill(labels.chargedBack, { amount: formatAmount(params?.amount ?? null) });

  if (event === "changes") {
    const parts = (Array.isArray(params?.changes) ? params.changes : []).map((change) => {
      if (!change || typeof change !== "object") return labels.notesUpdated;
      if (change.kind === "status") {
        return fill(labels.statusChanged, {
          from: labels.statuses[change.from] ?? change.from,
          to: labels.statuses[change.to] ?? change.to,
        });
      }
      if (change.kind === "quote") {
        const amount = (value: string | null) => (value === null ? labels.none : formatAmount(value));
        return fill(labels.quoteChanged, { from: amount(change.from), to: amount(change.to) });
      }
      if (change.kind === "dispatch") {
        return fill(labels.dispatched, { status: labels.statuses[change.to] ?? change.to });
      }
      if (change.kind === "vehicle") {
        const car = (value: string | null) => (value ? (vehicleByKey(value)?.name ?? value) : labels.none);
        return fill(labels.vehicleChanged, { from: car(change.from), to: car(change.to) });
      }
      if (change.kind === "cars") return fill(labels.carsChanged, { from: carsLine(change.from) || labels.none, to: carsLine(change.to) || labels.none });
      return labels.notesUpdated;
    });
    return parts.join(" · ");
  }

  return event;
}

/** What a partner sees of a booking's history. Everything not listed here stays inside the team. */
export type PartnerEventLabels = {
  received: string;
  /** Interpolates {from} and {to} */
  statusChanged: string;
  /** Interpolates {from} and {to} */
  quoteChanged: string;
  /** Interpolates {amount} */
  accepted: string;
  declined: string;
  attached: string;
  invoiceAdded: string;
  none: string;
  statuses: Record<RequestStatus, string>;
};

/**
 * One history line for the PARTNER, or null when it is not for them. Deny by default: only the events and the
 * status / quote parts of a save are shown. A save that also touched the internal notes shows its status and quote
 * parts and nothing of the notes; `legacy` text, detach and anything added in future stay hidden until listed here.
 */
export function renderPartnerEvent(
  event: string,
  params: RequestEventParams | null,
  labels: PartnerEventLabels,
  formatAmount: (value: string | null) => string,
): string | null {
  if (event === "received") return labels.received;
  if (event === "partner_accepted") return fill(labels.accepted, { amount: formatAmount(params?.amount ?? null) });
  if (event === "partner_declined") return labels.declined;
  if (event === "attached") return labels.attached;
  if (event === "invoice_added") return labels.invoiceAdded;

  if (event === "changes") {
    const parts: string[] = [];
    for (const change of params?.changes ?? []) {
      if (change.kind === "status") {
        parts.push(fill(labels.statusChanged, { from: labels.statuses[change.from] ?? change.from, to: labels.statuses[change.to] ?? change.to }));
      } else if (change.kind === "quote") {
        const amount = (value: string | null) => (value === null ? labels.none : formatAmount(value));
        parts.push(fill(labels.quoteChanged, { from: amount(change.from), to: amount(change.to) }));
      }
      // `notes` is internal: never shown
    }
    return parts.length ? parts.join(" · ") : null;
  }
  return null;
}
