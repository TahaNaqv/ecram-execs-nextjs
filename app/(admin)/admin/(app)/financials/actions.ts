"use server";

import { can } from "@/lib/admin/access";
import { getCustomFinancials, getFinancialBundle, type FinancialBundle } from "@/lib/admin/financials";
import type { FinancialQuery, FinancialSummary, PresentedFinancialRow } from "@/lib/admin/financials-shared";
import { requireAdmin } from "@/lib/auth/session";
import { adminDictionary } from "@/lib/i18n/get-dictionary";

async function ready() {
  const [dict, admin] = await Promise.all([adminDictionary(), requireAdmin()]);
  if (!can(admin.role, admin.permissions, "financials")) return null;
  return {
    locale: admin.locale ?? "en",
    labels: { services: dict.services, hourly: dict.admin.requestDetail.durationValue },
  };
}

export async function loadFinancialBundle(status: FinancialQuery["status"], q?: string): Promise<FinancialBundle | null> {
  const context = await ready();
  if (!context) return null;
  return getFinancialBundle({ status, q }, context.locale, context.labels);
}

export async function loadCustomFinancials(
  query: FinancialQuery,
): Promise<{ summary: FinancialSummary; rows: PresentedFinancialRow[] } | null> {
  if (query.range !== "custom" || !query.from || !query.to) return null;
  const context = await ready();
  if (!context) return null;
  return getCustomFinancials(query, context.locale, context.labels);
}
