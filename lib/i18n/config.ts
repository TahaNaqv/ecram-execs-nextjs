// Supported locales. `nl` first: it is the main default language and fallback.
export const LOCALES = ["nl", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "nl";

/**
 * The languages visitors can see. English only at launch (the client, 22 Nov 2026): the Dutch copy waits for a native
 * speaker to translate and refine it. While a locale is left out, its URLs redirect to the same page in the first public
 * locale, the flags are hidden, and the sitemap and hreflang links list only the public ones. Put "nl" back (first, to
 * make it the landing language again) to bring Dutch back; its dictionary is kept up to date meanwhile.
 * The admin keeps both languages: `DEFAULT_LOCALE` and `LOCALES` are unchanged.
 */
export const PUBLIC_LOCALES: readonly Locale[] = ["en"];

export function isPublicLocale(value: string | undefined): value is Locale {
  return isLocale(value) && PUBLIC_LOCALES.includes(value);
}

/** Where a visitor without a (public) language choice lands. */
export const LANDING_LOCALE: Locale = PUBLIC_LOCALES.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : PUBLIC_LOCALES[0];

/**
 * `next/root-params` getters are typed `string | undefined` while other root layouts
 * (the admin panel) have no `[locale]` segment, so every read is guarded.
 */
export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (LOCALES as readonly string[]).includes(value);
}