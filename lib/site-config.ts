import type { Locale } from "@/lib/i18n/config";

// ─────────────────────────────────────────────────────────────────────────────
//  Business details shown on the website.
//
//  ⚠ DEMO VALUES — the entries marked "DEMO" are sample data for client previews.
//  Replace them with the real details before launch. Anything set to "" is simply
//  hidden on the site (no "[PHONE]"-style placeholders are ever shown to visitors).
// ─────────────────────────────────────────────────────────────────────────────
type SiteConfig = {
  name: string;
  /**
   * Brand copy, so it is written per language rather than translated at render time — the client
   * may well want the English tagline kept as-is in Dutch.
   */
  tagline: Record<Locale, string>;
  contact: { phone: string; email: string; address: string };
  kvk: string;
  fleet: {
    /** A number, not prose: the site renders "Up to 6 passengers" / "Tot 6 passagiers" from it. */
    maxPassengers: number | null;
    amenities: Record<Locale, string>;
  };
  social: { instagram: string; tiktok: string; linkedin: string; youtube: string; x: string };
};

export const siteConfig: SiteConfig = {
  name: "Ecram Execs",
  tagline: {
    en: "The Art of Executive Hospitality",
    nl: "De kunst van executive gastvrijheid",
  },

  contact: {
    /** Display format, e.g. "+31 20 123 4567" */
    phone: "+31 20 123 4567", // DEMO
    email: "reservations@ecramexecs.nl", // DEMO
    /** e.g. "Herengracht 1, 1015 BA Amsterdam" ("Netherlands" is added automatically) */
    address: "Gustav Mahlerplein, Amsterdam Zuidas", // DEMO
  },

  /** Kamer van Koophandel registration number */
  kvk: "12345678", // DEMO

  fleet: {
    /** Set to null to hide the seating line entirely */
    maxPassengers: 6, // DEMO — confirm seating configuration
    /** Leave a language's entry as "" to hide the line in that language */
    amenities: {
      en: "Wi-Fi, chilled water, device charging", // DEMO — confirm
      nl: "Wi-Fi, gekoeld water, oplaadpunten", // DEMO — confirm
    },
  },

  /** Full profile URLs (https://…); leave "" to hide that network */
  social: {
    instagram: "https://www.instagram.com/ecramexecs/",
    tiktok: "https://www.tiktok.com/@ecramexecs",
    linkedin: "", // not provided by client — hidden
    youtube: "https://www.youtube.com/@ecramexecs",
    x: "https://x.com/EcramExecs",
  },
};

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

export const socialLinks: [label: string, url: string][] = (
  [
    ["Instagram", siteConfig.social.instagram],
    ["TikTok", siteConfig.social.tiktok],
    ["LinkedIn", siteConfig.social.linkedin],
    ["YouTube", siteConfig.social.youtube],
    ["X", siteConfig.social.x],
  ] satisfies [string, string][]
).filter(([, url]) => url !== "");
