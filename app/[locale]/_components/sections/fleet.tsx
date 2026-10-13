import { siteConfig } from "@/lib/site-config";
import { getDict } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import Image from "next/image";

export async function Fleet() {
  const d = await getDict();
  const t = d.fleetSection;
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

        <ul className="p-0 m-0 gap-3 list-none grid grid-cols-1 sm:grid-cols-2 md:gap-4 lg:grid-cols-6">
          {siteConfig.fleet.map((vehicle, i) => (
            <li
              key={vehicle.name}
              // Five cards: three across the first row, two wider ones beneath, so no row is left ragged.
              className={`reveal gap-[14px] flex flex-col ${i >= 3 ? "lg:col-span-3" : "lg:col-span-2"}`}
            >
              <div className="border border-ink-800 items-center aspect-video box-border flex justify-center relative overflow-hidden bg-ink-900">
                {vehicle.image ? (
                  <Image
                    className="block h-full object-cover w-full"
                    src={vehicle.image}
                    alt={interpolate(t.imageAlt, { name: vehicle.name })}
                    width={1600}
                    height={900}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  // No photograph yet: the name stands in on the same canvas.
                  <span className="px-6 text-ink-150 text-center font-serif text-[clamp(26px,3vw,38px)] font-light" aria-hidden="true">
                    {vehicle.name}
                  </span>
                )}
              </div>
              <div className="gap-4 items-baseline flex justify-between">
                <h3 className="m-0 text-white font-serif text-[22px] font-light md:text-[26px]">
                  {vehicle.name}
                </h3>
                <span className="text-ink-450 font-display text-[10px] tracking-[0.22em] md:text-[11px] md:tracking-[0.3em]">
                  {t.badge}
                </span>
              </div>
            </li>
          ))}
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
