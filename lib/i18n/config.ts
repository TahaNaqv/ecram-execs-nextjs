// Supported locales. The database enum was created in this order; English is the default below.
export const LOCALES = ["nl", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/**
 * The languages visitors can see. English only (the client, 22 Nov 2026, and again 26 Nov 2026 after Dutch had been
 * switched back on): the Dutch copy waits for a native speaker. While a locale is left out, its URLs redirect (307) to
 * the same page in English, the flags are hidden, and the sitemap and hreflang links list only English. Add "nl" to
 * bring Dutch back; its dictionary is kept up to date meanwhile. The admin keeps both languages.
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

/** Dutch only when the record or the visitor explicitly chose it. Everything else is English. */
export function spokenLocale(value: string | null | undefined): Locale {
  return value === "nl" ? "nl" : DEFAULT_LOCALE;
}

/**
 * The languages the admin panel offers. English only (the client's bug report, 26 Nov 2026): the switch is hidden and every
 * team member sees English, whatever their saved preference. Add "nl" to bring the switch back; the dictionary is kept.
 */
export const ADMIN_LOCALES: readonly Locale[] = ["en"];
