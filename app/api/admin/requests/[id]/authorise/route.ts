import { revalidatePath } from "next/cache";
import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { can } from "@/lib/admin/access";
import { setBookingStatus } from "@/lib/admin/approve";
import { requireAdmin } from "@/lib/auth/session";
import { invoiceBlocksStatus } from "@/lib/moneybird/sync";
import { ACTIVE_STATUSES } from "@/lib/quotes/constants";

/**
 * The admin's status menu and Approve. The amount in the body is ignored: confirming, completing, cancelling or resending
 * the email never reprices the booking (lib/admin/approve.ts keeps the amount already stored).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!can(admin.role, admin.permissions, "bookings")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const sendMail = Boolean(body.sendMail ?? false);
    const parsedStatus = z.enum(ACTIVE_STATUSES).safeParse(body.status ?? "confirmed");
    if (!parsedStatus.success) return NextResponse.json({ error: "Unknown status" }, { status: 400 });
    const newStatus = parsedStatus.data;

    // Once Moneybird has sent the invoice the booking stays confirmed, is completed, or is cancelled (and then credited)
    if (await invoiceBlocksStatus(id, newStatus)) {
      return NextResponse.json(
        { error: "This booking's invoice has been sent from Moneybird. Cancel the booking to credit it instead.", invoice: true },
        { status: 409 },
      );
    }

    const result = await setBookingStatus(id, { newStatus, sendMail, adminId: admin.id });
    if (result.status === "missing") return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if (result.status === "clash") {
      return NextResponse.json(
        { error: `That car is already booked at that time (${result.reference}). Give this booking another car first.`, clash: result.reference },
        { status: 409 },
      );
    }
    after(result.followUp);

    revalidatePath("/admin/corporate");
    revalidatePath("/admin");
    if (result.request.corporateContactId) revalidatePath(`/admin/corporate/${result.request.corporateContactId}`);
    return NextResponse.json({ ok: true, request: result.request });
  } catch (err: unknown) {
    console.error("[authorise] failed", err);
    return NextResponse.json({ error: "Failed to authorise quote" }, { status: 500 });
  }
}
