import Image from "next/image";
import { LanguageSwitcher } from "../language-switcher";
import { getDict } from "@/lib/i18n/get-dictionary";

export async function SiteHeader() {
  const d = await getDict();
  return (
    <header className="sticky top-0 z-40 border-b border-ink-850 bg-ink-950/95 backdrop-blur-md">
      <div className="py-4 px-4 my-0 mx-auto gap-2 items-center flex flex-wrap justify-between max-w-[1280px] lg:px-6 lg:gap-3 xl:py-[22px] xl:px-6 xl:gap-5 2xl:max-w-[1440px]">
        <input className="nav-toggle" type="checkbox" id="nav-toggle" aria-label={d.nav.menu} aria-controls="primary-nav" />
        {" "}
        <a className="gap-3 no-underline flex items-center shrink-0" href="#top">
          <Image className="h-10 w-10 md:h-12 md:w-12" src="/assets/logo-mark.png" alt="" width={48} height={48} sizes="48px" priority />
          <span className="gap-[2px] flex flex-col">
          <span className="chrome font-display text-[18px] font-medium tracking-[0.26em] max-[400px]:text-[15px] max-[400px]:tracking-[0.14em] max-[350px]:text-[13px] max-[350px]:tracking-[0.08em] md:text-[22px] md:tracking-[0.32em]">
            ECRAM EXECS
          </span>
          {" "}
          <span className="hidden text-ink-450 font-display text-[9px] tracking-[0.42em] 2xl:block">
            {d.nav.tagline}
          </span>
          </span>
        </a>
        <label className="nav-burger" htmlFor="nav-toggle" aria-label={d.nav.openMenu}>
          <span></span>
          <span></span>
          <span></span>
        </label>
        <nav className="primary-nav gap-3 lg:gap-3.5 xl:gap-5 flex flex-wrap text-[13px] lg:text-[13px] xl:text-[14px] tracking-[0.02em] shrink" id="primary-nav" aria-label={d.nav.primaryLabel}>
          <a className="navlink" href="#corporate">
            {d.nav.corporate}
          </a>
          <a className="navlink" href="#fleet">
            {d.nav.fleet}
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
        </nav>
        <div className="nav-lang flex items-center shrink-0">
          <LanguageSwitcher route="/" />
        </div>
        <div className="nav-actions gap-5 items-center flex shrink-0">
          <a className="py-0 px-3 lg:px-[14px] xl:px-[18px] border border-ink-250 no-underline items-center text-white inline-flex text-[10px] lg:text-[10.5px] xl:text-[11px] tracking-[0.18em] xl:tracking-[0.22em] min-h-[38px] xl:min-h-[42px] uppercase" href="#enquire">
            {d.common.requestQuote}
          </a>
        </div>
      </div>
    </header>
  );
}