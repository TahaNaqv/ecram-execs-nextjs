import { locale as localeParam } from "next/root-params";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import type enJson from "./dictionaries/en.json";
import type nlJson from "./dictionaries/nl.json";

export type Dictionary = typeof enJson;

// Compile-time only check to enforce full parity between en.json and nl.json
const _check = (x: typeof nlJson): Dictionary => x;

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import("./dictionaries/en.json").then((m) => m.default as Dictionary),
  nl: () => import("./dictionaries/nl.json").then((m) => {
    const nlData = m.default;
    _check(nlData); // triggers type checks for any mismatched or missing keys
    return nlData as Dictionary;
  }),
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
 */
export function dictionaryFromForm(formData: FormData): Promise<Dictionary> {
  const value = formData.get("locale");
  return getDictionary(isLocale(typeof value === "string" ? value : undefined) ? (value as Locale) : DEFAULT_LOCALE);
}

/**
 * The dictionary in the signed-in admin's own language (`admin_users.locale`).
 */
export async function adminDictionary(): Promise<Dictionary> {
  const { getAdmin } = await import("@/lib/auth/session");
  const admin = await getAdmin();
  return getDictionary(admin?.locale ?? DEFAULT_LOCALE);
}