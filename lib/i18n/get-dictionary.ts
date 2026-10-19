import { locale as localeParam } from "next/root-params";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import type { Dictionary } from "./types";

// Dynamic imports so each locale is a separate chunk and only the requested one is loaded.
const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import("./dictionaries/en.json").then((m) => m.default),
  nl: () => import("./dictionaries/nl.json").then((m) => m.default),
};

/**
 * The primitive: takes the locale explicitly. Server Actions, Route Handlers and the email
 * templates must use this form, because `next/root-params` is unavailable to them.
 */
export function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}

/**
 * The current locale, for Server Components only.
 *
 * ⚠ `next/root-params` ships a bare `declare module`, and Next.js only generates real types
 * when no other root layout registers at route `/`. `app/(admin)/layout.tsx` is a bare route
 * group, so it registers as `/` and suppresses generation — see T8 in docs/i18n-en-nl-plan.md.
 * Runtime is unaffected (verified: both locales prerender correctly), but the getter is
 * typed `any`. The explicit annotation below is the single boundary where that is pinned
 * back to a real type; everything downstream is properly typed `Locale`.
 */
export async function currentLocale(): Promise<Locale> {
  const value: string | undefined = await localeParam();
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Convenience for Server Components: the dictionary for the current route's locale. */
export async function getDict(): Promise<Dictionary> {
  return getDictionary(await currentLocale());
}

/**
 * The dictionary for the locale a form carried in its hidden `locale` field.
 *
 * Server Actions cannot use `next/root-params`, so this is how they localize validation
 * messages and confirmation copy. An absent or unrecognised value falls back to the default
 * rather than failing the submission.
 */
export function dictionaryFromForm(formData: FormData): Promise<Dictionary> {
  const value = formData.get("locale");
  return getDictionary(isLocale(typeof value === "string" ? value : undefined) ? (value as Locale) : DEFAULT_LOCALE);
}

/**
 * The dictionary in the signed-in admin's own language (`admin_users.locale`).
 *
 * The admin panel is not locale-routed — it is behind auth and `noindex`, so there is nothing
 * for a URL locale to buy, and a preference that sticks is better for a dispatch team (D3).
 * Deduplicated per request, because `getAdmin()` is.
 */
export async function adminDictionary(): Promise<Dictionary> {
  const { getAdmin } = await import("@/lib/auth/session");
  const admin = await getAdmin();
  return getDictionary(admin?.locale ?? DEFAULT_LOCALE);
}
