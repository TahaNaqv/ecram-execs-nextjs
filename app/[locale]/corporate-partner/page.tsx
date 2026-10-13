import Image from "next/image";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCorporateContact, getPendingChallenge } from "@/lib/corporate/access";
import { CODE_MINUTES } from "@/lib/corporate/otp";
import { FLEET } from "@/lib/fleet/vehicles";
import { LOCALES } from "@/lib/i18n/config";
import { companyLookupEnabled } from "@/lib/companies/provider";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { localizedPath, unprefixedPath } from "@/lib/i18n/pathnames";
import { CorporateFlow } from "../_components/corporate-flow";
import { LanguageSwitcher } from "../_components/language-switcher";
import { SiteFooter } from "../_components/sections";

/**
 * The page shell is static; only this part depends on the visitor's cookies, so it sits inside
 * <Suspense> (reading cookies outside one would make the whole route dynamic). Where the visitor
 * is in the flow comes from the database, never from the cookie alone.
 */
async function Flow() {
  const [locale, d, contact] = await Promise.all([currentLocale(), getDict(), getCorporateContact()]);
  const pending = contact ? null : await getPendingChallenge();
  const initial = contact
    ? ({ step: "form", email: contact.email } as const)
    : pending
      ? ({ step: "verify", email: pending.email } as const)
      : ({ step: "request" } as const);

  return (
    <CorporateFlow
      locale={locale}
      initial={initial}
      copy={d.corporatePartner}
      minutes={CODE_MINUTES}
      vehicles={FLEET.map(({ key, name }) => ({ key, name }))}
      privacyHref={localizedPath("/privacy", locale)}
      lookup={{ enabled: companyLookupEnabled(), copy: d.companySearch }}
    />
  );
}

function FlowSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="h-4 w-64 animate-pulse bg-ink-225" />
      <div className="h-[220px] animate-pulse bg-ink-225" />
      <div className="h-14 w-[320px] animate-pulse bg-ink-225" />
    </div>
  );
}

export default async function CorporatePartnerPage() {
  const [locale, dict] = await Promise.all([currentLocale(), getDict()]);
  const t = dict.corporatePartner;
  return (
    <div className="min-h-svh bg-ink-950 font-sans leading-[1.6] text-ink-150">
      <a className="skip-link" href="#main">
        {dict.common.skipToContent}
      </a>
      <header className="border-b border-ink-850">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-5 py-[22px] md:px-6 2xl:max-w-[1440px]">
          <Link href={localizedPath("/", locale)} className="inline-flex items-center gap-2 whitespace-nowrap chrome font-display text-[15px] tracking-[0.2em] md:gap-3 md:text-[22px] no-underline md:tracking-[0.32em]">
            <Image className="h-10 w-10 md:h-12 md:w-12" src="/assets/logo-mark.png" alt="" width={48} height={48} />
            <span className="max-sm:sr-only">ECRAM EXECS</span>
          </Link>
          <LanguageSwitcher route="/corporate-partner" />
        </div>
      </header>

      <main id="main">
        <section className="border-b border-ink-850">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-5 pt-16 pb-20 md:px-6 md:pt-24 md:pb-28 2xl:max-w-[1440px]">
            <div className="flex max-w-[720px] flex-col gap-6">
              <span className="font-display text-[12px] tracking-[0.3em] text-ink-450 md:tracking-[0.42em]">{t.eyebrow}</span>
              <h1 className="m-0 font-serif text-[clamp(36px,8.6vw,40px)] leading-[1.05] font-light text-white md:text-[clamp(40px,5vw,68px)]">
                {t.heading}
              </h1>
              <p className="m-0 font-light text-ink-400">{interpolate(t.intro, { minutes: CODE_MINUTES })}</p>
            </div>
            <div className="bg-ink-50 p-6 text-ink-950 md:p-10">
              <Suspense fallback={<FlowSkeleton />}>
                <Flow />
              </Suspense>
            </div>
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

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const d = await getDict();
  return {
    title: d.corporatePartner.metaTitle,
    description: d.corporatePartner.metaDescription,
    alternates: {
      canonical: localizedPath("/corporate-partner", locale),
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, localizedPath("/corporate-partner", l)])),
        "x-default": unprefixedPath("/corporate-partner"),
      },
    },
  };
}
