export function SiteHeader() {
  return (
    <header className="border-b border-b-ink-850 relative z-[2]">
      <div className="py-4 px-5 my-0 mx-auto gap-0 items-center flex flex-wrap justify-between max-w-[1280px] xl:py-[22px] xl:px-6 xl:gap-5 2xl:max-w-[1440px]">
        <input className="nav-toggle" type="checkbox" id="nav-toggle" aria-label="Menu" aria-controls="primary-nav" />
        {" "}
        <a className="gap-[2px] no-underline flex flex-col" href="#top">
          <span className="chrome font-display text-[18px] font-medium tracking-[0.26em] md:text-[22px] md:tracking-[0.32em]">
            ECRAM EXECS
          </span>
          {" "}
          <span className="hidden text-ink-450 font-display text-[9px] tracking-[0.42em] md:block">
            THE ART OF EXECUTIVE HOSPITALITY
          </span>
        </a>
        <label className="nav-burger" htmlFor="nav-toggle" aria-label="Open menu">
          <span></span>
          <span></span>
          <span></span>
        </label>
        <nav className="primary-nav gap-8 flex flex-wrap text-[12px] tracking-[0.22em] uppercase" id="primary-nav" aria-label="Primary">
          <a className="navlink" href="#services">
            Services
          </a>
          <a className="navlink" href="#experience">
            The Experience
          </a>
          <a className="navlink" href="#fleet">
            Fleet
          </a>
          <a className="navlink" href="#netherlands">
            Destinations
          </a>
          <a className="navlink" href="#corporate">
            Corporate
          </a>
        </nav>
        <div className="nav-actions gap-5 items-center flex">
          <span className="text-ink-450 text-[12px] tracking-[0.2em]">
            EN{" "}
            <span className="text-ink-700">
              |
            </span>
            {" "}NL
          </span>
          {" "}
          <a className="py-0 px-[22px] border border-ink-250 no-underline items-center text-white inline-flex text-[11px] tracking-[0.24em] min-h-[44px] uppercase" href="#enquire">
            Request a quotation
          </a>
        </div>
      </div>
    </header>
  );
}
