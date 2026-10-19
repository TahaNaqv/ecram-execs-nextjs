import Image from "next/image";
import Link from "next/link";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { localizedPath } from "@/lib/i18n/pathnames";

export async function WhoWeServe() {
  const [locale, d] = await Promise.all([currentLocale(), getDict()]);
  const w = d.whoWeServe;
  // The picture that fades in behind each audience when the pointer rests on it. The `serve-*` files are
  // resized copies of the client's photographs; the other three are destination photos (Rotterdam, Utrecht,
  // Amsterdam). Decorative only: the heading and text beside them already say who it is for.
  const segments = [
    [w.segmentExecutives, w.segmentExecutivesText, "/assets/serve-executives-v1.jpg", "50% 50%"],
    [w.segmentCorporate, w.segmentCorporateText, "/assets/c01091ac467f57c8ccacd1d28b8caa6f.jpg", "60% 62%"],
    [w.segmentPrivate, w.segmentPrivateText, "/assets/serve-private-v1.jpg", "50% 50%"],
    [w.segmentHotels, w.segmentHotelsText, "/assets/d38555c6a11a07329e901cbb09fa90bb.jpg", "50% 60%"],
    [w.segmentInternational, w.segmentInternationalText, "/assets/52de87fce1028743a6cc606de596dd57.jpg", "50% 55%"],
    [w.segmentEvents, w.segmentEventsText, "/assets/serve-events-v1.jpg", "50% 50%"],
  ] as const;
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
          <Link className="btn-fill mt-2 py-0 px-[34px] gap-3 no-underline items-center self-start bg-ink-50 text-ink-950 inline-flex text-[12px] font-semibold tracking-[0.24em] min-h-[52px] uppercase" href={localizedPath("/corporate-partner", locale)}>
            {d.whoWeServe.cta}{" "}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6"></path>
            </svg>
          </Link>
        </div>
        <ul className="flex-[999_1_560px] gap-x-12 grid grid-cols-[1fr] min-w-0 gap-y-0 p-0 m-0 list-none md:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
          {segments.map(([title, text, image, focus]) => (
            // The picture exists only where a pointer can hover: on touch screens it would never be seen, and
            // `display: none` keeps the browser from downloading it. It reaches 16px past the text on each side
            // so the words keep a margin inside it.
            <li key={title} className="group relative isolate py-6 px-0 gap-2 border-t border-t-ink-800 flex flex-col">
              <div
                className="pointer-events-none absolute inset-y-0 -inset-x-4 -z-10 hidden overflow-hidden opacity-0 [@media(hover:hover)]:block transition-opacity duration-500 group-hover:opacity-100"
                aria-hidden="true"
              >
                <Image
                  className="object-cover scale-110 transition-transform duration-[900ms] ease-out group-hover:scale-100 motion-reduce:scale-100 motion-reduce:transition-none"
                  style={{ objectPosition: focus }}
                  src={image}
                  alt=""
                  fill
                  sizes="(min-width: 1280px) 320px, (min-width: 768px) 30vw, 100vw"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,11,0.76)_0%,rgba(10,10,11,0.88)_100%)]"></div>
              </div>
              <h3 className="m-0 text-ink-50 font-serif text-[22px] font-normal md:text-[26px]">{title}</h3>
              <p className="m-0 text-ink-400 text-[14px] font-light transition-colors duration-500 group-hover:text-ink-150">{text}</p>
            </li>
          ))}
        </ul>
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
