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
        status: "quoted",
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
          { kind: "status", from: current.status, to: "quoted" },
          { kind: "quote", from: current.quotedAmount, to: amountStr },
        ],
      },
    });

    if (updated.corporateContactId && updated.source !== "website-corporate") {
      const [partner] = await db
        .select({ email: schema.corporateContacts.email, name: schema.corporateContacts.name, locale: schema.corporateContacts.locale })
        .from(schema.corporateContacts)
        .where(eq(schema.corporateContacts.id, updated.corporateContactId))
        .limit(1);
      if (partner) {
        after(() => emailPartnerBooking({ request: updated, to: partner, kind: "quoted" }));
      }
    } else if (!updated.corporateContactId && (updated.source === "website" || updated.source === "website-bespoke")) {
      after(() => emailEnquiryStatus({ request: updated, kind: "quoted" }));
    }

    return NextResponse.json({ ok: true, request: updated });
  } catch (err: unknown) {
    console.error("[authorise] failed", err);
    return NextResponse.json({ error: "Failed to authorise quote" }, { status: 500 });
  }
}
