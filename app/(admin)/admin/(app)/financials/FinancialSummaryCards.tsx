import { formatEuro } from "@/lib/admin/format";
import { CORPORATE_TERM_DAYS, type FinancialSummary, type RangePreset } from "@/lib/admin/financials-shared";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { BriefcaseIcon, EuroIcon, FileTextIcon } from "../../_components/icons";

type Copy = Dictionary["admin"]["financials"];

function percent(part: number, whole: number): string | null {
  if (!(whole > 0)) return null;
  return new Intl.NumberFormat("nl-NL", { style: "percent", maximumFractionDigits: 1 }).format(part / whole);
}

function Card({
  label,
  icon,
  tone = "default",
  children,
}: {
  label: string;
  icon: React.ReactNode;
  tone?: "default" | "accent";
  children: React.ReactNode;
}) {
  const accent = tone === "accent";
  return (
    <article
      className={`flex h-full min-w-0 flex-col rounded-xl border p-4 shadow-card sm:p-5 ${
        accent ? "border-zinc-900 bg-zinc-950 text-white" : "border-zinc-200/80 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className={`min-w-0 text-[13px] font-medium ${accent ? "text-zinc-400" : "text-zinc-500"}`}>{label}</h2>
        <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${accent ? "bg-white/10 text-zinc-200" : "bg-zinc-100 text-zinc-500"}`}>
          {icon}
        </span>
      </div>
      {children}
    </article>
  );
}

export function FinancialSummaryCards({
  summary,
  range,
  periodLabel,
  copy,
}: {
  summary: FinancialSummary;
  range: RangePreset;
  periodLabel: string;
  copy: Copy;
}) {
  const revenueHint =
    range === "month"
      ? interpolate(copy.revenueYtdOnly, { amount: formatEuro(summary.ytdRevenue) })
      : interpolate(copy.revenueHint, { month: formatEuro(summary.monthRevenue), ytd: formatEuro(summary.ytdRevenue) });
  const whole = summary.corporateRevenue + summary.publicRevenue;
  const corporatePct = percent(summary.corporateRevenue, whole);
  const publicPct = percent(summary.publicRevenue, whole);
  const corporateShare = whole > 0 ? (summary.corporateRevenue / whole) * 100 : 0;

  const settlement = [
    { label: copy.paid, amount: summary.paid, count: summary.paidCount },
    { label: copy.pending, amount: summary.pending, count: summary.pendingCount },
    { label: copy.overdue, amount: summary.overdue, count: summary.overdueCount },
    ...(summary.refundedCount > 0 ? [{ label: copy.refunded, amount: summary.refunded, count: summary.refundedCount }] : []),
  ];

  return (
    <div className="mt-6">
      <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <Card label={copy.revenueTitle} icon={<EuroIcon />} tone="accent">
          <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">{formatEuro(summary.periodRevenue)}</p>
          <p className="mt-1 text-xs text-zinc-300">{periodLabel}</p>
          <p className="mt-auto pt-2 text-xs text-zinc-400">{revenueHint}</p>
        </Card>

        <Card label={copy.settlementTitle} icon={<FileTextIcon />}>
          <dl className="mt-3 space-y-1.5">
            {settlement.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-3 text-sm">
                <dt className="text-zinc-500">{row.label}</dt>
                <dd className="font-semibold tabular-nums text-zinc-950">
                  {formatEuro(row.amount)}
                  <span className="ml-1.5 font-normal text-zinc-400">{row.count}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card label={copy.abvTitle} icon={<EuroIcon />}>
          <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-zinc-950">
            {summary.abv == null ? "—" : formatEuro(summary.abv)}
          </p>
          <p className="mt-auto pt-2 text-xs text-zinc-500">
            {summary.completedCount > 0 ? interpolate(copy.abvNote, { count: summary.completedCount }) : copy.abvEmpty}
          </p>
        </Card>

        <Card label={copy.splitTitle} icon={<BriefcaseIcon />}>
          <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-zinc-950">{corporatePct ?? "—"}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {copy.splitCorporate}
            {whole > 0 ? ` · ${formatEuro(summary.corporateRevenue)}` : ""}
          </p>
          {whole > 0 ? (
            <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-zinc-100" aria-hidden="true">
              <span className="bg-zinc-950" style={{ width: `${corporateShare}%` }} />
              <span className="bg-zinc-300" style={{ width: `${100 - corporateShare}%` }} />
            </div>
          ) : null}
          <p className="mt-auto pt-2 text-xs text-zinc-500">
            {publicPct ? `${copy.splitPublic} ${publicPct} · ${formatEuro(summary.publicRevenue)}` : copy.splitEmpty}
          </p>
        </Card>
      </div>
      <p className="mt-3 max-w-4xl text-xs leading-5 text-zinc-500">{interpolate(copy.settlementNote, { days: CORPORATE_TERM_DAYS })}</p>
    </div>
  );
}
