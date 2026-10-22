"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import type { DateTimeCopy } from "@/components/date-time-field";
import { normalizeVehicleKey } from "@/lib/fleet/vehicles";
import type { Locale } from "@/lib/i18n/config";
import { submitQuote, type QuoteFormState } from "@/lib/quotes/actions";
import { BookingDone, BookingFlow, startsAtCar, type BookingStep, type OfferedVehicle } from "./booking-flow";
import type { BookingCopy, TripMessages } from "./copy";
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
  return <Run key={search} search={search} {...props} />;
}

function Run({ search, locale, copy, dateTimeCopy, messages, fleetDict, vehicleAdvise, vehicles, bookPath, privacyHref }: Props & { search: string }) {
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

  if (state.status === "success") {
    return <BookingDone copy={copy} name={state.name} reference={state.reference} onAgain={() => router.push(bookPath)} />;
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
