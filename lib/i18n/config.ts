// Supported locales. The database enum was created in this order; English is the default below.
export const LOCALES = ["nl", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Both languages are on the site. A visitor who has not chosen Dutch stays on English. */
export const PUBLIC_LOCALES: readonly Locale[] = ["en", "nl"];

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