import Link from "next/link";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { localizedPath } from "@/lib/i18n/pathnames";

export async function WhoWeServe() {
  const [locale, d] = await Promise.all([currentLocale(), getDict()]);
  return (
    <section className="border-b border-b-ink-850" id="corporate">
      <div className="py-20 px-5 my-0 mx-auto gap-12 flex flex-wrap max-w-[1280px] md:py-30 md:px-6 md:gap-20 2xl:max-w-[1440px]">
        <div className="gap-6 flex-[1_1_380px] flex flex-col min-w-0">
          <span className="reveal text-ink-450 font-display text-[12px] tracking-[0.3em] md:tracking-[0.42em]">
            {d.whoWeServe.eyebrow}
          </span>
          <h2 className="reveal m-0 text-white font-serif text-[clamp(32px,8.6vw,40px)] font-light leading-[1.08] md:text-[clamp(36px,4vw,52px)]">
            {d.whoWeServe.heading}
          </h2>
          <Link className="gap-3 border-b border-b-ink-450 no-underline items-center self-start text-white inline-flex text-[12px] tracking-[0.24em] min-h-[44px] uppercase" href={localizedPath("/corporate-partner", locale)}>
            {d.whoWeServe.cta}{" "}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6"></path>
            </svg>
          </Link>
        </div>
        <div className="flex-[999_1_560px] gap-x-12 grid grid-cols-[1fr] min-w-0 gap-y-0 md:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
          <div className="py-[18px] px-0 border-t border-t-ink-800 text-ink-50 font-serif text-[22px] md:py-[22px] md:px-0 md:text-[26px]">
            {d.whoWeServe.segmentExecutives}
          </div>
          <div className="py-[18px] px-0 border-t border-t-ink-800 text-ink-50 font-serif text-[22px] md:py-[22px] md:px-0 md:text-[26px]">
            {d.whoWeServe.segmentCorporate}
          </div>
          <div className="py-[18px] px-0 border-t border-t-ink-800 text-ink-50 font-serif text-[22px] md:py-[22px] md:px-0 md:text-[26px]">
            {d.whoWeServe.segmentPrivate}
          </div>
          <div className="py-[18px] px-0 border-t border-t-ink-800 text-ink-50 font-serif text-[22px] md:py-[22px] md:px-0 md:text-[26px]">
            {d.whoWeServe.segmentHotels}
          </div>
          <div className="py-[18px] px-0 border-t border-t-ink-800 border-b border-b-ink-800 text-ink-50 font-serif text-[22px] md:py-[22px] md:px-0 md:text-[26px]">
            {d.whoWeServe.segmentInternational}
          </div>
          <div className="py-[18px] px-0 border-t border-t-ink-800 border-b border-b-ink-800 text-ink-50 font-serif text-[22px] md:py-[22px] md:px-0 md:text-[26px]">
            {d.whoWeServe.segmentEvents}
          </div>
        </div>
      </div>
      <div className="px-5 pt-0 pb-20 my-0 mx-auto gap-8 grid grid-cols-[1fr] max-w-[1280px] md:px-6 md:pt-0 md:pb-30 md:grid-cols-[repeat(2,minmax(0px,1fr))] lg:grid-cols-[repeat(4,minmax(0px,1fr))] 2xl:max-w-[1440px]">
        <div className="reveal py-10 px-6 gap-3 border border-ink-800 items-center flex flex-col text-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C9C9CF" strokeWidth="1.2" aria-hidden="true">
            <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"></path>
            <path d="M4 20L20 4"></path>
          </svg>
          <span className="text-white font-display text-[14px] tracking-[0.32em]">
            {d.whoWeServe.valueDiscretion}
          </span>
          <span className="text-ink-400 text-[14px] font-light">
            {d.whoWeServe.valueDiscretionText}
          </span>
        </div>
        <div className="reveal py-10 px-6 gap-3 border border-ink-800 items-center flex flex-col text-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C9C9CF" strokeWidth="1.2" aria-hidden="true">
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M12 7v5l3 2"></path>
          </svg>
          <span className="text-white font-display text-[14px] tracking-[0.32em]">
            {d.whoWeServe.valuePunctuality}
          </span>
          <span className="text-ink-400 text-[14px] font-light">
            {d.whoWeServe.valuePunctualityText}
          </span>
        </div>
        <div className="reveal py-10 px-6 gap-3 border border-ink-800 items-center flex flex-col text-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C9C9CF" strokeWidth="1.2" aria-hidden="true">
            <path d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6L3.3 9.2l6.1-.6z"></path>
          </svg>
          <span className="text-white font-display text-[14px] tracking-[0.32em]">
            {d.whoWeServe.valueProfessionalism}
          </span>
          <span className="text-ink-400 text-[14px] font-light">
            {d.whoWeServe.valueProfessionalismText}
          </span>
        </div>
        <div className="reveal py-10 px-6 gap-3 border border-ink-800 items-center flex flex-col text-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C9C9CF" strokeWidth="1.2" aria-hidden="true">
            <circle cx="11" cy="11" r="6"></circle>
            <path d="M20 20l-4.5-4.5"></path>
          </svg>
          <span className="text-white font-display text-[14px] tracking-[0.32em]">
            {d.whoWeServe.valueDetail}
          </span>
          <span className="text-ink-400 text-[14px] font-light">
            {d.whoWeServe.valueDetailText}
          </span>
        </div>
      </div>
    </section>
  );
}
