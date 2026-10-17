import { LOCALES, type Locale } from "./config";

/**
 * Localized URL slugs. The key is the physical folder under `app/[locale]/`; the value is
 * the public slug per locale. The homepage has no slug.
 *
 * Anchor IDs (`#services`, `#fleet`, …) are deliberately NOT localized: they are not
 * indexed, and the language switcher has to carry the fragment across a locale change.
 */
export const PATHNAMES = {
  "/": { en: "", nl: "" },
  "/drive-with-us": { en: "drive-with-us", nl: "rijd-met-ons" },
  "/corporate-partner": { en: "corporate-partner", nl: "zakelijke-partner" },
  // Nested slugs: the proxy and the language switcher match the whole path after the locale, so these work as they are
  "/corporate-partner/login": { en: "corporate-partner/login", nl: "zakelijke-partner/inloggen" },
  "/corporate-partner/signup": { en: "corporate-partner/signup", nl: "zakelijke-partner/registreren" },
  "/corporate-partner/forgot-password": { en: "corporate-partner/forgot-password", nl: "zakelijke-partner/wachtwoord-vergeten" },
  "/corporate-partner/account": { en: "corporate-partner/account", nl: "zakelijke-partner/account" },
  "/privacy": { en: "privacy", nl: "privacybeleid" },
} as const satisfies Record<string, Record<Locale, string>>;

export type AppRoute = keyof typeof PATHNAMES;

export const APP_ROUTES = Object.keys(PATHNAMES) as AppRoute[];

/** Public URL for a route in a locale: `localizedPath("/privacy", "nl")` → `/nl/privacybeleid`. */
export function localizedPath(route: AppRoute, locale: Locale): string {
  const slug = PATHNAMES[route][locale];
  return slug ? `/${locale}/${slug}` : `/${locale}`;
}

/**
 * The physical folder under `app/[locale]/` that serves a route — what the proxy rewrites to.
 * `"/drive-with-us"` → `"drive-with-us"`, `"/"` → `""`.
 */
export function physicalSegment(route: AppRoute): string {
  return route.replace(/^\//, "");
}

/** Reverse of {@link physicalSegment}: which route does this folder serve? */
export function routeFromPhysical(segment: string): AppRoute | undefined {
  const normalized = segment.replace(/^\/+|\/+$/g, "");
  return APP_ROUTES.find((route) => physicalSegment(route) === normalized);
}

/**
 * Reverse lookup for the proxy rewrite and the language switcher: which route does this
 * locale's slug refer to? Returns undefined for an unknown slug so the caller can 404.
 */
export function routeFromSlug(slug: string, locale: Locale): AppRoute | undefined {
  const normalized = slug.replace(/^\/+|\/+$/g, "");
  return APP_ROUTES.find((route) => PATHNAMES[route][locale] === normalized);
}

/**
 * The same page in another locale, used by the language switcher.
 * `switchPath("/nl/privacybeleid", "en")` → `/en/privacy`.
 */
export function switchPath(pathname: string, to: Locale): string {
  const [, first = "", ...rest] = pathname.split("/");
  const from = (LOCALES as readonly string[]).includes(first) ? (first as Locale) : undefined;
  if (!from) return localizedPath("/", to);

  const route = routeFromSlug(rest.join("/"), from);
  return route ? localizedPath(route, to) : localizedPath("/", to);
}

/**
 * The unprefixed URL for a route, e.g. `/privacy`. The proxy negotiates a language there and
 * redirects, which is exactly what `hreflang="x-default"` is meant to point at — so this is the
 * x-default for every route, not just the homepage.
 */
export function unprefixedPath(route: AppRoute): string {
  const segment = physicalSegment(route);
  return segment ? `/${segment}` : "/";
}
