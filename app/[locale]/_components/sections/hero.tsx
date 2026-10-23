import Image from "next/image";
import Link from "next/link";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { localizedPath } from "@/lib/i18n/pathnames";
import { JourneyBar } from "../booking/journey-bar";

export async function Hero() {
  const [locale, d] = await Promise.all([currentLocale(), getDict()]);
  // Clipped sideways only: the booking bar's suggestions and calendar may hang below the hero
  return (
    <section className="overflow-x-clip flex flex-col justify-center min-h-[calc(-77px_+_100svh)] relative md:min-h-[860px]" id="top">
      <div className="inset-0 overflow-hidden bg-ink-940 absolute">
        <Image className="hero-img inset-0 text-transparent h-full absolute w-full" src="/assets/hero-jet-arrival-v2.png" alt={d.hero.imageAlt} fill priority sizes="100vw" />
        {/* Desktop: dark behind the copy, lighter at the edges so the jet and van show, darker at the bottom for the strip */}
        <div className="inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_48%,rgba(10,10,11,0.72)_0%,rgba(10,10,11,0.5)_60%,rgba(10,10,11,0.18)_100%),linear-gradient(180deg,rgba(10,10,11,0.55)_0%,rgba(10,10,11,0)_30%,rgba(10,10,11,0)_78%,rgba(10,10,11,0.8)_100%)] absolute hidden md:block"></div>
        {/* Phones: darker behind the headline, lighter lower down so the vehicle stays visible */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,11,0.75)_0%,rgba(10,10,11,0.6)_45%,rgba(10,10,11,0.15)_75%,rgba(10,10,11,0.72)_100%)] md:hidden"></div>
      </div>
      <div className="px-5 pt-12 pb-10 my-0 mx-auto gap-[22px] items-center box-border flex flex-col max-w-[1280px] relative text-center w-full md:px-6 md:pt-20 md:pb-24 md:gap-7 2xl:max-w-[1440px]">
        <h1 className="rise d2 mx-0 mt-2 mb-0 text-white font-serif text-[clamp(36px,10.4vw,46px)] font-light tracking-[-0.01em] leading-[1.05] md:text-[clamp(40px,5.4vw,76px)]">
          {d.hero.headingBefore}{" "}
          <br className="hidden md:inline" />
          <em className="chrome-live block italic font-light md:inline">
            {d.hero.headingEmphasis}
          </em>
        </h1>
        <p className="rise d3 m-0 text-ink-150 text-[16px] font-normal max-w-[620px] [text-shadow:0_1px_12px_rgba(0,0,0,0.85)] md:[text-shadow:none] md:text-ink-300 md:text-[17px] md:font-light">
          {d.hero.intro}
        </p>
        {/* The booking bar. `enquire` is the anchor every "Request a quote" link on the site points to. Raised above the
            rest of the hero, so its suggestions and calendar open over the scroll cue and the strip below it */}
        <div id="enquire" className="rise d4 relative z-30 mt-2 w-full max-w-[1180px] scroll-mt-28 text-left">
          <JourneyBar
            locale={locale}
            copy={d.booking}
            dateTimeCopy={d.dateTimePicker}
            messages={d.forms}
            tone="dark"
            action={localizedPath("/book", locale)}
          />
        </div>
        {/* Outlined in white on dark glass, so it reads over any part of the photograph without competing with Continue */}
    <Link 
  prefetch={false} 
  className="rise d4 group inline-flex min-h-[44px] items-center justify-center gap-3 rounded-full border border-solid border-white/80 bg-ink-950/45 px-6 text-[11px] tracking-[0.24em] text-white uppercase no-underline backdrop-blur-sm transition-colors hover:border-white hover:bg-white hover:text-ink-950" 
  href={localizedPath("/corporate-partner/login", locale)}
>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="transition-colors group-hover:text-ink-950">
    <circle cx="12" cy="8" r="4"></circle>
    <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"></path>
  </svg>
  <span className="transition-colors group-hover:text-ink-950">{d.hero.corporateLogin}</span>
</Link>
      </div>
      <div className="rise d4 pb-7 gap-3 items-center hidden flex-col relative md:flex">
        <span className="text-ink-450 text-[10px] tracking-[0.3em]">
          {d.hero.scroll}
        </span>
        <span className="cue" aria-hidden="true"></span>
      </div>
      <div className="border-t border-t-ink-850 relative max-md:bg-[rgba(10,10,11,0.6)]">
        <div className="p-5 my-0 mx-auto items-center text-ink-450 gap-x-10 flex flex-col flex-wrap font-display text-[10px] justify-center tracking-[0.28em] max-w-[1280px] gap-y-[10px] text-center md:py-[22px] md:px-6 md:text-[12px] md:tracking-[0.38em] md:gap-y-4 md:gap-x-10 md:items-stretch md:flex-row xl:gap-4 xl:justify-between xl:text-start 2xl:max-w-[1440px]">
          <span>
            {d.hero.stripQuiet}
          </span>
          {" "}
          <span>
            {d.hero.stripServing}
          </span>
          {" "}
          <span>
            {d.hero.stripAvailable}
          </span>
        </div>
      </div>
    </section>
  );
}