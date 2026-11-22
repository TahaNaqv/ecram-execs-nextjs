import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PUBLIC_LOCALES } from "@/lib/i18n/config";
import { currentLocale, getDict, type Dictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { localizedPath, unprefixedPath } from "@/lib/i18n/pathnames";
import { bookableFleet } from "@/lib/fleet/catalog";
import { MAX_GALLERY_IMAGES, UPCOMING, vehicleByKey, type Amenity, type FleetVehicle, type OfferedVehicle } from "@/lib/fleet/vehicles";
import { LanguageSwitcher } from "../_components/language-switcher";
import { SiteFooter } from "../_components/sections";
import { VehicleGallery } from "../_components/vehicle-gallery";

/**
 * The fleet on a page of its own (the client, 22 Nov 2026): a photo, the specs and the availability of every vehicle,
 * so visitors can see the cars without starting a booking. Deliberately no prices and no booking buttons.
 *
 * The cars are the booking form's own list (lib/fleet/catalog.ts): the printed fleet with any photos an admin has
 * uploaded, plus cars listed in the admin. Specs come only from lib/fleet/vehicles.ts, so a car without confirmed
 * figures shows just what the admin entered. The list read is the booking form's own cached one (tag "fleet"), so an
 * admin edit refreshes both. It is not wrapped in a second "use cache": that would await the shared read from inside
 * another cache, which Next refuses.
 */

const AMENITY_KEY = {
  executive_seating: "amenityExecutiveSeating",
  in_car_screens: "amenityInCarScreens",
  entertainment: "amenityEntertainment",
  climate_control: "amenityClimateControl",
  refreshments: "amenityRefreshments",
} as const satisfies Record<Amenity, keyof Dictionary["fleetSection"]>;

type Row = [label: string, value: string];

function specRows(offer: OfferedVehicle, vehicle: FleetVehicle | undefined, d: Dictionary, locale: "en" | "nl"): Row[] {
  const t = d.fleetPage;
  const specs = vehicle?.specs;
  const rows: Row[] = [];
  const passengers = specs?.passengers ?? offer.seats;
  if (passengers) rows.push([t.passengers, interpolate(t.passengersValue, { count: passengers })]);
  if (specs && vehicle?.drivetrain !== "ice" && specs.rangeKm > 0) {
    rows.push([t.range, interpolate(t.rangeValue, { km: specs.rangeKm.toLocaleString(locale === "nl" ? "nl-NL" : "en-GB"), standard: specs.rangeStandard })]);
  }
  if (specs?.luggage) rows.push([t.luggage, specs.luggage[locale]]);
  else if (!vehicle && offer.bags) rows.push([t.luggage, offer.bags === 1 ? t.luggageBagsOne : interpolate(t.luggageBags, { count: offer.bags })]);
  if (specs && specs.amenities.length > 0) {
    rows.push([t.features, specs.amenities.map((a) => d.fleetSection[AMENITY_KEY[a]]).join(", ")]);
  }
  return rows;
}

function Availability({ expected, t }: { expected?: string; t: Dictionary["fleetPage"] }) {
  const soon = Boolean(expected);
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium tracking-[0.04em] ${
        soon ? "border-red-500/45 bg-red-500/12 text-red-300" : "border-emerald-500/45 bg-emerald-500/12 text-emerald-300"
      }`}
    >
      <span aria-hidden="true" className={`size-2 rounded-full ${soon ? "bg-red-400" : "bg-emerald-400"}`} />
      {soon ? interpolate(t.expected, { when: expected! }) : t.availableNow}
    </span>
  );
}

type Card = { key: string; name: string; images: string[]; rows: Row[]; pending?: boolean; expected?: string };

function VehicleCard({ card, index, d }: { card: Card; index: number; d: Dictionary }) {
  const t = d.fleetPage;
  const headingId = `vehicle-${index}`;
  return (
    <article
      aria-labelledby={headingId}
      className={`grid overflow-hidden border border-ink-800 bg-ink-900 ${card.images.length > 0 ? "md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]" : ""}`}
    >
      {/* A car an admin listed without photos gets no empty photo panel */}
      {card.images.length > 0 && (
        <div className="relative aspect-[16/10] w-full bg-ink-850 md:aspect-auto md:min-h-[380px]">
          <VehicleGallery
            name={card.name}
            images={card.images}
            alt={interpolate(d.fleetSection.imageAlt, { name: card.name })}
            sizes="(max-width: 768px) 100vw, 60vw"
            copy={{
              label: d.fleetSection.galleryLabel,
              prev: d.fleetSection.galleryPrev,
              next: d.fleetSection.galleryNext,
              enlarge: d.fleetSection.galleryEnlarge,
              close: d.fleetSection.galleryClose,
              counter: d.fleetSection.galleryCounter,
              lightbox: d.fleetSection.galleryLightbox,
            }}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-6 p-6 md:p-8 lg:p-10">
        <h2 id={headingId} className="m-0 font-serif text-[28px] leading-[1.1] font-light text-white md:text-[32px]">
          {card.name}
        </h2>

        {(card.rows.length > 0 || card.pending) && (
          <div className="flex flex-col gap-3">
            <span className="font-display text-[11px] tracking-[0.3em] text-ink-450 uppercase">{t.specsLabel}</span>
            {card.rows.length > 0 ? (
              <dl className="m-0 flex flex-col">
                {card.rows.map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)] gap-4 border-t border-ink-800 py-3 text-[14px] last:border-b">
                    <dt className="text-ink-450">{label}</dt>
                    <dd className="m-0 text-ink-150">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="m-0 border-y border-ink-800 py-3 text-[14px] font-light text-ink-400">{t.specsPending}</p>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-col gap-3">
          <span className="font-display text-[11px] tracking-[0.3em] text-ink-450 uppercase">{t.availabilityLabel}</span>
          <div>
            <Availability expected={card.expected} t={t} />
          </div>
        </div>
      </div>
    </article>
  );
}

async function FleetList() {
  const d = await getDict();
  const locale = await currentLocale();
  const offers = await bookableFleet();

  // The cars that can be booked, in the booking form's order, then the ones announced for later (lib/fleet/vehicles.ts UPCOMING)
  const cards: Card[] = [
    ...offers.map((offer) => {
      const vehicle = vehicleByKey(offer.key);
      return {
        key: offer.key,
        name: offer.name,
        images: (offer.images ?? vehicle?.images ?? []).slice(0, MAX_GALLERY_IMAGES),
        rows: specRows(offer, vehicle, d, locale),
        expected: vehicle?.expected,
      };
    }),
    ...UPCOMING.map((car) => ({ key: car.key, name: car.name, images: car.images, rows: [], pending: true, expected: car.expected })),
  ];

  return (
    <ol role="list" className="m-0 flex list-none flex-col gap-12 p-0 md:gap-16">
      {cards.map((card, i) => (
        <li key={card.key}>
          <VehicleCard card={card} index={i} d={d} />
        </li>
      ))}
    </ol>
  );
}

export default async function FleetPage() {
  const dict = await getDict();
  const locale = await currentLocale();
  const t = dict.fleetPage;
  return (
    <div className="min-h-svh bg-ink-950 font-sans leading-[1.6] text-ink-150">
      <a className="skip-link" href="#main">
        {dict.common.skipToContent}
      </a>
      <header className="sticky top-0 z-40 border-b border-ink-850 bg-ink-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-4 sm:px-6 md:px-8 md:py-[22px] 2xl:max-w-[1440px]">
          <Link
            href={localizedPath("/", locale)}
            aria-label={t.home}
            className="inline-flex items-center gap-2 whitespace-nowrap chrome font-display text-[13px] tracking-[0.15em] no-underline md:gap-3 md:text-[22px] md:tracking-[0.32em]"
          >
            <Image className="h-9 w-9 shrink-0 md:h-12 md:w-12" src="/assets/logo-mark.png" alt="" width={48} height={48} />
            <span>ECRAM EXECS</span>
          </Link>
          <LanguageSwitcher route="/fleet" />
        </div>
      </header>

      <main id="main">
        <section className="border-b border-ink-850">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-5 px-4 pt-12 pb-12 sm:px-6 md:px-8 md:pt-16 md:pb-14 lg:pt-20 2xl:max-w-[1440px]">
            <span className="font-display text-[12px] tracking-[0.3em] text-ink-450 md:tracking-[0.42em]">{t.eyebrow}</span>
            <h1 className="m-0 font-serif text-[clamp(36px,8.6vw,40px)] leading-[1.05] font-light text-white md:text-[clamp(40px,5vw,64px)]">
              {t.heading}
            </h1>
            <p className="m-0 max-w-[640px] font-light text-ink-400">{t.intro}</p>
            <p className="m-0 max-w-[640px] text-[13.5px] font-light text-ink-450">{t.specNote}</p>
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 md:px-8 md:py-16 2xl:max-w-[1440px]">
          <Suspense fallback={<div className="min-h-[60svh]" aria-busy="true" />}>
            <FleetList />
          </Suspense>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const d = await getDict();
  return {
    title: d.fleetPage.metaTitle,
    description: d.fleetPage.metaDescription,
    alternates: {
      canonical: localizedPath("/fleet", locale),
      languages: { ...Object.fromEntries(PUBLIC_LOCALES.map((l) => [l, localizedPath("/fleet", l)])), "x-default": unprefixedPath("/fleet") },
    },
  };
}
