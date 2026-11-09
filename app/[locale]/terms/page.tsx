import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { LOCALES } from "@/lib/i18n/config";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { localizedPath, unprefixedPath } from "@/lib/i18n/pathnames";
import { interpolate } from "@/lib/i18n/interpolate";
import { TERMS, TERMS_APPLICABILITY, TERMS_EFFECTIVE, TERMS_GOVERNING_ENTITY, TERMS_VERSION } from "@/lib/legal/terms";

// The terms are the client's own document, in English only (lib/legal/terms.ts). The Dutch page says so above them.
export default async function TermsPage() {
  const [locale, dict] = await Promise.all([currentLocale(), getDict()]);
  const t = dict.terms;

  return (
    <div className="min-h-svh bg-ink-950 font-sans leading-[1.7] text-ink-150">
      <header className="sticky top-0 z-40 border-b border-ink-850 bg-ink-950/95 backdrop-blur-md">
        <div className="mx-auto max-w-[820px] px-4 py-4 sm:px-6 md:px-8 md:py-[22px]">
          <Link href={localizedPath("/", locale)} className="inline-flex items-center gap-3 whitespace-nowrap chrome font-display text-[20px] tracking-[0.32em] no-underline">
            <Image className="h-10 w-10" src="/assets/logo-mark.png" alt="" width={48} height={48} />
            ECRAM EXECS
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto flex max-w-[820px] flex-col gap-8 px-4 pt-12 pb-16 sm:px-6 md:gap-10 md:px-8 md:pt-14 md:pb-20">
        <div className="flex flex-col gap-3">
          <span className="font-display text-[12px] tracking-[0.42em] text-ink-450">{t.eyebrow}</span>
          <h1 className="m-0 font-serif text-[clamp(36px,6vw,56px)] leading-[1.08] font-light text-white">{t.heading}</h1>
          <p className="m-0 text-[14px] text-ink-450">
            {interpolate(t.version, {
              version: TERMS_VERSION,
              date: new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${TERMS_EFFECTIVE}T00:00:00Z`)),
            })}
          </p>
          {locale !== "en" && <p className="m-0 text-[15px] text-ink-300">{t.englishNote}</p>}
          <dl lang="en" className="m-0 grid gap-1 text-[14px] font-light text-ink-300">
            <div>
              <dt className="inline font-semibold text-ink-150">Applicability: </dt>
              <dd className="m-0 inline">{TERMS_APPLICABILITY}</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-ink-150">Governing Entity: </dt>
              <dd className="m-0 inline">{TERMS_GOVERNING_ENTITY}</dd>
            </div>
          </dl>
        </div>

        <div lang="en" className="flex flex-col gap-8 md:gap-10">
          {TERMS.map((article) => (
            <section key={article.number} id={`article-${article.number}`} className="flex scroll-mt-6 flex-col gap-3">
              <h2 className="m-0 font-serif text-[26px] leading-tight font-normal text-white">
                <span className="mr-2 text-ink-450">{interpolate(t.article, { number: article.number })} —</span>
                {article.title}
              </h2>
              <ul className="m-0 flex list-disc flex-col gap-2.5 pl-5 font-light text-ink-300 marker:text-ink-500">
                {article.points.map((point, i) => (
                  <li key={i}>
                    {point.label && (
                      <strong className="font-semibold text-ink-150">
                        {point.label}:
                      </strong>
                    )}
                    {point.label && point.text ? " " : ""}
                    {point.text}
                    {point.sub && (
                      <ul className="m-0 mt-2 flex list-[circle] flex-col gap-1.5 pl-5">
                        {point.sub.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <Link href={localizedPath("/", locale)} className="text-[12px] tracking-[0.24em] uppercase">
          {t.back}
        </Link>
      </main>
    </div>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const d = await getDict();
  return {
    title: d.terms.metaTitle,
    description: d.terms.metaDescription,
    alternates: {
      canonical: localizedPath("/terms", locale),
      languages: { ...Object.fromEntries(LOCALES.map((l) => [l, localizedPath("/terms", l)])), "x-default": unprefixedPath("/terms") },
    },
  };
}
