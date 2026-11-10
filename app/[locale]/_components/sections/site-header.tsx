import Image from "next/image";
import { LanguageSwitcher } from "../language-switcher";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { localizedPath } from "@/lib/i18n/pathnames";

export async function SiteHeader() {
  const [d, locale] = await Promise.all([getDict(), currentLocale()]);
  return (
    <header className="sticky top-0 z-40 border-b border-ink-850 bg-ink-950/95 backdrop-blur-md">
      <div className="header-bar mx-auto my-0 flex max-w-[1280px] items-center gap-4 px-4 py-4 sm:px-6 md:px-8 xl:gap-6 xl:py-5 2xl:max-w-[1440px]">
        <input className="nav-toggle" type="checkbox" id="nav-toggle" aria-label={d.nav.menu} aria-controls="primary-nav" />

        <a className="flex shrink-0 items-center gap-3 no-underline" href={localizedPath("/", locale)}>
          <Image className="h-10 w-10 md:h-12 md:w-12" src="/assets/logo-mark.png" alt="" width={48} height={48} sizes="48px" priority />
          <span className="flex flex-col gap-[2px]">
            <span className="chrome font-display text-[18px] font-medium tracking-[0.26em] max-[400px]:text-[15px] max-[400px]:tracking-[0.14em] max-[350px]:text-[13px] max-[350px]:tracking-[0.08em] md:text-[22px] md:tracking-[0.32em]">
              ECRAM EXECS
            </span>
            <span className="hidden font-display text-[9px] tracking-[0.42em] text-ink-450 2xl:block">{d.nav.tagline}</span>
          </span>
        </a>

        <label className="nav-burger" htmlFor="nav-toggle" aria-label={d.nav.openMenu}>
          <span></span>
          <span></span>
          <span></span>
        </label>

        <nav
          className="primary-nav flex min-w-0 flex-1 items-center justify-center gap-x-5 text-[15px] tracking-[0.12em] xl:gap-x-6 xl:text-[16px] xl:tracking-[0.14em] 2xl:gap-x-8 2xl:text-[17px] 2xl:tracking-[0.16em] [&_a]:whitespace-nowrap [&_a]:px-1.5 [&_a]:py-1"
          id="primary-nav"
          aria-label={d.nav.primaryLabel}
        >
          <a className="navlink" href="#corporate">
            {d.nav.corporate}
          </a>
          <a className="navlink" href="#experience">
            {d.nav.experience}
          </a>
          <a className="navlink" href="#netherlands">
            {d.nav.destinations}
          </a>
          <a className="navlink" href="#services">
            {d.nav.services}
          </a>
          <a className="navlink" href="#protection">
            {d.nav.protection}
          </a>
          <a className="navlink" href="#concierge">
            {d.nav.concierge}
          </a>
        </nav>

        <div className="nav-lang flex shrink-0 items-center">
          <LanguageSwitcher route="/" />
        </div>

        <div className="nav-actions flex shrink-0 items-center">
          <a
            className="inline-flex min-h-[40px] items-center border border-ink-250 px-4 text-[11px] tracking-[0.2em] text-white uppercase no-underline xl:min-h-[42px] xl:px-5 xl:tracking-[0.22em]"
            href="#enquire"
          >
            {d.common.requestQuote}
          </a>
        </div>
      </div>
    </header>
  );
}
