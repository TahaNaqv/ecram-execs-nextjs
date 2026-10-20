"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { createBooking } from "@/lib/corporate/portal-actions";
import type { PortalState } from "@/lib/corporate/portal-state";
import { DateTimeField, type DateTimeCopy } from "@/components/date-time-field";
import { SERVICES, type Service } from "@/lib/quotes/constants";
import { MAX_STOPS, STOP_WAITS } from "@/lib/quotes/stops";
import type { Locale } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/interpolate";
import { ghostClass } from "./corporate-styles";
import { Status } from "./corporate-ui";
import { ActionCard, cardSubmit, CardField, CardGrid, CardSelect, ChoiceGroup, cardControl, CountedTextarea, FormCard, LockedInput, PhoneField, SendIcon } from "./form-cards";

export type BookingFormCopy = Record<
  | "labelCollection" | "phCollection" | "labelDestination" | "phDestination" | "labelDateTime" | "labelService" | "labelPassengers"
  | "selectPlaceholder" | "eightOrMore" | "labelVehicle" | "vehicleAdvise" | "labelNotes" | "phNotes" | "labelPhoneCountry" | "labelPhone" | "phPhone"
  | "labelBookerName" | "labelBookerEmail" | "labelStopWait" | "waitNone" | "waitMinutes" | "addStopCta" | "phStop" | "submitBooking" | "submittingBooking" | "removeStop" | "loginLink"
  | "cardBooker" | "cardBookerHint" | "cardService" | "cardServiceHint" | "cardJourney" | "cardJourneyHint" | "cardVehicle" | "cardVehicleHint"
  | "cardNotes" | "cardNotesHint" | "submitHint" | "lockedHint" | "charCount",
  string
> & { stopLabel: string };

export type BookingDefaults = {
  collection?: string;
  destination?: string;
  stops?: { place: string; wait: number }[];
  service?: string;
  passengers?: string;
  vehicle?: string;
  notes?: string;
  phoneCountry?: string;
  phone?: string;
};

const SERVICE_CHOICES = SERVICES.filter((s): s is Exclude<Service, "bespoke"> => s !== "bespoke");

/**
 * A booking request from inside the portal. The booker is the signed-in partner (shown, not typed, and taken from the
 * database again on the server); everything else is the usual trip. `defaults` carries a repeated booking's details.
 */
