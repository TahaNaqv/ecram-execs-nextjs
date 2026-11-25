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
import { dropPayTab, sendPayTab } from "./pay-tab";
import { tripFromParams } from "./trip";
import type { FleetDictionary } from "./vehicle-details";
import type { AddOnsCopy } from "./copy";

// One object for "no errors": the flow treats a new errors object as a new answer from the server
const NO_ERRORS = {};
/** The booking this page already opened. A later visit to the form must not open it again. */
const OPENED_KEY = "ee-public-booking-opened";

function checkoutUrlOk(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && (url.hostname === "mollie.com" || url.hostname.endsWith(".mollie.com"))) return true;
    return (url.protocol === "http:" || url.protocol === "https:") && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  } catch {
    return false;
  }
}

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
  /** Online payment is on: the booking is paid at booking */
  payOnline?: boolean;
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

function Run({ search, onAgain, locale, copy, addOns, dateTimeCopy, messages, fleetDict, vehicleAdvise, vehicles, privacyHref, homeHref, payOnline }: Props & { search: string; onAgain: () => void }) {
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
  const payingNow = state.status === "success" && state.payNow === true;
  const payUrl = state.status === "success" && checkoutUrlOk(state.payUrl) ? state.payUrl : undefined;
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
      // the confirmation still shows; only a return to this form can repeat it
    }
    markBookingSent();
    claimRideReceipt(sentReference);
    // This tab opens the confirmation. Mollie is only the other tab, and it does not replace this one.
    // The tab was opened at the click (pay-tab.ts); now it goes to Mollie, or closes when there is nothing to pay
    if (payingNow) {
      const sent = payUrl ? sendPayTab(payUrl) : false;
      if (!sent) dropPayTab();
      if (href) router.push(sent ? href : `${href}${href.includes("?") ? "&" : "?"}pay=blocked`);
    } else {
      dropPayTab();
      if (href) router.push(href);
    }
  }, [sentReference, href, payUrl, payingNow, router]);

  // Not sent (a field to fix, the server said no): the tab opened at the click is closed again
  const failed = state.status === "error";
  useEffect(() => {
    if (failed) dropPayTab();
  }, [failed, state]);
  // Nor left waiting when this page goes away or the send itself breaks (no answer, so no error state): after a send the
  // tab has already been handed to Mollie and there is nothing to close
  useEffect(() => {
    const drop = () => dropPayTab();
    window.addEventListener("pagehide", drop);
    return () => {
      window.removeEventListener("pagehide", drop);
      dropPayTab();
    };
  }, []);

  if (state.status === "success" && !again && payingNow) {
    return <div className="min-h-[60svh]" aria-busy="true" />;
  }

  if (state.status === "success" && !again && !payingNow) {
    // On its way to the booking's page when there is nothing to pay now
    if (href) return <div className="min-h-[60svh]" aria-busy="true" />;
    return <BookingDone copy={copy} locale={locale} name={state.name} reference={state.reference} map={state.map} price={state.price} onAgain={onAgain} />;
  }

  return (
    <BookingFlow
      variant="public"
      persistKey="book"
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
      payOnline={payOnline}
      payInNewTab
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
