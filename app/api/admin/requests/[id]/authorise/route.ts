import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { clashingReference, lockFleet } from "@/lib/fleet/availability";
import { routeHold } from "@/lib/fleet/route";
import { ACTIVE_STATUSES } from "@/lib/quotes/constants";
import { after } from "next/server";
import { emailPartnerBooking, emailEnquiryStatus, emailBookingRecorded } from "@/lib/email";
import type { RequestEventChange } from "@/lib/admin/events";
import { storedQuoteEuros } from "@/lib/pricing/rates";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    // The amount in the body is ignored. Confirming, completing, cancelling, or resending mail must not reprice
    // the booking. An amount already stored stays as it is. When none was stored, the rate-card total from submit is written once.
    const sendMail = Boolean(body.sendMail ?? false);
    const parsedStatus = z.enum(ACTIVE_STATUSES).safeParse(body.status ?? "confirmed");
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
    const hold = confirming ? await routeHold(current) : null;
    const routed = hold?.blockMinutes ?? null;

    // Confirming gives the booking its car: refused while another confirmed booking holds that car at that time.
    // The look and the save happen together under the fleet lock, so two people confirming at once cannot both pass.
    const result = await db.transaction(async (tx) => {
      let length: number | null = null;
      let back: number | null = null;
      let basis = current;
      if (newStatus === "confirmed") {
        await lockFleet(tx);
        // Read again under the lock: the car may have been changed while this request was on its way
        const [fresh] = await tx.select().from(schema.quoteRequests).where(eq(schema.quoteRequests.id, id)).limit(1);
        if (!fresh) return { missing: true } as const;
        basis = fresh;
        // A booking that is already confirmed holds its car: saving it again (a new amount, a resent email) is not a new hold
        // Someone else (a partner accepting the quote) may have confirmed it meanwhile: then its length is theirs, not this one
        if (fresh.status !== "confirmed") {
          length = fresh.blockMinutes ?? routed;
          back = fresh.driveBackMinutes ?? hold?.driveBackMinutes ?? null;
        }
        const clash = fresh.status === "confirmed" ? null : await clashingReference(tx, { ...fresh, blockMinutes: length, driveBackMinutes: back });
        if (clash) return { clash } as const;
      }
      // Keep a final already stored on the row (the VAT-inclusive total, or one the team overrode).
      // Fill it from the rate-card snapshot only when the row has no amount yet, so authorising
      // does not replace that final with a fresh sum of the rate-card lines.
      const rateCard = storedQuoteEuros(basis.priceEstimate);
      const hasQuote = basis.quotedAmount != null && basis.quotedAmount !== "";
      const amountStr = hasQuote ? basis.quotedAmount : rateCard;
      const sameMoney =
        (basis.quotedAmount == null || basis.quotedAmount === "" ? null : Number(basis.quotedAmount)) ===
        (amountStr == null ? null : Number(amountStr));
      const changes: RequestEventChange[] = [];
      if (basis.status !== newStatus) changes.push({ kind: "status", from: basis.status, to: newStatus });
      if (!sameMoney) changes.push({ kind: "quote", from: basis.quotedAmount, to: amountStr });
      if (sendMail) changes.push({ kind: "dispatch", to: newStatus });

      const [row] = await tx
        .update(schema.quoteRequests)
        .set({
          status: newStatus,
          quotedAmount: amountStr,
          updatedAt: new Date(),
          ...(length && length !== current.blockMinutes ? { blockMinutes: length } : {}),
          ...(back && back !== current.driveBackMinutes ? { driveBackMinutes: back } : {}),
        })
        .where(eq(schema.quoteRequests.id, id))
        .returning();
      if (!row) return { missing: true } as const;

      if (changes.length > 0) {
        await tx.insert(schema.requestEvents).values({
          requestId: id,
          adminId: admin.id,
          event: "changes",
          params: { changes },
        });
      }
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
      console.log(`Amount: €${updated.quotedAmount ?? "—"}`);

      // "New" has not been confirmed. Notify Client on that status sends the acknowledgement
      // ("booking recorded"), never the "your booking is confirmed" template.
      const emailKind = newStatus === "new" ? null : newStatus;

      if (emailKind === null) {
        console.log(`[EMAIL TARGET] Client Email: ${updated.email} with kind: recorded (status is still new)`);
        after(async () => {
          try {
            await emailBookingRecorded(updated);
            console.log("[EMAIL SUCCESS] Booking-received email dispatched successfully.");
          } catch (mailErr: unknown) {
            console.error("================ RESEND ERROR LOG ================");
            console.error("Failed to send booking-received email:", mailErr instanceof Error ? mailErr.message : mailErr);
            console.error("==================================================");
          }
        });
      } else if (updated.corporateContactId && updated.source !== "website-corporate") {
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