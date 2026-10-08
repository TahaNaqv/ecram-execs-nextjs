export function Experience() {
  return (
    <section className="border-b border-b-ink-850" id="experience">
      <div className="py-20 px-5 my-0 mx-auto gap-10 flex flex-col max-w-[1280px] md:py-30 md:px-6 md:gap-14 2xl:max-w-[1440px]">
        <div className="gap-4 items-center flex flex-col text-center">
          <span className="reveal text-ink-450 font-display text-[12px] tracking-[0.3em] md:tracking-[0.42em]">
            II — THE EXPERIENCE
          </span>
          <h2 className="reveal m-0 text-white font-serif text-[clamp(32px,8.6vw,40px)] font-light leading-[1.08] md:text-[clamp(36px,4vw,56px)]">
            The arrival, as you will see it.
          </h2>
        </div>
        <div className="ph p-5 gap-[10px] items-start aspect-[4/5] flex-col justify-end relative w-full md:p-7 md:items-end md:aspect-[21/9] md:justify-between md:gap-0 md:flex-row">
          <span className="text-ink-550 text-[10px] tracking-[0.18em] max-w-full uppercase md:text-[11px] md:tracking-[0.24em] md:max-w-none">
            Brand film — guest collected by a VLE 300 Electric, shot from the client&apos;s perspective
          </span>
          <button className="top-1/2 left-1/2 border border-ink-250 rounded-full items-center bg-transparent text-white cursor-default flex h-19 justify-center absolute [transform:translate(-50%,-50%)] w-19 md:h-24 md:w-24" type="button" disabled aria-label="Brand film coming soon" title="Brand film coming soon">
            <span className="ring" aria-hidden="true"></span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <path d="M8 5l11 7-11 7z"></path>
            </svg>
          </button>
          <span className="text-ink-450 font-display text-[11px] tracking-[0.32em]">
            02:10
          </span>
        </div>
        <ol className="p-0 m-0 gap-6 list-none grid grid-cols-[1fr] md:gap-8 md:grid-cols-[repeat(2,minmax(0px,1fr))] lg:grid-cols-[repeat(5,minmax(0px,1fr))]">
          <li className="reveal pt-5 gap-[10px] border-t border-t-ink-700 flex flex-col">
            <span className="text-ink-450 font-display text-[12px] tracking-[0.3em]">
              01
            </span>
            <span className="text-white font-serif text-[24px]">
              The arrival
            </span>
            <span className="text-ink-400 text-[14px] font-light">
              Your vehicle is in place before you are, without fuss.
            </span>
          </li>
          <li className="reveal pt-5 gap-[10px] border-t border-t-ink-700 flex flex-col">
            <span className="text-ink-450 font-display text-[12px] tracking-[0.3em]">
              02
            </span>
            <span className="text-white font-serif text-[24px]">
              The greeting
            </span>
            <span className="text-ink-400 text-[14px] font-light">
              A personal welcome from a chauffeur who knows your name and your plans.
            </span>
          </li>
          <li className="reveal pt-5 gap-[10px] border-t border-t-ink-700 flex flex-col">
            <span className="text-ink-450 font-display text-[12px] tracking-[0.3em]">
              03
            </span>
            <span className="text-white font-serif text-[24px]">
              Your luggage
            </span>
            <span className="text-ink-400 text-[14px] font-light">
              Taken care of, from the kerb to the boot and back again.
            </span>
          </li>
          <li className="reveal pt-5 gap-[10px] border-t border-t-ink-700 flex flex-col">
            <span className="text-ink-450 font-display text-[12px] tracking-[0.3em]">
              04
            </span>
            <span className="text-white font-serif text-[24px]">
              The cabin
            </span>
            <span className="text-ink-400 text-[14px] font-light">
              Settle into a silent, lounge-like interior prepared for you.
            </span>
          </li>
          <li className="reveal pt-5 gap-[10px] border-t border-t-ink-700 col-[1/-1] flex flex-col lg:col-auto">
            <span className="text-ink-450 font-display text-[12px] tracking-[0.3em]">
              05
            </span>
            <span className="text-white font-serif text-[24px]">
              The journey
            </span>
            <span className="text-ink-400 text-[14px] font-light">
              Work, talk or simply rest. We take care of everything else.
            </span>
          </li>
        </ol>
      </div>
    </section>
  );
}
