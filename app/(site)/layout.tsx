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
    images: ["/assets/3b00bbaea002c5bc3c19878670191ab0.jpg"],
    locale: "en_NL",
    type: "website",
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
