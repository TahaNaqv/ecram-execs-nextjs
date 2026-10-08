import { siteConfig, socialLinks } from "@/lib/site-config";
import { NavAutoClose } from "./_components/nav-auto-close";
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
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${siteUrl}/#business`,
  name: siteConfig.name,
  slogan: siteConfig.tagline,
  description:
    "Private executive chauffeur services across the Netherlands in a fully electric Mercedes-Benz fleet: airport transfers, business travel, corporate accounts and private occasions.",
  url: siteUrl,
  logo: `${siteUrl}/icon.png`,
  image: `${siteUrl}/assets/3b00bbaea002c5bc3c19878670191ab0.jpg`,
  areaServed: { "@type": "Country", name: "Netherlands" },
  ...(siteConfig.contact.phone ? { telephone: siteConfig.contact.phone } : {}),
  ...(siteConfig.contact.email ? { email: siteConfig.contact.email } : {}),
  ...(siteConfig.contact.address
    ? { address: { "@type": "PostalAddress", streetAddress: siteConfig.contact.address, addressCountry: "NL" } }
    : {}),
  ...(profileUrls.length ? { sameAs: profileUrls } : {}),
};

export default function HomePage() {
  return (
    <div className="motion-full bg-ink-950 text-ink-150 font-sans text-[16px] font-normal leading-[1.6] w-full"
     
     
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <a className="skip-link" href="#main">
        Skip to content
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
    </div>
  );
}
