import Image from "next/image";
import { LanguageSwitcher } from "../language-switcher";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { localizedPath } from "@/lib/i18n/pathnames";

export async function SiteHeader() {
  const [d, locale] = await Promise.all([getDict(), currentLocale()]);
  return (
    <header className="sticky top-0 z-40 border-b border-ink-850 bg-ink-950/95 backdrop-blur-md">
      <div className="header-bar mx-auto my-0 flex max-w-[1440px] items-center gap-3 px-4 py-4 sm:gap-4 sm:px-6 md:px-8 xl:gap-5 xl:py-5">
        <input className="nav-toggle" type="checkbox" id="nav-toggle" aria-label={d.nav.menu} aria-controls="primary-nav" />

        <a className="relative z-10 flex shrink-0 items-center gap-2.5 no-underline xl:gap-3" href={localizedPath("/", locale)}>
          <Image className="h-10 w-10 md:h-11 md:w-11 xl:h-12 xl:w-12" src="/assets/logo-mark.png" alt="" width={48} height={48} sizes="48px" priority />
          <span className="flex flex-col gap-[2px]">
            <span className="chrome font-display text-[18px] font-medium tracking-[0.22em] max-[400px]:text-[15px] max-[400px]:tracking-[0.14em] max-[350px]:text-[13px] max-[350px]:tracking-[0.08em] md:text-[19px] md:tracking-[0.24em] xl:text-[21px] xl:tracking-[0.28em]">
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
          className="primary-nav flex min-w-0 flex-1 items-center justify-center gap-x-2.5 text-[12.5px] tracking-[0.06em] xl:gap-x-4 xl:text-[14px] xl:tracking-[0.1em] 2xl:gap-x-6 2xl:text-[15px] 2xl:tracking-[0.12em] [&_a]:shrink-0 [&_a]:whitespace-nowrap [&_a]:px-0.5 [&_a]:py-1 xl:[&_a]:px-1"
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

        <div className="nav-lang relative z-10 flex shrink-0 items-center">
          <LanguageSwitcher route="/" />
        </div>

        <div className="nav-actions relative z-10 flex shrink-0 items-center">
          <a
            className="inline-flex min-h-[40px] items-center border border-ink-250 px-3 text-[10px] tracking-[0.14em] text-white uppercase no-underline xl:min-h-[42px] xl:px-4 xl:text-[11px] xl:tracking-[0.18em]"
            href="#enquire"
          >
            {d.common.requestQuote}
          </a>
        </div>
      </div>
    </header>
  );
}
