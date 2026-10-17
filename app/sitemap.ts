import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/i18n/config";
import { APP_ROUTES, localizedPath, unprefixedPath, type AppRoute } from "@/lib/i18n/pathnames";

/** How often each route changes, and how it ranks against the others. `null`: not listed (sign-in screens and the account page). */
const SETTINGS: Record<AppRoute, Pick<MetadataRoute.Sitemap[number], "changeFrequency" | "priority"> | null> = {
  "/": { changeFrequency: "monthly", priority: 1 },
  "/drive-with-us": { changeFrequency: "monthly", priority: 0.5 },
  "/corporate-partner": { changeFrequency: "monthly", priority: 0.5 },
  "/corporate-partner/login": null,
  "/corporate-partner/signup": null,
  "/corporate-partner/forgot-password": null,
  "/corporate-partner/account": null,
  "/privacy": { changeFrequency: "yearly", priority: 0.2 },
};

/**
 * One entry per route per locale, each listing the other locales as `alternates`.
 *
 * The unprefixed URLs that used to be listed here now redirect, so listing them would point
 * search engines at redirects instead of pages. `x-default` is the bare domain, which is where
 * the proxy decides a visitor's language.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.SITE_URL ?? "https://ecramexecs.vercel.app";
  const absolute = (route: AppRoute, locale: (typeof LOCALES)[number]) => `${site}${localizedPath(route, locale)}`;

  return APP_ROUTES.filter((route) => SETTINGS[route]).flatMap((route) =>
    LOCALES.map((locale) => ({
      url: absolute(route, locale),
      ...SETTINGS[route],
      alternates: {
        languages: {
          ...Object.fromEntries(LOCALES.map((l) => [l, absolute(route, l)])),
          "x-default": `${site}${unprefixedPath(route)}`,
        },
      },
    })),
  );
}
