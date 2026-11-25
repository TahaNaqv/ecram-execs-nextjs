import { can } from "@/lib/admin/access";
import { corporateContactsCsv } from "@/lib/admin/corporate";
import { requireAdmin } from "@/lib/auth/session";

// Admin-only: corporateContactsCsv() re-checks the session itself, so this never relies on the proxy.
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!can(admin.role, admin.permissions, "corporate")) return new Response("Forbidden", { status: 403 });
  const optedInOnly = new URL(request.url).searchParams.get("consent") === "1";
  const csv = await corporateContactsCsv(optedInOnly);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="corporate-contacts${optedInOnly ? "-opted-in" : ""}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
