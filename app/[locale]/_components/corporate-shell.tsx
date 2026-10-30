import Image from "next/image";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getCorporateContact } from "@/lib/corporate/access";
import { LOCALES } from "@/lib/i18n/config";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { localizedPath, unprefixedPath, type AppRoute } from "@/lib/i18n/pathnames";
import { linkButton } from "./corporate-styles";
import { LanguageSwitcher } from "./language-switcher";
import { SiteFooter } from "./sections";
import { CorporateRefresh } from "./corporate-refresh";

/**
 * The page around every Corporate Partner screen: header, heading and the light panel the forms sit in. The shell is
 * static; anything that depends on the visitor's cookies goes inside the `children`, behind its own <Suspense>.
 */
export async function CorporateShell({
  route,
  heading,
  intro,
  children,
}: {
  route: AppRoute;
  heading: string;
  intro?: string;
  children: ReactNode;
}) {
  const [locale, dict] = await Promise.all([currentLocale(), getDict()]);
  const t = dict.corporatePartner;
  return (
    <div className="min-h-svh bg-ink-950 font-sans leading-[1.6] text-ink-150">
      <CorporateRefresh />
      <a className="skip-link" href="#main">
        {dict.common.skipToContent}
      </a>
      <header className="sticky top-0 z-40 border-b border-ink-850 bg-ink-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-5 py-[22px] md:px-6 2xl:max-w-[1440px]">
          <Link href={localizedPath("/", locale)} className="inline-flex items-center gap-2 whitespace-nowrap chrome font-display text-[15px] tracking-[0.2em] md:gap-3 md:text-[22px] no-underline md:tracking-[0.32em]">
            <Image className="h-10 w-10 md:h-12 md:w-12" src="/assets/logo-mark.png" alt="" width={48} height={48} />
            <span className="text-white">ECRAM EXECS</span>
          </Link>
          <LanguageSwitcher route={route} />
        </div>
      </header>

      <main id="main">
        <section className="border-b border-ink-850">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-8 px-5 pt-10 pb-16 md:px-6 md:pt-12 md:pb-24 2xl:max-w-[1440px]">
            <div className="mx-auto flex max-w-[720px] flex-col items-center gap-4 text-center">
              <span className="font-display text-[12px] tracking-[0.3em] text-ink-450 md:tracking-[0.42em]">{t.eyebrow}</span>
              <h1 className="m-0 font-serif text-[clamp(36px,8.6vw,40px)] leading-[1.05] font-light text-white md:text-[clamp(36px,4.2vw,56px)]">
                {heading}
              </h1>
              {intro && <p className="m-0 font-light text-ink-400">{intro}</p>}
            </div>
            <div className="light-surface box-border w-full min-w-0 max-w-full bg-ink-50 p-6 text-ink-950 md:p-8">{children}</div>
            <Link href={localizedPath("/", locale)} className="text-[12px] tracking-[0.24em] uppercase">
              {t.back}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

export { linkButton };

export function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="h-4 w-64 animate-pulse bg-ink-225" />
      <div className="h-[220px] animate-pulse bg-ink-225" />
      <div className="h-14 w-[320px] animate-pulse bg-ink-225" />
    </div>
  );
}

/** Reads the sign-in, so it belongs inside <Suspense>. Shown above a form that a signed-in visitor doesn't need. */
export async function SignedInNotice({ explain }: { explain?: boolean }) {
  const [locale, d, contact] = await Promise.all([currentLocale(), getDict(), getCorporateContact()]);
  if (!contact) return null;
  const t = d.corporatePartner;
  return (
    <div className="mb-8 flex flex-col items-center text-center gap-3 border border-ink-225 bg-white p-5">
      <p className="m-0 text-[15px] text-ink-700">{interpolate(t.signedInAs, { email: contact.email })}</p>
      {explain && <p className="m-0 text-[14px] text-ink-600">{t.signedInSignupNote}</p>}
      <Link href={localizedPath("/corporate-partner/account", locale)} className={linkButton}>
        {t.goToAccount}
      </Link>
    </div>
  );
}

/** Metadata for a Corporate Partner screen. The screens behind a sign-in are kept out of search results. */
export async function corporateMetadata(route: AppRoute, title: string, description: string, indexable: boolean): Promise<Metadata> {
  const locale = await currentLocale();
  return {
    title,
    description,
    ...(indexable
      ? {
          alternates: {
            canonical: localizedPath(route, locale),
            languages: {
              ...Object.fromEntries(LOCALES.map((l) => [l, localizedPath(route, l)])),
              "x-default": unprefixedPath(route),
            },
          },
        }
      : { robots: { index: false, follow: false } }),
  };
}