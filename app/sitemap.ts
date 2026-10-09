import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.SITE_URL ?? "https://ecramexecs.vercel.app";
  return [
    { url: `${site}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${site}/drive-with-us`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${site}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
