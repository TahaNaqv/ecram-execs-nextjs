import Image from "next/image";
import type { Metadata } from "next";
import { LOCALES } from "@/lib/i18n/config";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { localizedPath, unprefixedPath } from "@/lib/i18n/pathnames";
import { interpolate } from "@/lib/i18n/interpolate";
import Link from "next/link";
import type { ReactNode } from "react";
import { siteConfig } from "@/lib/site-config";
import { CookieSettingsButton } from "../_components/cookie-settings-button";
import { CookieTable } from "../_components/cookie-table";

// NOTE: Describes how this website actually handles data (see lib/quotes, lib/email).
// Have it reviewed before launch, and update it whenever a new processor or feature is added.
/** ISO date; rendered in the reader's language. */
const LAST_UPDATED = "2026-10-27";

function Section({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-28 flex-col gap-3">
      <h2 className="m-0 font-serif text-[28px] font-normal text-white">{title}</h2>
      <div className="flex flex-col gap-3 font-light text-ink-300">{children}</div>
    </section>
  );
}

export default async function PrivacyPage() {
  const [locale, dict] = await Promise.all([currentLocale(), getDict()]);
  const t = dict.privacy;
  const { email, address } = siteConfig.contact;
  const contactLine = email ? (
    <a href={`mailto:${email}`}>{email}</a>
  ) : (
    <Link href={`${localizedPath("/", locale)}#enquire`}>{t.contactForm}</Link>
  );
  const lastUpdated = new Date(LAST_UPDATED).toLocaleDateString(locale === "nl" ? "nl-NL" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="min-h-svh bg-ink-950 font-sans leading-[1.7] text-ink-150">
      <header className="sticky top-0 z-40 border-b border-ink-850 bg-ink-950/95 backdrop-blur-md">
        <div className="mx-auto max-w-[820px] px-5 py-[22px]">
          <Link href={localizedPath("/", locale)} className="inline-flex items-center gap-3 whitespace-nowrap chrome font-display text-[20px] tracking-[0.32em] no-underline">
            <Image className="h-10 w-10" src="/assets/logo-mark.png" alt="" width={48} height={48} />
            ECRAM EXECS
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto flex max-w-[820px] flex-col gap-10 px-5 pt-16 pb-24">
        <div className="flex flex-col gap-3">
          <span className="font-display text-[12px] tracking-[0.42em] text-ink-450">{t.eyebrow}</span>
          <h1 className="m-0 font-serif text-[clamp(36px,6vw,56px)] leading-[1.08] font-light text-white">{t.heading}</h1>
          <p className="m-0 text-[14px] text-ink-450">{interpolate(t.lastUpdated, { date: lastUpdated })}</p>
        </div>

        <Section title={t.s1Title}>
          <p className="m-0">
            {interpolate(t.s1Intro, {
              name: siteConfig.name,
              registered: address ? interpolate(t.s1Registered, { address }) : "",
              kvk: siteConfig.kvk ? interpolate(t.s1Kvk, { kvk: siteConfig.kvk }) : "",
            })}
            {contactLine}
            {t.s1End}
          </p>
        </Section>

        <Section title={t.s2Title}>
          <p className="m-0">{t.s2p1}</p>
          <p className="m-0">{t.s2p2}</p>
          <p className="m-0">{t.s2p3}</p>
          <p className="m-0">{t.s2p4}</p>
        </Section>

        <Section title={t.s3Title} id="cookies">
          <p className="m-0">{t.s3p1}</p>
          <CookieTable copy={dict.cookieConsent} />
          <CookieSettingsButton label={dict.cookieConsent.settingsLink} className="cursor-pointer self-start border-none bg-transparent p-0 font-sans text-[length:inherit] text-white underline underline-offset-4" />
          <p className="m-0">{t.s3p2}</p>
        </Section>

        <Section title={t.s4Title}>
          <p className="m-0">{t.s4p1}</p>
          <ul className="m-0 list-disc pl-5">
            <li>{t.s4Hosting}</li>
            <li>{t.s4Resend}</li>
            <li>{t.s4Anthropic}</li>
          </ul>
          <p className="m-0">{t.s4Google}</p>
          <p className="m-0">{t.s4p3}</p>
          <p className="m-0">{t.s4p2}</p>
        </Section>

        <Section title={t.s5Title}>
          <p className="m-0">{t.s5p1}</p>
        </Section>

        <Section title={t.s6Title}>
          <p className="m-0">
            {t.s6p1}
            {contactLine}
            {t.s6p2}
            <a href="https://autoriteitpersoonsgegevens.nl" target="_blank" rel="noopener noreferrer">
              {t.s6Link}
            </a>
            {t.s6p3}
          </p>
        </Section>

        <Section title={t.s7Title}>
          <p className="m-0">{t.s7p1}</p>
        </Section>

        <Section title={t.s8Title}>
          <p className="m-0">{t.s8p1}</p>
          <p className="m-0">{t.s8p2}</p>
          <p className="m-0">{t.s8p3}</p>
          <p className="m-0">{t.s8p4}</p>
        </Section>

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
    title: d.privacy.metaTitle,
    description: d.privacy.metaDescription,
    alternates: {
      canonical: localizedPath("/privacy", locale),
      languages: { ...Object.fromEntries(LOCALES.map((l) => [l, localizedPath("/privacy", l)])), "x-default": unprefixedPath("/privacy") },
    },
  };
}
