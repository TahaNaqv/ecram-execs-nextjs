import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { PUBLIC_LOCALES } from "@/lib/i18n/config";
import { LanguageSwitcher } from "../_components/language-switcher";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { localizedPath, unprefixedPath } from "@/lib/i18n/pathnames";
import { interpolate } from "@/lib/i18n/interpolate";
import { publishedDocument } from "@/lib/legal/documents";
import { LegalText } from "@/lib/legal/legal-text";

// The terms are the client's own document, in English only, as last published in Settings (lib/legal/documents.ts).
export default async function TermsPage() {
  const [locale, dict, terms] = await Promise.all([currentLocale(), getDict(), publishedDocument("terms")]);
  const t = dict.terms;

  return (
    <div className="min-h-svh bg-ink-950 font-sans leading-[1.7] text-ink-150">
      <header className="sticky top-0 z-40 border-b border-ink-850 bg-ink-950/95 backdrop-blur-md">
        <div className="mx-auto max-w-[820px] px-4 py-4 sm:px-6 md:px-8 md:py-[22px]">
          <div className="flex items-center justify-between gap-4">
            <Link href={localizedPath("/", locale)} className="inline-flex items-center gap-3 whitespace-nowrap chrome font-display text-[20px] tracking-[0.32em] no-underline">
              <Image className="h-10 w-10" src="/assets/logo-mark.png" alt="" width={48} height={48} />
              ECRAM EXECS
            </Link>
            <LanguageSwitcher route="/terms" />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto flex max-w-[820px] flex-col gap-8 px-4 pt-12 pb-16 sm:px-6 md:gap-10 md:px-8 md:pt-14 md:pb-20">
        <div className="flex flex-col gap-3">
          <span className="font-display text-[12px] tracking-[0.42em] text-ink-450">{t.eyebrow}</span>
          <h1 className="m-0 font-serif text-[clamp(36px,6vw,56px)] leading-[1.08] font-light text-white">{t.heading}</h1>
          <p className="m-0 text-[14px] text-ink-450">
            {interpolate(t.version, {
              version: terms.version,
              date: new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${terms.effectiveOn}T00:00:00Z`)),
            })}
          </p>
        </div>

        <div lang="en">
          <LegalText text={terms.body} />
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
      languages: { ...Object.fromEntries(PUBLIC_LOCALES.map((l) => [l, localizedPath("/terms", l)])), "x-default": unprefixedPath("/terms") },
    },
  };
}
