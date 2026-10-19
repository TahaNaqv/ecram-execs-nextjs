import type { Locale } from "@/lib/i18n/config";

// ─────────────────────────────────────────────────────────────────────────────
//  Business details shown on the website. Entries marked "TODO" are still awaited from the client.
//  Anything set to "" is simply hidden on the site (no "[PHONE]"-style placeholders are ever
//  shown to visitors).
// ─────────────────────────────────────────────────────────────────────────────
export type DestinationKey = "amsterdam" | "rotterdam" | "theHague" | "utrecht" | "maastricht" | "eindhoven" | "bulbRegion" | "kinderdijk";

export type Destination = {
  key: DestinationKey;
  /** A file in /public. Leave unset until a photograph is supplied: the destination is then not shown. */
  image?: string;
  /** CSS object-position, to keep the subject in frame when the photo is cropped. */
  focus: string;
  /** Mutes an over-bright photo so it sits with the rest of the section. */
  muted?: boolean;
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
  destinations: Destination[];
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

  // Shown in the client's order (their caption list); a destination without an image is hidden. Eindhoven's is a landscape crop of a photo by
  // Mahmood Alhussein (Pexels, 34002112; free licence, no attribution required): the Blob and the Philips building.
  destinations: [
    { key: "amsterdam", image: "/assets/52de87fce1028743a6cc606de596dd57.jpg", focus: "50% 55%" },
    { key: "rotterdam", image: "/assets/c01091ac467f57c8ccacd1d28b8caa6f.jpg", focus: "60% 62%" },
    { key: "theHague", image: "/assets/3f6c76e3791d854e6974e39f5db1d665.jpg", focus: "60% 60%" },
    { key: "utrecht", image: "/assets/d38555c6a11a07329e901cbb09fa90bb.jpg", focus: "50% 60%" },
    { key: "maastricht", image: "/assets/015c3f4881474d5c1c3690861a6d2221.jpg", focus: "40% 62%" },
    { key: "bulbRegion", image: "/assets/9ba09fb8d24f8c76d2d91a2b893186bf.jpg", focus: "50% 55%", muted: true },
    { key: "eindhoven", image: "/assets/destination-eindhoven.jpg", focus: "50% 55%" },
    { key: "kinderdijk", image: "/assets/74497cf7361df1d7830d0f8ebc1d8e7a.jpg", focus: "28% 50%" },
  ],

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
