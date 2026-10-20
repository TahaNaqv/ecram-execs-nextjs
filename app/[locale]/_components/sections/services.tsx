import Link from "next/link";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { localizedPath } from "@/lib/i18n/pathnames";

export async function Services() {
  const [locale, d] = await Promise.all([currentLocale(), getDict()]);
  const s = d.servicesSection;
  // Every card is one link. Most lead to the booking form; Corporate Accounts leads to the Corporate Partner page.
  const cards = [
    { numeral: "I", title: s.airportTitle, text: s.airportText, href: "#enquire" },
    { numeral: "II", title: s.businessTitle, text: s.businessText, href: "#enquire" },
    { numeral: "III", title: s.corporateTitle, text: s.corporateText, href: localizedPath("/corporate-partner", locale) },
    { numeral: "IV", title: s.privateTitle, text: s.privateText, href: "#enquire" },
    { numeral: "V", title: s.hotelsTitle, text: s.hotelsText, href: "#enquire" },
    { numeral: "VI", title: s.bespokeTitle, text: s.bespokeText, href: "#enquire" },
  ];
  return (
    <section className="border-b border-b-ink-850" id="services">
      <div className="py-20 px-5 my-0 mx-auto gap-10 flex flex-col max-w-[1280px] md:py-30 md:px-6 md:gap-14 2xl:max-w-[1440px]">
        <div className="gap-6 items-end flex flex-wrap justify-between">
          <div className="gap-4 flex flex-col max-w-[640px]">
            <span className="reveal text-ink-450 font-display text-[12px] tracking-[0.3em] md:tracking-[0.42em]">{s.eyebrow}</span>
            <h2 className="reveal m-0 text-white font-serif text-[clamp(32px,8.6vw,40px)] font-light leading-[1.08] md:text-[clamp(36px,4vw,56px)]">
              {s.heading}
            </h2>
          </div>
        </div>
        <div className="gap-px border border-ink-825 bg-ink-825 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            // The whole card is the link (not a stretched pseudo-element inside it): the heading slides sideways on hover,
            // and a transformed ancestor would shrink a stretched link to the heading's own box.
            <Link
              key={c.numeral}
              href={c.href}
              className="card reveal py-8 px-6 gap-4 bg-ink-950 flex flex-col min-h-0 no-underline md:py-10 md:px-9 md:min-h-[280px]"
            >
              <span className="chrome font-display text-[22px]">{c.numeral}</span>
              <h3 className="m-0 text-white font-serif text-[26px] font-normal md:text-[30px]">{c.title}</h3>
              <p className="m-0 text-ink-400 text-[15px] font-light">{c.text}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
