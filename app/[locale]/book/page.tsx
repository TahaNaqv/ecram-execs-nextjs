import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { FLEET } from "@/lib/fleet/vehicles";
import { LOCALES } from "@/lib/i18n/config";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { localizedPath, unprefixedPath } from "@/lib/i18n/pathnames";
import { PublicBooking } from "../_components/booking/public-booking";
import { LanguageSwitcher } from "../_components/language-switcher";
import { SiteFooter } from "../_components/sections";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const d = await getDict();
  return {
    title: d.booking.pageTitle,
    description: d.booking.pageDescription,
    alternates: {
      canonical: localizedPath("/book", locale),
      languages: { ...Object.fromEntries(LOCALES.map((l) => [l, localizedPath("/book", l)])), "x-default": unprefixedPath("/book") },
    },
  };
}

/** Every car is offered here; the flow itself asks which ones the team has switched off (see the comment in PublicBooking). */
const FLEET_OFFER = FLEET.map(({ key, name }) => ({ key, name }));

/**
 * The booking flow after the hero's bar: choose a car, then who is travelling, then send. The trip comes in the query
 * string, so the page's shell is static and the flow renders once the URL is known.
 */
export default async function BookPage() {
  const [locale, d] = await Promise.all([currentLocale(), getDict()]);
  const t = d.booking;
  return (
    <div className="min-h-svh bg-ink-950 font-sans leading-[1.6] text-ink-150">
      <a className="skip-link" href="#main">
        {d.common.skipToContent}
      </a>
      <header className="sticky top-0 z-40 border-b border-ink-850 bg-ink-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-5 py-[18px] md:px-6 2xl:max-w-[1440px]">
          <Link href={localizedPath("/", locale)} className="chrome inline-flex items-center gap-2 font-display text-[15px] tracking-[0.2em] whitespace-nowrap no-underline md:gap-3 md:text-[22px] md:tracking-[0.32em]">
            <Image className="h-10 w-10 md:h-12 md:w-12" src="/assets/logo-mark.png" alt="" width={48} height={48} />
            <span className="max-sm:sr-only">ECRAM EXECS</span>
          </Link>
          <LanguageSwitcher route="/book" />
        </div>
      </header>
      <main id="main" className="light-surface bg-ink-50 text-ink-950">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-5 pt-8 pb-16 md:px-6 md:pt-10 2xl:max-w-[1440px]">
          <Suspense fallback={<div className="min-h-[60svh]" aria-busy="true" />}>
            <PublicBooking
              locale={locale}
              copy={t}
              dateTimeCopy={d.dateTimePicker}
              messages={d.forms}
              fleetDict={d.fleetSection}
              vehicleAdvise={d.quoteForm.vehicleAdvise}
              vehicles={FLEET_OFFER}
              bookPath={localizedPath("/book", locale)}
              privacyHref={localizedPath("/privacy", locale)}
            />
          </Suspense>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
