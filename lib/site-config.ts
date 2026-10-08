// ─────────────────────────────────────────────────────────────────────────────
//  Business details shown on the website.
//
//  ⚠ DEMO VALUES — the entries marked "DEMO" are sample data for client previews.
//  Replace them with the real details before launch. Anything set to "" is simply
//  hidden on the site (no "[PHONE]"-style placeholders are ever shown to visitors).
// ─────────────────────────────────────────────────────────────────────────────
type SiteConfig = {
  name: string;
  tagline: string;
  contact: { phone: string; email: string; address: string };
  kvk: string;
  fleet: { passengers: string; amenities: string };
  social: { instagram: string; tiktok: string; linkedin: string; youtube: string; x: string };
};

export const siteConfig: SiteConfig = {
  name: "Ecram Execs",
  tagline: "The Art of Executive Hospitality",

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
    /** e.g. "Up to 6 passengers" */
    passengers: "Up to 6 passengers", // DEMO — confirm seating configuration
    /** e.g. "Wi-Fi, chilled water, device charging" */
    amenities: "Wi-Fi, chilled water, device charging", // DEMO — confirm
  },

  /** Full profile URLs (https://…); leave "" to hide that network */
  social: {
    instagram: "#", // DEMO — "#" shows the link without leaving the page
    tiktok: "#", // DEMO
    linkedin: "#", // DEMO
    youtube: "#", // DEMO
    x: "#", // DEMO
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
