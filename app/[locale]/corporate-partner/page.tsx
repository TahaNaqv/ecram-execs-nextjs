import Link from "next/link";
import { Suspense } from "react";
import { getCorporateContact } from "@/lib/corporate/access";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { localizedPath } from "@/lib/i18n/pathnames";
import { CorporateShell, PanelSkeleton, corporateMetadata, linkButton } from "../_components/corporate-shell";

/**
 * Where "Become a Corporate Partner" leads: log in if you already have an account, sign up if you are new. Whether the
 * visitor is already signed in comes from the database (never the cookie alone) and streams in behind <Suspense>.
 */
async function Options() {
  const [locale, d, contact] = await Promise.all([currentLocale(), getDict(), getCorporateContact()]);
  const t = d.corporatePartner;

  if (contact) {
    return (
      <div className="flex max-w-[520px] flex-col items-start gap-4">
        <p className="m-0 text-[16px] text-ink-700">{interpolate(t.signedInAs, { email: contact.email })}</p>
        <Link href={localizedPath("/corporate-partner/account", locale)} className={linkButton}>
          {t.goToAccount}
        </Link>
      </div>
    );
  }

  const options = [
    { title: t.optionLoginTitle, text: t.optionLoginText, cta: t.optionLoginCta, href: localizedPath("/corporate-partner/login", locale) },
    { title: t.optionSignupTitle, text: t.optionSignupText, cta: t.optionSignupCta, href: localizedPath("/corporate-partner/signup", locale) },
  ];
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-px border border-ink-225 bg-ink-225 p-0 md:grid-cols-2">
      {options.map((o) => (
        <li key={o.href} className="flex flex-col items-start gap-5 bg-white p-8 md:p-10">
          <h2 className="m-0 font-serif text-[28px] font-normal leading-[1.1] text-ink-950 md:text-[32px]">{o.title}</h2>
          <p className="m-0 max-w-[420px] flex-1 text-[15px] text-ink-700">{o.text}</p>
          <Link href={o.href} className={linkButton}>
            {o.cta}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function CorporatePartnerPage() {
  const t = (await getDict()).corporatePartner;
  return (
    <CorporateShell route="/corporate-partner" heading={t.heading} intro={t.intro}>
      <Suspense fallback={<PanelSkeleton />}>
        <Options />
      </Suspense>
    </CorporateShell>
  );
}

export async function generateMetadata() {
  const t = (await getDict()).corporatePartner;
  return corporateMetadata("/corporate-partner", t.metaTitle, t.metaDescription, true);
}
