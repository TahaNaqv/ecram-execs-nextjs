import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/lib/fonts";
import "./site.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "https://ecramexecs.vercel.app"),
  title: "Ecram Execs — The Art of Executive Hospitality",
  description:
    "Private executive chauffeurs across the Netherlands in a fully electric Mercedes-Benz fleet. Airport transfers, business travel, corporate accounts and private occasions — every journey quoted personally.",
  openGraph: {
    title: "Ecram Execs — The Art of Executive Hospitality",
    description: "Private executive chauffeurs across the Netherlands, in a fully electric fleet.",
    images: [
      {
        url: "/assets/og-image-v2.jpg",
        width: 1200,
        height: 630,
        alt: "Ecram Execs chauffeur beside an electric Mercedes VLE as an executive leaves a private jet at dusk",
      },
    ],
    locale: "en_NL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ecram Execs — The Art of Executive Hospitality",
    description: "Private executive chauffeurs across the Netherlands, in a fully electric fleet.",
    images: ["/assets/og-image-v2.jpg"],
  },
};

export const viewport: Viewport = { themeColor: "#0a0a0b", viewportFit: "cover" };

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
