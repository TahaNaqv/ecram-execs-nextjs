"use client";

import { interpolate } from "@/lib/i18n/interpolate";
import { useRouter } from "next/navigation";
import { useState, useActionState, useEffect, useLayoutEffect, useRef } from "react";
import { DateTimeField, type DateTimeCopy } from "@/components/date-time-field";
import { COUNTRY_CODES } from "@/lib/quotes/constants";
import { cleanPhoneInput, PASTE_MAX } from "@/lib/phone";
import { AlertIcon, PlusIcon, XIcon } from "../../../_components/icons";
import { btn, field, fieldLabel } from "../../../_components/ui";
import { AddressField } from "@/app/[locale]/_components/booking/address-field";
import type { BookingCopy } from "@/app/[locale]/_components/booking/copy";
import { GuestsPicker } from "@/app/[locale]/_components/booking/guests-picker";
import { capacityProblem, MAX_GROUP, MAX_GROUP_BAGS, samePlace } from "@/app/[locale]/_components/booking/trip";
import { STOP_WAITS } from "@/lib/quotes/stops";
import { createBookingForPartner, type NewBookingState } from "./actions";

type RoutePoint = { place: string; wait: number };

const emptyPoint = (): RoutePoint => ({ place: "", wait: 0 });

type Option = { value: string; label: string };
type Copy = Record<
  | "partner" | "noPartner" | "service" | "collection" | "destination" | "stops" | "pickup" | "passengers" | "vehicle" | "vehicleNone" | "name" | "email"
  | "phone" | "phoneCountry" | "contactHint" | "language" | "notifyClient" | "notifyClientHint" | "status" | "quote" | "notes" | "internalNotes" | "submit" | "creating" | "addStop" | "removeStop" | "stopN" | "unavailable"
  | "phEntity" | "phKvk" | "phService" | "phCollection" | "phName" | "phEmail" | "phPhone" | "phQuote" | "phNotes" | "phInternal" | "phStatus" | "phLanguage",
  string
>;

type Values = Record<string, string | string[] | undefined>;

