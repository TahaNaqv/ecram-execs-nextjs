"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useActionState, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { DateTimeCopy } from "@/components/date-time-field";
import type { Locale } from "@/lib/i18n/config";
import { createBooking } from "@/lib/corporate/portal-actions";
import type { PortalState } from "@/lib/corporate/portal-state";
import { BookingFlow, clearBookingDraft, type DetailDefaults, type OfferedVehicle } from "./booking-flow";
import type { BookingCopy, TripMessages } from "./copy";
import { bookingsSent, markBookingSent, unmarkBookingSent, useResetAfterBooking } from "./sent";
import type { Trip } from "./trip";
import type { FleetDictionary } from "./vehicle-details";
import type { AddOnsCopy } from "./copy";

// One object for "no errors": the flow treats a new errors object as a new answer from the server
const NO_ERRORS = {};
/** The booking page this tab already opened. Coming back to New Booking must not open it again. */
const OPENED_KEY = "ee-portal-booking-opened";

const onNewBooking = () => /(?:new-booking|nieuwe-boeking)$/.test(window.location.pathname);

const openedBooking = () => {
  try {
    return sessionStorage.getItem(OPENED_KEY) ?? "";
  } catch {
    return "";
  }
};

/**
 * The portal's new-booking panel: the same flow as the website, with the signed-in partner as the booker. A successful
 * booking returns its page address and the browser opens it; an expired session offers the sign-in instead
 * of the send button.
 */
export function PortalBooking({
  locale,
  copy,
  addOns,
  dateTimeCopy,
  messages,
  fleetDict,
  vehicleAdvise,
  vehicles,
  booker,
  defaultPhone,
  initialTrip,
  defaults,
  notice,
  loginHref,
  loginLabel,
}: {
  locale: Locale;
  copy: BookingCopy;
  addOns: AddOnsCopy;
  dateTimeCopy: DateTimeCopy;
  messages: TripMessages;
  fleetDict: FleetDictionary;
  vehicleAdvise: string;
  vehicles: OfferedVehicle[];
  booker: { name: string; email: string; companyName?: string | null };
  defaultPhone?: { country: string; number: string };
  initialTrip: Trip;
  defaults?: DetailDefaults;
  notice?: string;
  loginHref: string;
  loginLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, action, pending] = useActionState<PortalState, FormData>(createBooking, { status: "idle" });
  const locked = state.status === "locked";
  // A sent booking opens its page once. The tab keeps that result, so a later visit must not follow it again.
  const [stale, setStale] = useState(false);
  const handled = useRef<string | null>(null);
  const cleared = useRef<string | null>(null);
  const [round, setRound] = useState(0);
  const openedAt = useRef<number | null>(null);
  useResetAfterBooking(() => setRound((r) => r + 1));
  // Next keeps this page mounted. Coming back to New Booking after a send starts an empty Journey, not the review that was just sent.
  useLayoutEffect(() => {
    if (!onNewBooking()) return;
    const now = bookingsSent();
    if (openedAt.current === null) {
      openedAt.current = now;
      return;
    }
    if (now > openedAt.current) {
      openedAt.current = now;
      clearBookingDraft();
      setStale(true);
      setRound((n) => n + 1);
    }
  }, [pathname]);
  useLayoutEffect(() => {
    if (state.status !== "sent") return;
    const href = state.href;
    clearBookingDraft();
    const here = onNewBooking();
    const already = handled.current === href || (here && openedBooking() === href);
    if (already) {
      handled.current = href;
      setStale(true);
      if (cleared.current !== href) {
        cleared.current = href;
        setRound((n) => n + 1);
      }
      return;
    }
    handled.current = href;
    setStale(false);
    try {
      sessionStorage.setItem(OPENED_KEY, href);
    } catch {
      // the redirect still happens; only a later return to this tab can repeat it
    }
    router.push(href);
  }, [state, router]);
  const sent = state.status === "sent" && !stale;
  const send = (data: FormData) => {
    markBookingSent();
    action(data);
  };
  useEffect(() => {
    if (state.status === "error" || state.status === "locked") unmarkBookingSent();
  }, [state]);

  return (
    <div className="relative w-full max-w-full overflow-visible">
      <BookingFlow
        key={round}
        variant="portal"
        locale={locale}
        copy={copy}
        addOns={addOns}
        dateTimeCopy={dateTimeCopy}
        messages={messages}
        fleetDict={fleetDict}
        vehicleAdvise={vehicleAdvise}
        vehicles={vehicles}
        initialTrip={initialTrip}
        initialStep="journey"
        result={{
          pending: pending || sent,
          message: state.status === "error" || locked ? state.message : null,
          fieldErrors: state.status === "error" ? state.fieldErrors : NO_ERRORS,
        }}
        submit={send}
        booker={booker}
        defaultPhone={defaultPhone}
        defaults={defaults}
        notice={notice}
        sealedHref={state.status === "sent" ? state.href : null}
        lockedNotice={
          locked ? (
            <Link href={loginHref} className="flex h-[52px] flex-1 items-center justify-center rounded-xl bg-ink-950 px-7 text-[14px] font-semibold text-white no-underline hover:bg-ink-800 sm:flex-none">
              {loginLabel}
            </Link>
          ) : undefined
        }
      />
    </div>
  );
}