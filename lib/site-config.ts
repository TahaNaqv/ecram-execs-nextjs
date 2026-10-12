import type { Locale } from "@/lib/i18n/config";

// ─────────────────────────────────────────────────────────────────────────────
//  Business details shown on the website. Entries marked "TODO" are still awaited from the client.
//  Anything set to "" is simply hidden on the site (no "[PHONE]"-style placeholders are ever
//  shown to visitors).
// ─────────────────────────────────────────────────────────────────────────────
export type FleetVehicle = {
  /** Brand names are shown as-is in every language, so they are not in the dictionaries. */
  name: string;
  /** A file in /public. Leave unset until a photograph is supplied: the card shows the name instead. */
  image?: string;
};

type SiteConfig = {
  name: string;
  /**
   * Brand copy, so it is written per language rather than translated at render time — the client
   * may well want the English tagline kept as-is in Dutch.
   */
  tagline: Record<Locale, string>;
  contact: { phone: string; email: string; address: string };
  kvk: string;
  fleet: FleetVehicle[];
  fleetInterior: string;
  social: { instagram: string; tiktok: string; linkedin: string; youtube: string; x: string };
};

export const siteConfig: SiteConfig = {
  name: "Ecram Execs",
  tagline: {
    en: "The Art of Executive Hospitality",
    nl: "De kunst van executive gastvrijheid",
  },

  contact: {
    /** Display format, e.g. "+31 6 12 34 56 78" */
    phone: "+31 6 27 13 37 00",
    email: "enquiries@ecramexecs.com",
    /** e.g. "Herengracht 1, 1015 BA Amsterdam" ("Netherlands" is added automatically) */
    address: "", // TODO: awaiting the client's business address — hidden until set
  },

  /** Kamer van Koophandel registration number */
  kvk: "", // TODO: awaiting the client's KvK number — hidden until set

  // Every vehicle: all-black exterior, black executive leather, full top-of-the-range specification.
  // NOTE: the photographs are AI-generated imagery supplied by the team. Swap in real photographs of the
  // fleet as they become available (16:9, at least 1600px wide, same all-black styling).
  fleet: [
    { name: "Mercedes-Benz VLE 300", image: "/assets/fleet-mercedes-vle-300-v2.jpg" },
    { name: "Audi", image: "/assets/fleet-audi-v2.jpg" },
    { name: "Cadillac Escalade", image: "/assets/fleet-cadillac-escalade-v2.jpg" },
    { name: "Range Rover", image: "/assets/fleet-range-rover-v2.jpg" },
    { name: "Hongqi E-HS9", image: "/assets/fleet-hongqi-e-hs9-v2.jpg" },
  ],
  /** Rear cabin, shown beneath the fleet to illustrate the black executive leather interior. */
  fleetInterior: "/assets/fleet-interior-v2.jpg",

  /** Full profile URLs (https://…); leave "" to hide that network */
  social: {
    instagram: "https://www.instagram.com/ecramexecs/",
    tiktok: "https://www.tiktok.com/@ecramexecs",
    linkedin: "https://www.linkedin.com/company/ecramexecs/",
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
