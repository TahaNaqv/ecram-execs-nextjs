import Image from "next/image";
import type { Metadata } from "next";
import { LOCALES } from "@/lib/i18n/config";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { localizedPath, unprefixedPath } from "@/lib/i18n/pathnames";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { amsterdamToday, APPROVED_MODELS_BY_MAKE, criteriaText } from "@/lib/partners/criteria";
import { storageConfigured } from "@/lib/storage";
import { LanguageSwitcher } from "../_components/language-switcher";
import { ApplicationForm } from "../_components/application-form";
import { SiteFooter } from "../_components/sections";





/** The age rule names a year, so the list is cached for a day rather than fixed at build time. */
async function Criteria() {
  "use cache";
  cacheLife("days");
  // Root params are readable inside `"use cache"`, and the locale becomes part of the cache key,
  // so each language gets its own cached entry.
  const d = await getDict();
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {criteriaText(amsterdamToday(), d.criteria).map((c) => (
        <li key={c} className="flex gap-4 border-t border-ink-800 py-3.5 text-[14px] text-ink-150 first:border-t-0">
          <span aria-hidden="true" className="mt-[9px] size-[5px] shrink-0 rotate-45 bg-ink-300" />
          {c}
        </li>
      ))}
    </ul>
  );
}

export default async function DriveWithUsPage() {
  const dict = await getDict();
  const t = dict.driveWithUs;
  const steps = [
    [t.step1Title, t.step1Text],
    [t.step2Title, t.step2Text],
    [t.step3Title, t.step3Text],
  ] as const;
  return (
    <div className="min-h-svh bg-ink-950 font-sans leading-[1.6] text-ink-150">
      <a className="skip-link" href="#main">
        {dict.common.skipToContent}
      </a>
      <header className="sticky top-0 z-40 border-b border-ink-850 bg-ink-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-5 py-[22px] md:px-6 2xl:max-w-[1440px]">
          <Link href="/" className="inline-flex items-center gap-2 whitespace-nowrap chrome font-display text-[15px] tracking-[0.2em] md:gap-3 md:text-[22px] no-underline md:tracking-[0.32em]">
            <Image className="h-10 w-10 md:h-12 md:w-12" src="/assets/logo-mark.png" alt="" width={48} height={48} />
            <span className="max-sm:sr-only">ECRAM EXECS</span>
          </Link>
          <div className="flex items-center gap-5">
            <LanguageSwitcher route="/drive-with-us" />
          <a
            href="#apply"
            className="inline-flex min-h-[44px] items-center border border-ink-250 px-[22px] text-[11px] tracking-[0.24em] text-white uppercase no-underline"
          >
            <span className="md:hidden">{t.applyShort}</span>
            <span className="hidden md:inline">{t.applyLong}</span>
          </a>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="border-b border-ink-850">
          <div className="mx-auto flex max-w-[1280px] flex-wrap gap-12 px-5 pt-16 pb-20 md:px-6 md:pt-24 md:pb-28 2xl:max-w-[1440px]">
            <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-6">
              <span className="font-display text-[12px] tracking-[0.3em] text-ink-450 md:tracking-[0.42em]">{t.eyebrow}</span>
              <h1 className="m-0 font-serif text-[clamp(36px,8.6vw,40px)] leading-[1.05] font-light text-white md:text-[clamp(40px,5vw,68px)]">
                {t.headingBefore} <br />
                <em className="chrome italic">{t.headingEmphasis}</em>
              </h1>
              <p className="m-0 max-w-[520px] font-light text-ink-400">
                {t.intro}
              </p>
              <ol className="m-0 mt-4 flex list-none flex-col border-b border-ink-800 p-0">
                {steps.map(([title, text], i) => (
                  <li key={title} className="flex gap-5 border-t border-ink-800 py-5">
                    <span className="font-display text-[12px] tracking-[0.3em] text-ink-450">0{i + 1}</span>
                    <div>
                      <p className="m-0 text-[15px] text-white">{title}</p>
                      <p className="m-0 mt-1 text-[14px] font-light text-ink-400">{text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-6 self-start border border-ink-800 bg-ink-900 p-6 md:p-10">
              <span className="font-display text-[12px] tracking-[0.3em] text-ink-450 md:tracking-[0.42em]">{t.criteriaEyebrow}</span>
              <h2 className="m-0 font-serif text-[30px] leading-[1.1] font-light text-white">{t.criteriaHeading}</h2>
              <Criteria />
              <div className="flex flex-col gap-3">
                <span className="font-display text-[12px] tracking-[0.3em] text-ink-450">{t.approvedModels}</span>
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-[14px]">
                  {APPROVED_MODELS_BY_MAKE.map(({ make, models }) => (
                    <div key={make} className="contents">
                      <dt className="text-ink-450">{make}</dt>
                      <dd className="m-0 text-ink-150">{models}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <p className="m-0 text-[13px] text-ink-450">
                {t.documentsNote}
              </p>
            </div>
          </div>
        </section>

        <section className="bg-ink-50 text-ink-950" id="apply">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-5 py-12 md:px-6 md:py-16 2xl:max-w-[1440px]">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="m-0 font-serif text-[30px] leading-[1.1] font-normal md:text-[34px]">{t.applyHeading}</h2>
              <p className="m-0 text-[14px] text-ink-600">{t.applyNote}</p>
            </div>
            <ApplicationForm
              documents={storageConfigured()}
              locale={await currentLocale()}
              copy={{ documents: dict.documents, declarations: dict.declarations, forms: dict.forms, page: t }}
            />
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
    title: d.driveWithUs.metaTitle,
    description: d.driveWithUs.metaDescription,
    alternates: {
      canonical: localizedPath("/drive-with-us", locale),
      languages: { ...Object.fromEntries(LOCALES.map((l) => [l, localizedPath("/drive-with-us", l)])), "x-default": unprefixedPath("/drive-with-us") },
    },
  };
}
