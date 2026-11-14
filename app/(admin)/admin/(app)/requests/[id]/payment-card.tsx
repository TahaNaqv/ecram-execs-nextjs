import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { QuoteRequest } from "@/lib/db/schema";
import { formatEuro, formatTimestamp } from "@/lib/admin/format";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { mollieConfig } from "@/lib/mollie/config";
import { recordingOn } from "@/lib/moneybird/recording";
import { paymentsFor, refundable } from "@/lib/mollie/pay";
import { AlertIcon, EuroIcon } from "../../../_components/icons";
import { Card, CardHeader } from "../../../_components/ui";
import { CheckPaymentsButton, RefundForm } from "./payment-controls";

const euros = (cents: number | null | undefined) => (cents == null ? "—" : formatEuro((cents / 100).toFixed(2)));
const plain = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

const TONE: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  open: "bg-sky-50 text-sky-700 ring-sky-200",
  pending: "bg-sky-50 text-sky-700 ring-sky-200",
  authorized: "bg-sky-50 text-sky-700 ring-sky-200",
  creating: "bg-sky-50 text-sky-700 ring-sky-200",
  failed: "bg-red-50 text-red-700 ring-red-200",
  expired: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  canceled: "bg-zinc-100 text-zinc-700 ring-zinc-200",
};

/**
 * The booking's online payments (Mollie): each with its amount, status, method and date, what was refunded or charged back,
 * and a link to it in Mollie's dashboard. For a cancelled booking that was paid, the team refunds from here. Hidden when
 * Mollie is not connected and the booking has no payments.
 */
export async function PaymentCard({ r }: { r: QuoteRequest }) {
  const [rows, { admin }] = await Promise.all([paymentsFor(r.id), adminDictionary()]);
  const t = admin.payments;
  const config = mollieConfig();
  if (rows.length === 0 && !config) return null;
  if (rows.length === 0 && !(r.status === "confirmed" || r.status === "completed")) return null;

  // What the credit invoice gives back (it is open for that much while the money has not been returned)
  const [credit] = await db
    .select({ unpaid: schema.moneybirdInvoices.unpaidCents })
    .from(schema.moneybirdInvoices)
    .where(and(eq(schema.moneybirdInvoices.requestId, r.id), eq(schema.moneybirdInvoices.kind, "credit"), isNotNull(schema.moneybirdInvoices.number)))
    .orderBy(desc(schema.moneybirdInvoices.createdAt))
    .limit(1);
  const owed = credit?.unpaid != null && credit.unpaid < 0 ? -credit.unpaid : null;
  const recording = recordingOn();
  const [anyInvoice] = await db
    .select({ id: schema.moneybirdInvoices.id })
    .from(schema.moneybirdInvoices)
    .where(and(eq(schema.moneybirdInvoices.requestId, r.id), isNotNull(schema.moneybirdInvoices.number)))
    .limit(1);
  const stateLabel = (state: string) => (t.states as Record<string, string>)[state] ?? state;

  const items = await Promise.all(
    rows.map(async (row) => ({ row, left: row.status === "paid" && config && row.mode === config.mode ? await refundable(row.id) : 0 })),
  );

  return (
    <Card>
      <CardHeader title={t.title} description={config ? (config.mode === "test" ? t.descriptionTest : t.description) : t.notConnected} icon={<EuroIcon />} />
      <div className="flex flex-col gap-4 p-5 text-sm">
        {rows.length === 0 && <p className="m-0 text-zinc-600">{t.none}</p>}
        {items.map(({ row, left }) => (
          <div key={row.id} className="flex flex-col gap-2 border-b border-zinc-100 pb-4 last:border-0 last:pb-0">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-zinc-950">
                {euros(row.amountCents)}
                {row.method ? <span className="font-normal text-zinc-500"> · {row.method}</span> : null}
                {row.mode === "test" ? <span className="font-normal text-amber-700"> · {t.testMode}</span> : null}
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONE[row.status] ?? "bg-zinc-100 text-zinc-700 ring-zinc-200"}`}>
                {stateLabel(row.status)}
              </span>
            </div>
            <dl className="m-0 grid grid-cols-2 gap-y-1 text-[13px]">
              <dt className="text-zinc-500">{row.paidAt ? t.paidAt : t.startedAt}</dt>
              <dd className="m-0 text-right text-zinc-900">{formatTimestamp(row.paidAt ?? row.createdAt)}</dd>
              {row.refundedCents > 0 && (
                <>
                  <dt className="text-zinc-500">{t.refunded}</dt>
                  <dd className="m-0 text-right tabular-nums text-zinc-900">{euros(row.refundedCents)}</dd>
                </>
              )}
              {row.chargedBackCents > 0 && (
                <>
                  <dt className="text-red-700">{t.chargedBack}</dt>
                  <dd className="m-0 text-right tabular-nums text-red-700">{euros(row.chargedBackCents)}</dd>
                </>
              )}
              {row.status === "paid" && !row.moneybirdRegisteredAt && row.requestId && recording && row.mode === config?.mode && (
                <dd className="col-span-2 m-0 text-xs text-zinc-500">{t.notRecorded}</dd>
              )}
            </dl>
            {row.refunds.map((refund) => (
              <p key={refund.id} className="m-0 text-[13px] text-zinc-600">
                {interpolate(t.refundLine, { amount: euros(refund.amountCents), status: (t.refundStates as Record<string, string>)[refund.status] ?? refund.status })}
                {refund.lastError ? <span className="text-red-700"> · {refund.lastError}</span> : null}
              </p>
            ))}
            {row.lastError && (
              <p className="m-0 flex gap-2 text-[13px] text-red-700">
                <AlertIcon className="mt-0.5 shrink-0" />
                <span>{row.lastError}</span>
              </p>
            )}
            {row.dashboardUrl && (
              <a className="text-[13px] font-medium text-zinc-900 underline-offset-2 hover:underline" href={row.dashboardUrl} target="_blank" rel="noreferrer">
                {t.openInMollie}
              </a>
            )}
            {r.status === "cancelled" && left > 0 && (
              <RefundForm paymentId={row.id} suggested={plain(Math.min(left, owed ?? left))} max={euros(left)} copy={t} />
            )}
          </div>
        ))}
        {r.status === "cancelled" && items.some(({ left }) => left > 0) && owed == null && (
          <p className="m-0 text-[13px] text-amber-800">{anyInvoice ? t.paidAfterCancel : t.paidAfterCancelNoInvoice}</p>
        )}
        {config && rows.length > 0 && <CheckPaymentsButton requestId={r.id} copy={t} />}
      </div>
    </Card>
  );
}
