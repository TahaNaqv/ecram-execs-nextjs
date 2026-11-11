"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import type { DateTimeCopy } from "@/components/date-time-field";
import type { Locale } from "@/lib/i18n/config";
import { createBooking } from "@/lib/corporate/portal-actions";
import type { PortalState } from "@/lib/corporate/portal-state";
import { BookingFlow, type DetailDefaults, type OfferedVehicle } from "./booking-flow";
import type { BookingCopy, TripMessages } from "./copy";
import { markBookingSent, unmarkBookingSent, useResetAfterBooking } from "./sent";
import type { Trip } from "./trip";
import type { FleetDictionary } from "./vehicle-details";
import type { AddOnsCopy } from "./copy";

// One object for "no errors": the flow treats a new errors object as a new answer from the server
const NO_ERRORS = {};

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
  const [state, action, pending] = useActionState<PortalState, FormData>(createBooking, { status: "idle" });
  const locked = state.status === "locked";
  const sent = state.status === "sent";
  useEffect(() => {
    if (state.status === "sent") router.push(state.href);
  }, [state, router]);
  const [round, setRound] = useState(0);
  useResetAfterBooking(() => setRound((r) => r + 1));
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