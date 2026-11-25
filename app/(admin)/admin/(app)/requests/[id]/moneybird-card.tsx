import Link from "next/link";
import { serviceFeeCents } from "@/lib/payments/schedule";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { QuoteRequest } from "@/lib/db/schema";
import { formatEuro } from "@/lib/admin/format";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { moneybirdConfigured, moneybirdInvoiceLink } from "@/lib/moneybird/config";
import { mollieConfigured } from "@/lib/mollie/config";
import { invoiceCents } from "@/lib/moneybird/invoice";
import { billingComplete, invoiceEligible, invoicesFor, isSent } from "@/lib/moneybird/sync";
import { AlertIcon, EuroIcon } from "../../../_components/icons";
import { btn, Card, CardHeader } from "../../../_components/ui";
import { CreditForm, ReissueButton, RetryButton } from "./moneybird-controls";

const euros = (cents: number | null | undefined) => (cents == null ? "—" : formatEuro((cents / 100).toFixed(2)));

const TONE: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  open: "bg-sky-50 text-sky-700 ring-sky-200",
  scheduled: "bg-sky-50 text-sky-700 ring-sky-200",
  pending_payment: "bg-sky-50 text-sky-700 ring-sky-200",
  late: "bg-amber-50 text-amber-800 ring-amber-200",
  reminded: "bg-amber-50 text-amber-800 ring-amber-200",
  uncollectible: "bg-red-50 text-red-700 ring-red-200",
  failed: "bg-red-50 text-red-700 ring-red-200",
  credited: "bg-zinc-100 text-zinc-800 ring-zinc-200",
};

/**
 * The booking's invoice in Moneybird (lib/moneybird/sync.ts): its number and state, what is still open, links to it, and
 * what the team can do: try again after an error, or credit it once the booking is cancelled. Hidden when Moneybird is not
 * connected and nothing was ever invoiced, and for a booking that was never confirmed.
 */
/** Invoice actions beside Email and Call, so they are available before the invoice details further down. */
export async function MoneybirdHeaderActions({ r }: { r: QuoteRequest }) {
  const [rows, { admin }] = await Promise.all([invoicesFor(r.id), adminDictionary()]);
  const t = admin.moneybird;
  const connected = moneybirdConfigured();
  const confirmed = r.status === "confirmed" || r.status === "completed";
  const live = rows.find((row) => row.kind === "invoice" && !row.creditedAt) ?? null;
  if (!live && (!connected || !confirmed)) return null;
  const automatic = !live && confirmed && connected ? await invoiceEligible(r.id) : true;
  const bookingCents = invoiceCents({ quotedAmount: r.quotedAmount, priceEstimate: r.priceEstimate ?? null });
  const sent = live ? isSent(live) : false;
  const differs = Boolean(live && sent && bookingCents != null && live.totalCents != null && bookingCents !== live.totalCents);
  const error = live?.lastError ?? null;
  const [partner] = error?.startsWith("billing_missing") && r.corporateContactId
    ? await db
        .select({ billingStreet: schema.corporateContacts.billingStreet, billingPostcode: schema.corporateContacts.billingPostcode, billingCity: schema.corporateContacts.billingCity })
        .from(schema.corporateContacts)
        .where(eq(schema.corporateContacts.id, r.corporateContactId))
        .limit(1)
    : [];
  const customerUrl = live
    ? live.url && live.url.startsWith("https://moneybird.com")
      ? live.url
      : `/api/mock/moneybird/invoice?id=${encodeURIComponent(live.moneybirdId || r.reference)}&view=customer`
    : null;
  const inMoneybird = live ? moneybirdInvoiceLink(live.moneybirdId || "") : null;
  const canRetry = connected && (!live ? confirmed : Boolean(error) && (!error?.startsWith("billing_missing") || (partner && billingComplete(partner))));
  return (
    <>
      {customerUrl ? (
        <a href={customerUrl} target="_blank" rel="noreferrer" className={`${btn.base} ${btn.secondary} ${btn.md}`}>{t.viewInvoice}</a>
      ) : null}
      {inMoneybird ? (
        <a href={inMoneybird} target="_blank" rel="noreferrer" className={`${btn.base} ${btn.primary} ${btn.md}`}>{t.openInMoneybird}</a>
      ) : null}
      {canRetry ? <RetryButton requestId={r.id} copy={t} force={!live && !automatic} /> : null}
      {differs && live && connected ? <ReissueButton requestId={r.id} copy={t} /> : null}
    </>
  );
}

