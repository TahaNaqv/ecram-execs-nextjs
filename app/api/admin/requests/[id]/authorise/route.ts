import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { clashingReference, lockFleet } from "@/lib/fleet/availability";
import { routeBlockMinutes } from "@/lib/fleet/route";
import { REQUEST_STATUSES } from "@/lib/quotes/constants";
import { after } from "next/server";
import { emailPartnerBooking, emailEnquiryStatus } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount ?? 0);
    const amountStr = amount > 0 ? amount.toFixed(2) : null;
    const sendMail = Boolean(body.sendMail ?? false);
    const parsedStatus = z.enum(REQUEST_STATUSES).safeParse(body.status ?? "quoted");
    if (!parsedStatus.success) return NextResponse.json({ error: "Unknown status" }, { status: 400 });
    const newStatus = parsedStatus.data;

    const [current] = await db
      .select()
      .from(schema.quoteRequests)
      .where(eq(schema.quoteRequests.id, id))
      .limit(1);

    if (!current) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Confirming also fixes how long the car is held: the route's length, asked for here, before the fleet lock is taken
    // (Google can be slow, and nobody else should wait on it). It is only ever an improvement on the estimate.
    const confirming = newStatus === "confirmed" && current.status !== "confirmed";
    const routed = confirming && current.blockMinutes == null ? await routeBlockMinutes(current) : null;

    // Confirming gives the booking its car: refused while another confirmed booking holds that car at that time.
    // The look and the save happen together under the fleet lock, so two people confirming at once cannot both pass.
    const result = await db.transaction(async (tx) => {
      let length: number | null = null;
      if (newStatus === "confirmed") {
        await lockFleet(tx);
        // Read again under the lock: the car may have been changed while this request was on its way
        const [fresh] = await tx.select().from(schema.quoteRequests).where(eq(schema.quoteRequests.id, id)).limit(1);
        if (!fresh) return { missing: true } as const;
        // A booking that is already confirmed holds its car: saving it again (a new amount, a resent email) is not a new hold
        // Someone else (a partner accepting the quote) may have confirmed it meanwhile: then its length is theirs, not this one
        if (fresh.status !== "confirmed") length = fresh.blockMinutes ?? routed;
        const clash = fresh.status === "confirmed" ? null : await clashingReference(tx, { ...fresh, blockMinutes: length });
        if (clash) return { clash } as const;
      }
      const [row] = await tx
        .update(schema.quoteRequests)
        .set({
          status: newStatus,
          quotedAmount: amountStr,
          updatedAt: new Date(),
          ...(length && length !== current.blockMinutes ? { blockMinutes: length } : {}),
        })
        .where(eq(schema.quoteRequests.id, id))
        .returning();
      if (!row) return { missing: true } as const;

      await tx.insert(schema.requestEvents).values({
        requestId: id,
        adminId: admin.id,
        event: "changes",
        params: {
          changes: [
            { kind: "status", from: current.status, to: newStatus },
            { kind: "quote", from: current.quotedAmount, to: amountStr },
          ],
        },
      });
      return { updated: row } as const;
    });
    if ("missing" in result) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if ("clash" in result) {
      return NextResponse.json(
        { error: `That car is already booked at that time (${result.clash}). Give this booking another car first.`, clash: result.clash },
        { status: 409 },
      );
    }
    const updated = result.updated;

    // Only dispatch emails if sendMail flag is explicitly true
    if (sendMail) {
      console.log("================ [EMAIL DISPATCH INITIATED] ================");
      console.log(`Request ID: ${id}`);
      console.log(`Reference: ${updated.reference}`);
      console.log(`Target Status / Email Kind: ${newStatus}`);
      console.log(`Amount: €${amountStr}`);

      // Map request status to valid email kinds ("quoted", "confirmed", "completed", "cancelled", "contacted")
      const emailKind = ["quoted", "confirmed", "completed", "cancelled", "contacted"].includes(newStatus)
        ? (newStatus as any)
        : "quoted";

      if (updated.corporateContactId && updated.source !== "website-corporate") {
        const [partner] = await db
          .select({ email: schema.corporateContacts.email, name: schema.corporateContacts.name, locale: schema.corporateContacts.locale })
          .from(schema.corporateContacts)
          .where(eq(schema.corporateContacts.id, updated.corporateContactId))
          .limit(1);
        if (partner) {
          console.log(`[EMAIL TARGET] Partner Email: ${partner.email} (${partner.name}) with kind: ${emailKind}`);
          after(async () => {
            try {
              await emailPartnerBooking({ request: updated, to: partner, kind: emailKind });
              console.log("[EMAIL SUCCESS] Partner booking email dispatched successfully.");
            } catch (mailErr: any) {
              console.error("================ RESEND ERROR LOG ================");
              console.error("Failed to send partner email:", mailErr?.message || mailErr);
              console.error("==================================================");
            }
          });
        }
      } else {
        console.log(`[EMAIL TARGET] Client Email: ${updated.email} with kind: ${emailKind}`);
        after(async () => {
          try {
            await emailEnquiryStatus({ request: updated, kind: emailKind });
            console.log("[EMAIL SUCCESS] Client enquiry email dispatched successfully.");
          } catch (mailErr: any) {
            console.error("================ RESEND ERROR LOG ================");
            console.error("Failed to send client email:", mailErr?.message || mailErr);
            console.error("==================================================");
          }
        });
      }
      console.log("==========================================================");
    } else {
      console.log(`[AUTHORISE] Saved changes for request ${updated.reference} (Email dispatch skipped as sendMail is false).`);
    }

    revalidatePath("/admin/corporate");
    revalidatePath("/admin");
    if (updated.corporateContactId) revalidatePath(`/admin/corporate/${updated.corporateContactId}`);
    return NextResponse.json({ ok: true, request: updated });
  } catch (err: unknown) {
    console.error("[authorise] failed", err);
    return NextResponse.json({ error: "Failed to authorise quote" }, { status: 500 });
  }
}