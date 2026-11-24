"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { RouteMapLinks } from "@/lib/fleet/map";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { refreshOnce } from "@/lib/nav/refresh-once";
import { sendGuestMessage, type GuestMessageState } from "@/lib/quotes/guest-actions";
import { BookingStatusBadge, DownloadableReceiptCard, parseRideReceipt, RouteMap, storedRideReceipt, type RideReceipt } from "./booking-flow";
import type { BookingCopy } from "./copy";
import { PayButton } from "../pay-button";
import type { PaymentView } from "@/lib/mollie/pay";

type Copy = Dictionary["guestBooking"];
type Message = { id: string; by: "guest" | "team"; body: string; at: string };

const noSubscription = () => () => {};

function checkoutHref(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && (url.hostname === "mollie.com" || url.hostname.endsWith(".mollie.com"))) return url.toString();
    if ((url.protocol === "http:" || url.protocol === "https:") && (url.hostname === "127.0.0.1" || url.hostname === "localhost")) return url.toString();
    return null;
  } catch {
    return null;
  }
}

function paymentBadge(status: string | null, state: PaymentView["state"] | undefined, copy: BookingCopy): string {
  if (status === "paid" || state === "paid") return copy.payLivePaid;
  if (status === "pending" || status === "authorized" || state === "progress") return copy.payLivePending;
  if (status === "failed" || status === "canceled" || status === "expired" || state === "failed") return copy.payLiveFailed;
  return copy.payLiveUnpaid;
}

/** How often the open page asks whether the booking manager has decided, in milliseconds. */
const POLL_MS = 3_000;

/** Statuses the page keeps asking about: the review, and the conversation (the team may reply, or approve). */
const WAITING = new Set(["new", "contacted", "quoted"]);

/**
 * The visitor's booking after it is sent. Every booking is reviewed by hand (the client, 8 Nov 2026): while it is, the
 * page says so and asks every few seconds whether anything changed, then shows the decision (approved, a conversation, or
 * not possible) without a reload. The receipt kept in this tab is offered for its own booking only.
 */
