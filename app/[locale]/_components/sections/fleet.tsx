import { siteConfig } from "@/lib/site-config";
import { FLEET, MAX_GALLERY_IMAGES, type Amenity, type FleetVehicle } from "@/lib/fleet/vehicles";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { localizedPath } from "@/lib/i18n/pathnames";
import Image from "next/image";
import { BookLink } from "../book-link";
import { VehicleGallery } from "../vehicle-gallery";

type Dictionary = Awaited<ReturnType<typeof getDict>>["fleetSection"];

const AMENITY_KEY = {
  executive_seating: "amenityExecutiveSeating",
  in_car_screens: "amenityInCarScreens",
  entertainment: "amenityEntertainment",
  climate_control: "amenityClimateControl",
  refreshments: "amenityRefreshments",
} as const satisfies Record<Amenity, keyof Dictionary>;

function questionsFor(vehicle: FleetVehicle, t: Dictionary, locale: "en" | "nl"): [question: string, answer: string][] {
  const { specs } = vehicle;
  const items: [string, string][] = [];
  if (specs) items.push([t.qaPassengersQ, interpolate(t.qaPassengersA, { count: specs.passengers })]);
  if (specs && vehicle.drivetrain !== "ice") {
    items.push([t.qaRangeQ, interpolate(t.qaRangeA, { km: specs.rangeKm, standard: specs.rangeStandard })]);
  }
  items.push([t.qaDurationQ, t.qaDurationA]);
  if (specs && specs.amenities.length > 0) {
    items.push([t.qaFeaturesQ, interpolate(t.qaFeaturesA, { list: specs.amenities.map((a) => t[AMENITY_KEY[a]]).join(", ") })]);
  }
  if (specs?.luggage) items.push([t.qaLuggageQ, specs.luggage[locale]]);
  return items.slice(0, 5);
}

export async function Fleet() {
  const [d, locale] = await Promise.all([getDict(), currentLocale()]);
  const t = d.fleetSection;
  const home = localizedPath("/", locale);
  return (
    <section className="border-b border-b-ink-850" id="fleet">
      <div className="py-20 px-5 my-0 mx-auto gap-12 flex flex-col max-w-[1280px] md:py-30 md:px-6 md:gap-14 2xl:max-w-[1440px]">
        <div className="gap-6 items-end flex flex-wrap justify-between">
          <div className="gap-4 flex flex-col max-w-[640px]">
            <span className="reveal text-ink-450 font-display text-[12px] tracking-[0.3em] md:tracking-[0.42em]">
              {t.eyebrow}
            </span>
            <h2 className="reveal m-0 text-white font-serif text-[clamp(32px,8.6vw,40px)] font-light leading-[1.05] md:text-[clamp(36px,4vw,56px)]">
              <span className="chrome italic">
                {t.heading}
              </span>
            </h2>
          </div>
          <p className="m-0 text-ink-400 font-light max-w-[520px]">
            {t.intro}
          </p>
        </div>

        {/* Increased grid column gap (gap-x-8 md:gap-x-12) to create breathing room between the bottom cards */}
        <ul className="p-0 m-0 gap-y-6 gap-x-8 md:gap-y-8 md:gap-x-12 list-none grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 items-stretch justify-center">
          {FLEET.map((vehicle, i) => {
            const images = vehicle.images.slice(0, MAX_GALLERY_IMAGES);
            const alt = interpolate(t.imageAlt, { name: vehicle.name });
            
            const spanClass = 
              i === 3 ? "lg:col-span-2 lg:col-start-2" : 
              i === 4 ? "lg:col-span-2 lg:col-start-4" : 
              "lg:col-span-2";

            return (
              <li
                key={vehicle.key}
                className={`reveal flex flex-col h-full ${spanClass}`}
              >
                {images.length > 0 ? (
                  <div className="w-full aspect-[16/9] relative">
                    <VehicleGallery
                      name={vehicle.name}
                      images={images}
                      alt={alt}
                      copy={{
                        label: t.galleryLabel,
                        prev: t.galleryPrev,
                        next: t.galleryNext,
                        enlarge: t.galleryEnlarge,
                        close: t.galleryClose,
                        counter: t.galleryCounter,
                        lightbox: t.galleryLightbox,
                      }}
                    />
                  </div>
                ) : (
                  <div className="border border-ink-800 items-center aspect-[16/9] shrink-0 box-border flex justify-center bg-ink-900 w-full">
                    <span className="px-6 text-ink-150 text-center font-serif text-[clamp(26px,3vw,38px)] font-light" aria-hidden="true">
                      {vehicle.name}
                    </span>
                  </div>
                )}
                
                <div className="gap-4 items-baseline flex justify-between pt-[14px]">
                  <h3 className="m-0 text-white font-serif text-[22px] font-light md:text-[26px]">
                    {vehicle.name}
                  </h3>
                  {vehicle.drivetrain === "bev" && (
                    <span className="text-ink-450 font-display text-[10px] tracking-[0.22em] md:text-[11px] md:tracking-[0.3em]">
                      {t.badge}
                    </span>
                  )}
                </div>

                <div className="border-t border-t-ink-800 my-4">
                  {questionsFor(vehicle, t, locale).map(([question, answer]) => (
                    <details key={question} name={`qa-${vehicle.key}`} className="group border-b border-b-ink-800">
                      <summary className="py-3 gap-4 items-center flex cursor-pointer justify-between list-none text-ink-150 text-[14px] [&::-webkit-details-marker]:hidden">
                        <span>{question}</span>
                        <svg className="shrink-0 transition-transform duration-300 group-open:rotate-45" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                          <path d="M12 5v14M5 12h14"></path>
                        </svg>
                      </summary>
                      <p className="m-0 pb-4 text-ink-400 text-[14px] font-light">
                        {answer}
                      </p>
                    </details>
                  ))}
                </div>

                <div className="mt-auto pt-4">
                  <BookLink
                    href={`${home}?vehicle=${vehicle.key}#enquire`}
                    vehicleKey={vehicle.key}
                    label={interpolate(t.bookAria, { name: vehicle.name })}
                    className="btn-fill py-0 px-5 no-underline items-center bg-ink-50 text-ink-950 inline-flex text-[12px] font-semibold justify-center tracking-[0.24em] min-h-[48px] uppercase w-full"
                  >
                    {t.bookCta}
                  </BookLink>
                </div>
              </li>
            );
          })}
        </ul>

        <figure className="reveal m-0 gap-4 flex flex-col">
          <div className="border border-ink-800 aspect-[16/9] relative overflow-hidden bg-ink-900 md:aspect-[21/9]">
            <Image
              className="object-cover"
              src={siteConfig.fleetInterior}
              alt={t.interiorAlt}
              fill
              sizes="(max-width: 1280px) 100vw, 1280px"
            />
          </div>
          <figcaption className="m-0 text-ink-450 text-[13px] font-light max-w-[760px]">
            {t.specNote}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}