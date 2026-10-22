import Image from "next/image";
import { siteConfig } from "@/lib/site-config";
import { getDict } from "@/lib/i18n/get-dictionary";

export async function Destinations() {
  const d = await getDict();
  const t = d.destinationsSection;
  // A destination appears once it has a photograph.
  const shown = siteConfig.destinations.filter((place) => place.image);
  return (
    <section className="border-b border-b-ink-850" id="netherlands">
      <div className="py-12 px-5 my-0 mx-auto gap-10 flex flex-col max-w-[1280px] md:py-16 md:px-6 md:gap-14 2xl:max-w-[1440px]">
        <div className="gap-6 items-end flex flex-wrap justify-between">
          <div className="gap-4 flex flex-col max-w-[640px]">
            <span className="reveal text-ink-450 font-display text-[12px] tracking-[0.3em] md:tracking-[0.42em]">
              {d.destinationsSection.eyebrow}
            </span>
            <h2 className="reveal m-0 text-white font-serif text-[clamp(32px,8.6vw,40px)] font-light leading-[1.08] md:text-[clamp(36px,4vw,56px)]">
              {d.destinationsSection.heading}
            </h2>
          </div>
          <div className="gap-4 flex flex-col max-w-[460px]">
            <p className="m-0 text-ink-400 font-light">
              {d.destinationsSection.intro}
            </p>
          </div>
        </div>
        {/* Uniform 4-column grid where every card has the exact same dimensions */}
        <div className="gap-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((place) => {
            return (
              <figure
                key={place.key}
                className="dest reveal m-0 gap-[14px] flex flex-col"
              >
                <div className="shot relative h-[220px] w-full md:h-[260px]">
                  <Image
                    style={{ 
                      objectPosition: place.focus,
                      filter: "brightness(1.15) contrast(1.1) saturate(1.2)" 
                    }}
                    src={place.image!}
                    alt={t[`${place.key}Alt`]}
                    fill
                    sizes="(max-width: 760px) 100vw, (max-width: 1200px) 50vw, 25vw"
                  />
                </div>
                <figcaption className="text-ink-250 font-display text-[10px] tracking-[0.06em] md:text-[12px] md:tracking-[0.1em]">
                  {t[place.key]}
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}