export function GuestBookingView({
  reference,
  linkKey,
  locale,
  status,
  name,
  facts,
  map,
  price,
  messages,
  lastMessageAt,
  open,
  copy: t,
  bookingCopy,
  savedReceipt,
  invoice,
  awaitingInvoice,
  payment,
  checkoutUrl = null,
  paymentStatus = null,
  payBlocked = false,
}: {
  reference: string;
  linkKey: string;
  locale: Locale;
  status: string;
  name: string;
  facts: { label: string; value: string }[];
  map: RouteMapLinks | null;
  price: { total: number; exact: boolean } | null;
  messages: Message[];
  lastMessageAt: string | null;
  open: boolean;
  copy: Copy;
  bookingCopy: BookingCopy;
  /** Itinerary from the stored booking, used when this tab has no receipt of its own (chat bookings, email links). */
  savedReceipt: RideReceipt | null;
  /** The booking's Moneybird invoice once it has been sent: its number, and its page (to pay it, while it is open). */
  invoice: { number: string; href: string | null; pay: boolean; emailed: boolean } | null;
  /** Approved, and Moneybird is making the invoice: the page keeps asking until it is there. */
  awaitingInvoice: boolean;
  /**
   * Paying online (Mollie), once approved; null when online payment is off. `due` is what is still to pay (formatted in
   * `dueLabel`); `state` is the latest payment's: in progress, paid (on `paidOn`), or ended without paying.
   */
  payment: PaymentView | null;
  /** Mollie's page for the payment still open, or nothing when there is no page to open. */
  checkoutUrl?: string | null;
  /** Latest Mollie status, so a change to paid refreshes this screen once. */
  paymentStatus?: string | null;
  /** The payment tab was blocked, so Pay now on this screen is the way through. */
  payBlocked?: boolean;
}) {
  const router = useRouter();
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const displayStatus = liveStatus ?? status;
  const heading = useRef<HTMLHeadingElement>(null);
  const [checking, setChecking] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const safeCheckout = checkoutHref(checkoutUrl);
  // The receipt this tab kept when the booking was sent (none on the server, nor in another browser)
  const storedReceipt = useSyncExternalStore(noSubscription, () => storedRideReceipt(reference), () => null);
  const receipt = useMemo(() => parseRideReceipt(storedReceipt) ?? savedReceipt, [storedReceipt, savedReceipt]);

  // Asks for the status and the conversation's last change; the page is fetched again only when one of them moved.
  // An open Mollie payment stays "none" until it is paid, so the confirmation tab keeps asking until that changes.
  useEffect(() => {
    const followPayment = payment != null && payment.state !== "paid" && paymentStatus !== "paid";
    if (!WAITING.has(displayStatus) && !awaitingInvoice && !followPayment) return;
    let stopped = false;
    // Waiting for the invoice or a payment is short: stop asking after a while (the page shows the answer on a reload)
    const until = WAITING.has(displayStatus) ? Infinity : Date.now() + (followPayment ? 15 : 5) * 60_000;
    const ask = async () => {
      if (Date.now() > until) return;
      try {
        const sync = followPayment && payment?.state === "progress" ? "&sync=1" : "";
        const res = await fetch(`/api/booking/state?ref=${encodeURIComponent(reference)}&k=${encodeURIComponent(linkKey)}${sync}`, { cache: "no-store" });
        if (!res.ok || stopped) return;
        const now = (await res.json()) as { status: string; lastMessageAt: string | null; invoice: string | null; payment: string | null };
        const moved = now.status !== displayStatus || now.lastMessageAt !== lastMessageAt || (now.invoice ?? null) !== (invoice?.number ?? null);
        const paymentMoved = (now.payment ?? null) !== (paymentStatus ?? null);
        if (now.status !== displayStatus) setLiveStatus(now.status);
        if (moved || paymentMoved) refreshOnce(router, now.status !== displayStatus);
      } catch {}
    };
    void ask();
    const timer = window.setInterval(ask, POLL_MS);
    const onShow = () => {
      if (document.visibilityState === "hidden") return;
      void ask();
    };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, [displayStatus, lastMessageAt, reference, linkKey, router, awaitingInvoice, invoice?.number, payment, paymentStatus]);

  // The Mollie tab reports the outcome here. This tab then asks for the booking again.
  useEffect(() => {
    const apply = (payload: { ref?: string } | null) => {
      if (payload?.ref === reference) refreshOnce(router);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "ee-payment" || !event.newValue) return;
      try {
        apply(JSON.parse(event.newValue) as { ref?: string });
      } catch {
        /* ignore a value this page did not write */
      }
    };
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("ee-payment");
      channel.onmessage = (event) => apply(event.data as { ref?: string });
    } catch {
      channel = null;
    }
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      channel?.close();
    };
  }, [reference, router]);

  // A new status moves the focus to the new heading, so a screen reader reads the decision out
  const seen = useRef(displayStatus);
  useEffect(() => {
    if (seen.current === displayStatus) return;
    seen.current = displayStatus;
    heading.current?.focus({ preventScroll: true });
  }, [displayStatus]);

  const view = {
    new: { eyebrow: t.reviewEyebrow, heading: interpolate(t.reviewHeading, { name }), note: t.reviewNote },
    quoted: { eyebrow: t.reviewEyebrow, heading: interpolate(t.reviewHeading, { name }), note: t.reviewNote },
    contacted: { eyebrow: t.discussEyebrow, heading: t.discussHeading, note: t.discussNote },
    confirmed: {
      eyebrow: t.approvedEyebrow,
      heading: t.approvedHeading,
      note: `${t.approvedNote} ${invoice ? interpolate(invoice.emailed ? t.invoiceSent : t.invoiceReady, { number: invoice.number }) : payment ? "" : t.paymentFollows}`.trim(),
    },
    completed: { eyebrow: t.completedEyebrow, heading: t.completedHeading, note: "" },
    cancelled: { eyebrow: t.cancelledEyebrow, heading: t.cancelledHeading, note: t.cancelledNote },
  }[displayStatus] ?? { eyebrow: t.reviewEyebrow, heading: interpolate(t.reviewHeading, { name }), note: t.reviewNote };
  const reviewing = displayStatus === "new" || displayStatus === "quoted";
  const confirmedLook = displayStatus === "confirmed" || displayStatus === "completed";
  const settled = payment?.state === "paid" || paymentStatus === "paid";

  const paying = Boolean(
    payment && displayStatus !== "cancelled" && (settled || (!payment.awaitingConfirmation && (displayStatus === "confirmed" || displayStatus === "completed" || payment.first || payment.rest))),
  );

  return (
    <div className="flex w-full flex-col gap-8">
      <div role="status" aria-live="polite" className="flex flex-col gap-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 max-w-[640px] flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <BookingStatusBadge label={view.eyebrow} tone={confirmedLook ? "confirmed" : "neutral"} />
              {payment && reference && (settled || !payment.awaitingConfirmation) ? <BookingStatusBadge label={paymentBadge(paymentStatus, payment.state, bookingCopy)} /> : null}
              {reference ? <span className="text-[12px] font-semibold tracking-[0.16em] text-ink-600 uppercase">{reference}</span> : null}
            </div>
            <h2 ref={heading} tabIndex={-1} className="m-0 font-serif text-[clamp(32px,4.2vw,46px)] leading-[1.08] font-normal outline-none">
              {view.heading}
            </h2>
            {!paying && view.note ? <p className="m-0 text-[15px] text-ink-700">{view.note}</p> : null}
            {payment?.awaitingConfirmation && !settled && !confirmedLook ? <p className="m-0 text-[15px] text-ink-700">{bookingCopy.payAwaitConfirm}</p> : null}
          </div>
          <DownloadableReceiptCard copy={bookingCopy} locale={locale} reference={reference} status={view.eyebrow} name={name} receipt={receipt} price={price} />
        </div>
        {paying && payment && (
          <div className="flex flex-col items-start gap-3">
            {payment.state === "paid" && payment.due === 0 && (
              <p className="m-0 text-[15px] font-semibold text-ink-950">
                {payment.rest
                  ? interpolate(t.payRestOn, { amount: payment.rest.label, date: payment.rest.on })
                  : payment.paidOn
                    ? interpolate(t.paidOn, { date: payment.paidOn })
                    : t.paidThanks}
              </p>
            )}
            {payment.state === "progress" && <p className="m-0 text-[15px] text-ink-700">{t.payInProgress}</p>}
            {payment.state === "failed" && payment.due > 0 && <p className="m-0 text-[15px] text-ink-700">{t.payNotCompleted}</p>}
            {payment.due > 0 && payment.state !== "progress" && (
              <div className="flex flex-row flex-wrap items-center gap-3">
                {payBlocked && safeCheckout ? <p className="m-0 w-full text-[13px] text-ink-700">{bookingCopy.payLiveBlocked}</p> : null}
                {payError ? <p role="alert" className="m-0 w-full text-[13px] text-error">{payError}</p> : null}
                {safeCheckout ? (
                  <a href={safeCheckout} target="_blank" rel="noopener noreferrer" className="inline-flex cursor-pointer rounded-full bg-ink-950 px-6 py-3 text-[12px] font-semibold tracking-[0.2em] text-white uppercase no-underline hover:bg-ink-800">
                    {bookingCopy.payLiveNow}
                  </a>
                ) : (
                  <PayButton
                    who="guest"
                    reference={reference}
                    linkKey={linkKey}
                    locale={locale}
                    label={interpolate(payment.first ? t.paySecure : t.payNow, { amount: payment.dueLabel })}
                    pendingLabel={t.payOpening}
                    consentGranted={payment.first && !payment.agreed}
                    className="cursor-pointer rounded-full border-none bg-ink-950 px-6 py-3 text-[12px] font-semibold tracking-[0.2em] text-white uppercase hover:bg-ink-800 disabled:cursor-progress disabled:opacity-70"
                  />
                )}
                <button
                  type="button"
                  disabled={checking || !reference || !linkKey}
                  onClick={() => {
                    if (!reference || !linkKey) return;
                    setChecking(true);
                    setPayError(null);
                    const params = new URLSearchParams({ ref: reference, k: linkKey, sync: "1" });
                    fetch(`/api/booking/state?${params}`, { cache: "no-store" })
                      .then((response) => (response.ok ? response.json() : null))
                      .then((now: { payment?: string | null } | null) => {
                        if (!now) {
                          setPayError(bookingCopy.payLiveRetry);
                          return;
                        }
                        if ((now.payment ?? null) !== (paymentStatus ?? null)) refreshOnce(router);
                      })
                      .catch(() => setPayError(bookingCopy.payLiveRetry))
                      .finally(() => setChecking(false));
                  }}
                  className="inline-flex cursor-pointer rounded-full border border-solid border-ink-225 bg-white px-5 py-3 text-[12px] font-semibold tracking-[0.16em] text-ink-950 uppercase hover:border-ink-950 disabled:cursor-progress disabled:opacity-70"
                >
                  {checking ? bookingCopy.payLiveChecking : bookingCopy.payLiveCheck}
                </button>
              </div>
            )}
          </div>
        )}
        {invoice?.href && (displayStatus === "confirmed" || displayStatus === "completed") && (
          <a
            href={invoice.href}
            target="_blank"
            rel="noreferrer"
            className={
              payment
                ? "self-start text-[12px] font-semibold tracking-[0.2em] text-ink-950 uppercase underline underline-offset-4"
                : "self-start rounded-full bg-ink-950 px-6 py-3 text-[12px] font-semibold tracking-[0.2em] text-white uppercase no-underline hover:bg-ink-800"
            }
          >
            {invoice.pay && !payment ? t.invoicePay : t.invoiceView}
          </a>
        )}
      </div>

      {reviewing && (
        <div className="flex items-center gap-3 rounded-[16px] border border-solid border-ink-150 bg-white px-4 py-3.5 text-ink-950">
          <span aria-hidden="true" className="size-5 shrink-0 animate-spin rounded-full border-[3px] border-solid border-ink-150 border-t-ink-950 motion-reduce:animate-none" />
          <p className="m-0 text-[15px] font-semibold">{t.reviewChecking}</p>
        </div>
      )}

      {(status === "contacted" || messages.length > 0) && (
        <section aria-labelledby="guest-messages" className="flex flex-col gap-4 rounded-[16px] border border-solid border-ink-150 bg-white p-5 text-ink-950">
          <h3 id="guest-messages" className="m-0 text-[11px] font-semibold tracking-[0.24em] uppercase">
            {t.conversationTitle}
          </h3>
          {messages.length > 0 && (
            <ol className="m-0 flex max-h-60 list-none flex-col gap-3 overflow-y-auto overscroll-contain p-0 pr-1">
              {messages.map((m) => (
                <li key={m.id} className={`flex max-w-[600px] flex-col gap-1 rounded-[12px] p-4 ${m.by === "guest" ? "self-end border border-solid border-ink-150 bg-white" : "bg-ink-50"}`}>
                  <span className="text-[11px] tracking-[0.16em] text-ink-600 uppercase">
                    <strong className="text-ink-950">{m.by === "guest" ? t.you : t.team}</strong> · {m.at}
                  </span>
                  {/* Plain text: whatever was written, with its line breaks, never as markup */}
                  <p className="m-0 text-left whitespace-pre-wrap wrap-break-word break-words text-[15px]">{m.body}</p>
                </li>
              ))}
            </ol>
          )}
          {open ? <GuestReply reference={reference} linkKey={linkKey} locale={locale} copy={t} /> : <p className="m-0 text-[14px] text-ink-700">{t.messagesClosed}</p>}
        </section>
      )}

      <section aria-labelledby="guest-summary" className="flex flex-col gap-4 rounded-[16px] border border-solid border-ink-150 bg-white p-5 text-ink-950">
        <h3 id="guest-summary" className="m-0 text-[11px] font-semibold tracking-[0.24em] uppercase">
          {t.summaryTitle}
        </h3>
        <dl className="m-0 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.label} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-[10px] tracking-[0.22em] text-ink-600 uppercase">{f.label}</dt>
              <dd className="m-0 wrap-break-word whitespace-pre-line text-[15px]">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {map && <RouteMap map={map} copy={bookingCopy} />}
    </div>
  );
}

