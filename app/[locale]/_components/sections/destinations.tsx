import Image from "next/image";
import { getDict } from "@/lib/i18n/get-dictionary";

export async function Destinations() {
  const d = await getDict();
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
          <p className="m-0 text-ink-400 font-light max-w-[420px]">
            {d.destinationsSection.intro}
          </p>
        </div>
        <div className="gap-3 grid grid-cols-[1fr] xs:grid-cols-[1fr_1fr] md:gap-4 md:grid-cols-2 lg:grid-cols-4">
          <figure className="dest reveal m-0 gap-[14px] col-[1/-1] row-auto flex flex-col md:row-[span_2/auto] md:col-auto">
            <div className="shot flex-none h-[200px] min-h-0 xs:h-[300px] md:flex-1 md:min-h-[560px] md:h-auto">
              <Image className="object-[50%_55%]" src="/assets/52de87fce1028743a6cc606de596dd57.jpg" alt={d.destinationsSection.amsterdamAlt} fill sizes="(max-width: 760px) 50vw, 40vw" />
            </div>
            <figcaption className="text-ink-250 font-display text-[10px] tracking-[0.22em] md:text-[12px] md:tracking-[0.34em]">
              {d.destinationsSection.amsterdam}
            </figcaption>
          </figure>
          <figure className="dest reveal m-0 gap-[14px] col-auto row-auto flex flex-col">
            <div className="shot flex-none h-[200px] min-h-0 xs:h-[180px] md:h-[240px] md:flex-initial md:min-h-auto">
              <Image className="object-[60%_62%]" src="/assets/c01091ac467f57c8ccacd1d28b8caa6f.jpg" alt={d.destinationsSection.rotterdamAlt} fill sizes="(max-width: 760px) 50vw, 40vw" />
            </div>
            <figcaption className="text-ink-250 font-display text-[10px] tracking-[0.22em] md:text-[12px] md:tracking-[0.34em]">
              {d.destinationsSection.rotterdam}
            </figcaption>
          </figure>
          <figure className="dest reveal m-0 gap-[14px] col-auto row-auto flex flex-col">
            <div className="shot flex-none h-[200px] min-h-0 xs:h-[180px] md:h-[240px] md:flex-initial md:min-h-auto">
              <Image className="object-[60%_60%]" src="/assets/3f6c76e3791d854e6974e39f5db1d665.jpg" alt={d.destinationsSection.theHagueAlt} fill sizes="(max-width: 760px) 50vw, 40vw" />
            </div>
            <figcaption className="text-ink-250 font-display text-[10px] tracking-[0.22em] md:text-[12px] md:tracking-[0.34em]">
              {d.destinationsSection.theHague}
            </figcaption>
          </figure>
          <figure className="dest reveal m-0 gap-[14px] col-auto row-auto flex flex-col">
            <div className="shot flex-none h-[200px] min-h-0 xs:h-[180px] md:h-[240px] md:flex-initial md:min-h-auto">
              <Image className="object-[50%_60%]" src="/assets/d38555c6a11a07329e901cbb09fa90bb.jpg" alt={d.destinationsSection.utrechtAlt} fill sizes="(max-width: 760px) 50vw, 40vw" />
            </div>
            <figcaption className="text-ink-250 font-display text-[10px] tracking-[0.22em] md:text-[12px] md:tracking-[0.34em]">
              {d.destinationsSection.utrecht}
            </figcaption>
          </figure>
          <figure className="dest reveal m-0 gap-[14px] col-auto row-auto flex flex-col">
            <div className="shot flex-none h-[200px] min-h-0 xs:h-[180px] md:h-[240px] md:flex-initial md:min-h-auto">
              <Image className="object-[40%_62%]" src="/assets/015c3f4881474d5c1c3690861a6d2221.jpg" alt={d.destinationsSection.maastrichtAlt} fill sizes="(max-width: 760px) 50vw, 40vw" />
            </div>
            <figcaption className="text-ink-250 font-display text-[10px] tracking-[0.22em] md:text-[12px] md:tracking-[0.34em]">
              {d.destinationsSection.maastricht}
            </figcaption>
          </figure>
          <figure className="dest reveal m-0 gap-[14px] col-auto row-auto flex flex-col md:col-[span_2/auto]">
            <div className="shot flex-none h-[200px] min-h-0 xs:h-[180px] md:h-[240px] md:flex-initial md:min-h-auto">
              <Image className="[filter:saturate(0.4)_contrast(1.05)_brightness(0.7)] object-[50%_55%]" src="/assets/9ba09fb8d24f8c76d2d91a2b893186bf.jpg" alt={d.destinationsSection.bulbRegionAlt} fill sizes="(max-width: 760px) 50vw, 40vw" />
            </div>
            <figcaption className="text-ink-250 font-display text-[10px] tracking-[0.22em] md:text-[12px] md:tracking-[0.34em]">
              {d.destinationsSection.bulbRegion}
            </figcaption>
          </figure>
          <figure className="dest reveal m-0 gap-[14px] col-auto row-auto flex flex-col md:col-[1/-1]">
            <div className="shot flex-none h-[200px] min-h-0 xs:h-[180px] md:h-[240px] md:flex-initial md:min-h-auto">
              <Image className="object-[28%_50%]" src="/assets/74497cf7361df1d7830d0f8ebc1d8e7a.jpg" alt={d.destinationsSection.kinderdijkAlt} fill sizes="(max-width: 760px) 50vw, 40vw" />
            </div>
            <figcaption className="text-ink-250 font-display text-[10px] tracking-[0.22em] md:text-[12px] md:tracking-[0.34em]">
              {d.destinationsSection.kinderdijk}
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
