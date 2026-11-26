import { NextResponse } from "next/server";
import { canOpenAdminPath } from "@/lib/admin/access";
import { getAdmin } from "@/lib/auth/session";
import { subscribedCsv } from "@/lib/marketing/contacts";

/** The subscribed contacts as CSV, for staff who may open the newsletter list. */
export async function GET() {
  const admin = await getAdmin();
  if (!admin || !canOpenAdminPath(admin.role, admin.permissions, "/admin/newsletter")) return new NextResponse("Not found", { status: 404 });
  const csv = await subscribedCsv();
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="newsletter-subscribed-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
