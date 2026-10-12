import { siteConfig } from "@/lib/site-config";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import Image from "next/image";

export async function Fleet() {
  const [locale, d] = await Promise.all([currentLocale(), getDict()]);
  return (
    <section className="border-b border-b-ink-850" id="fleet">
      <div className="py-20 px-5 my-0 mx-auto gap-10 items-center flex flex-wrap max-w-[1280px] md:py-30 md:px-6 md:gap-16 2xl:max-w-[1440px]">
        <div className="p-6 border border-ink-800 flex-[999_1_100%] items-center aspect-video bg-ink-50 box-border flex justify-center max-h-[520px] min-w-0 xl:flex-[999_1_560px] xl:aspect-[4/3] xl:max-h-none">
          <Image className="block h-full mix-blend-multiply object-contain w-full" src="/assets/mercedes-vle-300-electric.jpg" alt={d.fleetSection.imageAlt} width={1600} height={900} sizes="(max-width: 760px) 100vw, 60vw" />
        </div>
        <div className="gap-6 flex-[1_1_380px] flex flex-col min-w-0">
          <span className="reveal text-ink-450 font-display text-[12px] tracking-[0.3em] md:tracking-[0.42em]">
            {d.fleetSection.eyebrow}
          </span>
          <h2 className="reveal m-0 text-white font-serif text-[clamp(32px,8.6vw,40px)] font-light leading-[1.05] md:text-[clamp(36px,4vw,56px)]">
            Mercedes-Benz{" "}
            <br />
            <span className="chrome italic">
              VLE 300 Electric
            </span>
          </h2>
          <p className="m-0 text-ink-400 font-light">
            {d.fleetSection.intro}
          </p>
          <ul className="p-0 m-0 border-b border-b-ink-800 list-none flex flex-col">
            <li className="py-4 px-0 gap-[6px] border-t border-t-ink-800 flex flex-col text-[14px] justify-between md:gap-4 md:flex-row">
              <span className="text-ink-450 text-[11px] tracking-[0.18em] uppercase">
                {d.fleetSection.specCabin}
              </span>
              <span className="text-ink-150">
                {d.fleetSection.specCabinValue}
              </span>
            </li>
            <li className="py-4 px-0 gap-[6px] border-t border-t-ink-800 flex flex-col text-[14px] justify-between md:gap-4 md:flex-row">
              <span className="text-ink-450 text-[11px] tracking-[0.18em] uppercase">
                {d.fleetSection.specDrive}
              </span>
              <span className="text-ink-150">
                {d.fleetSection.specDriveValue}
              </span>
            </li>
            {siteConfig.fleet.maxPassengers !== null && (
              <li className="py-4 px-0 gap-[6px] border-t border-t-ink-800 flex flex-col text-[14px] justify-between md:gap-4 md:flex-row">
                <span className="text-ink-450 text-[11px] tracking-[0.18em] uppercase">
                  {d.fleetSection.specPassengers}
                </span>
                <span className="text-ink-150">
                  {interpolate(d.fleet.upToPassengers, { n: siteConfig.fleet.maxPassengers })}
                </span>
              </li>
            )}
            {siteConfig.fleet.amenities[locale] && (
              <li className="py-4 px-0 gap-[6px] border-t border-t-ink-800 flex flex-col text-[14px] justify-between md:gap-4 md:flex-row">
                <span className="text-ink-450 text-[11px] tracking-[0.18em] uppercase">
                  {d.fleetSection.specAmenities}
                </span>
                <span className="text-ink-150">
                  {siteConfig.fleet.amenities[locale]}
                </span>
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