function Select({ values, name, label, options, empty, className = "" }: { values: Values; name: string; label: string; options: Option[]; empty?: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={`nb-${name}`} className={fieldLabel}>
        {label}
      </label>
      <select id={`nb-${name}`} name={name} defaultValue="" className={`${field} h-10 cursor-pointer w-full`}>
        {empty !== undefined && <option value="">{empty}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Text({ values, name, label, type = "text", inputMode, hint, min, max, placeholder, className = "" }: { values: Values; name: string; label: string; type?: string; inputMode?: "email" | "tel" | "text" | "numeric"; hint?: string; min?: number; max?: number; placeholder?: string; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={`nb-${name}`} className={fieldLabel}>
        {label}
      </label>
      <input id={`nb-${name}`} name={name} type={type} inputMode={inputMode} min={min} max={max} placeholder={placeholder} spellCheck={inputMode === "email" || inputMode === "tel" ? false : undefined} defaultValue="" autoComplete="off" className={`${field} h-10 w-full`} />
      {hint && <p className="m-0 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

/** A booking this form already opened. Coming back to New booking must not open it again. */
const OPENED_KEY = "ee-admin-booking-opened";

/** The team's own booking form: for the phone and email bookings that should still show up in a partner's portal. */
const emptyGuests = { pax: 1, bags: 0, small: 0, set: false };

export function NewBookingForm({ partners, services, statuses, vehicles, copy, locale, dateTimeCopy, guests: guestCopy }: { partners: Option[]; services: Option[]; statuses: Option[]; vehicles: Option[]; copy: Copy; locale: string; dateTimeCopy: DateTimeCopy; guests: BookingCopy }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<NewBookingState, FormData>(createBookingForPartner, {});
  const opened = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useLayoutEffect(() => {
    const id = state.createdId;
    if (!id || opened.current === id) return;
    let seen = "";
    try {
      seen = sessionStorage.getItem(OPENED_KEY) ?? "";
    } catch {
      seen = "";
    }
    if (seen === id) {
      opened.current = id;
      return;
    }
    opened.current = id;
    try {
      sessionStorage.setItem(OPENED_KEY, id);
    } catch {
      // still open the booking; a later visit can only repeat it if this write failed
    }
    router.push(`/admin/requests/${id}`);
  }, [state.createdId, router]);
  const [phoneCountry, setPhoneCountry] = useState("31");
  const [destinations, setDestinations] = useState<RoutePoint[]>([emptyPoint()]);
  const [collection, setCollection] = useState("");
  const [party, setParty] = useState(emptyGuests);
  const [clientError, setClientError] = useState<string | null>(null);
  const placesMatch = samePlace(collection, destinations[0]?.place ?? "");

  // Clear form fields whenever the component mounts / user navigates back to this tab
  useEffect(() => {
    if (formRef.current) {
      formRef.current.reset();
      setDestinations([emptyPoint()]);
      setCollection("");
      setParty(emptyGuests);
      setClientError(null);
      setPhoneCountry("31");
    }
  }, []);

  const addDestination = () => {
    if (destinations.length < 5) {
      setDestinations((prev) => [...prev, emptyPoint()]);
    }
  };
  const removeDestination = (index: number) => setDestinations((prev) => prev.filter((_, i) => i !== index));
  const updateDestination = (index: number, patch: Partial<RoutePoint>) => {
    setDestinations((prev) => prev.map((point, i) => (i === index ? { ...point, ...patch } : point)));
  };

  return (
    <form
      ref={formRef}
      action={action}
      className="grid gap-5 md:grid-cols-2"
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        const from = String(data.get("collection") ?? "");
        const to = String(data.getAll("destinations")[0] ?? "");
        const paxRaw = String(data.get("passengers") ?? "");
        const bagsRaw = String(data.get("luggage") ?? "");
        const pax = paxRaw === "" ? null : Number(paxRaw);
        const bags = bagsRaw === "" ? null : Number(bagsRaw);
        const vehicle = String(data.get("vehicle") ?? "");
        if (samePlace(from, to)) {
          event.preventDefault();
          setClientError("Pickup and drop-off locations cannot be the same.");
          return;
        }
        if (pax != null && (!Number.isInteger(pax) || pax < 1 || pax > MAX_GROUP)) {
          event.preventDefault();
          setClientError("Enter a valid number of passengers.");
          return;
        }
        if (bags != null && (!Number.isInteger(bags) || bags < 0 || bags > MAX_GROUP_BAGS)) {
          event.preventDefault();
          setClientError("Enter a valid amount of luggage.");
          return;
        }
        const fit = capacityProblem(vehicle, pax ?? 1, bags);
        if (fit.passengers || fit.luggage) {
          event.preventDefault();
          setClientError(fit.passengers && fit.luggage ? "This car cannot accommodate this party and luggage." : fit.passengers ? "This car cannot accommodate this count of passengers." : "This car cannot accommodate this luggage.");
          return;
        }
        setClientError(null);
      }}
    >
      <div className="md:col-span-2">
        <Select values={{}} name="contactId" label={copy.partner} options={partners} empty={copy.noPartner} />
      </div>
      <Text values={{}} name="entity" label="Company / Entity (Optional)" hint="Auto-filled from partner if selected" placeholder={copy.phEntity} />
      <Text values={{}} name="entityKvk" label="KVK / Chamber of Commerce (Optional)" placeholder={copy.phKvk} />
      <Select values={{}} name="service" label={copy.service} options={services} empty={copy.phService} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="nb-pickupAt" className={fieldLabel}>
          {copy.pickup}
        </label>
        <DateTimeField id="nb-pickupAt" name="pickupAt" allowTyping appearance="admin" locale={locale} copy={dateTimeCopy} defaultValue="" boxClassName={`${field} h-10 px-3`} className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-zinc-900 shadow-none outline-none placeholder:text-zinc-400" />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 md:col-span-2">
        <label htmlFor="nb-collection" className={fieldLabel}>{copy.collection}</label>
        <div className={`${field} flex h-10 items-center [--field-pad:12px]`}>
          <AddressField
            id="nb-collection"
            value={{ text: collection, id: null, kind: null }}
            onChange={(place) => setCollection(place.text)}
            placeholder={copy.phCollection}
            locale={locale}
            copy={guestCopy}
            tone="light"
            className="text-sm font-normal text-zinc-900 placeholder:text-zinc-400"
          />
        </div>
        <input type="hidden" name="collection" value={collection} />
      </div>

      {/* Destination stays. Extra rows are stops, and only those can be removed. */}
      <div className="flex flex-col gap-2.5 md:col-span-2">
        <div className="flex items-center justify-between">
          <label htmlFor="nb-destination" className={fieldLabel}>{copy.destination}</label>
          {destinations.length < 5 && (
            <button
              type="button"
              onClick={addDestination}
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-900 hover:text-zinc-950"
            >
              <PlusIcon size={13} />
              <span>{copy.addStop}</span>
            </button>
          )}
        </div>

        {destinations.map((dest, index) => {
          const stop = index > 0;
          return (
            <div key={index} className="flex flex-col gap-1.5">
              {stop && <label htmlFor={`nb-stop-${index}`} className={fieldLabel}>{interpolate(copy.stopN, { number: index })}</label>}
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-[12rem] flex-1">
                  <div className={`${field} flex h-10 items-center [--field-pad:12px]`}>
                    <AddressField
                      id={stop ? `nb-stop-${index}` : "nb-destination"}
                      value={{ text: dest.place, id: null, kind: null }}
                      onChange={(place) => updateDestination(index, { place: place.text })}
                      placeholder={stop ? interpolate(copy.stopN, { number: index }) : copy.destination}
                      locale={locale}
                      copy={guestCopy}
                      tone="light"
                      className="text-sm font-normal text-zinc-900 placeholder:text-zinc-400"
                    />
                  </div>
                </div>
                <input type="hidden" name="destinations" value={stop && dest.wait > 0 ? `${dest.place} | ${dest.wait}` : dest.place} />
                {stop && (
                  <select
                    aria-label={interpolate(guestCopy.stopWaitLabel, { number: index })}
                    value={dest.wait}
                    onChange={(event) => updateDestination(index, { wait: Number(event.target.value) })}
                    className="h-10 w-full shrink-0 cursor-pointer rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-card outline-none transition hover:border-zinc-300 focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/5 sm:w-[11.5rem]"
                  >
                    {STOP_WAITS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes === 0 ? guestCopy.waitNone : interpolate(guestCopy.waitMinutes, { minutes })}
                      </option>
                    ))}
                  </select>
                )}
                {stop && (
                  <button
                    type="button"
                    onClick={() => removeDestination(index)}
                    aria-label={interpolate(copy.removeStop, { number: index })}
                    className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg border border-zinc-200 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700"
                  >
                    <XIcon size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {placesMatch && <p role="alert" className="m-0 text-sm text-red-700">Pickup and drop-off locations cannot be the same.</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label id="nb-guests-label" htmlFor="nb-guests" className={fieldLabel}>
          {guestCopy.guests}
        </label>
        <GuestsPicker
          id="nb-guests"
          pax={party.pax}
          bags={party.bags}
          small={party.small}
          set={party.set}
          onChange={(next) => setParty({ ...next, set: true })}
          copy={guestCopy}
          tone="light"
          appearance="admin"
          labelledBy="nb-guests-label"
        />
        <input type="hidden" name="passengers" value={party.set ? String(party.pax) : ""} />
        <input type="hidden" name="luggage" value={party.set ? String(party.bags) : ""} />
        <input type="hidden" name="handLuggage" value={party.set ? String(party.small) : ""} />
      </div>
      <Select values={{}} name="vehicle" label={copy.vehicle} options={vehicles} empty={copy.vehicleNone} />
      <Text values={{}} name="name" label={copy.name} hint={copy.contactHint} placeholder={copy.phName} />
      <Text values={{}} name="email" label={copy.email} type="text" inputMode="email" placeholder={copy.phEmail} />

      {/* Contact phone field: compact country select + phone input together in column 1 */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="nb-phone" className={fieldLabel}>
          {copy.phone}
        </label>
        <div className="flex h-10 w-full items-stretch overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-card transition hover:border-zinc-300 focus-within:border-zinc-900 focus-within:ring-4 focus-within:ring-zinc-900/5">
          <select
            id="nb-phoneCountry"
            name="phoneCountry"
            aria-label={copy.phoneCountry}
            value={phoneCountry}
            onChange={(e) => {
              setPhoneCountry(e.target.value);
              const typed = document.getElementById("nb-phone");
              if (typed instanceof HTMLInputElement) typed.value = cleanPhoneInput(typed.value, e.target.value);
            }}
            className="h-full w-[7.25rem] shrink-0 cursor-pointer border-0 border-r border-solid border-zinc-200 bg-transparent pr-2 pl-3 text-sm text-zinc-900 outline-none"
          >
            {COUNTRY_CODES.map(([code, iso]) => (
              <option key={code} value={code}>
                {iso} +{code}
              </option>
            ))}
          </select>
          <input
            id="nb-phone"
            name="phone"
            type="text"
            inputMode="numeric"
            spellCheck={false}
            maxLength={PASTE_MAX}
            onInput={(e) => {
              const target = e.target as HTMLInputElement;
              target.value = cleanPhoneInput(target.value, phoneCountry);
            }}
            defaultValue=""
            autoComplete="off"
            placeholder={copy.phPhone}
            className="min-w-0 flex-1 border-0 bg-transparent px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
          />
        </div>
      </div>

      {/* Status field in column 2 on the same row */}
      <Select values={{}} name="status" label={copy.status} options={statuses} empty={copy.phStatus} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nb-locale" className={fieldLabel}>{copy.language}</label>
        <select id="nb-locale" name="locale" defaultValue="en" className={`${field} h-10 cursor-pointer w-full`}>
          <option value="en">English</option>
          <option value="nl">Nederlands</option>
        </select>
      </div>
      <label className="flex items-start gap-2.5 self-end pb-2 text-sm text-zinc-900">
        <input type="checkbox" name="notifyClient" defaultChecked={true} className="mt-0.5 size-4 accent-zinc-950" />
        <span>
          {copy.notifyClient}
          <span className="block text-xs text-zinc-500">{copy.notifyClientHint}</span>
        </span>
      </label>

      <Text values={{}} name="quotedAmount" label={copy.quote} placeholder={copy.phQuote} className="md:col-span-2" />
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <label htmlFor="nb-notes" className={fieldLabel}>
          {copy.notes}
        </label>
        <textarea id="nb-notes" name="notes" rows={3} maxLength={2000} placeholder={copy.phNotes} defaultValue="" className={`${field} resize-y py-2.5`} />
      </div>
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <label htmlFor="nb-internalNotes" className={fieldLabel}>
          {copy.internalNotes}
        </label>
        <textarea id="nb-internalNotes" name="internalNotes" rows={3} maxLength={5000} placeholder={copy.phInternal} defaultValue="" className={`${field} resize-y py-2.5`} />
      </div>
      {(clientError || state.error) && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-inset ring-red-200 md:col-span-2">
          <AlertIcon className="mt-0.5 shrink-0" />
          {clientError || state.error}
        </p>
      )}
      <div className="md:col-span-2">
        <button disabled={pending} className={`${btn.base} ${btn.primary} ${btn.lg}`}>
          {pending ? copy.creating : copy.submit}
        </button>
      </div>
    </form>
  );
}