import type { Metadata } from "next";
import { siteConfig, socialLinks } from "@/lib/site-config";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { localizedPath, unprefixedPath } from "@/lib/i18n/pathnames";
import { NavAutoClose } from "./_components/nav-auto-close";
import { SectionNav } from "./_components/section-nav";
import {
  Concierge,
  Destinations,
  Enquiry,
  Experience,
  FinalCta,
  Fleet,
  Hero,
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
  logo: `${siteUrl}/assets/logo-mark.png`,
  image: `${siteUrl}/assets/og-image-v3.jpg`,
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

export default async function HomePage(props: {
  searchParams?: Promise<{ vehicle?: string }>;
}) {
  const [locale, d] = await Promise.all([currentLocale(), getDict()]);
  const jsonLd = buildJsonLd(locale, d.meta.description);

  return (
    <div className="motion-full bg-ink-950 text-ink-150 font-sans text-[16px] font-normal leading-[1.6] w-full">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      {/* A refresh starts at the top. Browsers otherwise reopen the page where it was (and jump to a stale #anchor);
          this runs before first paint and only for reloads, so back/forward navigation keeps its position. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            'try{var n=performance.getEntriesByType("navigation")[0];if(n&&n.type==="reload"){history.scrollRestoration="manual";if(location.hash)history.replaceState(null,"",location.pathname+location.search);var toTop=function(){scrollTo({top:0,behavior:"instant"})};addEventListener("load",toTop);addEventListener("pageshow",toTop);setTimeout(toTop,150);setTimeout(toTop,600)}}catch(e){}',
        }}
      />
      <a className="skip-link" href="#main">
        {d.common.skipToContent}
      </a>
      <SiteHeader />
      <main id="main">
        <Hero />
        <Enquiry locale={locale} dateTimeCopy={d.dateTimePicker} searchParams={props.searchParams} />
        <WhoWeServe />
        <Fleet />
        <Concierge />
        <Statement />
        <Services />
        <Experience />
        <RegionsMarquee />
        <Destinations />
        <FinalCta />
      </main>
      <SiteFooter />
      <NavAutoClose />
      <SectionNav copy={{ prev: d.common.sectionPrev, next: d.common.sectionNext }} />
    </div>
  );
}
