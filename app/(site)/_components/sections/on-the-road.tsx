export function OnTheRoad() {
  return (
    <section className="border-b border-b-ink-850">
      <div className="py-18 px-5 my-0 mx-auto gap-8 items-center flex flex-col flex-wrap justify-center max-w-[1080px] text-center md:py-25 md:px-6 md:gap-12 md:text-left md:flex-row">
        <div className="flex-none items-center flex h-40 justify-center relative w-40">
          <span className="orbit" aria-hidden="true"></span>
          <div className="border border-ink-700 rounded-full items-center flex h-28 justify-center w-28">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#C9C9CF" strokeWidth="1.1" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
              <path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2"></path>
            </svg>
          </div>
        </div>
        <div className="gap-[14px] flex-auto items-center flex flex-col min-w-0 md:flex-[1_1_420px] md:items-stretch">
          <span className="reveal text-ink-450 font-display text-[12px] tracking-[0.3em] md:tracking-[0.42em]">
            SEEN US ON THE ROAD?
          </span>
          <p className="m-0 text-white font-serif text-[26px] font-light leading-[1.2] md:text-[32px]">
            Welcome. You found us through the emblem at the heart of our wings — every Ecram vehicle carries one.
          </p>
        </div>
      </div>
    </section>
  );
}
