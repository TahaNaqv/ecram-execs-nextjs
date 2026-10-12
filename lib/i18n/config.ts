// Supported locales. `en` first: it is the fallback when nothing else matches.
export const LOCALES = ["en", "nl"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/**
 * `next/root-params` getters are typed `string | undefined` while other root layouts
 * (the admin panel) have no `[locale]` segment, so every read is guarded.
 */
export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (LOCALES as readonly string[]).includes(value);
}
