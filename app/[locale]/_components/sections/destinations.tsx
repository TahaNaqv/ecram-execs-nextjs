import Image from "next/image";
import { siteConfig } from "@/lib/site-config";
import { getDict } from "@/lib/i18n/get-dictionary";

/**
 * Four-column grid: a tall first photo on the left, rows of three beside it, and the final photo across
 * the full width. If the middle photos don't fill their last row, the final one of them stretches so
 * the grid never ends ragged — which is what lets a destination come and go as photographs arrive.
 */
function stretchClass(count: number, index: number) {
  if (count < 3 || index !== count - 2) return "";
  const remainder = (count - 2) % 3;
  if (remainder === 2) return "md:col-[span_2/auto]";
  if (remainder === 1) return "md:col-[span_2/auto] lg:col-[span_3/auto]";
  return "";
}

export async function Destinations() {
  const d = await getDict();
  const t = d.destinationsSection;
  // A destination appears once it has a photograph.
  const shown = siteConfig.destinations.filter((place) => place.image);
  return (
    <section className="border-b border-b-ink-850" id="netherlands">
      <div className="py-20 px-5 my-0 mx-auto gap-10 flex flex-col max-w-[1280px] md:py-30 md:px-6 md:gap-14 2xl:max-w-[1440px]">
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
            <p className="m-0 text-ink-400 font-light">
              {d.destinationsSection.intro2}
            </p>
          </div>
        </div>
        <div className="gap-3 grid grid-cols-[1fr] xs:grid-cols-[1fr_1fr] md:gap-4 md:grid-cols-2 lg:grid-cols-4">
          {shown.map((place, i) => {
            const first = i === 0;
            const last = i === shown.length - 1;
            const stretch = last && !first ? "md:col-[1/-1]" : stretchClass(shown.length, i);
            return (
              <figure
                key={place.key}
                className={`dest reveal m-0 gap-[14px] row-auto flex flex-col ${
                  first ? "col-[1/-1] md:row-[span_2/auto] md:col-auto" : "col-auto"
                } ${stretch}`}
              >
                <div
                  className={`shot flex-none h-[200px] min-h-0 ${
                    first ? "xs:h-[300px] md:flex-1 md:min-h-[560px] md:h-auto" : "xs:h-[180px] md:h-[240px] md:flex-initial md:min-h-auto"
                  }`}
                >
                  <Image
                    className={place.muted ? "[filter:saturate(0.4)_contrast(1.05)_brightness(0.7)]" : undefined}
                    style={{ objectPosition: place.focus }}
                    src={place.image!}
                    alt={t[`${place.key}Alt`]}
                    fill
                    sizes="(max-width: 760px) 50vw, 40vw"
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