export function BookingForm({
  locale,
  booker,
  defaults,
  vehicles,
  serviceLabels,
  loginHref,
  copy: t,
  dateTimeCopy,
}: {
  locale: Locale;
  booker: { name: string; email: string };
  defaults: BookingDefaults;
  vehicles: { key: string; name: string }[];
  serviceLabels: Record<Service, string>;
  loginHref: string;
  copy: BookingFormCopy;
  dateTimeCopy: DateTimeCopy;
}) {
  const [stops, setStops] = useState<{ id: number; value: string; wait: number }[]>((defaults.stops ?? []).map((s, id) => ({ id, value: s.place, wait: s.wait })));
  const [nextId, setNextId] = useState(stops.length);
  const [state, action, pending] = useActionState<PortalState, FormData>(createBooking, { status: "idle" });
  // The values of a repeated booking. After an error the fields simply keep what was typed: the form is submitted
  // from here rather than through `<form action>`, because React empties a form once its action has finished, and
  // that cleared the pills and the drop-downs (the text fields came back only because they were refilled).
  const v = defaults as Record<string, string | undefined>;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  };
  const err = state.status === "error" ? state.fieldErrors : {};
  const d = (name: string) => (err[name as keyof typeof err] ? `b-${name}-error` : undefined);

  const stopCard = "flex flex-wrap items-center gap-2 rounded-md border border-solid border-ink-225 bg-ink-50 p-2";
  const vehicleOptions = [
    ...vehicles.map(({ key, name }) => ({ value: key, label: name })),
    { value: "advise", label: t.vehicleAdvise, wide: true },
  ];

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <CardGrid>
        <FormCard as="h2" icon="building" step={1} title={t.cardBooker} hint={t.cardBookerHint}>
          <CardField idPrefix="b" name="bookerName" label={t.labelBookerName}>
            <LockedInput id="b-bookerName" value={booker.name} hint={t.lockedHint} />
          </CardField>
          <CardField idPrefix="b" name="bookerEmail" label={t.labelBookerEmail}>
            <LockedInput id="b-bookerEmail" type="email" value={booker.email} hint={t.lockedHint} />
          </CardField>
          <PhoneField idPrefix="b" label={t.labelPhone} countryLabel={t.labelPhoneCountry} placeholder={t.phPhone}
            defaultCountry={v.phoneCountry} defaultNumber={v.phone} error={err.phone ?? err.phoneCountry} />
        </FormCard>

        <FormCard as="h2" icon="briefcase" step={2} title={t.cardService} hint={t.cardServiceHint}>
          <ChoiceGroup idPrefix="b" name="service" legend={t.labelService} defaultValue={v.service || SERVICE_CHOICES[0]} error={err.service} required
            options={SERVICE_CHOICES.map((s) => ({ value: s, label: serviceLabels[s] }))} />
          <CardField idPrefix="b" name="passengers" label={t.labelPassengers} error={err.passengers}>
            <CardSelect id="b-passengers" name="passengers" defaultValue={v.passengers || ""} aria-invalid={!!err.passengers} aria-describedby={d("passengers")}>
              <option value="">{t.selectPlaceholder}</option>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value="8">{t.eightOrMore}</option>
            </CardSelect>
          </CardField>
        </FormCard>

        <FormCard as="h2" icon="pin" step={3} title={t.cardJourney} hint={interpolate(t.cardJourneyHint, { max: MAX_STOPS })} wide>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <CardField idPrefix="b" name="collection" label={t.labelCollection} error={err.collection}>
              <input id="b-collection" name="collection" type="text" required maxLength={200} placeholder={t.phCollection} defaultValue={v.collection}
                aria-invalid={!!err.collection} aria-describedby={d("collection")} autoComplete="off" className={cardControl} />
            </CardField>
            <CardField idPrefix="b" name="destination" label={t.labelDestination} error={err.destination}>
              <input id="b-destination" name="destination" type="text" required maxLength={200} placeholder={t.phDestination} defaultValue={v.destination}
                aria-invalid={!!err.destination} aria-describedby={d("destination")} autoComplete="off" className={cardControl} />
            </CardField>
          </div>

          {/* Stops between the two: each its own input, sent as `destinations`, with the wait beside it as `destinationWaits` */}
          {stops.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {stops.map((stop, i) => (
                <li key={stop.id} className={stopCard}>
                  <label htmlFor={`b-stop-${stop.id}`} className="w-full shrink-0 px-1 text-[11px] font-semibold tracking-[0.18em] text-ink-600 uppercase sm:w-auto">
                    {interpolate(t.stopLabel, { number: i + 1 })}
                  </label>
                  <input id={`b-stop-${stop.id}`} name="destinations" type="text" maxLength={200} placeholder={t.phStop} value={stop.value}
                    onChange={(e) => setStops((all) => all.map((x) => (x.id === stop.id ? { ...x, value: e.target.value } : x)))} autoComplete="off"
                    className={`${cardControl} min-w-[180px] flex-1 bg-white`} />
                  <div className="w-[150px] shrink-0">
                    <CardSelect
                      name="destinationWaits"
                      aria-label={t.labelStopWait}
                      value={stop.wait}
                      onChange={(e) => setStops((all) => all.map((x) => (x.id === stop.id ? { ...x, wait: Number(e.target.value) } : x)))}
                      className="bg-white"
                    >
                      {STOP_WAITS.map((minutes) => (
                        <option key={minutes} value={minutes}>
                          {minutes === 0 ? t.waitNone : t.waitMinutes.replace("{minutes}", String(minutes))}
                        </option>
                      ))}
                    </CardSelect>
                  </div>
                  <button type="button" onClick={() => setStops((s) => s.filter((x) => x.id !== stop.id))} aria-label={t.removeStop}
                    className="grid size-[42px] shrink-0 cursor-pointer place-items-center rounded-md font-sans border border-solid border-ink-225 bg-white text-[20px] leading-none text-ink-700 hover:border-ink-950 hover:text-ink-950">
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          {stops.length < MAX_STOPS && (
            <button
              type="button"
              onClick={() => {
                setStops((s) => [...s, { id: nextId, value: "", wait: 0 }]);
                setNextId((n) => n + 1);
              }}
              className="min-h-[44px] w-full cursor-pointer rounded-md border border-dashed font-sans border-ink-350 bg-transparent px-4 text-[13px] font-semibold text-ink-700 hover:border-ink-950 hover:text-ink-950 sm:w-auto sm:self-start"
            >
              + {t.addStopCta}
            </button>
          )}

          <CardField idPrefix="b" name="pickupAt" label={t.labelDateTime} error={err.pickupAt} className="md:max-w-[calc(50%-10px)]">
            <DateTimeField id="b-pickupAt" name="pickupAt" locale={locale} copy={dateTimeCopy} defaultValue={v.pickupAt} invalid={!!err.pickupAt} describedBy={d("pickupAt")} className={cardControl} />
          </CardField>
        </FormCard>

        <FormCard as="h2" icon="car" step={4} title={t.cardVehicle} hint={t.cardVehicleHint}>
          <ChoiceGroup idPrefix="b" name="vehicle" legend={t.labelVehicle} defaultValue={v.vehicle || ""} error={err.vehicle} options={vehicleOptions} />
        </FormCard>

        <FormCard as="h2" icon="doc" step={5} title={t.cardNotes} hint={t.cardNotesHint}>
          <CardField idPrefix="b" name="notes" label={t.labelNotes} error={err.notes}>
            <CountedTextarea id="b-notes" name="notes" rows={6} max={2000} counter={t.charCount} placeholder={t.phNotes} defaultValue={v.notes}
              invalid={!!err.notes} describedBy={d("notes")} />
          </CardField>
        </FormCard>

        <input type="hidden" name="locale" value={locale} />
        <ActionCard>
          <button type="submit" disabled={pending} className={cardSubmit}>
            <SendIcon />
            {pending ? t.submittingBooking : t.submitBooking}
          </button>
          <p className="m-0 max-w-[520px] text-[13px] text-ink-600">{t.submitHint}</p>
          <Status error={state.status === "error" || state.status === "locked"}>{state.status === "error" || state.status === "locked" ? state.message : undefined}</Status>
          {state.status === "locked" && (
            <Link href={loginHref} className={ghostClass}>
              {t.loginLink}
            </Link>
          )}
        </ActionCard>
      </CardGrid>
    </form>
  );
}
