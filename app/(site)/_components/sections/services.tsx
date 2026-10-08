export function Services() {
  return (
    <section className="border-b border-b-ink-850" id="services">
      <div className="py-20 px-5 my-0 mx-auto gap-10 flex flex-col max-w-[1280px] md:py-30 md:px-6 md:gap-14 2xl:max-w-[1440px]">
        <div className="gap-6 items-end flex flex-wrap justify-between">
          <div className="gap-4 flex flex-col max-w-[640px]">
            <span className="reveal text-ink-450 font-display text-[12px] tracking-[0.3em] md:tracking-[0.42em]">
              I — SERVICES
            </span>
            <h2 className="reveal m-0 text-white font-serif text-[clamp(32px,8.6vw,40px)] font-light leading-[1.08] md:text-[clamp(36px,4vw,56px)]">
              Executive chauffeur services, end to end.
            </h2>
          </div>
          <p className="m-0 text-ink-400 font-light max-w-[420px]">
            Professionalism, punctuality, discretion and attention to detail — whether you are travelling for business or for leisure.
          </p>
        </div>
        <div className="gap-px border border-ink-825 bg-ink-825 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
          <article className="card reveal py-8 px-6 gap-4 bg-ink-950 flex flex-col min-h-0 md:py-10 md:px-9 md:min-h-[280px]">
            <span className="chrome font-display text-[22px]">
              I
            </span>
            <h3 className="m-0 text-white font-serif text-[26px] font-normal md:text-[30px]">
              Airport transfers
            </h3>
            <p className="m-0 text-ink-400 text-[15px] font-light">
              Flight-tracked collections at Schiphol, Rotterdam The Hague and Eindhoven. Met in arrivals, luggage handled, straight to the cabin.
            </p>
          </article>
          <article className="card reveal py-8 px-6 gap-4 bg-ink-950 flex flex-col min-h-0 md:py-10 md:px-9 md:min-h-[280px]">
            <span className="chrome font-display text-[22px]">
              II
            </span>
            <h3 className="m-0 text-white font-serif text-[26px] font-normal md:text-[30px]">
              Business travel
            </h3>
            <p className="m-0 text-ink-400 text-[15px] font-light">
              Meetings, roadshows and site visits, with a chauffeur who waits as directed. A quiet cabin in which to prepare, call or rest.
            </p>
          </article>
          <article className="card reveal py-8 px-6 gap-4 bg-ink-950 flex flex-col min-h-0 md:py-10 md:px-9 md:min-h-[280px]">
            <span className="chrome font-display text-[22px]">
              III
            </span>
            <h3 className="m-0 text-white font-serif text-[26px] font-normal md:text-[30px]">
              Corporate accounts
            </h3>
            <p className="m-0 text-ink-400 text-[15px] font-light">
              A single point of contact for your organisation, consolidated invoicing and dependable cover for executives and guests.
            </p>
          </article>
          <article className="card reveal py-8 px-6 gap-4 bg-ink-950 flex flex-col min-h-0 md:py-10 md:px-9 md:min-h-[280px]">
            <span className="chrome font-display text-[22px]">
              IV
            </span>
            <h3 className="m-0 text-white font-serif text-[26px] font-normal md:text-[30px]">
              Private occasions
            </h3>
            <p className="m-0 text-ink-400 text-[15px] font-light">
              Weddings, celebrations and evenings out, attended to with the same composure as a board meeting.
            </p>
          </article>
          <article className="card reveal py-8 px-6 gap-4 bg-ink-950 flex flex-col min-h-0 md:py-10 md:px-9 md:min-h-[280px]">
            <span className="chrome font-display text-[22px]">
              V
            </span>
            <h3 className="m-0 text-white font-serif text-[26px] font-normal md:text-[30px]">
              Hotels &amp; concierge
            </h3>
            <p className="m-0 text-ink-400 text-[15px] font-light">
              A trusted partner for hotels and concierge desks welcoming international guests to the Netherlands.
            </p>
          </article>
          <article className="card reveal py-8 px-6 gap-4 bg-ink-950 flex flex-col min-h-0 md:py-10 md:px-9 md:min-h-[280px]">
            <span className="chrome font-display text-[22px]">
              VI
            </span>
            <h3 className="m-0 text-white font-serif text-[26px] font-normal md:text-[30px]">
              Bespoke programmes
            </h3>
            <p className="m-0 text-ink-400 text-[15px] font-light">
              Multi-day delegations, events and itineraries planned around your requirements, not ours.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
