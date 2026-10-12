import { getDict } from "@/lib/i18n/get-dictionary";

export async function Services() {
  const d = await getDict();
  return (
    <section className="border-b border-b-ink-850" id="services">
      <div className="py-20 px-5 my-0 mx-auto gap-10 flex flex-col max-w-[1280px] md:py-30 md:px-6 md:gap-14 2xl:max-w-[1440px]">
        <div className="gap-6 items-end flex flex-wrap justify-between">
          <div className="gap-4 flex flex-col max-w-[640px]">
            <span className="reveal text-ink-450 font-display text-[12px] tracking-[0.3em] md:tracking-[0.42em]">
              {d.servicesSection.eyebrow}
            </span>
            <h2 className="reveal m-0 text-white font-serif text-[clamp(32px,8.6vw,40px)] font-light leading-[1.08] md:text-[clamp(36px,4vw,56px)]">
              {d.servicesSection.heading}
            </h2>
          </div>
          <p className="m-0 text-ink-400 font-light max-w-[420px]">
            {d.servicesSection.intro}
          </p>
        </div>
        <div className="gap-px border border-ink-825 bg-ink-825 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          <article className="card reveal py-8 px-6 gap-4 bg-ink-950 flex flex-col min-h-0 md:py-10 md:px-9 md:min-h-[280px]">
            <span className="chrome font-display text-[22px]">
              I
            </span>
            <h3 className="m-0 text-white font-serif text-[26px] font-normal md:text-[30px]">
              {d.servicesSection.airportTitle}
            </h3>
            <p className="m-0 text-ink-400 text-[15px] font-light">
              {d.servicesSection.airportText}
            </p>
          </article>
          <article className="card reveal py-8 px-6 gap-4 bg-ink-950 flex flex-col min-h-0 md:py-10 md:px-9 md:min-h-[280px]">
            <span className="chrome font-display text-[22px]">
              II
            </span>
            <h3 className="m-0 text-white font-serif text-[26px] font-normal md:text-[30px]">
              {d.servicesSection.businessTitle}
            </h3>
            <p className="m-0 text-ink-400 text-[15px] font-light">
              {d.servicesSection.businessText}
            </p>
          </article>
          <article className="card reveal py-8 px-6 gap-4 bg-ink-950 flex flex-col min-h-0 md:py-10 md:px-9 md:min-h-[280px]">
            <span className="chrome font-display text-[22px]">
              III
            </span>
            <h3 className="m-0 text-white font-serif text-[26px] font-normal md:text-[30px]">
              {d.servicesSection.corporateTitle}
            </h3>
            <p className="m-0 text-ink-400 text-[15px] font-light">
              {d.servicesSection.corporateText}
            </p>
          </article>
          <article className="card reveal py-8 px-6 gap-4 bg-ink-950 flex flex-col min-h-0 md:py-10 md:px-9 md:min-h-[280px]">
            <span className="chrome font-display text-[22px]">
              IV
            </span>
            <h3 className="m-0 text-white font-serif text-[26px] font-normal md:text-[30px]">
              {d.servicesSection.privateTitle}
            </h3>
            <p className="m-0 text-ink-400 text-[15px] font-light">
              {d.servicesSection.privateText}
            </p>
          </article>
          <article className="card reveal py-8 px-6 gap-4 bg-ink-950 flex flex-col min-h-0 md:py-10 md:px-9 md:min-h-[280px]">
            <span className="chrome font-display text-[22px]">
              V
            </span>
            <h3 className="m-0 text-white font-serif text-[26px] font-normal md:text-[30px]">
              {d.servicesSection.hotelsTitle}
            </h3>
            <p className="m-0 text-ink-400 text-[15px] font-light">
              {d.servicesSection.hotelsText}
            </p>
          </article>
          <article className="card reveal relative py-8 px-6 gap-4 bg-ink-950 flex flex-col min-h-0 md:py-10 md:px-9 md:min-h-[280px]">
            <span className="chrome font-display text-[22px]">
              VI
            </span>
            <h3 className="m-0 text-white font-serif text-[26px] font-normal md:text-[30px]">
              <a className="text-inherit no-underline after:absolute after:inset-0 after:content-['']" href="#bespoke">
                {d.servicesSection.bespokeTitle}
              </a>
            </h3>
            <p className="m-0 text-ink-400 text-[15px] font-light">
              {d.servicesSection.bespokeText}
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
