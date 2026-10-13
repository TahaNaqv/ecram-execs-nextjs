import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath, physicalSegment, PATHNAMES, routeFromPhysical, routeFromSlug } from "@/lib/i18n/pathnames";

const LOCALE_COOKIE = "NEXT_LOCALE";
const ADMIN_SESSION_COOKIE = "ee_admin_session";

/** Cookie first (an explicit choice), then the browser's preference, then the default. */
function detectLocale(request: NextRequest): Locale {
  const fromCookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const header = request.headers.get("accept-language");
  if (header) {
    const ranked = header
      .split(",")
      .map((part) => {
        const [tag = "", ...params] = part.trim().split(";");
        const q = params.find((p) => p.trim().startsWith("q="));
        return { tag: tag.trim().toLowerCase(), q: q ? Number(q.split("=")[1]) || 0 : 1 };
      })
      .filter((entry) => entry.tag !== "")
      .sort((a, b) => b.q - a.q);

    for (const { tag } of ranked) {
      // "nl-NL" and "nl" both resolve to "nl"; "*" resolves to nothing.
      const base = tag.split("-")[0];
      if (isLocale(base)) return base;
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * Remembers an explicit locale, but only when it actually changed. Writing Set-Cookie on every
 * response would attach it to the statically prerendered pages and undermine CDN caching.
 */
function rememberLocale(response: NextResponse, request: NextRequest, locale: Locale) {
  if (request.cookies.get(LOCALE_COOKIE)?.value === locale) return response;
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generated file routes (/robots.txt, /sitemap.xml, /icon.png, /favicon.ico) are real routes
  // and would otherwise be redirected under a locale prefix.
  if (/\.[^/]+$/.test(pathname)) return;

  // ── Admin: never locale-prefixed; locale comes from admin_users.locale instead.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname === "/admin/login") return;
    // Optimistic check only: every admin page, query and Server Action re-verifies the session.
    if (!request.cookies.has(ADMIN_SESSION_COOKIE)) {
      const url = new URL("/admin/login", request.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return;
  }

  const segments = pathname.split("/").filter(Boolean);
  const [first, ...rest] = segments;

  // ── No locale prefix: send the visitor to the canonical URL for their locale.
  if (!isLocale(first)) {
    // Only the bare domain and paths we actually serve are redirected; redirecting an unknown
    // path to the homepage would be a soft 404.
    const route = segments.length === 0 ? "/" : routeFromPhysical(segments.join("/"));
    if (!route) {
      // `[locale]` matches ANY first segment, so passing this through would hand the locale
      // layout an invalid locale. The layout would then call notFound() — and a root layout that
      // throws leaves no shell to render the 404 into, producing Next's bare error page. Rewrite
      // to a path no route matches so `global-not-found` renders properly instead.
      return NextResponse.rewrite(new URL("/_not-found", request.url));
    }

    const locale = detectLocale(request);
    const url = new URL(localizedPath(route, locale), request.url);
    url.search = request.nextUrl.search;
    return rememberLocale(NextResponse.redirect(url), request, locale);
  }

  const locale = first;
  const tail = rest.join("/");

  // ── Locale-prefixed. The slug in the URL is the localized one; the folder on disk is not.
  const bySlug = routeFromSlug(tail, locale);
  if (bySlug) {
    const physical = physicalSegment(bySlug);
    if (physical === tail) {
      // Slug and folder coincide (e.g. /en/privacy) — serve directly.
      return rememberLocale(NextResponse.next(), request, locale);
    }
    const url = new URL(`/${locale}/${physical}`, request.url);
    url.search = request.nextUrl.search;
    return rememberLocale(NextResponse.rewrite(url), request, locale);
  }

  // ── A folder name used where this locale expects its own slug (/nl/privacy). Redirect to the
  //    single canonical URL so the two spellings never both get indexed.
  const byFolder = routeFromPhysical(tail);
  if (byFolder && PATHNAMES[byFolder][locale] !== tail) {
    const url = new URL(localizedPath(byFolder, locale), request.url);
    url.search = request.nextUrl.search;
    return rememberLocale(NextResponse.redirect(url, 308), request, locale);
  }

  // Unknown path under a valid locale — let Next.js render the 404.
  return rememberLocale(NextResponse.next(), request, locale);
}

export const config = {
  // Everything except Next.js internals, static assets and API routes (which have no locale and would
  // otherwise be rewritten to the 404). Anything with a file extension is skipped inside `proxy` itself,
  // which is easier to verify than a lookahead.
  matcher: ["/((?!_next/|assets/|api/).*)"],
};
