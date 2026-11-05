import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { localizedPath } from "@/lib/i18n/pathnames";
import { HeroJourneyBar, JourneyBar } from "../booking/journey-bar";
import { AskConciergeLink } from "../concierge-launcher";

export async function Hero() {
  const [locale, d] = await Promise.all([currentLocale(), getDict()]);
  // The background is clipped on its own. The section is not, so the booking calendar can sit above the floating buttons.
  return (
    <section className="keep-navy relative flex min-w-0 flex-col justify-center md:min-h-[720px] xl:min-h-[860px]" id="top">
      <div className="inset-0 overflow-hidden bg-ink-940 absolute">
        <Image className="hero-img inset-0 text-transparent h-full absolute w-full" src="/assets/hero-jet-arrival-v2.png" alt={d.hero.imageAlt} fill priority sizes="100vw" />
        {/* A blue dusk, not black. Desktop: the deepest blue behind the copy (white text needs it: about 5:1), lighter at the
            edges so the jet and van show, a deep navy at the bottom for the strip */}
        <div className="inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_48%,rgba(var(--ec-sky-rgb),0.8)_0%,rgba(var(--ec-sky-rgb),0.62)_60%,rgba(var(--ec-sky-rgb),0.22)_100%),linear-gradient(180deg,rgba(var(--ec-sky-rgb),0.4)_0%,rgba(var(--ec-sky-rgb),0)_30%,rgba(var(--ec-sky-rgb),0)_78%,rgba(var(--ec-deep-rgb),0.8)_100%)] absolute hidden md:block"></div>
        {/* Phones: the same blue behind the headline, lighter lower down so the vehicle stays visible */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(var(--ec-sky-rgb),0.84)_0%,rgba(var(--ec-sky-rgb),0.72)_45%,rgba(var(--ec-sky-rgb),0.22)_75%,rgba(var(--ec-deep-rgb),0.76)_100%)] md:hidden"></div>
      </div>
      <div className="relative mx-auto my-0 box-border flex w-full min-w-0 max-w-[1280px] flex-col items-center gap-4 px-4 pt-8 pb-8 text-center sm:px-6 md:gap-6 md:px-8 md:pt-12 md:pb-12 lg:gap-7 lg:pt-20 lg:pb-20 xl:pb-24 2xl:max-w-[1440px]">
        <h1 className="rise d2 mx-0 mt-1 mb-0 font-serif text-[clamp(28px,8vw,40px)] leading-[1.08] font-light tracking-[-0.01em] text-white md:mt-2 md:text-[clamp(40px,5.4vw,76px)] md:leading-[1.05]">
          {d.hero.headingBefore}{" "}
          <br className="hidden md:inline" />
          <em className="chrome-live-light block italic font-light md:inline">
            {d.hero.headingEmphasis}
          </em>
        </h1>
        <p className="rise d3 m-0 max-w-[34rem] text-[14px] leading-relaxed font-normal text-white [text-shadow:0_1px_12px_rgba(var(--ec-deep-rgb),0.7)] md:max-w-[620px] md:text-[17px] md:leading-normal md:font-light">
          {d.hero.intro}
        </p>
        {/* The booking bar. `enquire` is the anchor every "Request a quote" link on the site points to. Raised above the
            rest of the hero, so its suggestions and calendar open over the scroll cue and the strip below it */}
        <div id="enquire" className="rise d4 relative z-30 mt-2 w-full min-w-0 max-w-[1180px] scroll-mt-28 text-left">
          <Suspense
            fallback={
              <JourneyBar
                locale={locale}
                copy={d.booking}
                dateTimeCopy={d.dateTimePicker}
                messages={d.forms}
                tone="dark"
                action={localizedPath("/book", locale)}
              />
            }
          >
            <HeroJourneyBar
              locale={locale}
              copy={d.booking}
              dateTimeCopy={d.dateTimePicker}
              messages={d.forms}
              tone="dark"
              action={localizedPath("/book", locale)}
            />
          </Suspense>
        </div>
        {/* Outlined in white on dark glass, so it reads over any part of the photograph without competing with Continue */}
<div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          prefetch={false}
          className="rise d4 group inline-flex min-h-10 max-w-full items-center justify-center gap-2 rounded-full border-0 bg-[rgba(var(--ec-deep-rgb),0.5)] px-4 text-[10px] tracking-[0.12em] text-white uppercase no-underline ring-1 ring-white/85 backdrop-blur-sm transition-colors hover:bg-white hover:text-ink-950 hover:ring-white sm:min-h-[44px] sm:gap-3 sm:px-6 sm:text-[11px] sm:tracking-[0.24em]"
          href={localizedPath("/corporate-partner/login", locale)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="transition-colors group-hover:text-ink-950">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
          </svg>
          <span className="transition-colors group-hover:text-ink-950">{d.hero.corporateLogin}</span>
        </Link>
<AskConciergeLink className="rise d4 group inline-flex min-h-10 max-w-full items-center justify-center gap-2 rounded-full border border-solid border-white bg-white px-4 text-[10px] tracking-[0.12em] text-ink-950 uppercase no-underline transition-colors hover:bg-transparent hover:text-white sm:min-h-[44px] sm:gap-3 sm:px-6 sm:text-[11px] sm:tracking-[0.24em]">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M4 5h16v11H9l-5 4z"></path>
    </svg>
    <span>{d.hero.askConcierge}</span>
  </AskConciergeLink>
</div>
      </div>
      <div className="rise d4 pb-7 gap-3 items-center hidden flex-col relative md:flex">
        <span className="text-ink-100 text-[10px] tracking-[0.3em] [text-shadow:0_1px_8px_rgba(var(--ec-deep-rgb),0.85)]">
          {d.hero.scroll}
        </span>
        <span className="cue" aria-hidden="true"></span>
      </div>
      <div className="border-t border-t-white/15 relative bg-[rgba(var(--ec-deep-rgb),0.74)]">
        <div className="mx-auto my-0 flex max-w-[1280px] flex-col flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-4 text-center font-display text-[10px] tracking-[0.22em] text-ink-100 sm:px-6 md:flex-row md:items-center md:justify-between md:gap-x-6 md:px-8 md:py-4 md:text-[11px] md:tracking-[0.24em] lg:gap-x-8 lg:text-[12px] lg:tracking-[0.32em] xl:justify-between xl:text-start 2xl:max-w-[1440px]">
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