import { Suspense } from "react";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getBooking, latestPhone } from "@/lib/corporate/bookings";
import { requirePartner } from "@/lib/corporate/portal";
import { FLEET, normalizeVehicleKey, VEHICLE_CHOICES, type VehicleChoice } from "@/lib/fleet/vehicles";
import { stopsWithWaits } from "@/lib/quotes/stops";
import { HOURLY_DURATIONS } from "@/lib/quotes/constants";
import { getDict } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { localizedPath } from "@/lib/i18n/pathnames";
import { PortalBooking } from "../../../_components/booking/portal-booking";
import { emptyTrip, MAX_PASSENGERS, type Trip } from "../../../_components/booking/trip";
import { corporateMetadata, PanelSkeleton } from "../../../_components/corporate-shell";
import { PortalPage } from "../../../_components/portal-shell";

/** A booking request, with the partner's details filled in. `?repeat=EE-…` starts from one of their own earlier bookings. */
async function NewBooking({ searchParams }: Pick<PageProps<"/[locale]/corporate-partner/account/new-booking">, "searchParams">) {
  const { repeat } = await searchParams;
  const { locale, contact } = await requirePartner("/corporate-partner/account/new-booking");
  const d = await getDict();
  const [phone, earlier, dbVehicles] = await Promise.all([
    latestPhone(),
    typeof repeat === "string" ? getBooking(repeat) : null,
    db
      .select({ key: schema.vehicles.id, name: schema.vehicles.name })
      .from(schema.vehicles)
      .where(eq(schema.vehicles.status, "available"))
      .catch(() => []),
  ]);

  // Only the partner's own bookings can be repeated (getBooking finds nothing else); the date is never copied, and
  // neither is the flight (a new trip, a new flight)
  const source = earlier && earlier.service !== "bespoke" ? earlier : null;
  const trip: Trip = emptyTrip();
  if (source) {
    const vehicle = normalizeVehicleKey(source.vehicle) ?? source.vehicle ?? "";
    Object.assign(trip, {
      mode: source.service === "hourly" && !source.destination ? "hourly" : "oneway",
      from: { text: source.collection ?? "", id: null, kind: null },
      to: { text: source.destination ?? "", id: null, kind: null },
      stops: stopsWithWaits(source.destinations, source.destinationWaits),
      hours: (HOURLY_DURATIONS as readonly number[]).includes(source.durationHours ?? 0) ? source.durationHours! : trip.hours,
      pax: Math.min(source.passengers ?? trip.pax, MAX_PASSENGERS),
      bags: source.luggage ?? trip.bags,
      guestsSet: true, // the earlier booking's party is the answer; a new booking starts without one
      vehicle: (VEHICLE_CHOICES as readonly string[]).includes(vehicle) ? (vehicle as VehicleChoice) : "",
    } satisfies Partial<Trip>);
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
        dateTimeCopy={d.dateTimePicker}
        messages={d.forms}
        fleetDict={d.fleetSection}
        vehicleAdvise={d.quoteForm.vehicleAdvise}
        vehicles={dbVehicles && dbVehicles.length > 0 ? dbVehicles : FLEET.map(({ key, name }) => ({ key, name }))}
        booker={{ name: contact.name, email: contact.email }}
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
