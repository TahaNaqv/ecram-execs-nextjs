import { Suspense } from "react";
import { getBooking, latestPhone } from "@/lib/corporate/bookings";
import { requirePartner } from "@/lib/corporate/portal";
import { FLEET } from "@/lib/fleet/vehicles";
import { getDict } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { localizedPath } from "@/lib/i18n/pathnames";
import { BookingForm, type BookingDefaults } from "../../../_components/portal-booking-form";
import { corporateMetadata, PanelSkeleton } from "../../../_components/corporate-shell";
import { PortalPage } from "../../../_components/portal-shell";

/** A booking request, with the partner's details filled in. `?repeat=EE-…` starts from one of their own earlier bookings. */
async function NewBooking({ searchParams }: Pick<PageProps<"/[locale]/corporate-partner/account/new-booking">, "searchParams">) {
  const { repeat } = await searchParams;
  const { locale, contact } = await requirePartner("/corporate-partner/account/new-booking");
  const d = await getDict();
  const [phone, earlier] = await Promise.all([latestPhone(), typeof repeat === "string" ? getBooking(repeat) : null]);

  // Only the partner's own bookings can be repeated (getBooking finds nothing else); the date is never copied
  const source = earlier && earlier.service !== "bespoke" ? earlier : null;
  const defaults: BookingDefaults = {
    ...(source && {
      collection: source.collection ?? "",
      destination: source.destination ?? "",
      stops: source.destinations ?? [],
      service: source.service,
      passengers: source.passengers?.toString() ?? "",
      vehicle: source.vehicle ?? "",
      notes: source.notes ?? "",
    }),
    phoneCountry: phone?.country,
    phone: phone?.number,
  };

  const q = d.quoteForm;
  const c = d.corporatePartner;
  const p = d.portal;
  return (
    <div className="flex flex-col gap-6">
      <p className="m-0 max-w-[640px] text-[15px] text-ink-700">{p.newIntro}</p>
      {source && <p className="m-0 border-l-4 border-ink-950 bg-white px-4 py-3 text-[14px] text-ink-950">{interpolate(p.repeatNote, { reference: source.reference })}</p>}
      {/* A key per starting point: the form keeps its own state (the stops), which must not carry over from another visit */}
      <BookingForm
        key={source?.reference ?? "new"}
        locale={locale}
        booker={{ name: contact.name, email: contact.email }}
        defaults={defaults}
        vehicles={FLEET.map(({ key, name }) => ({ key, name }))}
        serviceLabels={d.services}
        loginHref={localizedPath("/corporate-partner/login", locale)}
        copy={{
          labelCollection: q.labelCollection,
          phCollection: q.phCollection,
          labelDestination: q.labelDestination,
          phDestination: q.phDestination,
          labelDateTime: q.labelDateTime,
          labelService: q.labelService,
          labelPassengers: q.labelPassengers,
          selectPlaceholder: q.selectPlaceholder,
          eightOrMore: q.eightOrMore,
          labelVehicle: q.labelVehicle,
          vehicleAdvise: q.vehicleAdvise,
          labelNotes: q.labelNotes,
          phNotes: q.phNotes,
          labelPhoneCountry: q.labelPhoneCountry,
          labelPhone: q.labelPhone,
          phPhone: q.phPhone,
          removeStop: q.removeStop,
          labelBookerName: c.labelBookerName,
          labelBookerEmail: c.labelBookerEmail,
          loginLink: c.loginLink,
          addStopCta: p.addStopCta,
          phStop: p.phStop,
          stopLabel: p.stopLabel,
          submitBooking: p.submitBooking,
          submittingBooking: p.submittingBooking,
        }}
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
