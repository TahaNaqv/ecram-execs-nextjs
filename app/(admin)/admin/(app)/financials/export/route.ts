import { exportFinancialCsv } from "@/lib/admin/financials";
import { amsterdamToday, parseFinancialQuery } from "@/lib/admin/financials-shared";
import { getAdmin } from "@/lib/auth/session";
import { adminDictionary } from "@/lib/i18n/get-dictionary";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = parseFinancialQuery(Object.fromEntries(url.searchParams.entries()));
  const [dict, admin] = await Promise.all([adminDictionary(), getAdmin()]);
  const copy = dict.admin.financials;
  const csv = await exportFinancialCsv(
    query,
    admin?.locale ?? "en",
    { services: dict.services, hourly: dict.admin.requestDetail.durationValue },
    {
      headers: [
        copy.colReference,
        copy.colDate,
        copy.colClient,
        copy.colAudience,
        copy.colService,
        copy.colRoute,
        copy.colGross,
        copy.colVatLow,
        copy.colVatHigh,
        copy.colVat,
        copy.colStatus,
        copy.colInvoice,
      ],
      status: {
        paid: copy.paid,
        pending: copy.pending,
        overdue: copy.overdue,
        refunded: copy.refunded,
        failed: copy.failed,
      },
      business: copy.badgeBusiness,
      public: copy.badgePublic,
    },
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ecram-financials-${amsterdamToday()}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
