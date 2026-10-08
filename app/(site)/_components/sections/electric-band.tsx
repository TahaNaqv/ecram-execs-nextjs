export function ElectricBand() {
  return (
    <section className="bg-ink-50 text-ink-950">
      <div className="py-20 px-5 my-0 mx-auto gap-10 items-center grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] max-w-[1280px] md:py-30 md:px-6 md:gap-16 2xl:max-w-[1440px]">
        <div className="gap-5 flex flex-col">
          <span className="text-ink-600 font-display text-[12px] tracking-[0.3em] md:tracking-[0.42em]">
            IV — ELECTRIC EXECUTIVE FLEET
          </span>
          <h2 className="reveal m-0 font-serif text-[clamp(32px,8.6vw,40px)] font-light leading-[1.08] md:text-[clamp(36px,4vw,56px)]">
            Sustainability and luxury need not be separate.
          </h2>
        </div>
        <div className="gap-6 flex flex-col">
          <p className="m-0 text-ink-650 text-[17px] font-light">
            As a Netherlands-based company we are building a modern, fully electric executive fleet — contributing, where we can, to the Dutch transition towards cleaner, future-focused mobility. Electric drive brings a quieter, smoother journey: precisely the calm our service is built on.
          </p>
          <p className="m-0 text-ink-950 font-display text-[14px] tracking-[0.3em] md:tracking-[0.42em]">
            QUIET. REFINED. ELECTRIC.
          </p>
        </div>
      </div>
    </section>
  );
}
