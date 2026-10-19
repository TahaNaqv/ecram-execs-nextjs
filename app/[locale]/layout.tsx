import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { fontVariables } from "@/lib/fonts";
import { locale as localeParam } from "next/root-params";
import { isLocale, LOCALES } from "@/lib/i18n/config";
import { currentLocale, getDictionary } from "@/lib/i18n/get-dictionary";
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
    // `alternates` is deliberately NOT set here: metadata is inherited, so a canonical on the
    // root layout would wrongly apply to /privacy and /drive-with-us. Each page sets its own.
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

export default async function SiteLayout({ children }: LayoutProps<"/[locale]">) {
  // `[locale]` matches any first segment, so anything that isn't a locale is a 404.
  const value: string | undefined = await localeParam();
  if (!isLocale(value)) notFound();

  return (
    <html lang={value} className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
