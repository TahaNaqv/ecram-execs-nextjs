import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
// Driver application documents upload from the browser straight to Supabase Storage
const supabaseOrigin = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).origin : "";

// Inline styles are used throughout the ported design and Next.js injects inline
// bootstrap scripts, so 'unsafe-inline' is required; everything else is locked to this origin.
// When adding a third party (analytics, video embeds, chat), extend the matching directive.
const BASE_DIRECTIVES: Record<string, string> = {
  "default-src": "'self'",
  "script-src": "'self' 'unsafe-inline'",
  "style-src": "'self' 'unsafe-inline'",
  "img-src": "'self' data: blob:",
  "font-src": "'self'",
  "connect-src": `'self' ${supabaseOrigin}`.trim(),
  "media-src": "'self'",
  "frame-ancestors": "'none'",
  "object-src": "'none'",
  "base-uri": "'self'",
  "form-action": "'self'",
};

/** The policy as one line: the base, with each extra source added to its directive (a directive the base lacks is added whole). */
const policy = (extra: Record<string, string> = {}) =>
  [
    ...Object.keys({ ...BASE_DIRECTIVES, ...extra }).map((name) => `${name} ${[BASE_DIRECTIVES[name], extra[name]].filter(Boolean).join(" ")}`),
    "upgrade-insecure-requests",
  ].join("; ");

const csp = policy();

// The admin shows Google's maps: the route on a booking page (an embedded frame) and the day map on the schedule (Maps
// JavaScript API, which loads its own script, tiles, fonts and a worker; the list is Google's own for it). Only the admin is
// given this; the public site keeps the strict policy above.
const GOOGLE = "https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com https://*.ggpht.com";
const adminCsp = policy({
  "script-src": `${GOOGLE} blob:`,
  "style-src": "https://fonts.googleapis.com",
  "img-src": GOOGLE,
  "font-src": "https://fonts.gstatic.com",
  "connect-src": `${GOOGLE} data: blob:`,
  "frame-src": "https://www.google.com",
  "worker-src": "blob:",
});

const securityHeaders = [
  ...(isProd ? [{ key: "Content-Security-Policy", value: csp }] : []),
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // The folder the build goes to. scripts/deploy.sh builds into another folder while the site keeps serving from `.next`, and swaps
  // it in when the build has succeeded; everything else uses the default
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true, // <-- Change this from false to true
  partialPrefetching: true,
  poweredByHeader: false,
  experimental: {
    // Two root layouts (site + admin) need a global 404 for unmatched URLs
    globalNotFound: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/admin/:path*",
        headers: [
          // Listed after the rule for every path, so this one replaces the public policy on admin pages
          ...(isProd ? [{ key: "Content-Security-Policy", value: adminCsp }] : []),
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        source: "/assets/:path*",
        // Asset filenames are not content-hashed, so keep this short enough for replacements to show up
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
    ];
  },
};
export default nextConfig;
