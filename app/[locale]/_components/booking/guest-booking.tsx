"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { RouteMapLinks } from "@/lib/fleet/map";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { sendGuestMessage, type GuestMessageState } from "@/lib/quotes/guest-actions";
import { BookingStatusBadge, DownloadableReceiptCard, parseRideReceipt, RouteMap, storedRideReceipt, type RideReceipt } from "./booking-flow";
import type { BookingCopy } from "./copy";

type Copy = Dictionary["guestBooking"];
type Message = { id: string; by: "guest" | "team"; body: string; at: string };

const noSubscription = () => () => {};

/** How often the open page asks whether the booking manager has decided, in milliseconds. */
const POLL_MS = 10_000;

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
}) {
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  // The receipt this tab kept when the booking was sent (none on the server, nor in another browser)
  const storedReceipt = useSyncExternalStore(noSubscription, () => storedRideReceipt(reference), () => null);
  const receipt = useMemo(() => parseRideReceipt(storedReceipt) ?? savedReceipt, [storedReceipt, savedReceipt]);

  // Asks for the status and the conversation's last change; the page is fetched again only when one of them moved
  useEffect(() => {
    if (!WAITING.has(status)) return;
    let stopped = false;
    const ask = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(`/api/booking/state?ref=${encodeURIComponent(reference)}&k=${encodeURIComponent(linkKey)}`, { cache: "no-store" });
        if (!res.ok || stopped) return;
        const now = (await res.json()) as { status: string; lastMessageAt: string | null };
        if (now.status !== status || now.lastMessageAt !== lastMessageAt) router.refresh();
      } catch {}
    };
    const timer = window.setInterval(ask, POLL_MS);
    const onShow = () => void ask();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [status, lastMessageAt, reference, linkKey, router]);

  // A new status moves the focus to the new heading, so a screen reader reads the decision out
  const seen = useRef(status);
  useEffect(() => {
    if (seen.current === status) return;
    seen.current = status;
    heading.current?.focus({ preventScroll: true });
  }, [status]);

  const view = {
    new: { eyebrow: t.reviewEyebrow, heading: interpolate(t.reviewHeading, { name }), note: t.reviewNote },
    quoted: { eyebrow: t.reviewEyebrow, heading: interpolate(t.reviewHeading, { name }), note: t.reviewNote },
    contacted: { eyebrow: t.discussEyebrow, heading: t.discussHeading, note: t.discussNote },
    confirmed: { eyebrow: t.approvedEyebrow, heading: t.approvedHeading, note: `${t.approvedNote} ${t.paymentFollows}` },
    completed: { eyebrow: t.completedEyebrow, heading: t.completedHeading, note: "" },
    cancelled: { eyebrow: t.cancelledEyebrow, heading: t.cancelledHeading, note: t.cancelledNote },
  }[status] ?? { eyebrow: t.reviewEyebrow, heading: interpolate(t.reviewHeading, { name }), note: t.reviewNote };
  const reviewing = status === "new" || status === "quoted";

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 py-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div role="status" aria-live="polite" className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <BookingStatusBadge label={view.eyebrow} />
            <span className="text-[12px] font-semibold tracking-[0.16em] text-ink-600 uppercase">{reference}</span>
          </div>
          <h2 ref={heading} tabIndex={-1} className="m-0 font-serif text-[clamp(30px,5vw,42px)] leading-[1.08] font-normal outline-none">
            {view.heading}
          </h2>
          {view.note && <p className="m-0 text-[15px] text-ink-700">{view.note}</p>}
        </div>
        <DownloadableReceiptCard copy={bookingCopy} locale={locale} reference={reference} status={view.eyebrow} name={name} receipt={receipt} price={price} />
      </div>

      {reviewing && (
        <div className="flex items-start gap-4 rounded-[16px] border border-solid border-ink-150 bg-white p-5 text-ink-950">
          <span aria-hidden="true" className="mt-0.5 size-6 shrink-0 animate-spin rounded-full border-[3px] border-solid border-ink-150 border-t-ink-950 motion-reduce:animate-none" />
          <div className="flex flex-col gap-1">
            <p className="m-0 text-[15px] font-semibold">{t.reviewChecking}</p>
            <p className="m-0 text-[14px] text-ink-700">{t.reviewKeepOpen}</p>
          </div>
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
              <dd className="m-0 wrap-break-word text-[15px]">{f.value}</dd>
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
