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
};

export const REQUEST_EVENTS = ["received", "changes", "legacy"] as const;
export type RequestEventKey = (typeof REQUEST_EVENTS)[number];

/** The strings the renderer needs, assembled by {@link eventLabels} from the admin's dictionary. */
export type EventLabels = {
  received: string;
  /** Interpolates {from} and {to} */
  statusChanged: string;
  /** Interpolates {from} and {to} */
  quoteChanged: string;
  notesUpdated: string;
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
  if (event === "received") return labels.received;
  if (event === "legacy") return params?.text ?? "";

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
