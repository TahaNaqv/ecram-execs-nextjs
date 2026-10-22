"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { DateTimeCopy } from "@/components/date-time-field";
import type { Locale } from "@/lib/i18n/config";
import { createBooking } from "@/lib/corporate/portal-actions";
import type { PortalState } from "@/lib/corporate/portal-state";
import { BookingFlow, type DetailDefaults, type OfferedVehicle } from "./booking-flow";
import type { BookingCopy, TripMessages } from "./copy";
import type { Trip } from "./trip";
import type { FleetDictionary } from "./vehicle-details";

// One object for "no errors": the flow treats a new errors object as a new answer from the server
const NO_ERRORS = {};

/**
 * The portal's new-booking panel: the same flow as the website, with the signed-in partner as the booker. A successful
 * booking leaves through the action's redirect to the booking's own page; an expired session offers the sign-in instead
 * of the send button.
 */
export function PortalBooking({
  locale,
  copy,
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
  dateTimeCopy: DateTimeCopy;
  messages: TripMessages;
  fleetDict: FleetDictionary;
  vehicleAdvise: string;
  vehicles: OfferedVehicle[];
  booker: { name: string; email: string };
  defaultPhone?: { country: string; number: string };
  initialTrip: Trip;
  defaults?: DetailDefaults;
  notice?: string;
  loginHref: string;
  loginLabel: string;
}) {
  const [state, action, pending] = useActionState<PortalState, FormData>(createBooking, { status: "idle" });
  const locked = state.status === "locked";
  return (
    <BookingFlow
      variant="portal"
      locale={locale}
      copy={copy}
      dateTimeCopy={dateTimeCopy}
      messages={messages}
      fleetDict={fleetDict}
      vehicleAdvise={vehicleAdvise}
      vehicles={vehicles}
      initialTrip={initialTrip}
      initialStep="journey"
      result={{
        pending,
        message: state.status === "error" || locked ? state.message : null,
        fieldErrors: state.status === "error" ? state.fieldErrors : NO_ERRORS,
      }}
      submit={action}
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
  );
}
