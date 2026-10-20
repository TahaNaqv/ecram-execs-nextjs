import type { CodeField, CompleteField, OnboardingField, RequestField } from "./validation";

/** What the Corporate Partner forms get back from their Server Actions. Never carries a password. */
export type CorporateState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Partial<Record<RequestField | OnboardingField | CompleteField | CodeField, string>>; values: Record<string, string> }
  | { status: "sent"; email: string; notice?: string }
  // The emailed code was right; the password is the next step
  | { status: "verified" }
  // The code or the sign-in ended while the person was filling in a form: back to the start of that flow
  | { status: "locked"; message: string }
  | { status: "success"; reference: string; name: string };
