import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCorporateContact, listIntroductions } from "@/lib/corporate/access";
import { logout } from "@/lib/corporate/account-actions";
import { companyLookupEnabled } from "@/lib/companies/provider";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { localizedPath } from "@/lib/i18n/pathnames";
import { IntroductionPanel } from "../../_components/corporate-introduction-panel";
import { OnboardingForm } from "../../_components/corporate-onboarding-form";
import { ghostClass } from "../../_components/corporate-ui";
import { CorporateShell, PanelSkeleton, corporateMetadata } from "../../_components/corporate-shell";

/**
 * The partner's own page, behind sign-in. The sign-in is checked against the database here and again by every action
 * on the page. Without one, the visitor is sent to log in.
 */
async function Account() {
  const [locale, d, contact] = await Promise.all([currentLocale(), getDict(), getCorporateContact()]);
  if (!contact) redirect(localizedPath("/corporate-partner/login", locale));
  const t = d.corporatePartner;
  const introductions = await listIntroductions(contact.id);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Europe/Amsterdam" });

  const form = (
    <OnboardingForm
      locale={locale}
      copy={t}
      booker={{ name: contact.name, email: contact.email }}
      lookup={{ enabled: companyLookupEnabled(), copy: d.companySearch }}
      loginHref={localizedPath("/corporate-partner/login", locale)}
    />
  );

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="m-0 max-w-[620px] text-[16px] text-ink-700">{interpolate(t.accountWelcome, { name: contact.name.split(" ")[0], email: contact.email })}</p>
        <form action={logout}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className={ghostClass}>
            {t.signOut}
          </button>
        </form>
      </div>

      {/* Fixed slots, so the form keeps its place (and its confirmation) when the first introduction makes the list appear */}
      {introductions.length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="c-introductions">
          <h2 id="c-introductions" className="m-0 font-serif text-[28px] font-normal leading-[1.1] text-ink-950 md:text-[32px]">
            {t.introductionsHeading}
          </h2>
          <p className="m-0 text-[15px] text-ink-700">{t.introductionsNote}</p>
          <ul className="m-0 flex list-none flex-col gap-px border border-ink-225 bg-ink-225 p-0">
            {introductions.map((i) => (
              <li key={i.reference} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 bg-white px-5 py-4 text-[14px]">
                <span>
                  <strong className="font-semibold tracking-[0.08em]">{i.reference}</strong>
                  {i.company ? <span className="text-ink-700"> · {i.company}</span> : null}
                </span>
                <span className="text-ink-600">{interpolate(t.introductionOn, { date: date.format(i.createdAt) })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <IntroductionPanel collapsible={introductions.length > 0} summary={t.newIntroduction}>
        {form}
      </IntroductionPanel>
    </div>
  );
}

export default async function AccountPage() {
  const t = (await getDict()).corporatePartner;
  return (
    <CorporateShell route="/corporate-partner/account" heading={t.accountHeading}>
      <Suspense fallback={<PanelSkeleton />}>
        <Account />
      </Suspense>
    </CorporateShell>
  );
}

export async function generateMetadata() {
  const t = (await getDict()).corporatePartner;
  return corporateMetadata("/corporate-partner/account", t.accountMetaTitle, t.metaDescription, false);
}
