"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DateTimeCopy } from "@/components/date-time-field";
import { normalizeVehicleKey } from "@/lib/fleet/vehicles";
import type { Locale } from "@/lib/i18n/config";
import { submitQuote, type QuoteFormState } from "@/lib/quotes/actions";
import { BookingDone, BookingFlow, claimRideReceipt, clearBookingDraft, startsAtCar, type BookingStep, type OfferedVehicle } from "./booking-flow";
import type { BookingCopy, TripMessages } from "./copy";
import { markBookingSent, useResetAfterBooking } from "./sent";
import { tripFromParams } from "./trip";
import type { FleetDictionary } from "./vehicle-details";
import type { AddOnsCopy } from "./copy";

// One object for "no errors": the flow treats a new errors object as a new answer from the server
const NO_ERRORS = {};
/** The booking this page already opened. A later visit to the form must not open it again. */
const OPENED_KEY = "ee-public-booking-opened";

type Props = {
  locale: Locale;
  copy: BookingCopy;
  addOns: AddOnsCopy;
  dateTimeCopy: DateTimeCopy;
  messages: TripMessages;
  fleetDict: FleetDictionary;
  vehicleAdvise: string;
  vehicles: OfferedVehicle[];
  bookPath: string;
  privacyHref: string;
  homeHref: string;
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

function Run({ search, onAgain, locale, copy, addOns, dateTimeCopy, messages, fleetDict, vehicleAdvise, vehicles, privacyHref, homeHref }: Props & { search: string; onAgain: () => void }) {
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

  // Counted once per sent booking, so the booking bar on the home page and the next visit to /book start empty. Then the
  // visitor goes to the booking's own page, where they follow the review by hand (the client, 8 Nov 2026)
  const href = state.status === "success" ? state.href : undefined;
  const sentReference = state.status === "success" ? state.reference : "";
  const followed = useRef<string | null>(null);
  const [again, setAgain] = useState(false);
  useLayoutEffect(() => {
    if (!sentReference) return;
    clearBookingDraft();
    if (followed.current === sentReference) return;
    let seen = "";
    try {
      seen = sessionStorage.getItem(OPENED_KEY) ?? "";
    } catch {
      seen = "";
    }
    if (seen === sentReference) {
      followed.current = sentReference;
      setAgain(true);
      return;
    }
    followed.current = sentReference;
    try {
      sessionStorage.setItem(OPENED_KEY, sentReference);
    } catch {
      // the booking page still opens; only a return to this form can repeat it
    }
    markBookingSent();
    claimRideReceipt(sentReference);
    if (href) router.push(href);
  }, [sentReference, href, router]);

  if (state.status === "success" && !again) {
    // On its way to the booking's page: nothing to show for the moment it takes
    if (href) return <div className="min-h-[60svh]" aria-busy="true" />;
    return <BookingDone copy={copy} locale={locale} name={state.name} reference={state.reference} map={state.map} price={state.price} onAgain={onAgain} />;
  }

  return (
    <BookingFlow
      variant="public"
      locale={locale}
      copy={copy}
      addOns={addOns}
      dateTimeCopy={dateTimeCopy}
      messages={messages}
      fleetDict={fleetDict}
      vehicleAdvise={vehicleAdvise}
      vehicles={vehicles.filter((v) => !unavailable.has(normalizeVehicleKey(v.key) ?? v.key))}
      initialTrip={trip}
      initialStep={initialStep}
      sealedHref={sentReference || null}
      result={{
        pending,
        message: state.status === "error" ? state.message : null,
        fieldErrors: state.status === "error" ? state.fieldErrors : NO_ERRORS,
      }}
      submit={action}
      privacyHref={privacyHref}
      cancelHref={homeHref}
    />
  );
}
