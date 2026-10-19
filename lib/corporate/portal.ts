import "server-only";
import { redirect } from "next/navigation";
import { currentLocale } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";
import { localizedPath, type AppRoute } from "@/lib/i18n/pathnames";
import { getCorporateContact } from "./access";

/**
 * The gate every portal page goes through, inside its <Suspense> (it reads the visitor's cookie). The sign-in is
 * checked against the database; without one the visitor is sent to log in and brought straight back afterwards.
 */
export async function requirePartner(route: AppRoute, search = "") {
  const [locale, contact] = await Promise.all([currentLocale(), getCorporateContact()]);
  if (!contact) {
    const back = `${localizedPath(route, locale)}${search}`;
    redirect(`${localizedPath("/corporate-partner/login", locale)}?next=${encodeURIComponent(back)}`);
  }
  return { locale, contact };
}

/**
 * Where to go after signing in, if the visitor was sent to log in from a portal page. Only an address inside the
 * portal of this language is accepted, so the login form cannot be used to send anyone to another site.
 */
export function safeNext(value: string, locale: Locale): string | null {
  const base = localizedPath("/corporate-partner/account", locale);
  if (!value.startsWith(base) || value.length > 300 || /[\\\r\n]/.test(value) || value.includes("//")) return null;
  return value.length === base.length || "/?#".includes(value[base.length]) ? value : null;
}
