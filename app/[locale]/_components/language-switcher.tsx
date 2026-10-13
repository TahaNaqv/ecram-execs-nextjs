import type { Locale } from "@/lib/i18n/config";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { localizedPath, type AppRoute } from "@/lib/i18n/pathnames";
import { LanguageSwitcherLinks } from "./language-switcher-links";

/** Dutch first, English second — the order the flags are shown in. */
const DISPLAY_ORDER: readonly Locale[] = ["nl", "en"];

/**
 * `route` is passed in rather than read from the pathname: a Server Component cannot read the
 * request URL without opting the page out of static prerendering, and every page knows which
 * route it is.
 */
export async function LanguageSwitcher({ route }: { route: AppRoute }) {
  const locale = await currentLocale();
  const d = await getDict();

  return (
    <LanguageSwitcherLinks
      label={d.switcher.label}
      current={locale}
      options={DISPLAY_ORDER.map((value) => ({
        locale: value,
        href: localizedPath(route, value),
        aria: value === "en" ? d.switcher.ariaEn : d.switcher.ariaNl,
      }))}
    />
  );
}
