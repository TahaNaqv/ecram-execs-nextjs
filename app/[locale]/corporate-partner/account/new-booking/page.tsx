import { Suspense } from "react";
import { getBooking, latestPhone } from "@/lib/corporate/bookings";
import { requirePartner } from "@/lib/corporate/portal";
import { bookableFleet } from "@/lib/fleet/catalog";
import { fleetPicks, normalizeVehicleKey, VEHICLE_CHOICES, type VehicleChoice } from "@/lib/fleet/vehicles";
import { stopsWithWaits } from "@/lib/quotes/stops";
import { HOURLY_DURATIONS } from "@/lib/quotes/constants";
import { getDict } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { localizedPath } from "@/lib/i18n/pathnames";
import { PortalBooking } from "../../../_components/booking/portal-booking";
import { CURATED_PLACES, curatedKind } from "@/lib/places/curated";
import { cleanCars, emptyTrip, normalizeTrip, type Place, type Trip } from "../../../_components/booking/trip";
import { corporateMetadata, PanelSkeleton } from "../../../_components/corporate-shell";
import { PortalPage } from "../../../_components/portal-shell";

function carsFromBooking(source: { vehicle: string | null; vehicleCount: number; vehicles: { key: string; count: number }[] | null }): Trip["cars"] {
  // Every car of the earlier booking, with how many of each (several cars per booking again, 7 Nov 2026)
  const stored = fleetPicks(source.vehicles);
  if (stored.length > 0) return cleanCars(stored);
  const key = normalizeVehicleKey(source.vehicle);
  return key ? [{ key, count: 1 }] : [];
}

/** Restore a place so "Choose your car" sees the same id the visitor originally picked (or a curated match by name). */
function placeFromBooking(text: string | null | undefined, id: string | null | undefined): Place {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return { text: "", id: null, kind: null };
  const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const needle = fold(trimmed);
  const curated = CURATED_PLACES.find((p) => {
    const name = fold(p.name);
    return needle === name || needle.startsWith(`${name},`) || needle.includes(name);
  });
  return {
    text: trimmed,
    id: id?.trim() || curated?.id || `repeat:${trimmed}`,
    kind: curated?.kind ?? curatedKind(trimmed),
  };
}

/** A booking request, with the partner's details filled in. `?repeat=EE-…` starts from one of their own earlier bookings. */
async function NewBooking({ searchParams }: Pick<PageProps<"/[locale]/corporate-partner/account/new-booking">, "searchParams">) {
  const { repeat } = await searchParams;
  const { locale, contact } = await requirePartner("/corporate-partner/account/new-booking");
  const d = await getDict();
  const [phone, earlier, vehicles] = await Promise.all([
    latestPhone(),
    typeof repeat === "string" ? getBooking(repeat) : null,
    bookableFleet(),
  ]);

  // Only the partner's own bookings can be repeated (getBooking finds nothing else); the date is never copied, and
  // neither is the flight (a new trip, a new flight)
  const source = earlier && earlier.service !== "bespoke" ? earlier : null;
  const trip: Trip = emptyTrip();
  if (source) {
    const vehicle = normalizeVehicleKey(source.vehicle) ?? source.vehicle ?? "";
    const cars = carsFromBooking(source);
    Object.assign(trip, normalizeTrip({
      ...trip,
      mode: source.service === "hourly" && !source.destination ? "hourly" : "oneway",
      from: placeFromBooking(source.collection, source.pickupPlaceId),
      to: placeFromBooking(source.destination, source.destinationPlaceId),
      stops: stopsWithWaits(source.destinations, source.destinationWaits),
      hours: (HOURLY_DURATIONS as readonly number[]).includes(source.durationHours ?? 0) ? source.durationHours! : trip.hours,
      pax: source.passengers ?? trip.pax,
      bags: source.luggage ?? trip.bags,
      small: source.handLuggage ?? 0,
      guestsSet: true, // the earlier booking's party is the answer; a new booking starts without one
      vehicle: cars[0]?.key ?? ((VEHICLE_CHOICES as readonly string[]).includes(vehicle) ? (vehicle as VehicleChoice) : ""),
      cars,
      // The same add-ons as last time; they can be changed on their own step
      extras: source.extras ?? [],
    }));
  }
  const passengerPhone = source?.passengerPhone?.match(/^\+(\d{1,4}) (.+)$/);

  const p = d.portal;
  return (
    <div className="flex flex-col gap-6">
      <p className="m-0 max-w-[640px] text-[15px] text-ink-700">{p.newIntro}</p>
      {/* A key per starting point: the flow keeps its own state, which must not carry over from another visit */}
      <PortalBooking
        key={source?.reference ?? "new"}
        locale={locale}
        copy={d.booking}
        addOns={d.addOns}
        dateTimeCopy={d.dateTimePicker}
        messages={d.forms}
        fleetDict={d.fleetSection}
        vehicleAdvise={d.quoteForm.vehicleAdvise}
        vehicles={vehicles}
        booker={{ name: contact.name, email: contact.email, companyName: contact.companyName }}
        defaultPhone={phone ?? undefined}
        initialTrip={trip}
        defaults={
          source
            ? {
                notes: source.notes ?? undefined,
                passengerName: source.passengerName ?? undefined,
                passengerPhone: passengerPhone ? { country: passengerPhone[1], number: passengerPhone[2] } : undefined,
              }
            : undefined
        }
        notice={source ? interpolate(p.repeatNote, { reference: source.reference }) : undefined}
        loginHref={localizedPath("/corporate-partner/login", locale)}
        loginLabel={d.corporatePartner.loginLink}
      />
    </div>
  );
}

export default async function NewBookingPage({ searchParams }: PageProps<"/[locale]/corporate-partner/account/new-booking">) {
  const p = (await getDict()).portal;
  return (
    <PortalPage route="/corporate-partner/account/new-booking" current="new" heading={p.headingNew}>
      <Suspense fallback={<PanelSkeleton />}>
        <NewBooking searchParams={searchParams} />
      </Suspense>
    </PortalPage>
  );
}

export async function generateMetadata() {
  const d = await getDict();
  return corporateMetadata("/corporate-partner/account/new-booking", d.portal.metaTitleNew, d.corporatePartner.metaDescription, false);
}