function GuestReply({ reference, linkKey, locale, copy: t }: { reference: string; linkKey: string; locale: Locale; copy: Copy }) {
  // A new key after each sent message empties the box
  const [sent, setSent] = useState(0);
  const [state, action, pending] = useActionState<GuestMessageState, FormData>(async (prev, formData) => {
    const next = await sendGuestMessage(prev, formData);
    if (next.status === "ok") setSent((n) => n + 1);
    return next;
  }, { status: "idle" });
  return (
    <form key={sent} action={action} noValidate className="flex flex-col gap-3">
      <label className="flex flex-col gap-2 text-[11px] tracking-[0.2em] text-ink-600 uppercase">
        {t.replyLabel}
        <textarea
          name="body"
          rows={3}
          maxLength={2000}
          placeholder={t.replyPlaceholder}
          aria-invalid={state.status === "error" || undefined}
          className="w-full box-border resize-y rounded-[10px] border border-solid border-ink-225 bg-white p-3 text-[15px] tracking-normal text-ink-950 normal-case"
        />
      </label>
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="k" value={linkKey} />
      <input type="hidden" name="locale" value={locale} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} aria-busy={pending} className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border-0 bg-ink-950 px-5 text-[13px] font-semibold tracking-wide text-white hover:bg-ink-800 disabled:opacity-60">
          {pending && <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-white/35 border-t-white motion-reduce:animate-none" />}
          {pending ? t.sending : t.send}
        </button>
        {state.status === "error" && (
          <span aria-live="polite" className="text-[13px] text-error">
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
