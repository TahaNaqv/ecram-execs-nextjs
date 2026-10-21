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
  | { kind: "notes" };

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

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (token, key: string) => values[key] ?? token);

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

  if (event === "changes") {
    const parts = (params?.changes ?? []).map((change) => {
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
