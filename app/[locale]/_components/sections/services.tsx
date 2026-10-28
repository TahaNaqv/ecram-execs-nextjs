import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { localizedPath } from "@/lib/i18n/pathnames";
import { PictureAccordion, type PictureItem } from "../picture-accordion";

export async function Services() {
  const [locale, d] = await Promise.all([currentLocale(), getDict()]);
  const s = d.servicesSection;
  // Each service is a picture card that unfolds into its details. They book through the form; Corporate Accounts leads to the
  // Corporate Partner page instead. The pictures are stills from the client's showreel, 2000px wide (public/assets/service-*-v4/v5.jpg).
  const quote = { label: d.common.requestQuote, href: "#enquire" };
  const items: PictureItem[] = [
    { key: "airport", numeral: "I", title: s.airportTitle, text: s.airportText, points: [s.airportP1, s.airportP2, s.airportP3], image: "/assets/service-airport-v5.jpg", focus: "42% 50%", brightness: 1.15, cta: quote },
    { key: "business", numeral: "II", title: s.businessTitle, text: s.businessText, points: [s.businessP1, s.businessP2, s.businessP3], image: "/assets/service-business-v5.jpg", focus: "62% 42%", brightness: 1.15, cta: quote },
    { key: "corporate", numeral: "III", title: s.corporateTitle, text: s.corporateText, points: [s.corporateP1, s.corporateP2, s.corporateP3], image: "/assets/service-corporate-v5.jpg", focus: "62% 40%", brightness: 1.15, cta: { label: d.whoWeServe.cta, href: localizedPath("/corporate-partner", locale) } },
    { key: "private", numeral: "IV", title: s.privateTitle, text: s.privateText, points: [s.privateP1, s.privateP2, s.privateP3], image: "/assets/service-private-v5.jpg", focus: "52% 62%", brightness: 1.15, cta: quote },
    { key: "hotels", numeral: "V", title: s.hotelsTitle, text: s.hotelsText, points: [s.hotelsP1, s.hotelsP2, s.hotelsP3], image: "/assets/service-hotels-v5.jpg", focus: "60% 55%", brightness: 1.15, cta: quote },
    { key: "bespoke", numeral: "VI", title: s.bespokeTitle, text: s.bespokeText, points: [s.bespokeP1, s.bespokeP2, s.bespokeP3], image: "/assets/service-bespoke-v5.jpg", focus: "52% 62%", brightness: 1.15, cta: quote },
  ];
  return (
    <section className="border-b border-b-ink-850" id="services">
      <div className="py-12 px-5 my-0 mx-auto gap-10 flex flex-col max-w-[1280px] md:py-16 md:px-6 md:gap-14 2xl:max-w-[1440px]">
        <div className="gap-6 items-end flex flex-wrap justify-between">
          <div className="gap-4 flex flex-col max-w-[640px]">
            <span className="reveal text-white/80 font-display text-[12px] tracking-[0.3em] md:tracking-[0.42em]">{s.eyebrow}</span>
            <h2 className="reveal m-0 text-white font-serif text-[clamp(32px,8.6vw,40px)] font-light leading-[1.08] md:text-[clamp(36px,4vw,56px)]">
              {s.heading}
            </h2>
          </div>
        </div>
        <PictureAccordion items={items} variant="services" />
      </div>
    </section>
  );
}
