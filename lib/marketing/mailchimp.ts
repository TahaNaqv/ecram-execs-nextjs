import "server-only";
import { createHash } from "node:crypto";

/**
 * Mailchimp, the client's email-marketing platform, mirrored from the newsletter list (lib/marketing/contacts.ts). Off until
 * the server's .env has MAILCHIMP_API_KEY (ends in the data centre, e.g. "-us21") and MAILCHIMP_AUDIENCE_ID; keys are never
 * stored in the database. Mailchimp tells us about unsubscribes and bounces through the webhook at
 * /api/newsletter/mailchimp?secret=MAILCHIMP_WEBHOOK_SECRET (set up in the audience's Settings → Webhooks).
 */

export type MailchimpConfig = { key: string; audience: string; api: string };

export function mailchimpConfig(): MailchimpConfig | null {
  const key = process.env.MAILCHIMP_API_KEY?.trim();
  const audience = process.env.MAILCHIMP_AUDIENCE_ID?.trim();
  const dc = key?.match(/-([a-z]{2,4}\d{1,3})$/)?.[1];
  if (!key || !audience || !dc || !/^[a-z0-9]+$/i.test(audience)) return null;
  return { key, audience, api: `https://${dc}.api.mailchimp.com/3.0` };
}

export const mailchimpConnected = () => mailchimpConfig() !== null;

/** Mailchimp's member id: the MD5 of the lower-case address. */
export const memberHash = (email: string) => createHash("md5").update(email.trim().toLowerCase()).digest("hex");

export class MailchimpError extends Error {
  constructor(
    readonly status: number,
    readonly title: string,
    detail: string,
  ) {
    super(`Mailchimp ${status} ${title}: ${detail}`.slice(0, 400));
  }
}

async function call(method: "GET" | "PUT" | "PATCH" | "POST", path: string, body?: unknown): Promise<unknown> {
  const config = mailchimpConfig();
  if (!config) throw new MailchimpError(0, "off", "Mailchimp is not connected");
  const res = await fetch(`${config.api}${path}`, {
    method,
    headers: { Authorization: `Basic ${Buffer.from(`ecram:${config.key}`).toString("base64")}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 204) return null;
  const json = (await res.json().catch(() => null)) as { title?: string; detail?: string } | null;
  if (!res.ok) throw new MailchimpError(res.status, json?.title ?? "error", json?.detail ?? res.statusText);
  return json;
}

/**
 * Sends one contact's state to the audience. A subscribed contact is added when new; Mailchimp keeps its own "unsubscribed"
 * for someone who left there (it refuses to resubscribe them without their own confirmation), so an existing member's
 * status is only ever lowered from here. Unsubscribed and suppressed contacts are marked unsubscribed there.
 */
export async function pushMember(contact: { email: string; name: string | null; status: "subscribed" | "unsubscribed" | "suppressed" }): Promise<void> {
  const config = mailchimpConfig();
  if (!config) return;
  const path = `/lists/${config.audience}/members/${memberHash(contact.email)}`;
  const [first, ...rest] = (contact.name ?? "").trim().split(/\s+/);
  const merge = contact.name ? { merge_fields: { FNAME: first ?? "", LNAME: rest.join(" ") } } : {};
  if (contact.status === "subscribed") {
    await call("PUT", `${path}?skip_merge_validation=true`, { email_address: contact.email, status_if_new: "subscribed", ...merge });
    return;
  }
  try {
    await call("PATCH", path, { status: "unsubscribed" });
  } catch (err) {
    // Never in the audience: nothing to unsubscribe
    if (err instanceof MailchimpError && err.status === 404) return;
    throw err;
  }
}

/** Removes a contact from the audience for good (their data erased on request). */
export async function deleteMember(email: string): Promise<void> {
  const config = mailchimpConfig();
  if (!config) return;
  try {
    await call("POST", `/lists/${config.audience}/members/${memberHash(email)}/actions/delete-permanent`);
  } catch (err) {
    if (err instanceof MailchimpError && err.status === 404) return;
    throw err;
  }
}
