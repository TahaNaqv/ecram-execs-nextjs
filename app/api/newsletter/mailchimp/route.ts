import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { cleanEmail, recordOptIn, setContactStatus } from "@/lib/marketing/contacts";

/**
 * Mailchimp's webhook for the newsletter audience (lib/marketing/mailchimp.ts): someone who unsubscribes with the link in a
 * newsletter, or whose address bounces ("cleaned"), is marked unsubscribed here too; someone who subscribes on a Mailchimp
 * form joins the list. Mailchimp does not sign its webhooks, so the URL carries a secret:
 *   https://www.ecramexecs.com/api/newsletter/mailchimp?secret=MAILCHIMP_WEBHOOK_SECRET
 * Mailchimp checks the URL with a GET first, which answers 200.
 */

function authorised(req: NextRequest): boolean {
  const secret = process.env.MAILCHIMP_WEBHOOK_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(req.nextUrl.searchParams.get("secret") ?? "");
  const wanted = Buffer.from(secret);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

export async function GET(req: NextRequest) {
  return authorised(req) ? new NextResponse("ok") : new NextResponse("Unauthorised", { status: 401 });
}

export async function POST(req: NextRequest) {
  if (!authorised(req)) return new NextResponse("Unauthorised", { status: 401 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }
  const type = String(form.get("type") ?? "");
  const email = cleanEmail(String(form.get("data[email]") ?? ""));
  if (!email) return NextResponse.json({ ok: true, ignored: true });
  const m = schema.marketingContacts;
  const [contact] = await db.select().from(m).where(eq(m.email, email)).limit(1);

  try {
    if (type === "unsubscribe" || type === "cleaned") {
      if (contact && contact.status === "subscribed") await setContactStatus(contact.id, "unsubscribed", { fromMailchimp: true });
    } else if (type === "subscribe") {
      // Consent given on Mailchimp's own form; a contact who asked us to remove them stays suppressed
      const name = [form.get("data[merges][FNAME]"), form.get("data[merges][LNAME]")].map((part) => String(part ?? "").trim()).filter(Boolean).join(" ");
      await recordOptIn({ email, name: name || null, source: "mailchimp" });
    } else if (type === "upemail") {
      const next = cleanEmail(String(form.get("data[new_email]") ?? ""));
      if (contact && next) {
        const [taken] = await db.select({ id: m.id }).from(m).where(eq(m.email, next)).limit(1);
        if (!taken) await db.update(m).set({ email: next, updatedAt: new Date(), syncPending: false }).where(eq(m.id, contact.id));
      }
    }
  } catch (err) {
    console.error("[mailchimp] webhook failed", err);
    return new NextResponse("Error", { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
