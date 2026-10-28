import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
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
    const newStatus = body.status ?? "quoted";

    const [current] = await db
      .select()
      .from(schema.quoteRequests)
      .where(eq(schema.quoteRequests.id, id))
      .limit(1);

    if (!current) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(schema.quoteRequests)
      .set({
        status: newStatus,
        quotedAmount: amountStr,
        updatedAt: new Date(),
      })
      .where(eq(schema.quoteRequests.id, id))
      .returning();

    await db.insert(schema.requestEvents).values({
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

    return NextResponse.json({ ok: true, request: updated });
  } catch (err: unknown) {
    console.error("[authorise] failed", err);
    return NextResponse.json({ error: "Failed to authorise quote" }, { status: 500 });
  }
}