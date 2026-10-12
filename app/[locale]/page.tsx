import type { Metadata } from "next";
import { siteConfig, socialLinks } from "@/lib/site-config";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { localizedPath, unprefixedPath } from "@/lib/i18n/pathnames";
import { NavAutoClose } from "./_components/nav-auto-close";
import { BackToTop } from "./_components/back-to-top";
import {
  Concierge,
  Destinations,
  ElectricBand,
  Enquiry,
  Experience,
  FinalCta,
  Fleet,
  Hero,
  OnTheRoad,
  RegionsMarquee,
  Services,
  SiteFooter,
  SiteHeader,
  Statement,
  WhoWeServe,
} from "./_components/sections";

const siteUrl = process.env.SITE_URL ?? "https://ecramexecs.vercel.app";
const profileUrls = socialLinks.map(([, url]) => url).filter((url) => url.startsWith("http"));

// Structured data so search engines understand the business (fields are only included once filled in)
const buildJsonLd = (locale: Locale, description: string) => ({
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${siteUrl}/#business`,
  name: siteConfig.name,
  slogan: siteConfig.tagline[locale],
  description,
  inLanguage: locale,
  url: localizedPath("/", locale) === "/" + locale ? `${siteUrl}/${locale}` : siteUrl,
  logo: `${siteUrl}/icon.png`,
  image: `${siteUrl}/assets/og-image-v2.jpg`,
  areaServed: { "@type": "Country", name: "Netherlands" },
  ...(siteConfig.contact.phone ? { telephone: siteConfig.contact.phone } : {}),
  ...(siteConfig.contact.email ? { email: siteConfig.contact.email } : {}),
  ...(siteConfig.contact.address
    ? { address: { "@type": "PostalAddress", streetAddress: siteConfig.contact.address, addressCountry: "NL" } }
    : {}),
  ...(profileUrls.length ? { sameAs: profileUrls } : {}),
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  return {
    alternates: {
      canonical: localizedPath("/", locale),
      languages: { ...Object.fromEntries(LOCALES.map((l) => [l, localizedPath("/", l)])), "x-default": unprefixedPath("/") },
    },
  };
}

export default async function HomePage() {
  const [locale, d] = await Promise.all([currentLocale(), getDict()]);
  const jsonLd = buildJsonLd(locale, d.meta.description);

  return (
    <div className="motion-full bg-ink-950 text-ink-150 font-sans text-[16px] font-normal leading-[1.6] w-full"
     
     
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <a className="skip-link" href="#main">
        {d.common.skipToContent}
      </a>
      <SiteHeader />
      <main id="main">
        <Hero />
        <Enquiry />
        <Statement />
        <Services />
        <Experience />
        <Fleet />
        <ElectricBand />
        <RegionsMarquee />
        <Destinations />
        <WhoWeServe />
        <Concierge />
        <OnTheRoad />
        <FinalCta />
      </main>
      <SiteFooter />
      <NavAutoClose />
      <BackToTop label={d.common.backToTop} />
    </div>
  );
}
