"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import type { DateTimeCopy } from "@/components/date-time-field";
import { normalizeVehicleKey } from "@/lib/fleet/vehicles";
import type { Locale } from "@/lib/i18n/config";
import { submitQuote, type QuoteFormState } from "@/lib/quotes/actions";
import { BookingDone, BookingFlow, startsAtCar, type BookingStep, type OfferedVehicle } from "./booking-flow";
import type { BookingCopy, TripMessages } from "./copy";
import { markBookingSent, useResetAfterBooking } from "./sent";
import { tripFromParams } from "./trip";
import type { FleetDictionary } from "./vehicle-details";

// One object for "no errors": the flow treats a new errors object as a new answer from the server
const NO_ERRORS = {};

type Props = {
  locale: Locale;
  copy: BookingCopy;
  dateTimeCopy: DateTimeCopy;
  messages: TripMessages;
  fleetDict: FleetDictionary;
  vehicleAdvise: string;
  vehicles: OfferedVehicle[];
  bookPath: string;
  privacyHref: string;
};

/**
 * /book for website visitors: the trip arrives in the URL from the hero's bar. Each new trip in the URL starts the flow
 * afresh (the page stays mounted between visits, so without the key an old step would come back).
 */
export function PublicBooking(props: Props) {
  const search = useSearchParams().toString();
  // "Plan another ride" starts again even when the URL stays the same (a visit to /book with no trip in it)
  const [round, setRound] = useState(0);
  // Coming back to /book after a booking was sent starts a new one, not the old confirmation (QA round 3, bug 3)
  useResetAfterBooking(() => setRound((r) => r + 1));
  return <Run key={`${search}#${round}`} search={search} onAgain={() => setRound((r) => r + 1)} {...props} />;
}

function Run({ search, onAgain, locale, copy, dateTimeCopy, messages, fleetDict, vehicleAdvise, vehicles, bookPath, privacyHref }: Props & { search: string; onAgain: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<QuoteFormState, FormData>(submitQuote, { status: "idle" });
  const trip = useMemo(() => tripFromParams(new URLSearchParams(search)), [search]);
  const [initialStep] = useState<BookingStep>(() => (startsAtCar(trip) ? "car" : "journey"));

  // Cars the team has switched off are not offered (asked here, not in the homepage hero, so the hero stays static)
  const [unavailable, setUnavailable] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/vehicles/unavailable", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { unavailable?: string[] } | null) => data?.unavailable && setUnavailable(new Set(data.unavailable)))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Counted once per sent booking, so the booking bar on the home page and the next visit to /book start empty
  useEffect(() => {
    if (state.status === "success") markBookingSent();
  }, [state.status]);

  if (state.status === "success") {
    return <BookingDone copy={copy} name={state.name} reference={state.reference} onAgain={() => {
          router.push(`/${locale}`); // Redirects back to the main home screen for the current locale
          onAgain();
        }}
      />;
  }

  return (
    <BookingFlow
      variant="public"
      locale={locale}
      copy={copy}
      dateTimeCopy={dateTimeCopy}
      messages={messages}
      fleetDict={fleetDict}
      vehicleAdvise={vehicleAdvise}
      vehicles={vehicles.filter((v) => !unavailable.has(normalizeVehicleKey(v.key) ?? v.key))}
      initialTrip={trip}
      initialStep={initialStep}
      result={{
        pending,
        message: state.status === "error" ? state.message : null,
        fieldErrors: state.status === "error" ? state.fieldErrors : NO_ERRORS,
      }}
      submit={action}
      privacyHref={privacyHref}
    />
  );
}
