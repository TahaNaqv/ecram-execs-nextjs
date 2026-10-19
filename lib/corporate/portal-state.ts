import type { QuoteField } from "@/lib/quotes/validation";

/** What the portal's forms get back from their Server Actions. */
export type PortalState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Partial<Record<QuoteField | "message" | "reason", string>>; values: Record<string, string> }
  | { status: "ok"; notice: string }
  // The sign-in ended while the form was open
  | { status: "locked"; message: string };
