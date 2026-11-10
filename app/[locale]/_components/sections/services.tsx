import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { localizedPath } from "@/lib/i18n/pathnames";
import { PictureAccordion, type PictureItem } from "../picture-accordion";

export async function Services() {
  const [locale, d] = await Promise.all([currentLocale(), getDict()]);
  const s = d.servicesSection;
  // Each service is a picture card that unfolds into its details. They book through the form; Corporate Accounts leads to the
  // Corporate Partner page instead. The pictures are 2000px wide (public/assets/service-*.jpg): stills from the client's showreel, and AI-generated
  // photographs for Business Travel (the arrival) and Close Protection.
  const quote = { label: d.common.requestQuote, href: "#enquire" };
  const items: PictureItem[] = [
    // The first two cards follow the client's notes of 11 Nov 2026: Airport Transfers became Business Travel (keeping the arrival
    // photograph), and Close Protection took the second place, its button leading to the close protection section (V) below.
    { key: "business", numeral: "I", title: s.businessTitle, text: s.businessText, points: [s.businessP1, s.businessP2, s.businessP3], image: "/assets/service-airport-v6.jpg", focus: "50% 50%", brightness: 1.15, cta: quote },
    { key: "protection", numeral: "II", title: s.protectionTitle, text: s.protectionText, points: [s.protectionP1, s.protectionP2, s.protectionP3], image: "/assets/service-protection-v1.jpg", focus: "62% 45%", brightness: 1.15, cta: { label: s.protectionCta, href: "#protection" } },
    { key: "corporate", numeral: "III", title: s.corporateTitle, text: s.corporateText, points: [s.corporateP1, s.corporateP2, s.corporateP3], image: "/assets/service-corporate-v5.jpg", focus: "62% 40%", brightness: 1.15, cta: { label: d.whoWeServe.cta, href: localizedPath("/corporate-partner", locale) } },
    { key: "private", numeral: "IV", title: s.privateTitle, text: s.privateText, points: [s.privateP1, s.privateP2, s.privateP3], image: "/assets/service-private-v5.jpg", focus: "52% 62%", brightness: 1.15, cta: quote },
    { key: "hotels", numeral: "V", title: s.hotelsTitle, text: s.hotelsText, points: [s.hotelsP1, s.hotelsP2, s.hotelsP3], image: "/assets/service-hotels-v5.jpg", focus: "60% 55%", brightness: 1.15, cta: quote },
    { key: "bespoke", numeral: "VI", title: s.bespokeTitle, text: s.bespokeText, points: [s.bespokeP1, s.bespokeP2, s.bespokeP3], image: "/assets/service-bespoke-v5.jpg", focus: "52% 62%", brightness: 1.15, cta: quote },
  ];
  return (
    <section className="border-b border-b-ink-850" id="services">
      <div className="mx-auto my-0 flex max-w-[1280px] flex-col gap-8 px-4 py-12 sm:px-6 md:gap-10 md:px-8 md:py-14 lg:py-16 2xl:max-w-[1440px]">
        <div className="flex flex-col items-center text-center">
          <div className="gap-4 flex flex-col max-w-[640px]">
            <span className="reveal text-white/80 font-display text-[12px] tracking-[0.3em] md:tracking-[0.42em]">{s.eyebrow}</span>
            <h2 className="reveal m-0 text-white font-serif text-[clamp(32px,8.6vw,40px)] font-light leading-[1.08] md:text-[clamp(36px,4vw,56px)]">
              {s.heading}
            </h2>
          </div>
        </div>
        <PictureAccordion items={items} variant="services" anchorPrefix="service" />
      </div>
    </section>
  );
}