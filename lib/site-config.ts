// ─────────────────────────────────────────────────────────────────────────────
//  Business details shown on the website.
//  Fill these in before launch. Anything left empty is simply hidden on the site
//  (no "[PHONE]"-style placeholders are ever shown to visitors).
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
    phone: "",
    email: "",
    /** e.g. "Herengracht 1, 1015 BA Amsterdam" ("Netherlands" is added automatically) */
    address: "",
  },

  /** Kamer van Koophandel registration number */
  kvk: "",

  fleet: {
    /** e.g. "Up to 6 passengers" */
    passengers: "",
    /** e.g. "Wi-Fi, chilled water, device charging" */
    amenities: "",
  },

  /** Full profile URLs; leave empty to hide that network */
  social: {
    instagram: "",
    tiktok: "",
    linkedin: "",
    youtube: "",
    x: "",
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