export async function MoneybirdCard({ r }: { r: QuoteRequest }) {
  const [rows, { admin }] = await Promise.all([invoicesFor(r.id), adminDictionary()]);
  const t = admin.moneybird;
  const connected = moneybirdConfigured();
  const confirmed = r.status === "confirmed" || r.status === "completed";
  if (rows.length === 0 && (!connected || !confirmed)) return null;

  const live = rows.find((row) => row.kind === "invoice" && !row.creditedAt) ?? null;
  // A booking approved before Moneybird was connected is only invoiced when the team asks for it
  const automatic = !live && confirmed && connected ? await invoiceEligible(r.id) : true;
  const credits = rows.filter((row) => row.kind === "credit");
  const earlier = rows.filter((row) => row.kind === "invoice" && row !== live && row.state !== "void");
  const [partner] = r.corporateContactId
    ? await db
        .select({ id: schema.corporateContacts.id, billingStreet: schema.corporateContacts.billingStreet, billingPostcode: schema.corporateContacts.billingPostcode, billingCity: schema.corporateContacts.billingCity })
        .from(schema.corporateContacts)
        .where(eq(schema.corporateContacts.id, r.corporateContactId))
        .limit(1)
    : [];
  const bookingCents = invoiceCents({ quotedAmount: r.quotedAmount, priceEstimate: r.priceEstimate ?? null });
  const sent = live ? isSent(live) : false;
  const differs = Boolean(live && sent && bookingCents != null && live.totalCents != null && bookingCents !== live.totalCents);
  const error = live?.lastError ?? null;
  const errorText = !error
    ? null
    : error.startsWith("billing_missing")
      ? t.billingMissing
      : error.startsWith("no_amount")
        ? t.noAmount
        : error.startsWith("total_mismatch")
          ? interpolate(t.totalMismatch, { detail: error.replace(/^total_mismatch:\s*/, "") })
          : interpolate(t.error, { detail: error.replace(/^rejected:\s*/, "") });
  const stateLabel = (state: string) => (t.states as Record<string, string>)[state] ?? state;
  const badge = (state: string) => (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONE[state] ?? "bg-zinc-100 text-zinc-700 ring-zinc-200"}`}>
      {stateLabel(state)}
    </span>
  );

  const links = (row: { moneybirdId: string | null; url: string | null; totalCents?: number | null; state?: string }) => {
    // Open in Moneybird actual website in a new tab
    const inMoneybird = moneybirdInvoiceLink(row.moneybirdId || "");

    // Customer's view opens the receipt in a new tab / website
    const customerUrl =
      row.url && row.url.startsWith("https://moneybird.com")
        ? row.url
        : `/api/mock/moneybird/invoice?id=${encodeURIComponent(row.moneybirdId || r.reference)}&view=customer`;

    return (
      <div className="flex flex-wrap gap-2">
        {customerUrl && (
          <a
            className={`${btn.base} ${btn.secondary} ${btn.sm}`}
            href={customerUrl}
            target="_blank"
            rel="noreferrer"
            title="View receipt"
          >
            {t.viewInvoice}
          </a>
        )}
        {inMoneybird && (
          <a
            className={`${btn.base} ${btn.secondary} ${btn.sm}`}
            href={inMoneybird}
            target="_blank"
            rel="noreferrer"
            title="Open in Moneybird"
          >
            {t.openInMoneybird}
          </a>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader title={t.title} icon={<EuroIcon />} />
      <div className="flex flex-col gap-4 p-5 text-sm">
        {!live && confirmed && <p className="m-0 text-zinc-600">{automatic ? t.making : t.notAutomatic}</p>}

        {live && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-zinc-950">{live.number ? interpolate(t.number, { number: live.number }) : t.notSent}</span>
              {badge(live.state)}
            </div>
            <p className="m-0 text-right text-[15px] font-semibold tabular-nums text-zinc-950">{euros(live.totalCents ?? bookingCents)}</p>
          </div>
        )}

        {errorText && (
          <div className="flex flex-col gap-2 rounded-lg bg-red-50 p-3 text-[13px] text-red-900 ring-1 ring-inset ring-red-200">
            <p className="m-0 flex gap-2">
              <AlertIcon className="mt-0.5 shrink-0 text-red-600" />
              <span>{errorText}</span>
            </p>
            {error?.startsWith("billing_missing") && partner && (
              <Link className="font-medium underline" href={`/admin/corporate/${partner.id}/billing`}>
                {t.billingLink}
              </Link>
            )}
          </div>
        )}

        {differs && live && connected && (
          <div className="flex flex-col gap-3 rounded-lg bg-amber-50 p-3 text-[13px] text-amber-950 ring-1 ring-inset ring-amber-200">
            <p className="m-0 font-medium">{interpolate(t.priceChanged, { booking: euros(bookingCents), invoice: euros(live.totalCents) })}</p>
          </div>
        )}

        {live && sent && r.status === "cancelled" && connected && (
          <CreditForm
            requestId={r.id}
            copy={t}
            paid={live.state === "paid"}
            total={euros(live.totalCents)}
            serviceFee={r.paymentPlan && r.priceEstimate?.fee ? euros(serviceFeeCents(r.priceEstimate)) : undefined}
          />
        )}

        {credits.filter((row) => Boolean(row.number) || (row.totalCents != null && row.totalCents !== 0) || Boolean(row.lastError)).map((row) => {
          // Money owed back: the credit is still open (negative), which happens only when the customer had already paid.
          // An unpaid invoice is settled against its credit instead, which leaves both "paid" and nothing to refund.
          const paidBack = row.unpaidCents != null && row.unpaidCents < 0 ? -row.unpaidCents : 0;
          return (
            <div key={row.id} className="flex flex-col gap-2 border-t border-zinc-100 pt-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-zinc-950">{row.number ? interpolate(t.credit, { number: row.number }) : t.creditNotSent}</span>
                {row.number ? badge("credited") : null}
              </div>
              <p className="m-0 text-[13px] text-zinc-600">
                {interpolate(t.creditAmount, { amount: euros(row.totalCents == null ? null : -row.totalCents) })}
                {row.feeCents ? ` · ${interpolate(t.feeKept, { amount: euros(row.feeCents) })}` : ""}
              </p>
              {paidBack > 0 && (
                <p className="m-0 text-[13px] font-medium text-amber-800">
                  {interpolate(mollieConfigured() ? t.refundOwedMollie : t.refundOwed, { amount: euros(paidBack) })}
                </p>
              )}
              {row.lastError && <p className="m-0 text-[13px] text-red-700">{interpolate(t.error, { detail: row.lastError.replace(/^rejected:\s*/, "") })}</p>}
              {links(row)}
            </div>
          );
        })}

        {earlier.length > 0 && (
          <details className="border-t border-zinc-100 pt-4 text-[13px] text-zinc-600">
            <summary className="cursor-pointer font-medium text-zinc-800">{t.earlier}</summary>
            <ul className="m-0 mt-2 list-none p-0">
              {earlier.map((row) => (
                <li key={row.id}>
                  {row.number ?? row.reference} · {stateLabel(row.state)} · {euros(row.totalCents)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Card>
  );
}
