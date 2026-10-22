import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { fontVariables } from "@/lib/fonts";
import { locale as localeParam } from "next/root-params";
import { isLocale, LOCALES } from "@/lib/i18n/config";
import { currentLocale, getDictionary } from "@/lib/i18n/get-dictionary";
import { WhatsAppFloat } from "@/components/whatsapp-float";
import { localizedPath } from "@/lib/i18n/pathnames";
import { CookieConsent } from "./_components/cookie-consent";
import { SameHashScroll } from "./_components/same-hash-scroll";
import "./site.css";

// Required by cacheComponents: every root param needs at least one value or the build fails.
export function generateStaticParams() {
  return LOCALES.map((value) => ({ locale: value }));
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const d = await getDictionary(locale);

  return {
    metadataBase: new URL(process.env.SITE_URL ?? "https://ecramexecs.vercel.app"),
    title: d.meta.title,
    description: d.meta.description,
    openGraph: {
      title: d.meta.title,
      description: d.meta.ogDescription,
      images: [{ url: "/assets/og-image-v3.jpg", width: 1200, height: 630, alt: d.meta.ogImageAlt }],
      locale: d.meta.ogLocale,
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => (l === "nl" ? "nl_NL" : "en_NL")),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: d.meta.title,
      description: d.meta.ogDescription,
      images: ["/assets/og-image-v3.jpg"],
    },
  };
}

export const viewport: Viewport = { themeColor: "#0a0a0b", viewportFit: "cover" };

export default async function SiteLayout({ 
  children 
}: { 
  children: React.ReactNode; 
}) {
  const value: string | undefined = await localeParam();
  if (!isLocale(value)) notFound();
  const consentCopy = (await getDictionary(value)).cookieConsent;

  return (
    <html lang={value} translate="no" className={`notranslate ${fontVariables}`}>
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body>
        {/* First in the page, so a keyboard visitor reaches the cookie choice before the rest */}
        <CookieConsent copy={consentCopy} policyHref={`${localizedPath("/privacy", value)}#cookies`} />
        {children}
        <SameHashScroll />
        <WhatsAppFloat />
      </body>
    </html>
  );
}